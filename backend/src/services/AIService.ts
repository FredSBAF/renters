import axios from 'axios';
import { config } from '../config/env';
import { AuditLog, Document, Folder, User } from '../models';
import { S3Service } from './S3Service';
import { FolderService } from './FolderService';
import { ModerationService } from './ModerationService';
import { sendModerationAlert } from './EmailService';
import { NotificationService } from './NotificationService';
import { logger } from '../utils/logger';

type AIWarning = {
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  document_id?: number;
};

type AIResultPayload = {
  global_score: number;
  scores: { identity: number; income: number; stability: number; coherence: number };
  status: 'verified' | 'manual_review' | 'rejected';
  warnings: AIWarning[];
  documents: Array<{
    document_id: number;
    score: number;
    status: 'valid' | 'invalid' | 'attention';
    extracted_data: object;
    warnings: object[];
    ai_metadata: object;
  }>;
  analysis_time_ms: number;
};

export class AIService {
  static async analyzeFolder(folderId: number): Promise<void> {
    const folder = await Folder.findByPk(folderId);
    if (!folder) throw new Error('FOLDER_NOT_FOUND');
    const user = await User.findByPk(folder.user_id);
    if (!user) throw new Error('USER_NOT_FOUND');
    const docs = await Document.findAll({ where: { folder_id: folderId } });

    await folder.update({ ai_status: 'pending' });

    const payloadDocs = await Promise.all(
      docs.map(async (d) => ({
        document_id: d.id,
        document_type: d.document_type,
        file_url: await S3Service.getPresignedUrl(d.file_path, 3600),
        mime_type: d.mime_type,
      }))
    );

    try {
      const response = await axios.post<AIResultPayload>(
        `${config.ai.serviceUrl}/analyze`,
        {
          folder_id: folderId,
          tenant_profile: user.tenant_profile,
          documents: payloadDocs,
        },
        {
          headers: { 'X-Service-Secret': config.ai.secret },
          timeout: config.ai.timeoutMs,
        }
      );
      await AIService.processAnalysisResult(folderId, response.data);
    } catch (error) {
      await AIService.handleAnalysisFailure(folderId, error);
    }
  }

  static async processAnalysisResult(folderId: number, result: AIResultPayload): Promise<void> {
    for (const docResult of result.documents) {
      const document = await Document.findByPk(docResult.document_id);
      if (!document) continue;
      await document.update({
        ai_score: docResult.score,
        ai_warnings: docResult.warnings,
        ai_metadata: docResult.ai_metadata,
        extracted_data: docResult.extracted_data,
        status: docResult.status,
      });
    }

    const folder = await Folder.findByPk(folderId);
    if (!folder) return;
    const aiStatus =
      result.global_score >= config.ai.scoreAutoValidate ? 'analyzed' : 'manual_review';
    await folder.update({
      ai_score_global: result.global_score,
      ai_score_identity: result.scores.identity,
      ai_score_income: result.scores.income,
      ai_score_stability: result.scores.stability,
      ai_score_coherence: result.scores.coherence,
      ai_warnings: result.warnings,
      ai_analyzed_at: new Date(),
      ai_status: aiStatus,
      status: aiStatus === 'analyzed' ? 'verified' : 'attention',
    });

    const tenant = await User.findByPk(folder.user_id);
    if (tenant?.tenant_profile) {
      await FolderService.calculateCompletion(folderId, tenant.tenant_profile);
    }

    if (aiStatus === 'analyzed') {
      await AuditLog.create({
        action: 'folder.ai_validated',
        entity_type: 'folder',
        entity_id: folderId,
      });
      try {
        await NotificationService.notifyFolderVerified(folder.user_id, result.global_score);
      } catch (err) {
        logger.error('Notification failed', { err });
      }
    } else {
      await ModerationService.addToQueue(folderId, {
        globalScore: result.global_score,
        warnings: result.warnings,
      });
      await AuditLog.create({
        action: 'folder.ai_flagged',
        entity_type: 'folder',
        entity_id: folderId,
      });
    }

    await AuditLog.create({
      action: 'folder.ai_analyzed',
      entity_type: 'folder',
      entity_id: folderId,
      details: {
        global_score: result.global_score,
        analysis_time_ms: result.analysis_time_ms,
        status: aiStatus,
      } as unknown as object,
    });
  }

  static async handleAnalysisFailure(folderId: number, _error: unknown): Promise<void> {
    const folder = await Folder.findByPk(folderId);
    if (!folder) return;
    await folder.update({ ai_status: 'pending' });
    await ModerationService.addToQueue(folderId, {
      globalScore: config.ai.scoreManualReview - 1,
      warnings: [{ type: 'ai_service_unavailable', message: 'AI service unavailable', severity: 'high' }],
    });
    await sendModerationAlert('admin@renters.local', folderId, 'high', [
      { type: 'ai_service_unavailable' },
    ]);
  }

  static async triggerAnalysis(folderId: number): Promise<void> {
    const docs = await Document.count({ where: { folder_id: folderId } });
    if (docs === 0) return;
    const folder = await Folder.findByPk(folderId);
    if (!folder || folder.ai_status === 'pending') return;
    void AIService.analyzeFolder(folderId);
    await AuditLog.create({
      action: 'folder.analysis_triggered',
      entity_type: 'folder',
      entity_id: folderId,
    });
  }
}
