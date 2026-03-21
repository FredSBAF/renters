# RENTERS — Partie 8 : Dashboard Admin + Métriques + Gestion Utilisateurs

## Contexte
Tu travailles sur le backend Node.js 20 + Express + TypeScript du projet RENTERS.
La structure existante inclut :
- src/models/User.ts (avec is_fraud_flagged)
- src/models/Agency.ts
- src/models/Folder.ts
- src/models/Document.ts
- src/models/SharingLink.ts
- src/models/SharingView.ts
- src/models/ModerationQueue.ts
- src/models/PaymentLog.ts
- src/models/AuditLog.ts
- src/services/EmailService.ts
- src/middlewares/auth.middleware.ts (avec requireRole)
- src/utils/response.ts (successResponse / errorResponse)
- src/config/env.ts (config centralisée)
- src/utils/logger.ts

Ne touche PAS aux fichiers existants sauf pour y ajouter des imports/routes.
Respecte strictement le pattern déjà en place.

---

## Ce qu'il faut créer

### 1. src/services/MetricsService.ts
Toutes les requêtes SQL agrégées pour le dashboard admin.
```typescript
import { Op, fn, col, literal, QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';

class MetricsService {

  // getBusinessMetrics(period: 'day' | 'week' | 'month' = 'month')
  //   : Promise<BusinessMetrics>
  //
  // Retourne :
  // {
  //   tenants: {
  //     total: number,              // COUNT users WHERE role = 'tenant'
  //     active: number,             // COUNT WHERE role = 'tenant'
  //                                 //   AND status = 'active'
  //     new_this_period: number,    // COUNT WHERE role = 'tenant'
  //                                 //   AND created_at >= period_start
  //     growth_rate: number,        // % vs période précédente
  //   },
  //   folders: {
  //     total: number,              // COUNT folders non supprimés
  //     complete: number,           // COUNT WHERE status = 'complete'
  //     verified: number,           // COUNT WHERE status = 'verified'
  //     active: number,             // COUNT WHERE folder_status = 'active'
  //     completion_rate: number,    // % complete / total
  //     sharing_rate: number,       // % folders avec au moins 1 sharing_link
  //                                 //   actif / folders complete
  //   },
  //   agencies: {
  //     paying: number,             // COUNT agencies WHERE status = 'active'
  //     trial: number,              // COUNT WHERE status = 'trial'
  //     suspended: number,          // COUNT WHERE status = 'suspended'
  //     cancelled: number,          // COUNT WHERE status = 'cancelled'
  //     new_this_period: number,    // COUNT WHERE created_at >= period_start
  //     conversion_rate: number,    // % trial → active (30 derniers jours)
  //     churn_rate: number,         // % cancelled / (active + cancelled)
  //   },
  //   revenue: {
  //     mrr: number,                // agencies.paying * 300 (prix fixe MVP)
  //     arr: number,                // mrr * 12
  //     total_collected: number,    // SUM payment_logs WHERE status = 'success'
  //                                 //   AND created_at >= period_start
  //   }
  // }
  //
  // IMPLÉMENTATION :
  // Utiliser Promise.all() pour lancer toutes les requêtes en parallèle
  // Chaque métrique = 1 requête SQL COUNT ou SUM via Sequelize
  // period_start calculé selon 'day' (24h), 'week' (7j), 'month' (30j)

  // getOperationalMetrics() : Promise<OperationalMetrics>
  //
  // Retourne :
  // {
  //   moderation: {
  //     pending_count: number,
  //     in_review_count: number,
  //     sla_breached_count: number,
  //     avg_resolution_time_hours: number, // AVG(TIMESTAMPDIFF(HOUR,
  //                                        //   created_at, resolved_at))
  //                                        // WHERE resolved_at IS NOT NULL
  //   },
  //   ai: {
  //     fraud_rate: number,          // % folders avec ai_status = 'rejected'
  //                                  //   / total folders analysés
  //     false_positive_rate: number, // % approved après manual_review
  //                                  //   / total manual_review
  //     avg_analysis_time_ms: number,// depuis audit_logs WHERE
  //                                  //   action = 'folder.ai_analyzed'
  //                                  //   details->>'$.analysis_time_ms'
  //     pending_analysis: number,    // COUNT folders WHERE
  //                                  //   ai_status = 'pending'
  //   },
  //   documents: {
  //     total_uploaded: number,
  //     total_expired: number,
  //     total_downloaded_by_agencies: number, // COUNT audit_logs WHERE
  //                                           //   action = 'document.downloaded.agency'
  //   }
  // }

  // getEfficiencyMetrics() : Promise<EfficiencyMetrics>
  //
  // Retourne :
  // {
  //   avg_folder_completion_time_minutes: number,
  //   // AVG temps entre premier upload et folder.status = 'complete'
  //   // Via audit_logs : TIMESTAMPDIFF entre 'document.uploaded' (premier)
  //   // et 'folder.ai_validated'
  //
  //   avg_time_to_share_days: number,
  //   // AVG temps entre created_at folder et premier sharing_link créé
  //
  //   top_document_types_missing: Array<{type: string, count: number}>,
  //   // Documents les plus souvent manquants dans les dossiers incomplets
  //   // JOIN document_types pour avoir les labels
  //
  //   agency_activity: {
  //     avg_folders_viewed_per_agency: number,
  //     avg_documents_downloaded_per_agency: number,
  //   }
  // }

  // getTimeSeriesData(metric: string, period: 'week' | 'month' | 'year',
  //                   granularity: 'day' | 'week' | 'month')
  //   : Promise<Array<{date: string, value: number}>>
  //
  // Génère des séries temporelles pour graphes frontend
  // metric IN : 'new_tenants', 'new_agencies', 'folders_verified',
  //             'revenue', 'fraud_detected'
  //
  // IMPLÉMENTATION via raw SQL :
  // SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date,
  //        COUNT(*) as value
  // FROM {table}
  // WHERE created_at >= {period_start}
  //   AND {conditions selon metric}
  // GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
  // ORDER BY date ASC
  //
  // Remplir les jours manquants avec value: 0 pour avoir
  // une série continue sans trous

  // exportMetricsCSV(params) : Promise<string>
  // params: { type: 'tenants' | 'agencies' | 'folders' | 'revenue',
  //           from: Date, to: Date }
  //
  // Retourne string CSV avec BOM UTF-8 (\ufeff) pour Excel
  //
  // Format CSV selon type :
  //
  // 'tenants' :
  // id, email, status, tenant_profile, created_at, folder_status,
  // completion_percentage, ai_score_global, is_fraud_flagged
  //
  // 'agencies' :
  // id, name, siret, status, trial_ends_at, subscription_id,
  // next_billing_date, created_at, agents_count, folders_viewed_count
  //
  // 'folders' :
  // id, tenant_email, status, completion_percentage, ai_score_global,
  // ai_status, created_at, expires_at, sharing_links_count
  //
  // 'revenue' :
  // date, agency_name, event_type, amount_eur, status
  // (depuis payment_logs JOIN agencies)
  //
  // IMPLÉMENTATION :
  // Utiliser requêtes Sequelize avec include pour les JOINs
  // Construire CSV manuellement (pas de lib externe) :
  // - Ligne header : colonnes séparées par ';' (format Excel FR)
  // - Échapper les virgules/guillemets dans les valeurs
  // - Date format : DD/MM/YYYY HH:mm
}
```

### 2. src/services/AdminUserService.ts
Gestion des utilisateurs côté admin.
```typescript
class AdminUserService {

  // searchUsers(params) : Promise<{ users: User[], total: number }>
  // params: {
  //   search?: string,     // email, first_name, last_name (LIKE %search%)
  //   role?: string,
  //   status?: string,
  //   is_fraud_flagged?: boolean,
  //   agency_id?: number,
  //   page: number,
  //   limit: number,
  //   sort_by?: 'created_at' | 'last_login_at' | 'email',
  //   sort_order?: 'ASC' | 'DESC'
  // }
  // - Requête Sequelize avec WHERE dynamique
  // - Include Agency (pour les agency_*)
  // - Include Folder (pour les tenants : completion_percentage, ai_status)
  // - Exclure password_hash, totp_secret
  // - Retourner { users, total, page, limit }

  // getUserDetails(userId: number) : Promise<object>
  // - Retourne profil complet :
  //   User + Agency (si applicable) + Folder avec documents
  //   + dernières activités depuis AuditLog (20 derniers events)
  //   + consentements (UserConsent)
  // - Exclure password_hash, totp_secret

  // suspendUser(userId: number, adminId: number, reason: string)
  //   : Promise<void>
  // - Vérifie que userId != adminId (pas se suspendre soi-même)
  // - Vérifie que userId n'est pas admin
  // - Met user.status = 'suspended'
  // - Invalide tous les refresh tokens (supprimer de refresh_tokens)
  // - Logger dans AuditLog : action 'admin.user.suspended',
  //   details: { reason, suspended_by: adminId }
  // - Envoyer email à l'utilisateur via EmailService.sendAccountSuspended()

  // reactivateUser(userId: number, adminId: number) : Promise<void>
  // - Met user.status = 'active'
  // - Logger : action 'admin.user.reactivated'
  // - Envoyer email à l'utilisateur

  // deleteUser(userId: number, adminId: number) : Promise<void>
  // RGPD — suppression complète
  // PROCESS (transaction Sequelize) :
  // 1. Vérifier que userId != adminId
  // 2. Vérifier que userId n'est pas admin
  // 3. Récupérer tous les documents du user → supprimer fichiers S3
  // 4. Hard delete : Documents, Folder, SharingLinks, SharingViews,
  //    RefreshTokens, EmailVerificationTokens, UserConsents, Guarantors
  // 5. Anonymiser AuditLogs :
  //    UPDATE audit_logs SET user_id = NULL,
  //    ip_address = '0.0.0.0'
  //    WHERE user_id = userId
  // 6. Soft delete User : deleted_at = NOW(), status = 'deleted'
  //    Anonymiser : email = 'deleted_{id}@renters.deleted',
  //                 first_name = 'Supprimé', last_name = 'Supprimé',
  //                 phone = NULL, date_of_birth = NULL
  // 7. Logger : action 'admin.user.deleted' (avec admin_id uniquement)
  // 8. Envoyer email de confirmation suppression

  // exportUserData(userId: number) : Promise<Buffer>
  // Droit d'accès RGPD — export ZIP de toutes les données
  // PROCESS :
  // 1. Récupérer toutes les données :
  //    User profile + Folder + Documents metadata + SharingLinks
  //    + AuditLogs + UserConsents
  // 2. Récupérer tous les fichiers S3 du user
  // 3. Construire ZIP en mémoire via archiver :
  //    npm install archiver @types/archiver
  //    Structure ZIP :
  //    ├── user_data.json       (toutes les métadonnées)
  //    └── documents/
  //        ├── identity_card.pdf
  //        ├── payslip_oct.pdf
  //        └── ...
  // 4. Retourner Buffer du ZIP

  // changeUserRole(userId, newRole, adminId) : Promise<void>
  // - Vérifie que newRole est valide
  // - Met à jour user.role
  // - Logger : 'admin.user.role_changed'

  // getAuditLogs(params) : Promise<{ logs: AuditLog[], total: number }>
  // params: { userId?, agencyId?, action?, from?, to?, page, limit }
  // - Retourne logs avec User + Agency associés
  // - Triés par created_at DESC
}
```

### 3. src/validators/admin.validator.ts
```typescript
// getUsersQuerySchema :
// - search: string, optional, max 100
// - role: string, optional,
//   valid('tenant','agency_owner','agency_agent','admin')
// - status: string, optional,
//   valid('pending_verification','active','suspended','deleted')
// - is_fraud_flagged: boolean, optional
// - agency_id: number, optional
// - page: number, optional, default 1, min 1
// - limit: number, optional, default 20, max 100
// - sort_by: string, optional,
//   valid('created_at','last_login_at','email'), default 'created_at'
// - sort_order: string, optional, valid('ASC','DESC'), default 'DESC'

// suspendUserSchema :
// - reason: string, required, min 10, max 500

// deleteUserSchema :
// - confirm: boolean, must be true
//   (double confirmation obligatoire pour suppression RGPD)

// getMetricsQuerySchema :
// - period: string, optional, valid('day','week','month'), default 'month'

// getTimeSeriesSchema :
// - metric: string, required,
//   valid('new_tenants','new_agencies','folders_verified',
//         'revenue','fraud_detected')
// - period: string, optional, valid('week','month','year'), default 'month'
// - granularity: string, optional, valid('day','week','month'), default 'day'

// exportCSVSchema :
// - type: string, required,
//   valid('tenants','agencies','folders','revenue')
// - from: string, date ISO, optional, default = 30 jours avant
// - to: string, date ISO, optional, default = today
```

### 4. src/controllers/AdminDashboardController.ts
```typescript
class AdminDashboardController {

  // getMetrics(req, res) :
  // GET /api/v1/admin/dashboard/metrics (AUTH: admin)
  // - Valide query avec getMetricsQuerySchema
  // - Appelle en parallèle :
  //   Promise.all([
  //     MetricsService.getBusinessMetrics(query.period),
  //     MetricsService.getOperationalMetrics(),
  //     MetricsService.getEfficiencyMetrics()
  //   ])
  // - Retourne 200 avec :
  //   { business, operational, efficiency, generated_at: new Date() }

  // getTimeSeries(req, res) :
  // GET /api/v1/admin/dashboard/timeseries (AUTH: admin)
  // - Valide query avec getTimeSeriesSchema
  // - Appelle MetricsService.getTimeSeriesData()
  // - Retourne 200 avec array de { date, value }

  // exportCSV(req, res) :
  // GET /api/v1/admin/dashboard/export (AUTH: admin)
  // - Valide query avec exportCSVSchema
  // - Appelle MetricsService.exportMetricsCSV()
  // - Set headers :
  //   Content-Type: text/csv; charset=utf-8
  //   Content-Disposition: attachment; filename="renters_{type}_{date}.csv"
  // - Retourne 200 avec string CSV
  // - Logger : 'admin.export.csv', details: { type, from, to }
}
```

### 5. src/controllers/AdminUserController.ts
```typescript
class AdminUserController {

  // getUsers(req, res) :
  // GET /api/v1/admin/users (AUTH: admin)
  // - Valide query avec getUsersQuerySchema
  // - Appelle AdminUserService.searchUsers(query)
  // - Retourne 200 avec { users, total, page, limit }

  // getUserDetails(req, res) :
  // GET /api/v1/admin/users/:userId (AUTH: admin)
  // - Appelle AdminUserService.getUserDetails(params.userId)
  // - Retourne 200 avec profil complet

  // suspendUser(req, res) :
  // POST /api/v1/admin/users/:userId/suspend (AUTH: admin)
  // - Valide body avec suspendUserSchema
  // - Appelle AdminUserService.suspendUser(
  //     params.userId, req.user.id, body.reason
  //   )
  // - Retourne 200 avec message "Utilisateur suspendu"

  // reactivateUser(req, res) :
  // POST /api/v1/admin/users/:userId/reactivate (AUTH: admin)
  // - Appelle AdminUserService.reactivateUser(params.userId, req.user.id)
  // - Retourne 200

  // deleteUser(req, res) :
  // DELETE /api/v1/admin/users/:userId (AUTH: admin)
  // - Valide body avec deleteUserSchema (confirm: true obligatoire)
  // - Appelle AdminUserService.deleteUser(params.userId, req.user.id)
  // - Retourne 204

  // exportUserData(req, res) :
  // GET /api/v1/admin/users/:userId/export (AUTH: admin)
  // - Appelle AdminUserService.exportUserData(params.userId)
  // - Set headers :
  //   Content-Type: application/zip
  //   Content-Disposition: attachment; filename="user_{userId}_data.zip"
  // - Retourne 200 avec Buffer ZIP
  // - Logger : 'admin.user.data_exported'

  // changeRole(req, res) :
  // PATCH /api/v1/admin/users/:userId/role (AUTH: admin)
  // Body: { role: string }
  // - Appelle AdminUserService.changeUserRole(
  //     params.userId, body.role, req.user.id
  //   )
  // - Retourne 200

  // getAuditLogs(req, res) :
  // GET /api/v1/admin/audit-logs (AUTH: admin)
  // Query params: userId?, agencyId?, action?, from?, to?, page?, limit?
  // - Appelle AdminUserService.getAuditLogs(query)
  // - Retourne 200 avec { logs, total }
}
```

### 6. Ajouter dans src/services/EmailService.ts
```typescript
// sendAccountSuspended(email, reason) : Promise<void>
// Objet : "Votre compte Renters a été suspendu"
// Corps : informer de la suspension, contact support@renters.app

// sendAccountReactivated(email) : Promise<void>
// Objet : "Votre compte Renters a été réactivé"
// Corps : confirmation réactivation, CTA vers /login

// sendAccountDeleted(email) : Promise<void>
// Objet : "Confirmation de suppression de votre compte Renters"
// Corps : confirmer suppression RGPD, données effacées
```

### 7. src/routes/admin.routes.ts
```typescript
// Toutes les routes AUTH: admin

// Dashboard :
// GET  /dashboard/metrics      → AdminDashboardController.getMetrics
// GET  /dashboard/timeseries   → AdminDashboardController.getTimeSeries
// GET  /dashboard/export       → AdminDashboardController.exportCSV

// Users :
// GET    /users                → AdminUserController.getUsers
// GET    /users/:userId        → AdminUserController.getUserDetails
// POST   /users/:userId/suspend    → AdminUserController.suspendUser
// POST   /users/:userId/reactivate → AdminUserController.reactivateUser
// DELETE /users/:userId        → AdminUserController.deleteUser
// GET    /users/:userId/export → AdminUserController.exportUserData
// PATCH  /users/:userId/role   → AdminUserController.changeRole

// Audit :
// GET  /audit-logs             → AdminUserController.getAuditLogs
```

### 8. Brancher dans src/routes/index.ts
```typescript
import adminRouter from './admin.routes';
app.use('/api/v1/admin', adminRouter);
```

---

## Tests à écrire

### src/__tests__/admin.test.ts
```typescript
describe('GET /api/v1/admin/dashboard/metrics', () => {
  test('should return all metrics sections', async () => {
    // Auth admin
    // Vérifie 200 + { business, operational, efficiency }
    // Vérifie business.tenants.total >= 0
    // Vérifie business.revenue.mrr = paying_agencies * 300
    // Vérifie generated_at présent
  });

  test('should reject non-admin user', async () => {
    // Auth tenant
    // Vérifie 403
  });

  test('should accept period query param', async () => {
    // ?period=week
    // Vérifie 200
  });
});

describe('GET /api/v1/admin/dashboard/timeseries', () => {
  test('should return continuous date series with no gaps', async () => {
    // ?metric=new_tenants&period=week&granularity=day
    // Vérifie 200 + array de 7 items (un par jour)
    // Vérifie items avec value: 0 pour jours sans activité
  });

  test('should reject invalid metric', async () => {
    // ?metric=invalid
    // Vérifie 400
  });
});

describe('GET /api/v1/admin/dashboard/export', () => {
  test('should export tenants CSV with BOM', async () => {
    // ?type=tenants
    // Vérifie Content-Type: text/csv
    // Vérifie Content-Disposition header
    // Vérifie réponse commence par \ufeff (BOM UTF-8)
    // Vérifie header CSV correct (id;email;status...)
  });

  test('should export agencies CSV', async () => {
    // ?type=agencies
    // Vérifie colonnes : id;name;siret;status...
  });
});

describe('GET /api/v1/admin/users', () => {
  test('should return paginated users list', async () => {
    // Vérifie 200 + { users, total, page, limit }
    // Vérifie password_hash absent des résultats
    // Vérifie totp_secret absent des résultats
  });

  test('should filter by role', async () => {
    // ?role=tenant
    // Vérifie tous les users retournés ont role = 'tenant'
  });

  test('should search by email', async () => {
    // ?search=jean
    // Vérifie résultats contiennent 'jean' dans email ou nom
  });

  test('should filter fraud flagged users', async () => {
    // ?is_fraud_flagged=true
    // Vérifie tous les users retournés ont is_fraud_flagged = true
  });
});

describe('POST /api/v1/admin/users/:userId/suspend', () => {
  test('should suspend user and invalidate tokens', async () => {
    // Créer user avec refresh token actif
    // Auth admin → suspend
    // Vérifie 200 + user.status = 'suspended'
    // Vérifie refresh_tokens supprimés pour ce user
    // Vérifie AuditLog créé
    // Vérifie email envoyé
  });

  test('should reject suspension of admin user', async () => {
    // Tenter de suspendre un autre admin
    // Vérifie 400 ou 403
  });

  test('should reject self-suspension', async () => {
    // Admin tente de se suspendre lui-même
    // Vérifie 400
  });
});

describe('DELETE /api/v1/admin/users/:userId', () => {
  test('should hard delete user data RGPD', async () => {
    // Body: { confirm: true }
    // Vérifie 204
    // Vérifie user.status = 'deleted'
    // Vérifie user.email anonymisé
    // Vérifie documents supprimés (soft delete)
    // Vérifie AuditLogs anonymisés
    // Vérifie S3Service.deleteFile appelé pour chaque document
  });

  test('should reject without confirm: true', async () => {
    // Body: { confirm: false }
    // Vérifie 400
  });
});

describe('GET /api/v1/admin/users/:userId/export', () => {
  test('should return ZIP with user data', async () => {
    // Vérifie Content-Type: application/zip
    // Vérifie Content-Disposition header
    // Vérifie Buffer non vide retourné
  });
});

describe('GET /api/v1/admin/audit-logs', () => {
  test('should return paginated audit logs', async () => {
    // Vérifie 200 + { logs, total }
    // Vérifie structure log : action, entity_type, created_at...
  });

  test('should filter by action', async () => {
    // ?action=document.uploaded
    // Vérifie tous les logs retournés ont action = 'document.uploaded'
  });

  test('should filter by date range', async () => {
    // ?from=2026-01-01&to=2026-12-31
    // Vérifie 200
  });
});

describe('MetricsService', () => {
  test('should calculate MRR correctly', async () => {
    // Créer 5 agences avec status = 'active'
    // Vérifie revenue.mrr = 5 * 300 = 1500
  });

  test('should fill time series gaps with zeros', async () => {
    // Créer 1 tenant hier seulement
    // getTimeSeriesData('new_tenants', 'week', 'day')
    // Vérifie 7 points retournés
    // Vérifie 6 points avec value: 0
    // Vérifie 1 point avec value: 1
  });

  test('should calculate conversion rate', async () => {
    // 10 agences trial créées ce mois
    // 2 passées à active
    // Vérifie conversion_rate = 20
  });
});
```

---

## Règles importantes à respecter

- Installer : npm install archiver @types/archiver
- Toutes les réponses utilisent successResponse / errorResponse
- Toute config passe par config de src/config/env.ts
- Logger Winston pour toutes les actions admin sensibles
- Toutes les routes /admin/* sont protégées par requireRole('admin')
- La suppression RGPD est IRRÉVERSIBLE — double confirmation obligatoire
  (confirm: true dans le body)
- Jamais retourner password_hash ou totp_secret dans les réponses admin
- Le CSV doit commencer par BOM UTF-8 (\ufeff) pour compatibilité Excel FR
- Le séparateur CSV est ';' (pas ',') pour Excel FR
- Les dates dans le CSV sont en format DD/MM/YYYY HH:mm
- Les montants CSV sont en euros (pas centimes) avec 2 décimales
- Toutes les requêtes métriques via Promise.all() pour performance
- L'export ZIP est construit en mémoire (memoryStorage)
  via archiver en mode 'zip'
- La suppression user doit supprimer les fichiers S3 de manière
  asynchrone mais DANS la transaction (si S3 échoue → rollback BDD)
  Utiliser try/catch par fichier pour ne pas bloquer sur 1 erreur S3
- Les AuditLogs ne sont JAMAIS supprimés — uniquement anonymisés
  (user_id = NULL, ip_address = '0.0.0.0')