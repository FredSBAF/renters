import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env';
import { Agency, AuditLog, Folder, SharingLink, SharingView } from '../models';
import { FolderService } from './FolderService';
import { NotificationService } from './NotificationService';
import { logger } from '../utils/logger';

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export class SharingService {
  static async createSharingLink(params: {
    folderId: number;
    userId: number;
    context?: object;
  }): Promise<SharingLink & { url: string }> {
    const folder = await Folder.findByPk(params.folderId);
    if (!folder || folder.user_id !== params.userId) throw new Error('FORBIDDEN');
    if (folder.folder_status !== 'active') throw new Error('FOLDER_NOT_ACTIVE');

    const link = await SharingLink.create({
      id: uuidv4(),
      folder_id: params.folderId,
      context: params.context ?? null,
      expires_at: addDays(new Date(), config.sharing.expiryDays),
    });

    await AuditLog.create({
      user_id: params.userId,
      action: 'folder.shared',
      entity_type: 'sharing_link',
      entity_id: null,
      details: { link_id: link.id } as unknown as object,
    });

    return Object.assign(link, { url: `${config.sharing.baseLinkUrl}/${link.id}` });
  }

  static async getSharingLinks(userId: number): Promise<Array<Record<string, unknown>>> {
    const folder = await Folder.findOne({ where: { user_id: userId } });
    if (!folder) return [];
    const links = await SharingLink.findAll({
      where: { folder_id: folder.id },
      order: [['created_at', 'DESC']],
    });
    const now = Date.now();
    return links.map((l) => {
      const j = l.toJSON() as Record<string, unknown>;
      const revoked = Boolean(j.revoked_at);
      const expired = new Date(String(j.expires_at)).getTime() < now;
      return {
        ...j,
        is_active: !revoked && !expired,
        url: `${config.sharing.baseLinkUrl}/${l.id}`,
      };
    });
  }

  static async revokeSharingLink(linkId: string, userId: number): Promise<void> {
    const link = await SharingLink.findByPk(linkId);
    if (!link) throw new Error('LINK_NOT_FOUND');
    const folder = await Folder.findByPk(link.folder_id);
    if (!folder || folder.user_id !== userId) throw new Error('FORBIDDEN');
    if (link.revoked_at) throw new Error('ALREADY_REVOKED');
    await link.update({ revoked_at: new Date() });
    await AuditLog.create({
      user_id: userId,
      action: 'sharing_link.revoked',
      entity_type: 'sharing_link',
      details: { link_id: linkId } as unknown as object,
    });
  }

  static async extendSharingLink(linkId: string, userId: number): Promise<SharingLink> {
    const link = await SharingLink.findByPk(linkId);
    if (!link) throw new Error('LINK_NOT_FOUND');
    const folder = await Folder.findByPk(link.folder_id);
    if (!folder || folder.user_id !== userId) throw new Error('FORBIDDEN');
    if (link.revoked_at) throw new Error('ALREADY_REVOKED');
    const next = addDays(new Date(link.expires_at), 30);
    await link.update({ expires_at: next });
    return link;
  }

  static async consultFolder(params: {
    linkId: string;
    requestingAgencyId?: number;
    viewerEmail?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ folder: Record<string, unknown>; accessLevel: 'limited' | 'full'; linkId: string }> {
    const link = await SharingLink.findByPk(params.linkId);
    if (!link) throw new Error('LINK_NOT_FOUND');
    if (link.revoked_at) throw new Error('LINK_GONE');
    if (new Date(link.expires_at).getTime() < Date.now()) throw new Error('LINK_GONE');

    let accessLevel: 'limited' | 'full' = 'limited';
    if (params.requestingAgencyId) {
      const agency = await Agency.findByPk(params.requestingAgencyId);
      if (agency && (agency.status === 'active' || agency.status === 'trial')) {
        accessLevel = 'full';
      }
    }

    await SharingView.create({
      sharing_link_id: params.linkId,
      agency_id: params.requestingAgencyId ?? null,
      viewer_email: params.viewerEmail ?? null,
      ip_address: params.ipAddress ?? null,
      user_agent: params.userAgent ?? null,
      access_level: accessLevel,
    });

    await SharingLink.increment('views_count', { by: 1, where: { id: params.linkId } });
    await link.update({ last_viewed_at: new Date() });

    const folderData = await FolderService.getFolderForSharing(link.folder_id, accessLevel);
    await AuditLog.create({
      agency_id: params.requestingAgencyId ?? null,
      action: 'folder.viewed',
      entity_type: 'sharing_link',
      details: {
        link_id: params.linkId,
        access_level: accessLevel,
        agency_id: params.requestingAgencyId ?? null,
      } as unknown as object,
    });
    if (accessLevel === 'full') {
      try {
        const folder = await Folder.findByPk(link.folder_id);
        const agency = params.requestingAgencyId ? await Agency.findByPk(params.requestingAgencyId) : null;
        if (folder) {
          await NotificationService.notifyFolderViewed(
            folder.user_id,
            agency?.name ?? 'Une agence',
            params.linkId
          );
        }
      } catch (err) {
        logger.error('Notification failed', { err });
      }
    }

    return { folder: folderData, accessLevel, linkId: params.linkId };
  }

  static async trackDocumentDownload(params: {
    linkId: string;
    documentId: number;
    agencyId: number;
  }): Promise<void> {
    const view = await SharingView.findOne({
      where: { sharing_link_id: params.linkId, agency_id: params.agencyId },
      order: [['viewed_at', 'DESC']],
    });
    if (!view) throw new Error('VIEW_NOT_FOUND');
    const current = Array.isArray(view.documents_downloaded) ? view.documents_downloaded : [];
    if (!current.includes(params.documentId)) {
      current.push(params.documentId);
      await view.update({ documents_downloaded: current });
    }
    await AuditLog.create({
      agency_id: params.agencyId,
      action: 'document.downloaded.via_link',
      entity_type: 'sharing_link',
      details: { link_id: params.linkId, document_id: params.documentId } as unknown as object,
    });
    try {
      const link = await SharingLink.findByPk(params.linkId);
      if (link) {
        const folder = await Folder.findByPk(link.folder_id);
        const agency = await Agency.findByPk(params.agencyId);
        if (folder) {
          await NotificationService.notifyDocumentDownloaded(
            folder.user_id,
            agency?.name ?? 'Une agence',
            [String(params.documentId)]
          );
        }
      }
    } catch (err) {
      logger.error('Notification failed', { err });
    }
  }

  static async getSharingHistory(userId: number): Promise<object[]> {
    const folder = await Folder.findOne({ where: { user_id: userId } });
    if (!folder) return [];
    const links = await SharingLink.findAll({ where: { folder_id: folder.id } });
    const history: Array<Record<string, unknown>> = [];

    for (const link of links) {
      const views = await SharingView.findAll({
        where: { sharing_link_id: link.id },
        order: [['viewed_at', 'DESC']],
      });
      for (const v of views) {
        let agencyName: string | null = null;
        if (v.agency_id) {
          const agency = await Agency.findByPk(v.agency_id);
          agencyName = agency?.name ?? null;
        }
        history.push({
          link_id: link.id,
          viewed_at: v.viewed_at,
          agency_name: agencyName,
          viewer_email: v.viewer_email,
          access_level: v.access_level,
          documents_downloaded_count: Array.isArray(v.documents_downloaded)
            ? v.documents_downloaded.length
            : 0,
        });
      }
    }
    history.sort((a, b) => String(b.viewed_at).localeCompare(String(a.viewed_at)));
    return history;
  }

  static async getActiveSharingLinksForFolder(folderId: number): Promise<SharingLink[]> {
    const now = new Date();
    const all = await SharingLink.findAll({ where: { folder_id: folderId } });
    return all.filter((l) => !l.revoked_at && new Date(l.expires_at) > now);
  }
}
