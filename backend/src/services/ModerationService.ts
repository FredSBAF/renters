import { Op } from 'sequelize';
import { AuditLog, Folder, ModerationQueue, User } from '../models';
import { sendModerationAlert, sendModerationInfoRequest, sendModerationResolved } from './EmailService';

function priorityFromScore(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 60) return 'low';
  if (score >= 40) return 'medium';
  if (score >= 20) return 'high';
  return 'critical';
}

function addHours(date: Date, hours: number): Date {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

export class ModerationService {
  static async addToQueue(
    folderId: number,
    analysisResult: { globalScore: number; warnings: object[] }
  ): Promise<ModerationQueue> {
    const existing = await ModerationQueue.findOne({ where: { folder_id: folderId } });
    const priority = priorityFromScore(analysisResult.globalScore);
    const sla = addHours(new Date(), 48);
    if (existing) {
      if (existing.status === 'pending') {
        await existing.update({
          ai_score_at_submission: analysisResult.globalScore,
          motifs: analysisResult.warnings,
          priority,
          sla_deadline: sla,
          sla_breached: false,
        });
        return existing;
      }
      // resolved entries: return existing to avoid duplicate unique errors
      return existing;
    }

    const created = await ModerationQueue.create({
      folder_id: folderId,
      priority,
      ai_score_at_submission: analysisResult.globalScore,
      motifs: analysisResult.warnings,
      sla_deadline: sla,
    });

    if (priority === 'high' || priority === 'critical') {
      await sendModerationAlert('admin@renters.local', folderId, priority, analysisResult.warnings);
    }

    await AuditLog.create({
      action: 'moderation.added_to_queue',
      entity_type: 'folder',
      entity_id: folderId,
      details: { priority } as unknown as object,
    });

    return created;
  }

  static async getQueue(params: {
    status?: string;
    priority?: string;
    assignedTo?: number;
    page: number;
    limit: number;
  }): Promise<{ items: ModerationQueue[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (params.priority) where.priority = params.priority;
    if (params.assignedTo) where.assigned_to = params.assignedTo;

    const { count, rows } = await ModerationQueue.findAndCountAll({
      where,
      order: [['priority', 'DESC'], ['sla_deadline', 'ASC']],
      offset: (params.page - 1) * params.limit,
      limit: params.limit,
    });
    const now = Date.now();
    rows.forEach((i) => {
      if (new Date(i.sla_deadline).getTime() < now) {
        i.setDataValue('sla_breached', true);
      }
    });
    return { items: rows, total: count };
  }

  static async assignToAdmin(queueId: number, adminUserId: number): Promise<ModerationQueue> {
    const admin = await User.findByPk(adminUserId);
    if (!admin || admin.role !== 'admin') throw new Error('FORBIDDEN');
    const item = await ModerationQueue.findByPk(queueId);
    if (!item) throw new Error('NOT_FOUND');
    await item.update({ assigned_to: adminUserId, status: 'in_review' });
    return item;
  }

  static async resolveItem(params: {
    queueId: number;
    adminUserId: number;
    resolution: 'approved' | 'rejected' | 'fraud_confirmed';
    adminNotes?: string;
    adjustedScore?: number;
  }): Promise<ModerationQueue> {
    const admin = await User.findByPk(params.adminUserId);
    if (!admin || admin.role !== 'admin') throw new Error('FORBIDDEN');
    const item = await ModerationQueue.findByPk(params.queueId);
    if (!item) throw new Error('NOT_FOUND');
    const folder = await Folder.findByPk(item.folder_id);
    if (!folder) throw new Error('NOT_FOUND');

    await item.update({
      status: params.resolution === 'approved' ? 'validated' : 'rejected',
      resolved_at: new Date(),
      resolved_by: params.adminUserId,
      resolution: params.resolution,
      admin_notes: params.adminNotes ?? null,
      adjusted_score: params.adjustedScore ?? null,
    });

    if (params.resolution === 'approved') {
      await folder.update({
        ai_status: 'analyzed',
        status: 'verified',
        ai_score_global: params.adjustedScore ?? folder.ai_score_global,
      });
      await AuditLog.create({ action: 'moderation.approved', entity_type: 'folder', entity_id: folder.id });
    } else if (params.resolution === 'rejected') {
      await folder.update({ ai_status: 'rejected', status: 'attention' });
      await AuditLog.create({ action: 'moderation.rejected', entity_type: 'folder', entity_id: folder.id });
    } else {
      await folder.update({ ai_status: 'rejected', status: 'attention' });
      await User.update(
        { is_fraud_flagged: true } as never,
        { where: { id: folder.user_id } }
      );
      await AuditLog.create({
        action: 'moderation.fraud_confirmed',
        entity_type: 'folder',
        entity_id: folder.id,
      });
    }

    const tenant = await User.findByPk(folder.user_id);
    if (tenant) {
      await sendModerationResolved(tenant.email, params.resolution);
    }

    return item;
  }

  static async requestMoreInfo(params: {
    queueId: number;
    adminUserId: number;
    message: string;
  }): Promise<void> {
    const admin = await User.findByPk(params.adminUserId);
    if (!admin || admin.role !== 'admin') throw new Error('FORBIDDEN');
    const item = await ModerationQueue.findByPk(params.queueId);
    if (!item) throw new Error('NOT_FOUND');
    const folder = await Folder.findByPk(item.folder_id);
    if (!folder) throw new Error('NOT_FOUND');
    const tenant = await User.findByPk(folder.user_id);
    if (tenant) await sendModerationInfoRequest(tenant.email, params.message);
    await AuditLog.create({
      action: 'moderation.info_requested',
      entity_type: 'folder',
      entity_id: folder.id,
    });
  }

  static async getSLAStats(): Promise<object> {
    const pending = await ModerationQueue.count({ where: { status: 'pending' } });
    const inReview = await ModerationQueue.count({ where: { status: 'in_review' } });
    const breached = await ModerationQueue.count({ where: { sla_breached: true } });
    const byPriority = {
      low: await ModerationQueue.count({ where: { priority: 'low' } }),
      medium: await ModerationQueue.count({ where: { priority: 'medium' } }),
      high: await ModerationQueue.count({ where: { priority: 'high' } }),
      critical: await ModerationQueue.count({ where: { priority: 'critical' } }),
    };
    return {
      pending_count: pending,
      in_review_count: inReview,
      sla_breached_count: breached,
      avg_resolution_time_hours: 0,
      by_priority: byPriority,
    };
  }

  static async checkSLABreaches(): Promise<void> {
    const now = new Date();
    const items = await ModerationQueue.findAll({
      where: {
        sla_deadline: { [Op.lt]: now },
        sla_breached: false,
        status: { [Op.in]: ['pending', 'in_review'] },
      },
    });
    for (const item of items) {
      await item.update({ sla_breached: true });
      await sendModerationAlert('admin@renters.local', item.folder_id, item.priority, item.motifs);
      await AuditLog.create({
        action: 'moderation.sla_breached',
        entity_type: 'folder',
        entity_id: item.folder_id,
      });
    }
  }
}
