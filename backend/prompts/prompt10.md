# RENTERS — Partie 10 : Sécurité & RGPD Transversal

## Contexte
Tu travailles sur le backend Node.js 20 + Express + TypeScript du projet RENTERS.
La structure existante inclut :
- src/app.ts (avec rate limiting global déjà configuré)
- src/middlewares/auth.middleware.ts
- src/models/User.ts (avec deleted_at, status)
- src/models/Folder.ts (avec expires_at, deleted_at)
- src/models/Document.ts (avec expires_at, deleted_at)
- src/models/AuditLog.ts
- src/models/UserConsent.ts
- src/models/RefreshToken.ts
- src/services/AdminUserService.ts (avec exportUserData)
- src/services/S3Service.ts
- src/services/EmailService.ts
- src/services/NotificationService.ts
- src/jobs/documentExpiry.job.ts
- src/jobs/trialReminder.job.ts
- src/jobs/moderationSLA.job.ts
- src/utils/response.ts (successResponse / errorResponse)
- src/config/env.ts (config centralisée)
- src/utils/logger.ts

Ne touche PAS aux fichiers existants sauf pour y ajouter des imports/routes.
Respecte strictement le pattern déjà en place.

---

## Variables d'environnement à ajouter dans .env.example et config/env.ts
```env
# == RGPD ==
GDPR_FOLDER_EXPIRY_MONTHS=6
GDPR_ACCOUNT_GRACE_DAYS=30
GDPR_AUDIT_LOG_ANONYMIZE_YEARS=3
GDPR_EXPORT_LINK_EXPIRY_HOURS=24

# == RATE LIMITING (en plus du global existant) ==
RATE_LIMIT_AUTH_WINDOW_MS=900000       # 15 min
RATE_LIMIT_AUTH_MAX=5                  # 5 tentatives login
RATE_LIMIT_REGISTER_MAX=3              # 3 inscriptions / IP / 15min
RATE_LIMIT_UPLOAD_WINDOW_MS=3600000    # 1 heure
RATE_LIMIT_UPLOAD_MAX=20               # 20 uploads / heure
RATE_LIMIT_SHARING_WINDOW_MS=3600000   # 1 heure
RATE_LIMIT_SHARING_MAX=10              # 10 liens créés / heure
RATE_LIMIT_EXPORT_WINDOW_MS=86400000   # 24 heures
RATE_LIMIT_EXPORT_MAX=3                # 3 exports / 24h
RATE_LIMIT_FORGOT_PASSWORD_WINDOW_MS=3600000  # 1 heure
RATE_LIMIT_FORGOT_PASSWORD_MAX=3       # 3 demandes reset / heure
RATE_LIMIT_API_AGENCY_WINDOW_MS=60000  # 1 minute
RATE_LIMIT_API_AGENCY_MAX=60           # 60 req / min pour agences
```

Ajouter dans src/config/env.ts dans le schéma Joi existant :
```typescript
// RGPD
GDPR_FOLDER_EXPIRY_MONTHS: Joi.number().default(6),
GDPR_ACCOUNT_GRACE_DAYS: Joi.number().default(30),
GDPR_AUDIT_LOG_ANONYMIZE_YEARS: Joi.number().default(3),
GDPR_EXPORT_LINK_EXPIRY_HOURS: Joi.number().default(24),

// Rate limiting spécifiques
RATE_LIMIT_AUTH_WINDOW_MS: Joi.number().default(900000),
RATE_LIMIT_AUTH_MAX: Joi.number().default(5),
RATE_LIMIT_REGISTER_MAX: Joi.number().default(3),
RATE_LIMIT_UPLOAD_WINDOW_MS: Joi.number().default(3600000),
RATE_LIMIT_UPLOAD_MAX: Joi.number().default(20),
RATE_LIMIT_SHARING_WINDOW_MS: Joi.number().default(3600000),
RATE_LIMIT_SHARING_MAX: Joi.number().default(10),
RATE_LIMIT_EXPORT_WINDOW_MS: Joi.number().default(86400000),
RATE_LIMIT_EXPORT_MAX: Joi.number().default(3),
RATE_LIMIT_FORGOT_PASSWORD_WINDOW_MS: Joi.number().default(3600000),
RATE_LIMIT_FORGOT_PASSWORD_MAX: Joi.number().default(3),
RATE_LIMIT_API_AGENCY_WINDOW_MS: Joi.number().default(60000),
RATE_LIMIT_API_AGENCY_MAX: Joi.number().default(60),

// Dans l'objet config exporté :
gdpr: {
  folderExpiryMonths: value.GDPR_FOLDER_EXPIRY_MONTHS,
  accountGraceDays: value.GDPR_ACCOUNT_GRACE_DAYS,
  auditLogAnonymizeYears: value.GDPR_AUDIT_LOG_ANONYMIZE_YEARS,
  exportLinkExpiryHours: value.GDPR_EXPORT_LINK_EXPIRY_HOURS,
},
rateLimits: {
  auth: {
    windowMs: value.RATE_LIMIT_AUTH_WINDOW_MS,
    max: value.RATE_LIMIT_AUTH_MAX,
  },
  register: {
    windowMs: value.RATE_LIMIT_AUTH_WINDOW_MS,
    max: value.RATE_LIMIT_REGISTER_MAX,
  },
  upload: {
    windowMs: value.RATE_LIMIT_UPLOAD_WINDOW_MS,
    max: value.RATE_LIMIT_UPLOAD_MAX,
  },
  sharing: {
    windowMs: value.RATE_LIMIT_SHARING_WINDOW_MS,
    max: value.RATE_LIMIT_SHARING_MAX,
  },
  export: {
    windowMs: value.RATE_LIMIT_EXPORT_WINDOW_MS,
    max: value.RATE_LIMIT_EXPORT_MAX,
  },
  forgotPassword: {
    windowMs: value.RATE_LIMIT_FORGOT_PASSWORD_WINDOW_MS,
    max: value.RATE_LIMIT_FORGOT_PASSWORD_MAX,
  },
  agencyApi: {
    windowMs: value.RATE_LIMIT_API_AGENCY_WINDOW_MS,
    max: value.RATE_LIMIT_API_AGENCY_MAX,
  },
},
```

---

## Ce qu'il faut créer

### 1. src/middlewares/rateLimiter.middleware.ts
Tous les rate limiters spécifiques centralisés ici.
```typescript
import rateLimit from 'express-rate-limit';
import { config } from '../config/env';
import { errorResponse } from '../utils/response';
import { Request, Response } from 'express';

// Handler commun pour toutes les erreurs rate limit
const rateLimitHandler = (message: string) =>
  (req: Request, res: Response) => {
    return errorResponse(
      res,
      message,
      ['RATE_LIMIT_EXCEEDED'],
      429
    );
  };

// authLimiter :
// Appliqué sur POST /auth/login
// windowMs: config.rateLimits.auth.windowMs
// max: config.rateLimits.auth.max
// skipSuccessfulRequests: true
//   (ne compte que les tentatives échouées)
// keyGenerator: (req) => req.ip + ':' + req.body?.email
//   (limite par IP + email pour éviter énumération)
// message: "Trop de tentatives de connexion. Réessayez dans 15 minutes."
export const authLimiter = rateLimit({...});

// registerLimiter :
// Appliqué sur POST /auth/register + POST /agencies/register
// max: config.rateLimits.register.max
// message: "Trop d'inscriptions depuis cette IP."
export const registerLimiter = rateLimit({...});

// uploadLimiter :
// Appliqué sur POST /documents/upload
// Limite par userId (pas IP) pour les users authentifiés :
// keyGenerator: (req) => `upload:${req.user?.id || req.ip}`
// max: config.rateLimits.upload.max
// message: "Limite d'uploads atteinte. Réessayez dans 1 heure."
export const uploadLimiter = rateLimit({...});

// sharingLimiter :
// Appliqué sur POST /sharing/links
// keyGenerator: (req) => `sharing:${req.user?.id || req.ip}`
// max: config.rateLimits.sharing.max
// message: "Trop de liens créés. Réessayez dans 1 heure."
export const sharingLimiter = rateLimit({...});

// exportLimiter :
// Appliqué sur GET /users/me/data-export
//   + GET /admin/dashboard/export
//   + GET /admin/users/:userId/export
// keyGenerator: (req) => `export:${req.user?.id || req.ip}`
// max: config.rateLimits.export.max
// message: "Limite d'exports atteinte. Réessayez dans 24 heures."
export const exportLimiter = rateLimit({...});

// forgotPasswordLimiter :
// Appliqué sur POST /auth/forgot-password
// keyGenerator: (req) => req.ip + ':forgot'
// max: config.rateLimits.forgotPassword.max
// message: "Trop de demandes de réinitialisation. Réessayez dans 1 heure."
export const forgotPasswordLimiter = rateLimit({...});

// agencyApiLimiter :
// Appliqué sur toutes les routes /agencies/* et /sharing/view/*
// Pour éviter le scraping massif de dossiers
// keyGenerator: (req) => `agency:${req.user?.agencyId || req.ip}`
// max: config.rateLimits.agencyApi.max
// message: "Trop de requêtes. Ralentissez."
export const agencyApiLimiter = rateLimit({...});
```

### 2. Appliquer les rate limiters dans les routes existantes

#### src/routes/auth.routes.ts — ajouter sans modifier l'existant :
```typescript
// POST /login         → authLimiter avant le controller
// POST /register      → registerLimiter avant le controller
// POST /forgot-password → forgotPasswordLimiter avant le controller
```

#### src/routes/agency.routes.ts :
```typescript
// POST /register      → registerLimiter avant le controller
// Toutes les routes   → agencyApiLimiter en premier middleware du router
```

#### src/routes/document.routes.ts :
```typescript
// POST /upload        → uploadLimiter avant handleUpload
```

#### src/routes/sharing.routes.ts :
```typescript
// POST /links         → sharingLimiter avant le controller
// GET  /view/:linkId  → agencyApiLimiter avant le controller
```

#### src/routes/users.routes.ts :
```typescript
// GET /me/data-export → exportLimiter avant le controller
```

#### src/routes/admin.routes.ts :
```typescript
// GET /dashboard/export       → exportLimiter
// GET /users/:userId/export   → exportLimiter
```

### 3. src/middlewares/security.middleware.ts
Middlewares de sécurité supplémentaires.
```typescript
import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';
import logger from '../utils/logger';

// suspendedAccountCheck :
// Middleware à appliquer APRÈS auth.middleware sur toutes les routes
// protégées (pas juste au login)
// - Si req.user.status = 'suspended' → 403
//   "Votre compte a été suspendu. Contactez support@renters.app"
// - Si req.user.status = 'deleted' → 401
//   "Ce compte n'existe plus."
// - Sinon → next()
export const suspendedAccountCheck = (
  req: Request, res: Response, next: NextFunction
) => {...};

// agencySubscriptionCheck :
// Middleware pour routes qui nécessitent un abonnement actif
// (pas juste être authentifié comme agency_*)
// - Si req.user.role IN ('agency_owner', 'agency_agent') :
//   Récupérer Agency depuis BDD
//   Si status = 'suspended' → 402 Payment Required
//     "Abonnement suspendu. Mettez à jour vos informations de paiement."
//   Si status = 'cancelled' → 402
//     "Abonnement résilié. Souscrivez un nouvel abonnement."
//   Si status = 'trial' AND trial_ends_at < NOW() → 402
//     "Période d'essai expirée. Souscrivez un abonnement."
//   Si status IN ('trial', 'active') → next()
// - Sinon → next()
export const agencySubscriptionCheck = async (
  req: Request, res: Response, next: NextFunction
) => {...};

// sanitizeInput :
// Middleware global pour nettoyer les inputs (XSS basique)
// - Pour chaque champ string dans req.body :
//   Trim les espaces début/fin
//   Supprimer les caractères de contrôle (< \x20 sauf \t\n\r)
//   NE PAS encoder HTML ici (Joi + Sequelize gèrent l'injection SQL)
// - Appliquer récursivement sur les objets imbriqués
// - Ignorer les champs 'password', 'password_confirmation'
export const sanitizeInput = (
  req: Request, res: Response, next: NextFunction
) => {...};

// requestId :
// Génère un ID unique par requête pour le tracing
// - Générer UUID v4
// - Ajouter à req.requestId
// - Ajouter header X-Request-ID dans la réponse
// - Inclure dans tous les logs Winston via logger.child({ requestId })
export const requestId = (
  req: Request, res: Response, next: NextFunction
) => {...};
```

### 4. Appliquer les nouveaux middlewares dans src/app.ts
Ajouter dans l'ordre correct (sans modifier l'existant) :
```typescript
// Après helmet() et avant express.json() :
app.use(requestId);
app.use(sanitizeInput);

// Sur toutes les routes protégées (après auth middleware) :
// Ajouter suspendedAccountCheck comme middleware global
// après le router principal

// Sur les routes agences :
// agencySubscriptionCheck appliqué dans agency.routes.ts
// et sharing.routes.ts (pour download-agency)
```

### 5. src/services/GDPRService.ts
Toute la logique RGPD centralisée.
```typescript
class GDPRService {

  // exportUserData(userId: number) : Promise<Buffer>
  // Version accessible au locataire lui-même
  // (réutilise AdminUserService.exportUserData mais avec
  //  vérifications ownership strictes)
  // PROCESS :
  // 1. Récupérer User complet (sans password_hash, totp_secret)
  // 2. Récupérer Folder + Documents (métadonnées seulement, pas file_path)
  // 3. Récupérer SharingLinks + SharingViews (anonymiser agency info)
  // 4. Récupérer UserConsents
  // 5. Récupérer AuditLogs du user (actions de l'user uniquement)
  //    — exclure les logs des admins sur ce user
  // 6. Récupérer Notifications
  // 7. Récupérer fichiers S3 du user via S3Service
  // 8. Construire ZIP :
  //    Structure :
  //    ├── mes_donnees.json
  //    │   ├── profil: { id, email, first_name, ... }
  //    │   ├── dossier: { status, completion_percentage, ... }
  //    │   ├── documents: [{ type, status, created_at, ... }]
  //    │   ├── partages: [{ created_at, views_count, context, ... }]
  //    │   ├── consentements: [{ type, consented_at, ... }]
  //    │   └── activite: [{ action, created_at, ... }]
  //    └── documents/
  //        ├── carte_identite.pdf
  //        └── ...
  // 9. Logger : 'gdpr.data_exported.self', user_id
  // 10. Retourner Buffer ZIP

  // requestDeletion(userId: number) : Promise<void>
  // Initie la demande de suppression compte par le locataire lui-même
  // PROCESS :
  // 1. Vérifier user.status != 'deleted'
  // 2. Mettre user.status = 'pending_deletion'
  //    + deletion_requested_at = NOW()
  //    (ajouter ces champs via migration)
  // 3. Invalider tous les refresh tokens
  // 4. Révoquer tous les sharing links actifs
  // 5. Envoyer email confirmation avec :
  //    - Info : compte supprimé dans GDPR_ACCOUNT_GRACE_DAYS jours
  //    - Lien annulation : /account/cancel-deletion?token=XXX
  //      (token valide GDPR_ACCOUNT_GRACE_DAYS jours)
  // 6. Logger : 'gdpr.deletion_requested'

  // cancelDeletion(token: string) : Promise<void>
  // Annulation pendant la période de grâce
  // - Vérifier token valide + non expiré
  // - Remettre user.status = 'active'
  // - Annuler deletion_requested_at
  // - Email confirmation annulation
  // - Logger : 'gdpr.deletion_cancelled'

  // processExpiredAccounts() : Promise<void>
  // Appelé par CRON — supprime les comptes en attente de suppression
  // - Chercher users WHERE status = 'pending_deletion'
  //   AND deletion_requested_at < NOW() - GDPR_ACCOUNT_GRACE_DAYS jours
  // - Pour chaque user : appeler AdminUserService.deleteUser()
  //   (hard delete RGPD complet)
  // - Logger : { deleted_count, errors }

  // cleanExpiredFolders() : Promise<void>
  // Appelé par CRON — supprime dossiers expirés (6 mois)
  // - Chercher Folders WHERE :
  //   deleted_at IS NULL
  //   AND expires_at < NOW()
  //   AND folder_status != 'archived'
  // - Pour chaque folder :
  //   1. Alerter 30j avant (voir job séparé)
  //   2. Récupérer tous les Documents du folder
  //   3. Supprimer fichiers S3 pour chaque document
  //   4. Soft delete Documents (deleted_at = NOW())
  //   5. Soft delete Folder (deleted_at = NOW())
  //   6. Révoquer tous les SharingLinks du folder
  //   7. Notifier locataire via NotificationService
  //   8. Logger : 'gdpr.folder_expired'
  // - Logger récapitulatif

  // cleanExpiredFolderWarnings() : Promise<void>
  // Alertes 30j avant expiration dossier
  // - Chercher Folders WHERE :
  //   deleted_at IS NULL
  //   AND expires_at BETWEEN NOW() AND NOW() + 30 jours
  //   AND folder_expiry_notified_at IS NULL
  //     (ajouter ce champ via migration)
  // - Pour chaque folder :
  //   - NotificationService.notifyFolderExpiringSoon(userId, daysLeft)
  //   - Mettre à jour folder_expiry_notified_at = NOW()

  // anonymizeOldAuditLogs() : Promise<void>
  // Appelé par CRON annuel
  // - Anonymiser AuditLogs > GDPR_AUDIT_LOG_ANONYMIZE_YEARS ans :
  //   UPDATE audit_logs
  //   SET user_id = NULL,
  //       ip_address = '0.0.0.0',
  //       details = JSON_SET(
  //         details,
  //         '$.email', 'anonymized',
  //         '$.user_email', 'anonymized'
  //       )
  //   WHERE created_at < DATE_SUB(NOW(), INTERVAL N YEAR)
  //   AND user_id IS NOT NULL
  // - Logger : { anonymized_count }

  // cleanRevokedTokens() : Promise<void>
  // Nettoyage tokens expirés en BDD
  // - DELETE FROM refresh_tokens WHERE expires_at < NOW()
  // - DELETE FROM email_verification_tokens WHERE expires_at < NOW()
  // - DELETE FROM password_reset_tokens WHERE expires_at < NOW()
  // - Logger : { deleted_count }
}
```

### 6. Migrations supplémentaires

#### src/migrations/XXX-add-deletion-fields-to-users.ts
```typescript
// up() :
// addColumn('users', 'status', modifier ENUM pour ajouter 'pending_deletion')
// addColumn('users', 'deletion_requested_at', DATETIME NULLABLE)
// addColumn('users', 'deletion_cancellation_token', VARCHAR(255) NULLABLE UNIQUE)
// addColumn('users', 'deletion_cancellation_token_expires_at', DATETIME NULLABLE)
// down() : removeColumns
```

#### src/migrations/XXX-add-expiry-notified-to-folders.ts
```typescript
// up() :
// addColumn('folders', 'folder_expiry_notified_at', DATETIME NULLABLE)
// down() : removeColumn
```

### 7. src/jobs/gdprCleanup.job.ts
CRON de nettoyage RGPD quotidien et annuel.
```typescript
import cron from 'node-cron';
import { GDPRService } from '../services/GDPRService';
import logger from '../utils/logger';

// CRON 1 : Nettoyage quotidien à 2h du matin
// '0 2 * * *'
// - GDPRService.cleanExpiredFolderWarnings() — alertes 30j avant
// - GDPRService.cleanExpiredFolders()        — suppression dossiers expirés
// - GDPRService.processExpiredAccounts()     — suppression comptes grâce terminée
// - GDPRService.cleanRevokedTokens()         — nettoyage tokens expirés
// - Logger récapitulatif global

// CRON 2 : Anonymisation annuelle à 3h du matin le 1er janvier
// '0 3 1 1 *'
// - GDPRService.anonymizeOldAuditLogs()
// - Logger résultat
```

Brancher dans src/server.ts :
```typescript
import './jobs/gdprCleanup.job';
```

### 8. src/controllers/GDPRController.ts
```typescript
class GDPRController {

  // requestDataExport(req, res) :
  // GET /api/v1/users/me/data-export (AUTH: tenant)
  // Rate limited par exportLimiter
  // - Appelle GDPRService.exportUserData(req.user.id)
  // - Set headers :
  //   Content-Type: application/zip
  //   Content-Disposition: attachment;
  //     filename="mes_donnees_renters_{date}.zip"
  // - Retourne 200 avec Buffer ZIP
  // Note : génération synchrone pour MVP
  //   (V2 : job async + email avec lien téléchargement)

  // requestDeletion(req, res) :
  // POST /api/v1/users/me/delete-account (AUTH: tenant)
  // Body: { password: string, confirm: boolean }
  // - Valide body :
  //   password: string, required (vérifier le mot de passe)
  //   confirm: boolean, must be true
  // - Vérifier mot de passe via bcrypt.compare()
  // - Si invalide → 401
  // - Appelle GDPRService.requestDeletion(req.user.id)
  // - Retourne 200 avec message :
  //   "Votre compte sera supprimé dans {GDPR_ACCOUNT_GRACE_DAYS} jours.
  //    Un email de confirmation vous a été envoyé."

  // cancelDeletion(req, res) :
  // POST /api/v1/users/me/cancel-deletion (PUBLIC)
  // Body: { token: string }
  // - Appelle GDPRService.cancelDeletion(body.token)
  // - Retourne 200 avec message "Suppression annulée, compte réactivé"

  // getConsents(req, res) :
  // GET /api/v1/users/me/consents (AUTH: any)
  // - Récupère tous les UserConsents du user connecté
  // - Retourne 200 avec liste consentements + dates
}
```

### 9. Ajouter dans src/routes/users.routes.ts
Sans modifier l'existant :
```typescript
// GET  /me/data-export      → exportLimiter, GDPRController.requestDataExport
// POST /me/delete-account   → GDPRController.requestDeletion
// POST /me/cancel-deletion  → GDPRController.cancelDeletion (public)
// GET  /me/consents         → GDPRController.getConsents
```

### 10. src/middlewares/auditLog.middleware.ts
Middleware automatique d'audit log sur les actions sensibles.
```typescript
import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models/AuditLog';
import logger from '../utils/logger';

// Map des routes → actions à logger automatiquement
const AUDIT_ROUTES: Record<string, string> = {
  'POST /api/v1/auth/login': 'auth.login',
  'POST /api/v1/auth/logout': 'auth.logout',
  'POST /api/v1/auth/forgot-password': 'auth.password_reset_requested',
  'POST /api/v1/users/me/delete-account': 'gdpr.deletion_requested',
  'GET /api/v1/users/me/data-export': 'gdpr.data_exported.self',
  'POST /api/v1/users/me/enable-2fa': 'auth.2fa_enabled',
  'DELETE /api/v1/documents/:id': 'document.deleted',
  'DELETE /api/v1/sharing/links/:linkId': 'sharing_link.revoked',
  'POST /api/v1/admin/users/:userId/suspend': 'admin.user.suspended',
  'DELETE /api/v1/admin/users/:userId': 'admin.user.deleted',
};

// autoAuditLog middleware :
// - Sur res.on('finish') :
//   Si statusCode < 400 ET route dans AUDIT_ROUTES :
//     Créer AuditLog avec :
//     { user_id: req.user?.id,
//       agency_id: req.user?.agencyId,
//       ip_address: req.ip,
//       action: AUDIT_ROUTES[route],
//       entity_type: extractEntityType(req.path),
//       entity_id: req.params.id || req.params.userId,
//       details: {
//         method: req.method,
//         path: req.path,
//         request_id: req.requestId
//       }
//     }
//   En mode fire-and-forget (ne pas await)
// - Logger erreur si création AuditLog échoue
//   (ne jamais faire échouer la requête pour un log)

export const autoAuditLog = (
  req: Request, res: Response, next: NextFunction
) => {...};
```

Appliquer dans src/app.ts après requestLogger existant :
```typescript
import { autoAuditLog } from './middlewares/auditLog.middleware';
app.use(autoAuditLog);
```

### 11. src/middlewares/inputValidation.middleware.ts
Protections supplémentaires contre les injections.
```typescript
// preventNoSQLInjection :
// - Pour chaque valeur string dans req.body / req.query / req.params :
//   Rejeter si contient : $where, $gt, $lt, $ne, $in, $nin, $exists
//   (protège MongoDB si jamais utilisé, bonne pratique générale)
// - Retourner 400 si détecté : "Requête invalide"

// preventXSS :
// - Pour chaque valeur string dans req.body :
//   Rejeter si contient des patterns XSS évidents :
//   <script, javascript:, onerror=, onload=, eval(
// - Retourner 400 : "Contenu non autorisé détecté"

// validateContentType :
// - Pour les requêtes POST/PUT/PATCH (sauf multipart) :
//   Vérifier Content-Type = 'application/json'
//   Sinon → 415 Unsupported Media Type
```

Appliquer dans src/app.ts :
```typescript
import { preventNoSQLInjection, preventXSS,
         validateContentType } from './middlewares/inputValidation.middleware';
app.use(preventNoSQLInjection);
app.use(preventXSS);
app.use(validateContentType);
```

---

## Tests à écrire

### src/__tests__/security.test.ts
```typescript
describe('Rate Limiting', () => {
  test('authLimiter should block after 5 failed login attempts', async () => {
    // 5 tentatives échouées sur POST /auth/login avec même email
    // Vérifie 429 à la 6ème tentative
    // Vérifie message rate limit dans réponse
  });

  test('authLimiter should not count successful logins', async () => {
    // 3 logins réussis + 5 logins échoués
    // Vérifie pas de blocage (skipSuccessfulRequests: true)
  });

  test('uploadLimiter should block after 20 uploads per hour', async () => {
    // Mock 20 uploads réussis
    // Vérifie 429 au 21ème
    // Vérifie keyGenerator utilise userId pas IP
  });

  test('exportLimiter should block after 3 exports per 24h', async () => {
    // 3 exports réussis
    // Vérifie 429 au 4ème
  });

  test('sharingLimiter should block after 10 link creations per hour', async () => {
    // 10 liens créés
    // Vérifie 429 au 11ème
  });

  test('forgotPasswordLimiter should block after 3 requests per hour', async () => {
    // 3 demandes reset
    // Vérifie 429 à la 4ème
  });
});

describe('Security Middlewares', () => {
  test('suspendedAccountCheck should block suspended users', async () => {
    // User avec status = 'suspended'
    // Appel à une route protégée
    // Vérifie 403
  });

  test('agencySubscriptionCheck should block expired trial', async () => {
    // Agency avec status = 'trial' + trial_ends_at dans le passé
    // Appel à une route agence
    // Vérifie 402
  });

  test('agencySubscriptionCheck should block suspended agency', async () => {
    // Agency avec status = 'suspended'
    // Vérifie 402
  });

  test('agencySubscriptionCheck should allow active trial', async () => {
    // Agency avec status = 'trial' + trial_ends_at dans le futur
    // Vérifie accès autorisé (pas 402)
  });

  test('sanitizeInput should trim whitespace from body fields', async () => {
    // Body: { first_name: '  Jean  ' }
    // Vérifie req.body.first_name = 'Jean' après middleware
  });

  test('sanitizeInput should not modify password fields', async () => {
    // Body: { password: '  SecureP@ss  ' }
    // Vérifie password inchangé
  });

  test('preventXSS should reject script tags in body', async () => {
    // Body: { comment: '<script>alert(1)</script>' }
    // Vérifie 400
  });

  test('preventNoSQLInjection should reject $where operator', async () => {
    // Body: { email: { $where: 'this.password' } }
    // Vérifie 400
  });

  test('requestId should add X-Request-ID header', async () => {
    // Any request
    // Vérifie header X-Request-ID présent dans réponse
    // Vérifie format UUID v4
  });
});

describe('GDPR - Data Export (Tenant)', () => {
  test('should return ZIP with all tenant data', async () => {
    // Auth tenant avec dossier + documents
    // GET /api/v1/users/me/data-export
    // Vérifie Content-Type: application/zip
    // Vérifie Buffer non vide
    // Vérifie AuditLog 'gdpr.data_exported.self' créé
  });

  test('should be rate limited to 3 per 24h', async () => {
    // 3 exports réussis
    // Vérifie 429 au 4ème
  });
});

describe('GDPR - Account Deletion', () => {
  test('should initiate deletion with valid password', async () => {
    // Body: { password: 'correct', confirm: true }
    // Vérifie 200 + user.status = 'pending_deletion'
    // Vérifie deletion_requested_at IS NOT NULL
    // Vérifie refresh tokens supprimés
    // Vérifie sharing links révoqués
    // Vérifie email envoyé avec token annulation
  });

  test('should reject with wrong password', async () => {
    // Body: { password: 'wrong', confirm: true }
    // Vérifie 401
    // Vérifie user.status inchangé
  });

  test('should reject without confirm: true', async () => {
    // Body: { password: 'correct', confirm: false }
    // Vérifie 400
  });

  test('should cancel deletion with valid token', async () => {
    // User en pending_deletion avec token valide
    // POST /me/cancel-deletion avec token
    // Vérifie user.status = 'active'
    // Vérifie email confirmation envoyé
  });

  test('should reject cancellation with expired token', async () => {
    // Token expiré
    // Vérifie 400 ou 410
  });
});

describe('GDPR - CRON Jobs', () => {
  test('cleanExpiredFolders should delete folders past 6 months', async () => {
    // Créer folder avec expires_at = il y a 1 jour
    // Appeler GDPRService.cleanExpiredFolders()
    // Vérifie folder.deleted_at IS NOT NULL
    // Vérifie Documents soft deleted
    // Vérifie S3Service.deleteFile appelé
    // Vérifie SharingLinks révoqués
    // Vérifie Notification envoyée au locataire
  });

  test('cleanExpiredFolderWarnings should notify 30 days before', async () => {
    // Folder avec expires_at = NOW() + 25 jours
    // Appeler cleanExpiredFolderWarnings()
    // Vérifie Notification 'folder.expiring_soon' créée
    // Vérifie folder_expiry_notified_at IS NOT NULL
    // Relancer → vérifie PAS de 2ème notification (idempotence)
  });

  test('processExpiredAccounts should delete after grace period', async () => {
    // User avec status = 'pending_deletion'
    //   + deletion_requested_at = il y a 31 jours
    // Appeler processExpiredAccounts()
    // Vérifie user.status = 'deleted'
    // Vérifie données anonymisées
  });

  test('cleanRevokedTokens should delete expired tokens', async () => {
    // Créer 3 refresh_tokens expirés
    // Appeler cleanRevokedTokens()
    // Vérifie 0 tokens expirés en BDD
  });

  test('anonymizeOldAuditLogs should anonymize logs older than 3 years', async () => {
    // Créer AuditLog avec created_at = il y a 4 ans
    // Appeler anonymizeOldAuditLogs()
    // Vérifie log.user_id = NULL
    // Vérifie log.ip_address = '0.0.0.0'
  });
});

describe('Audit Logs automatiques', () => {
  test('should auto-log on login', async () => {
    // Login réussi
    // Vérifie AuditLog avec action = 'auth.login' créé
  });

  test('should not log on failed requests (4xx)', async () => {
    // Login échoué (401)
    // Vérifie PAS d'AuditLog créé par autoAuditLog middleware
  });

  test('should include requestId in log details', async () => {
    // Login réussi
    // Vérifie AuditLog.details.request_id IS NOT NULL
  });
});
```

---

## Règles importantes à respecter

- Toutes les réponses utilisent successResponse / errorResponse
- Toute config passe par config de src/config/env.ts
- Logger Winston pour toutes les actions RGPD et sécurité
- Les rate limiters ne doivent JAMAIS faire échouer silencieusement —
  toujours retourner 429 avec message clair et errors: ['RATE_LIMIT_EXCEEDED']
- autoAuditLog est fire-and-forget — JAMAIS faire échouer la requête
  pour un problème de log
- suspendedAccountCheck doit être appliqué sur TOUTES les routes
  protégées (pas juste au login) — un user suspendu après login
  doit être bloqué sur chaque requête suivante
- La suppression RGPD est irréversible après la période de grâce —
  le token d'annulation doit expirer exactement après GDPR_ACCOUNT_GRACE_DAYS
- cleanExpiredFolderWarnings est idempotent :
  folder_expiry_notified_at empêche les doubles notifications
- anonymizeOldAuditLogs NE SUPPRIME PAS les logs — seulement anonymise
  (garder la traçabilité sans données personnelles)
- Les CRON jobs utilisent Promise.allSettled() pour ne pas bloquer
  sur une erreur individuelle
- sanitizeInput ne doit JAMAIS modifier les champs password —
  une trim accidentelle sur un mot de passe changerait le hash bcrypt
- preventXSS et preventNoSQLInjection sont des filets de sécurité
  supplémentaires — Joi et Sequelize restent la première ligne de défense
- Le requestId doit être inclus dans TOUS les logs Winston de la requête
  pour faciliter le débogage en production