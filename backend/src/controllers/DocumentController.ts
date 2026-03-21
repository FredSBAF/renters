import { Request, Response } from 'express';
import { Agency, User } from '../models';
import { DocumentService } from '../services/DocumentService';
import { FolderService } from '../services/FolderService';
import { errorResponse, successResponse } from '../utils/response';
import { uploadDocumentSchema, updateCommentSchema } from '../validators/document.validator';

export class DocumentController {
  static async upload(req: Request, res: Response): Promise<Response> {
    if (!req.file) {
      return errorResponse(res, 'Fichier requis', ['FILE_REQUIRED'], 400);
    }
    const { error, value } = uploadDocumentSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return errorResponse(
        res,
        'Validation échouée',
        error.details.map((d) => d.message),
        400
      );
    }

    const folder = await FolderService.getOrCreateFolder(req.user!.id);
    try {
      const doc = await DocumentService.uploadDocument({
        folderId: folder.id,
        userId: req.user!.id,
        documentType: value.document_type,
        fileBuffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        comment: value.comment,
        ipAddress: req.ip,
      });
      const json = doc.toJSON() as Record<string, unknown>;
      delete json.file_path;
      return successResponse(res, { document: json }, 'Document uploadé, analyse en cours...', 201);
    } catch (e) {
      if (e instanceof Error && e.message === 'DOCUMENT_TYPE_NOT_FOUND') {
        return errorResponse(res, 'Type de document inconnu', [], 400);
      }
      return errorResponse(res, 'Erreur upload document', [], 500);
    }
  }

  static async getDocuments(req: Request, res: Response): Promise<Response> {
    const folder = await FolderService.getOrCreateFolder(req.user!.id);
    const docs = await DocumentService.getDocuments(folder.id, req.user!.id);
    return successResponse(res, { documents: docs }, 'Documents récupérés', 200);
  }

  static async getDocument(req: Request, res: Response): Promise<Response> {
    try {
      const doc = await DocumentService.getDocumentById(Number(req.params.id), req.user!.id);
      const json = doc.toJSON() as Record<string, unknown>;
      delete json.file_path;
      return successResponse(res, { document: json }, 'Document récupéré', 200);
    } catch {
      return errorResponse(res, 'Document introuvable', [], 404);
    }
  }

  static async downloadTenant(req: Request, res: Response): Promise<Response> {
    try {
      const url = await DocumentService.downloadDocumentForTenant(Number(req.params.id), req.user!.id);
      return successResponse(res, { download_url: url }, 'URL de téléchargement générée', 200);
    } catch {
      return errorResponse(res, 'Document introuvable', [], 404);
    }
  }

  static async downloadAgency(req: Request, res: Response): Promise<Response | void> {
    try {
      const agency = await Agency.findByPk(req.user!.agencyId!);
      if (!agency) return errorResponse(res, 'Agence introuvable', [], 404);
      const result = await DocumentService.downloadDocumentForAgency(
        Number(req.params.id),
        req.user!.agencyId!,
        agency.name,
        req.user!.id,
        typeof req.query.link_id === 'string' ? req.query.link_id : undefined
      );
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${result.fileName.replace(/\.[^.]+$/, '')}_watermarked"`
      );
      res.status(200).send(result.buffer);
      return;
    } catch (e) {
      if (e instanceof Error && e.message === 'FORBIDDEN') {
        return errorResponse(res, 'Action non autorisée', [], 403);
      }
      return errorResponse(res, 'Document introuvable', [], 404);
    }
  }

  static async deleteDocument(req: Request, res: Response): Promise<Response> {
    try {
      await DocumentService.deleteDocument(Number(req.params.id), req.user!.id);
      return res.status(204).send();
    } catch {
      return errorResponse(res, 'Document introuvable', [], 404);
    }
  }

  static async updateComment(req: Request, res: Response): Promise<Response> {
    const { error, value } = updateCommentSchema.validate(req.body, { abortEarly: false });
    if (error) {
      return errorResponse(
        res,
        'Validation échouée',
        error.details.map((d) => d.message),
        400
      );
    }
    try {
      const doc = await DocumentService.updateDocumentComment(
        Number(req.params.id),
        req.user!.id,
        value.comment
      );
      const json = doc.toJSON() as Record<string, unknown>;
      delete json.file_path;
      return successResponse(res, { document: json }, 'Commentaire mis à jour', 200);
    } catch {
      return errorResponse(res, 'Document introuvable', [], 404);
    }
  }
}
