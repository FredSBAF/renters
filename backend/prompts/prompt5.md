Documents

Upload fichiers vers S3 (Multer + AWS SDK)

Modèle Document + CRUD

Gestion expiration par type (CRON + alertes email)

Dépôt par email (SendGrid Inbound Parse)

RENTERS — Partie 5 : Documents (Upload S3, Expiration, Watermarking)

Contexte

Tu travailles sur le backend Node.js 20 + Express + TypeScript du projet RENTERS.
La structure existante inclut :

src/models/Folder.ts (avec user_id, status, completion_percentage...)

src/models/DocumentType.ts (référentiel types documents)

src/models/User.ts

src/models/Agency.ts

src/services/FolderService.ts (avec calculateCompletion, refreshExpiry)

src/services/EmailService.ts (Brevo)

src/middlewares/auth.middleware.ts (avec requireRole)

src/utils/response.ts (successResponse / errorResponse)

src/config/env.ts (config centralisée)

src/utils/logger.ts

Ne touche PAS aux fichiers existants sauf pour y ajouter des imports/routes.
Respecte strictement le pattern déjà en place.

Variables d'environnement à ajouter dans .env.example et config/env.ts

# == AWS S3 ==
AWS_ACCESS_KEY_ID=change_me
AWS_SECRET_ACCESS_KEY=change_me
AWS_REGION=eu-west-3
AWS_S3_BUCKET=renters-documents-dev

# == UPLOAD ==
MAX_FILE_SIZE_MB=5
ALLOWED_MIME_TYPES=application/pdf,image/jpeg,image/png

Ajouter dans src/config/env.ts dans le schéma Joi existant :

AWS_ACCESS_KEY_ID: Joi.string().required(),
AWS_SECRET_ACCESS_KEY: Joi.string().required(),
AWS_REGION: Joi.string().default('eu-west-3'),
AWS_S3_BUCKET: Joi.string().required(),
MAX_FILE_SIZE_MB: Joi.number().default(5),
ALLOWED_MIME_TYPES: Joi.string().default('application/pdf,image/jpeg,image/png'),

// Dans l'objet config exporté :
aws: {
  accessKeyId: value.AWS_ACCESS_KEY_ID,
  secretAccessKey: value.AWS_SECRET_ACCESS_KEY,
  region: value.AWS_REGION,
  s3Bucket: value.AWS_S3_BUCKET,
},
upload: {
  maxFileSizeMb: value.MAX_FILE_SIZE_MB,
  allowedMimeTypes: value.ALLOWED_MIME_TYPES.split(','),
},

Ce qu'il faut créer

1. src/models/Document.ts

// Champs :
// id: INT UNSIGNED AUTO_INCREMENT PK
// folder_id: INT UNSIGNED NOT NULL (FK folders, CASCADE DELETE)
// document_type: VARCHAR(50) NOT NULL
//   — correspond à DocumentType.code
//   — ex: 'identity_card', 'payslip'...
//
// -- Fichier --
// file_path: VARCHAR(500) NOT NULL  — clé S3 ex: users/123/documents/uuid.pdf
// file_name: VARCHAR(255) NOT NULL  — nom original uploadé par user
// file_size: INT UNSIGNED           — taille en bytes
// mime_type: VARCHAR(100)           — 'application/pdf', 'image/jpeg', 'image/png'
//
// -- Extraction IA (null jusqu'à analyse) --
// extracted_text: TEXT NULLABLE     — résultat OCR brut
// extracted_data: JSON NULLABLE     — données structurées extraites
//   ex: { name, date_of_birth, nir, siret, net_salary, period... }
//
// -- Validité --
// status: ENUM('pending_analysis', 'valid', 'invalid', 'expired', 'attention')
//   DEFAULT 'pending_analysis'
// issued_at: DATE NULLABLE          — date d'émission du document
// expires_at: DATE NULLABLE         — date d'expiration du document
//   (calculée depuis issued_at + DocumentType.validity_months si applicable)
//
// -- Analyse IA (null jusqu'à analyse) --
// ai_score: INT NULLABLE
// ai_warnings: JSON NULLABLE        — [{type, message, severity}]
// ai_metadata: JSON NULLABLE        — métadonnées PDF (creation_date, producer...)
//
// -- Commentaire locataire --
// comment: TEXT NULLABLE
//
// -- Timestamps --
// created_at, updated_at, deleted_at (soft delete)
//
// Index sur : folder_id, document_type, status, expires_at, deleted_at

2. src/models/AuditLog.ts

Traçabilité complète de toutes les actions sensibles.

// Champs :
// id: BIGINT UNSIGNED AUTO_INCREMENT PK
// user_id: INT UNSIGNED NULLABLE (FK users, SET NULL on delete)
// agency_id: INT UNSIGNED NULLABLE (FK agencies, SET NULL on delete)
// ip_address: VARCHAR(45) NULLABLE
// action: VARCHAR(100) NOT NULL
//   — ex: 'document.uploaded', 'document.downloaded', 'folder.shared'...
// entity_type: VARCHAR(50) NULLABLE — 'folder', 'document', 'user'...
// entity_id: INT UNSIGNED NULLABLE
// details: JSON NULLABLE            — infos supplémentaires contextuelles
// created_at: DATETIME DEFAULT NOW
//
// Index sur : user_id, agency_id, action, entity_type, created_at

3. Migrations Sequelize

src/migrations/XXX-create-documents.ts

// up() :
// - createTable 'documents' avec tous les champs
// - FK folder_id → folders (CASCADE DELETE)
// - INDEX sur folder_id, document_type, status, expires_at, deleted_at
// down() : dropTable

src/migrations/XXX-create-audit-logs.ts

// up() :
// - createTable 'audit_logs' avec tous les champs
// - FK user_id → users (SET NULL on delete)
// - FK agency_id → agencies (SET NULL on delete)
// - INDEX sur user_id, agency_id, action, created_at
// down() : dropTable

4. src/services/S3Service.ts

Toute la logique AWS S3 centralisée ici.

import { S3Client, PutObjectCommand, GetObjectCommand,
         DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env';

const s3Client = new S3Client({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
});

class S3Service {

  // uploadFile(params) : Promise<string>
  // params: { buffer: Buffer, mimeType: string, userId: number, originalName: string }
  // - Génère clé S3 : users/{userId}/documents/{uuid}.{ext}
  //   (ext déduit du mimeType : pdf → pdf, jpeg → jpg, png → png)
  // - Upload via PutObjectCommand :
  //   { Bucket, Key, Body: buffer, ContentType: mimeType,
  //     ServerSideEncryption: 'AES256' }
  // - Retourne la clé S3 (pas l'URL complète)

  // getPresignedUrl(fileKey: string, expiresInSeconds = 3600) : Promise<string>
  // - Génère une URL présignée temporaire pour accès direct S3
  // - Utilisée pour le téléchargement locataire (accès à son propre fichier)
  // - Via getSignedUrl + GetObjectCommand

  // getFileBuffer(fileKey: string) : Promise<Buffer>
  // - Télécharge le fichier depuis S3 en mémoire
  // - Via GetObjectCommand + stream to buffer
  // - Utilisé pour watermarking avant envoi agence

  // deleteFile(fileKey: string) : Promise<void>
  // - Supprime le fichier via DeleteObjectCommand
  // - Logger la suppression

  // buildS3Key(userId: number, originalName: string) : string
  // - Méthode utilitaire privée
  // - Format : users/{userId}/documents/{uuidv4()}.{ext}
}

5. src/services/WatermarkService.ts

Watermarking visible + stéganographie invisible sur les documents.

// DÉPENDANCES À INSTALLER :
// npm install pdf-lib sharp jimp

import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import sharp from 'sharp';
import { config } from '../config/env';

class WatermarkService {

  // watermarkDocument(params) : Promise<Buffer>
  // params: {
  //   fileBuffer: Buffer,
  //   mimeType: string,
  //   agencyName: string,
  //   agencyId: number,
  //   userId: number,
  //   documentId: number,
  //   timestamp: Date
  // }
  // - Si mimeType = 'application/pdf' → appelle watermarkPdf()
  // - Si mimeType = 'image/jpeg' | 'image/png' → appelle watermarkImage()
  // - Retourne buffer watermarké

  // watermarkPdf(buffer, watermarkData) : Promise<Buffer> — PRIVÉ
  // Watermark VISIBLE :
  // - Charger PDF avec pdf-lib : PDFDocument.load(buffer)
  // - Pour chaque page :
  //   1. Ajouter texte watermark en bas de page (opacity 0.4, gris) :
  //      "Consulté par {agencyName} le {date} - Réf: WM-{shortId}"
  //      Font: Helvetica, size: 9, color: rgb(0.5, 0.5, 0.5)
  //      Position: x=30, y=20
  //   2. Ajouter texte diagonal en filigrane (opacity 0.08) :
  //      "RENTERS - {agencyName}"
  //      rotation: 45 degrés, size: 40, centré sur la page
  // Stéganographie INVISIBLE dans les métadonnées PDF :
  // - pdfDoc.setSubject(JSON.stringify({
  //     agency_id: agencyId,
  //     user_id: userId,
  //     document_id: documentId,
  //     timestamp: timestamp.toISOString(),
  //     wm_version: '1'
  //   }))
  // - pdfDoc.setKeywords([`agency:${agencyId}`, `doc:${documentId}`])
  // - Retourner await pdfDoc.save() as Buffer

  // watermarkImage(buffer, mimeType, watermarkData) : Promise<Buffer> — PRIVÉ
  // Watermark VISIBLE avec sharp :
  // - Créer un SVG overlay avec le texte watermark :
  //   <svg>
  //     <text opacity="0.4" fill="gray" font-size="14">
  //       Consulté par {agencyName} le {date}
  //     </text>
  //   </svg>
  // - Composite sur l'image originale (position: bottom-left, gravity: south)
  // Stéganographie INVISIBLE via LSB (Least Significant Bit) :
  // - Encoder les métadonnées dans les bits de poids faible des pixels
  //   en utilisant sharp pour accéder aux raw pixels :
  //   const { data, info } = await sharp(buffer).raw().toBuffer({ resolveWithObject: true })
  //   Encoder message JSON dans les premiers N pixels (LSB du canal rouge)
  //   Message : JSON.stringify({ agency_id, user_id, document_id, timestamp })
  // - Reconstruire l'image depuis les raw pixels modifiés
  // - Retourner en format original (jpeg ou png)

  // extractSteganography(buffer: Buffer, mimeType: string) : Promise<object | null>
  // - Méthode inverse pour vérification/forensique
  // - Pour PDF : lire pdfDoc.getSubject()
  // - Pour images : décoder LSB des premiers pixels
  // - Retourner les métadonnées cachées ou null si non trouvé
}

6. src/services/DocumentService.ts

class DocumentService {

  // uploadDocument(params) : Promise<Document>
  // params: {
  //   folderId: number,
  //   userId: number,
  //   documentType: string,
  //   fileBuffer: Buffer,
  //   originalName: string,
  //   mimeType: string,
  //   fileSize: number,
  //   comment?: string
  // }
  // - Vérifie que folderId appartient bien à userId
  // - Vérifie que documentType existe dans DocumentType (findOne by code)
  // - Si document du même type existe déjà (non supprimé) :
  //   → soft delete l'ancien (deleted_at = NOW()) + supprimer ancien fichier S3
  // - Upload fichier via S3Service.uploadFile()
  // - Calculer expires_at si DocumentType.validity_months non null :
  //   expires_at = today + validity_months
  //   (stocké en BDD sur le document, pas la date légale CNI — celle-ci sera
  //    extraite par l'IA plus tard)
  // - Créer entrée Document en BDD (status: 'pending_analysis')
  // - Appeler FolderService.refreshExpiry(folderId)
  // - Appeler FolderService.calculateCompletion(folderId, tenantProfile)
  // - Logger dans AuditLog : action 'document.uploaded'
  // - Retourner le document créé

  // downloadDocumentForTenant(documentId, userId) : Promise<string>
  // - Vérifie que le document appartient au dossier du userId
  // - Génère presigned URL S3 (expire 1h)
  // - Logger dans AuditLog : action 'document.downloaded.tenant'
  // - Retourne presigned URL

  // downloadDocumentForAgency(documentId, agencyId, agencyName, agentUserId)
  //   : Promise<Buffer>
  // - Vérifie que l'agence a accès au dossier contenant ce document
  //   (via table sharing_links — sera implémenté Partie 6,
  //    pour l'instant vérifier juste que l'agence est active)
  // - Récupère buffer fichier via S3Service.getFileBuffer()
  // - Applique watermark via WatermarkService.watermarkDocument()
  // - Logger dans AuditLog :
  //   action 'document.downloaded.agency',
  //   details: { agency_id, document_id, watermark_ref }
  // - Retourne buffer watermarké

  // deleteDocument(documentId, userId) : Promise<void>
  // - Vérifie ownership
  // - Soft delete en BDD (deleted_at = NOW())
  // - Suppression fichier S3 (async, ne pas bloquer la réponse)
  // - Recalculer complétion dossier
  // - Logger dans AuditLog : action 'document.deleted'

  // getDocuments(folderId, userId) : Promise<Document[]>
  // - Vérifie ownership du folder
  // - Retourne tous les documents non supprimés
  // - Triés par document_type, puis created_at DESC
  // - N'inclut PAS file_path (clé S3 privée)

  // getDocumentById(documentId, userId) : Promise<Document>
  // - Vérifie ownership
  // - Retourne document ou 404

  // updateDocumentComment(documentId, userId, comment) : Promise<Document>
  // - Vérifie ownership
  // - Met à jour document.comment
  // - Retourne document mis à jour
}

7. src/jobs/documentExpiry.job.ts

CRON quotidien à 3h du matin pour gérer l'expiration des documents.

import cron from 'node-cron';
import { Op } from 'sequelize';

// Planification : '0 3 * * *'
//
// ÉTAPE 1 — Alertes pré-expiration (7 jours avant)
// - Chercher documents WHERE :
//   deleted_at IS NULL
//   AND status NOT IN ('expired')
//   AND expires_at BETWEEN NOW() AND NOW() + 7 jours
// - Pour chaque document :
//   - Récupérer folder → user → email
//   - Envoyer email via EmailService.sendDocumentExpiringSoon(
//       email, documentType.label_fr, daysUntilExpiry
//     )
//   - Logger action
//
// ÉTAPE 2 — Expiration effective
// - Chercher documents WHERE :
//   deleted_at IS NULL
//   AND status != 'expired'
//   AND expires_at < NOW()
// - Pour chaque document :
//   - Mettre à jour status = 'expired'
//   - Supprimer fichier S3 via S3Service.deleteFile()
//   - Soft delete en BDD (deleted_at = NOW())
//   - Envoyer email via EmailService.sendDocumentExpired(
//       email, documentType.label_fr
//     )
//   - Recalculer complétion dossier via FolderService.calculateCompletion()
//   - Logger action
//
// ÉTAPE 3 — Logger récapitulatif
// - Logger : { alerts_sent, documents_expired, errors }

Ajouter dans src/services/EmailService.ts (sans toucher à l'existant) :

// sendDocumentExpiringSoon(email, documentLabel, daysLeft) : Promise<void>
// Objet : "Votre {documentLabel} expire dans {daysLeft} jours"
// Corps : rappel + CTA vers /dashboard

// sendDocumentExpired(email, documentLabel) : Promise<void>
// Objet : "Votre {documentLabel} a expiré et a été supprimé"
// Corps : informer + CTA pour uploader nouveau document

Brancher dans src/server.ts :

import './jobs/documentExpiry.job';

8. src/validators/document.validator.ts

// uploadDocumentSchema (multipart — valider les fields texte) :
// - document_type: string, required
//   (validation que le code existe en BDD se fait dans le service)
// - comment: string, optional, max 500

// updateCommentSchema :
// - comment: string, required, max 500

9. src/controllers/DocumentController.ts

class DocumentController {

  // upload(req, res) :
  // POST /api/v1/documents/upload (AUTH: tenant)
  // Content-Type: multipart/form-data
  // - Vérifier présence fichier (req.file from Multer)
  // - Vérifier taille ≤ MAX_FILE_SIZE_MB
  // - Vérifier mimeType dans ALLOWED_MIME_TYPES
  // - Valider fields texte avec uploadDocumentSchema
  // - Récupérer folder du user (FolderService.getOrCreateFolder)
  // - Appeler DocumentService.uploadDocument()
  // - Retourner 201 avec document créé
  // - Message: "Document uploadé, analyse en cours..."

  // getDocuments(req, res) :
  // GET /api/v1/documents (AUTH: tenant)
  // - Récupère folder du user connecté
  // - Appelle DocumentService.getDocuments(folder.id, req.user.id)
  // - Retourne 200 avec liste documents

  // getDocument(req, res) :
  // GET /api/v1/documents/:id (AUTH: tenant)
  // - Appelle DocumentService.getDocumentById(params.id, req.user.id)
  // - Retourne 200 avec document

  // downloadTenant(req, res) :
  // GET /api/v1/documents/:id/download (AUTH: tenant)
  // - Appelle DocumentService.downloadDocumentForTenant(params.id, req.user.id)
  // - Retourne 200 avec { download_url: presignedUrl }

  // downloadAgency(req, res) :
  // GET /api/v1/documents/:id/download-agency (AUTH: agency_owner | agency_agent)
  // - Appelle DocumentService.downloadDocumentForAgency(
  //     params.id,
  //     req.user.agencyId,
  //     agencyName,  // récupérer depuis Agency model
  //     req.user.id
  //   )
  // - Set headers :
  //   Content-Type: document.mime_type
  //   Content-Disposition: attachment; filename="{original_name}_watermarked.pdf"
  // - Retourne 200 avec buffer en stream

  // deleteDocument(req, res) :
  // DELETE /api/v1/documents/:id (AUTH: tenant)
  // - Appelle DocumentService.deleteDocument(params.id, req.user.id)
  // - Retourne 204

  // updateComment(req, res) :
  // PATCH /api/v1/documents/:id/comment (AUTH: tenant)
  // - Valide body avec updateCommentSchema
  // - Appelle DocumentService.updateDocumentComment(params.id, req.user.id, body.comment)
  // - Retourne 200 avec document mis à jour
}

10. src/middlewares/upload.middleware.ts

Configuration Multer pour upload en mémoire (pas sur disque).

import multer from 'multer';
import { config } from '../config/env';

// Storage : memoryStorage() — fichier en mémoire (Buffer), pas sur disque
// Limits : fileSize = config.upload.maxFileSizeMb * 1024 * 1024
// FileFilter : vérifier mimetype dans config.upload.allowedMimeTypes
//   Si type non autorisé → cb(new Error('FORMAT_NOT_SUPPORTED'), false)

export const uploadMiddleware = multer({ storage, limits, fileFilter }).single('file');

// Middleware wrapper pour gérer les erreurs Multer proprement :
export const handleUpload = (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return errorResponse(res, 'Fichier trop volumineux (max 5 Mo)', ['FILE_TOO_LARGE'], 400);
      }
      return errorResponse(res, err.message, ['UPLOAD_ERROR'], 400);
    }
    if (err) {
      return errorResponse(res, 'Format non supporté (PDF, JPG, PNG)', ['FORMAT_NOT_SUPPORTED'], 400);
    }
    next();
  });
};

11. src/routes/document.routes.ts

// Routes :
// POST   /upload              → handleUpload, DocumentController.upload (auth: tenant)
// GET    /                    → DocumentController.getDocuments (auth: tenant)
// GET    /:id                 → DocumentController.getDocument (auth: tenant)
// GET    /:id/download        → DocumentController.downloadTenant (auth: tenant)
// GET    /:id/download-agency → DocumentController.downloadAgency
//                               (auth: agency_owner | agency_agent)
// DELETE /:id                 → DocumentController.deleteDocument (auth: tenant)
// PATCH  /:id/comment         → DocumentController.updateComment (auth: tenant)

12. Brancher dans src/routes/index.ts

import documentRouter from './document.routes';
app.use('/api/v1/documents', documentRouter);

13. Mettre à jour src/models/index.ts

Ajouter les associations manquantes :

// Document.belongsTo(Folder, { foreignKey: 'folder_id', as: 'folder' })
// Folder.hasMany(Document, { foreignKey: 'folder_id', as: 'documents' })
// Document.belongsTo(DocumentType, { foreignKey: 'document_type', targetKey: 'code', as: 'type' })
// AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' })
// AuditLog.belongsTo(Agency, { foreignKey: 'agency_id', as: 'agency' })

Tests à écrire

src/tests/document.test.ts

describe('POST /api/v1/documents/upload', () => {
  test('should upload PDF and create document entry', async () => {
    // Mock S3Service.uploadFile → retourne clé S3 fictive
    // Auth tenant avec folder existant
    // Upload fichier PDF test (fixtures/test.pdf)
    // Vérifie 201 + document.status = 'pending_analysis'
    // Vérifie document créé en BDD
    // Vérifie FolderService.calculateCompletion appelé
  });

  test('should replace existing document of same type', async () => {
    // Upload 2x le même document_type
    // Vérifie que l'ancien est soft deleted
    // Vérifie qu'un seul document actif de ce type en BDD
  });

  test('should reject file > 5MB', async () => {
    // Buffer de 6MB
    // Vérifie 400 + FILE_TOO_LARGE
  });

  test('should reject unsupported format', async () => {
    // Fichier .docx
    // Vérifie 400 + FORMAT_NOT_SUPPORTED
  });

  test('should reject if not tenant role', async () => {
    // Auth agency_owner
    // Vérifie 403
  });
});

describe('GET /api/v1/documents/:id/download', () => {
  test('should return presigned URL for tenant', async () => {
    // Mock S3Service.getPresignedUrl
    // Vérifie 200 + download_url présent
  });

  test('should reject if document belongs to another user', async () => {
    // Auth tenant différent
    // Vérifie 403 ou 404
  });
});

describe('GET /api/v1/documents/:id/download-agency', () => {
  test('should return watermarked buffer for agency', async () => {
    // Mock S3Service.getFileBuffer + WatermarkService.watermarkDocument
    // Auth agency_owner
    // Vérifie 200 + Content-Type header correct
    // Vérifie AuditLog créé avec action 'document.downloaded.agency'
  });
});

describe('DELETE /api/v1/documents/:id', () => {
  test('should soft delete document', async () => {
    // Vérifie 204
    // Vérifie deleted_at IS NOT NULL en BDD
    // Vérifie S3Service.deleteFile appelé
  });
});

describe('WatermarkService', () => {
  test('should add visible watermark to PDF', async () => {
    // Charger PDF test depuis fixtures/
    // Appeler watermarkDocument()
    // Vérifie que buffer retourné est un PDF valide
    // Vérifie taille buffer > original (watermark ajouté)
  });

  test('should embed steganography metadata in PDF', async () => {
    // Appeler watermarkDocument() avec agencyId=10
    // Appeler extractSteganography() sur le résultat
    // Vérifie que agency_id = 10 est récupéré
  });

  test('should watermark JPEG image', async () => {
    // Charger image test depuis fixtures/
    // Vérifie buffer retourné valide
  });
});

describe('documentExpiry CRON job', () => {
  test('should mark expired documents and send email', async () => {
    // Créer document avec expires_at = yesterday
    // Appeler manuellement la fonction du cron
    // Vérifie document.status = 'expired'
    // Vérifie EmailService.sendDocumentExpired appelé
    // Vérifie S3Service.deleteFile appelé
  });

  test('should send warning email 7 days before expiry', async () => {
    // Document expires_at = NOW + 5 jours
    // Vérifie EmailService.sendDocumentExpiringSoon appelé
  });
});

Fichiers de test fixtures à créer

src/tests/fixtures/ ├── test.pdf — petit PDF valide (générer avec pdf-lib dans setup.ts) ├── test.jpg — petite image JPEG valide └── test.png — petite image PNG valide

Ajouter dans src/tests/setup.ts la génération des fixtures si elles n'existent pas.

Règles importantes à respecter

Installer les packages : npm install pdf-lib sharp jimp multer @types/multer

Toutes les réponses utilisent successResponse / errorResponse

Toute config passe par config de src/config/env.ts

Logger Winston pour tous les events importants

Soft delete sur les documents (deleted_at) — jamais hard delete immédiat

Ne jamais retourner file_path (clé S3) dans les réponses API

Le watermarking se fait TOUJOURS côté serveur, jamais côté client

Multer en memoryStorage (pas de fichiers temporaires sur disque)

Les presigned URLs expirent après 1h

Le CRON documentExpiry doit être idempotent
(relancer 2x ne doit pas envoyer 2x l'email)
→ Ajouter un champ expiry_notified_at: DATETIME NULLABLE sur Document
→ Ne pas renvoyer l'alerte si expiry_notified_at IS NOT NULL

