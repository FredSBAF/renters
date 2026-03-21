import { Agency, AuditLog, Document, DocumentType, Folder, User } from '../models';
import { FolderService } from './FolderService';
import { S3Service } from './S3Service';
import { WatermarkService } from './WatermarkService';
import { AIService } from './AIService';
import { NotificationService } from './NotificationService';
import { logger } from '../utils/logger';

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export class DocumentService {
  static async uploadDocument(params: {
    folderId: number;
    userId: number;
    documentType: string;
    fileBuffer: Buffer;
    originalName: string;
    mimeType: string;
    fileSize: number;
    comment?: string;
    ipAddress?: string;
  }): Promise<Document> {
    const folder = await Folder.findByPk(params.folderId);
    if (!folder || folder.user_id !== params.userId || folder.deleted_at) {
      throw new Error('FORBIDDEN');
    }

    const type = await DocumentType.findOne({ where: { code: params.documentType } });
    if (!type) throw new Error('DOCUMENT_TYPE_NOT_FOUND');

    const existing = await Document.findOne({
      where: {
        folder_id: params.folderId,
        document_type: params.documentType,
      },
    });
    if (existing && !existing.deleted_at) {
      await existing.update({ deleted_at: new Date() });
      void Promise.resolve(S3Service.deleteFile(existing.file_path)).catch(() => undefined);
    }

    const filePath = await S3Service.uploadFile({
      buffer: params.fileBuffer,
      mimeType: params.mimeType,
      userId: params.userId,
      originalName: params.originalName,
    });

    const expiresAt =
      type.validity_months === null ? null : addMonths(new Date(), type.validity_months);

    const document = await Document.create({
      folder_id: params.folderId,
      document_type: params.documentType,
      file_path: filePath,
      file_name: params.originalName,
      file_size: params.fileSize,
      mime_type: params.mimeType,
      status: 'pending_analysis',
      expires_at: expiresAt ? expiresAt.toISOString().slice(0, 10) : null,
      comment: params.comment ?? null,
    });

    await FolderService.refreshExpiry(params.folderId);
    const user = await User.findByPk(params.userId);
    if (user?.tenant_profile) {
      await FolderService.calculateCompletion(params.folderId, user.tenant_profile);
      const refreshed = await Folder.findByPk(params.folderId);
      if (refreshed?.completion_percentage === 100) {
        try {
          await NotificationService.notifyFolderComplete(params.userId);
        } catch (err) {
          logger.error('Notification failed', { err });
        }
      }
    }

    void AIService.triggerAnalysis(folder.id);

    await AuditLog.create({
      user_id: params.userId,
      ip_address: params.ipAddress ?? null,
      action: 'document.uploaded',
      entity_type: 'document',
      entity_id: document.id,
      details: { document_type: params.documentType } as unknown as object,
    });

    return document;
  }

  static async downloadDocumentForTenant(documentId: number, userId: number): Promise<string> {
    const document = await DocumentService.getDocumentById(documentId, userId, true);
    await AuditLog.create({
      user_id: userId,
      action: 'document.downloaded.tenant',
      entity_type: 'document',
      entity_id: document.id,
    });
    return S3Service.getPresignedUrl(document.file_path, 3600);
  }

  static async downloadDocumentForAgency(
    documentId: number,
    agencyId: number,
    agencyName: string,
    agentUserId: number,
    linkId?: string
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const agency = await Agency.findByPk(agencyId);
    if (!agency || agency.status !== 'active') {
      throw new Error('FORBIDDEN');
    }

    const document = await Document.findByPk(documentId);
    if (!document || document.deleted_at) throw new Error('DOCUMENT_NOT_FOUND');
    const folder = await Folder.findByPk(document.folder_id);
    if (!folder || folder.deleted_at) throw new Error('DOCUMENT_NOT_FOUND');

    const fileBuffer = await S3Service.getFileBuffer(document.file_path);
    const watermarked = await WatermarkService.watermarkDocument({
      fileBuffer,
      mimeType: document.mime_type,
      agencyName,
      agencyId,
      userId: folder.user_id,
      documentId: document.id,
      timestamp: new Date(),
      linkId,
    });

    await AuditLog.create({
      user_id: agentUserId,
      agency_id: agencyId,
      action: 'document.downloaded.agency',
      entity_type: 'document',
      entity_id: document.id,
      details: { watermark_ref: `WM-${document.id}-${agencyId}`, link_id: linkId ?? null } as unknown as object,
    });

    return { buffer: watermarked, mimeType: document.mime_type, fileName: document.file_name };
  }

  static async deleteDocument(documentId: number, userId: number): Promise<void> {
    const document = await DocumentService.getDocumentById(documentId, userId, true);
    await document.update({ deleted_at: new Date() });
    void Promise.resolve(S3Service.deleteFile(document.file_path)).catch(() => undefined);

    const folder = await Folder.findByPk(document.folder_id);
    const user = await User.findByPk(userId);
    if (folder && user?.tenant_profile) {
      await FolderService.calculateCompletion(folder.id, user.tenant_profile);
    }

    await AuditLog.create({
      user_id: userId,
      action: 'document.deleted',
      entity_type: 'document',
      entity_id: document.id,
    });
  }

  static async getDocuments(folderId: number, userId: number): Promise<Array<Record<string, unknown>>> {
    const folder = await Folder.findByPk(folderId);
    if (!folder || folder.user_id !== userId || folder.deleted_at) throw new Error('FORBIDDEN');
    const docs = await Document.findAll({
      where: { folder_id: folderId },
      order: [['document_type', 'ASC'], ['created_at', 'DESC']],
    });
    return docs.map((d) => {
      const j = d.toJSON() as Record<string, unknown>;
      delete j.file_path;
      return j;
    });
  }

  static async getDocumentById(
    documentId: number,
    userId: number,
    includePrivate = false
  ): Promise<Document> {
    const document = await Document.findByPk(documentId);
    if (!document || document.deleted_at) throw new Error('DOCUMENT_NOT_FOUND');
    const folder = await Folder.findByPk(document.folder_id);
    if (!folder || folder.user_id !== userId || folder.deleted_at) throw new Error('FORBIDDEN');
    if (!includePrivate) {
      (document as unknown as { file_path?: string }).file_path = undefined;
    }
    return document;
  }

  static async updateDocumentComment(
    documentId: number,
    userId: number,
    comment: string
  ): Promise<Document> {
    const document = await DocumentService.getDocumentById(documentId, userId, true);
    await document.update({ comment });
    return document;
  }
}
