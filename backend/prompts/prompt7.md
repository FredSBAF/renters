# RENTERS — Partie 7 : Module Anti-Fraude IA + Garants

## Contexte
Tu travailles sur le backend Node.js 20 + Express + TypeScript du projet RENTERS.
La structure existante inclut :
- src/models/Folder.ts (avec ai_score_global, ai_status, ai_warnings...)
- src/models/Document.ts (avec ai_score, ai_warnings, ai_metadata...)
- src/models/User.ts
- src/models/Agency.ts
- src/models/AuditLog.ts
- src/models/SharingLink.ts
- src/services/FolderService.ts
- src/services/DocumentService.ts
- src/services/EmailService.ts
- src/middlewares/auth.middleware.ts
- src/utils/response.ts (successResponse / errorResponse)
- src/config/env.ts (config centralisée)
- src/utils/logger.ts

Ne touche PAS aux fichiers existants sauf pour y ajouter des imports/routes.
Respecte strictement le pattern déjà en place.

---

## Variables d'environnement à ajouter dans .env.example et config/env.ts
```env
# == MICROSERVICE IA ==
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_SECRET=change_me
AI_SERVICE_TIMEOUT_MS=30000
AI_SCORE_AUTO_VALIDATE=80    # score >= 80 → validation automatique
AI_SCORE_MANUAL_REVIEW=40    # score < 40 → modération prioritaire
```

Ajouter dans src/config/env.ts :
```typescript
AI_SERVICE_URL: Joi.string().uri().required(),
AI_SERVICE_SECRET: Joi.string().required(),
AI_SERVICE_TIMEOUT_MS: Joi.number().default(30000),
AI_SCORE_AUTO_VALIDATE: Joi.number().default(80),
AI_SCORE_MANUAL_REVIEW: Joi.number().default(40),

// Dans l'objet config exporté :
ai: {
  serviceUrl: value.AI_SERVICE_URL,
  secret: value.AI_SERVICE_SECRET,
  timeoutMs: value.AI_SERVICE_TIMEOUT_MS,
  scoreAutoValidate: value.AI_SCORE_AUTO_VALIDATE,
  scoreManualReview: value.AI_SCORE_MANUAL_REVIEW,
},
```

---

## Ce qu'il faut créer

### 1. src/models/Guarantor.ts
```typescript
// Champs :
// id: INT UNSIGNED AUTO_INCREMENT PK
// tenant_id: INT UNSIGNED NOT NULL (FK users, CASCADE DELETE)
//   — locataire principal qui a ajouté ce garant
// guarantor_user_id: INT UNSIGNED NULLABLE (FK users, SET NULL on delete)
//   — si le garant a créé son propre compte
// role: ENUM('guarantor', 'co_tenant', 'spouse') DEFAULT 'guarantor'
//
// -- Si upload direct (pas de compte garant) --
// first_name: VARCHAR(100) NULLABLE
// last_name: VARCHAR(100) NULLABLE
// email: VARCHAR(255) NULLABLE
// phone: VARCHAR(20) NULLABLE
//
// -- Dossier garant --
// folder_id: INT UNSIGNED NULLABLE (FK folders, SET NULL on delete)
//   — dossier séparé du garant (même structure que locataire)
//
// -- Invitation --
// invitation_token: VARCHAR(255) NULLABLE UNIQUE
//   — token envoyé par email pour que le garant crée son compte
// invitation_expires_at: DATETIME NULLABLE
// invitation_accepted_at: DATETIME NULLABLE
//
// -- Timestamps --
// created_at, updated_at
//
// Index sur : tenant_id, guarantor_user_id, folder_id
```

### 2. src/models/ModerationQueue.ts
```typescript
// File de modération pour les dossiers suspects
//
// Champs :
// id: INT UNSIGNED AUTO_INCREMENT PK
// folder_id: INT UNSIGNED NOT NULL UNIQUE (FK folders, CASCADE DELETE)
//   — un dossier ne peut être dans la queue qu'une seule fois
// priority: ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium'
//   — calculée depuis ai_score :
//     score >= 60 → 'low'
//     score 40-59 → 'medium'
//     score 20-39 → 'high'
//     score < 20  → 'critical'
// status: ENUM('pending', 'in_review', 'validated', 'rejected') DEFAULT 'pending'
// assigned_to: INT UNSIGNED NULLABLE (FK users admin, SET NULL on delete)
//   — admin assigné à ce dossier
// ai_score_at_submission: INT NOT NULL
//   — score IA au moment de l'entrée en modération
// motifs: JSON NOT NULL
//   — liste des raisons ex: [{type, message, severity}]
// admin_notes: TEXT NULLABLE
//   — notes internes de l'admin
// resolved_at: DATETIME NULLABLE
// resolved_by: INT UNSIGNED NULLABLE (FK users, SET NULL on delete)
// resolution: ENUM('approved', 'rejected', 'fraud_confirmed') NULLABLE
// adjusted_score: INT NULLABLE
//   — score ajusté manuellement par l'admin
//
// -- SLA --
// sla_deadline: DATETIME NOT NULL
//   — created_at + 48h (alerte si dépassé)
// sla_breached: BOOLEAN DEFAULT false
//
// -- Timestamps --
// created_at, updated_at
//
// Index sur : status, priority, sla_deadline, assigned_to
```

### 3. Migrations Sequelize

#### src/migrations/XXX-create-guarantors.ts
```typescript
// up() :
// - createTable 'guarantors' avec tous les champs
// - FK tenant_id → users (CASCADE DELETE)
// - FK guarantor_user_id → users (SET NULL on delete)
// - FK folder_id → folders (SET NULL on delete)
// - UNIQUE sur invitation_token
// - INDEX sur tenant_id, guarantor_user_id, folder_id
// down() : dropTable
```

#### src/migrations/XXX-create-moderation-queue.ts
```typescript
// up() :
// - createTable 'moderation_queue' avec tous les champs
// - FK folder_id → folders (CASCADE DELETE) + UNIQUE
// - FK assigned_to → users (SET NULL on delete)
// - FK resolved_by → users (SET NULL on delete)
// - INDEX sur status, priority, sla_deadline, assigned_to
// down() : dropTable
```

### 4. src/services/AIService.ts
Intégration avec le microservice Python IA.
```typescript
import axios from 'axios';
import { config } from '../config/env';

class AIService {

  // analyzeFolder(folderId: number) : Promise<AIAnalysisResult>
  //
  // PROCESS :
  // 1. Récupérer le folder avec ses documents non supprimés
  //    et l'user associé (pour tenant_profile)
  //
  // 2. Construire le payload pour le microservice :
  //    {
  //      folder_id: number,
  //      tenant_profile: string,
  //      documents: [
  //        {
  //          document_id: number,
  //          document_type: string,
  //          file_url: string,  // presigned URL S3 (expire 1h)
  //          mime_type: string
  //        }
  //      ]
  //    }
  //    Générer les presigned URLs via S3Service.getPresignedUrl()
  //
  // 3. Mettre à jour folder.ai_status = 'pending' en BDD
  //
  // 4. Appeler le microservice via axios.post :
  //    URL : ${config.ai.serviceUrl}/analyze
  //    Headers : { 'X-Service-Secret': config.ai.secret }
  //    Timeout : config.ai.timeoutMs
  //    Body : payload ci-dessus
  //
  // 5. Si succès → appeler processAnalysisResult()
  // 6. Si timeout ou erreur réseau → appeler handleAnalysisFailure()
  // 7. Retourner AIAnalysisResult

  // processAnalysisResult(folderId, result) : Promise<void>
  // result structure (réponse du microservice Python) :
  // {
  //   global_score: number,         // 0-100
  //   scores: {
  //     identity: number,
  //     income: number,
  //     stability: number,
  //     coherence: number
  //   },
  //   status: 'verified' | 'manual_review' | 'rejected',
  //   warnings: [{type, message, severity, document_id?}],
  //   documents: [{
  //     document_id: number,
  //     score: number,
  //     status: 'valid' | 'invalid' | 'attention',
  //     extracted_data: object,
  //     warnings: array,
  //     ai_metadata: object
  //   }],
  //   analysis_time_ms: number
  // }
  //
  // PROCESS :
  // Transaction Sequelize pour tout mettre à jour atomiquement :
  //
  // 1. Mettre à jour chaque Document :
  //    - ai_score, ai_warnings, ai_metadata, extracted_data
  //    - status selon résultat IA :
  //      'valid' → status = 'valid'
  //      'attention' → status = 'attention'
  //      'invalid' → status = 'invalid'
  //
  // 2. Mettre à jour Folder :
  //    - ai_score_global, ai_score_identity, ai_score_income,
  //      ai_score_stability, ai_score_coherence
  //    - ai_warnings (warnings globaux)
  //    - ai_analyzed_at = NOW()
  //    - ai_status selon seuils config :
  //      global_score >= config.ai.scoreAutoValidate → 'analyzed'
  //      global_score < config.ai.scoreAutoValidate  → 'manual_review'
  //
  // 3. Recalculer completion percentage via FolderService.calculateCompletion()
  //
  // 4. Selon ai_status :
  //    a) Si 'analyzed' (score >= 80) :
  //       - Mettre folder.status = 'verified'
  //       - Logger : action 'folder.ai_validated'
  //    b) Si 'manual_review' (score < 80) :
  //       - Mettre folder.status = 'attention'
  //       - Appeler ModerationService.addToQueue(folderId, result)
  //       - Logger : action 'folder.ai_flagged'
  //
  // 5. Logger dans AuditLog : action 'folder.ai_analyzed',
  //    details: { global_score, analysis_time_ms, status }

  // handleAnalysisFailure(folderId, error) : Promise<void>
  // - Mettre folder.ai_status = 'pending' (laisser en attente)
  // - Logger erreur avec détails
  // - Ajouter à ModerationQueue avec priority 'high'
  //   et motif 'ai_service_unavailable'
  // - Envoyer alerte email admin via EmailService

  // triggerAnalysis(folderId: number) : Promise<void>
  // Point d'entrée appelé depuis DocumentService après upload
  // - Vérifier que le dossier a au moins 1 document
  // - Vérifier que ai_status != 'pending' (analyse déjà en cours)
  // - Lancer analyzeFolder() de manière ASYNCHRONE (ne pas await)
  //   pour ne pas bloquer la réponse upload
  // - Logger : 'folder.analysis_triggered'
}

// Type AIAnalysisResult :
interface AIAnalysisResult {
  folderId: number;
  globalScore: number;
  scores: {
    identity: number;
    income: number;
    stability: number;
    coherence: number;
  };
  status: 'verified' | 'manual_review' | 'rejected';
  warnings: AIWarning[];
  analysisTimeMs: number;
}

interface AIWarning {
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  documentId?: number;
}
```

### 5. src/services/ModerationService.ts
```typescript
class ModerationService {

  // addToQueue(folderId, analysisResult) : Promise<ModerationQueue>
  // - Vérifie que le dossier n'est pas déjà dans la queue (UNIQUE folder_id)
  //   Si déjà présent et status = 'pending' → mettre à jour motifs + score
  //   Si déjà résolu → créer nouvelle entrée
  // - Calculer priority depuis globalScore :
  //   >= 60 → 'low'
  //   40-59 → 'medium'
  //   20-39 → 'high'
  //   < 20  → 'critical'
  // - Calculer sla_deadline = NOW() + 48h
  // - Créer ModerationQueue en BDD
  // - Envoyer alerte email admin si priority IN ('high', 'critical')
  //   via EmailService.sendModerationAlert()
  // - Logger : action 'moderation.added_to_queue'
  // - Retourner l'entrée créée

  // getQueue(params) : Promise<{ items: ModerationQueue[], total: number }>
  // params: {
  //   status?: string,
  //   priority?: string,
  //   assignedTo?: number,
  //   page: number,
  //   limit: number
  // }
  // - Retourne items avec folder + user + documents associés
  // - Triés par : priority DESC, sla_deadline ASC
  //   (les plus urgents en premier)
  // - Inclut flag sla_breached si sla_deadline < NOW()

  // assignToAdmin(queueId, adminUserId) : Promise<ModerationQueue>
  // - Vérifie que adminUserId a bien le role 'admin'
  // - Met à jour assigned_to + status = 'in_review'
  // - Retourne entrée mise à jour

  // resolveItem(params) : Promise<ModerationQueue>
  // params: {
  //   queueId: number,
  //   adminUserId: number,
  //   resolution: 'approved' | 'rejected' | 'fraud_confirmed',
  //   adminNotes?: string,
  //   adjustedScore?: number
  // }
  // PROCESS :
  // 1. Vérifier ownership (assigned_to = adminUserId ou admin peut tout résoudre)
  // 2. Mettre à jour ModerationQueue :
  //    status = 'validated' ou 'rejected' selon resolution
  //    resolved_at = NOW(), resolved_by = adminUserId
  //    admin_notes, adjusted_score si fournis
  // 3. Selon resolution :
  //    a) 'approved' :
  //       - folder.ai_status = 'analyzed'
  //       - folder.status = 'verified'
  //       - Si adjustedScore → folder.ai_score_global = adjustedScore
  //       - Logger : 'moderation.approved'
  //    b) 'rejected' :
  //       - folder.ai_status = 'rejected'
  //       - folder.status = 'attention'
  //       - Logger : 'moderation.rejected'
  //    c) 'fraud_confirmed' :
  //       - folder.ai_status = 'rejected'
  //       - folder.status = 'attention'
  //       - Ajouter tag fraud sur le user (champ is_fraud_flagged: BOOLEAN)
  //         sur le modèle User → ajouter migration pour ce champ
  //       - NE PAS supprimer le dossier (preuve)
  //       - NE PAS bannir le compte (sanction légale suffit)
  //       - Logger : 'moderation.fraud_confirmed'
  //    Pour tous les cas :
  //    - Envoyer notification au locataire via EmailService
  //      (sans révéler les détails de l'analyse)
  // 4. Retourner entrée résolue

  // requestMoreInfo(params) : Promise<void>
  // params: { queueId, adminUserId, message }
  // - Envoyer email au locataire avec demande de complément
  //   via EmailService.sendModerationInfoRequest()
  // - Logger : 'moderation.info_requested'

  // getSLAStats() : Promise<object>
  // - Retourne stats pour dashboard admin :
  //   { pending_count, in_review_count, sla_breached_count,
  //     avg_resolution_time_hours, by_priority: {...} }

  // checkSLABreaches() : Promise<void>
  // - Méthode appelée par CRON
  // - Cherche items WHERE sla_deadline < NOW() AND sla_breached = false
  //   AND status IN ('pending', 'in_review')
  // - Pour chaque item :
  //   - sla_breached = true
  //   - Envoyer alerte email admin
  //   - Logger : 'moderation.sla_breached'
}
```

### 6. src/services/GuarantorService.ts
```typescript
class GuarantorService {

  // inviteGuarantor(params) : Promise<Guarantor>
  // params: {
  //   tenantId: number,
  //   email: string,
  //   role: 'guarantor' | 'co_tenant' | 'spouse',
  //   firstName?: string,
  //   lastName?: string,
  //   phone?: string
  // }
  // - Vérifie que tenantId est bien un tenant actif
  // - Vérifie qu'un garant avec ce email n'est pas déjà lié à ce tenant
  // - Si user avec cet email existe déjà :
  //   - Vérifier qu'il n'est pas déjà garant pour un autre tenant
  //   - Associer directement (guarantor_user_id = userId)
  //   - invitation_accepted_at = NOW()
  // - Sinon :
  //   - Générer token invitation (UUID, expire 7 jours)
  //   - Stocker dans Guarantor.invitation_token
  // - Créer entrée Guarantor en BDD
  // - Envoyer email invitation via EmailService.sendGuarantorInvitation()
  // - Logger : 'guarantor.invited'
  // - Retourner guarantor créé

  // uploadGuarantorDocumentsDirect(params) : Promise<Guarantor>
  // params: { tenantId, firstName, lastName, email?, phone?, role }
  // - Crée un garant SANS compte utilisateur
  //   (locataire principal upload les docs lui-même)
  // - Crée un Folder virtuel pour le garant
  // - Retourner guarantor avec folder_id

  // acceptInvitation(token: string, userId: number) : Promise<Guarantor>
  // - Vérifie token valide + non expiré
  // - Associe guarantor_user_id = userId
  // - invitation_accepted_at = NOW()
  // - Crée un Folder pour le garant si pas déjà existant
  // - Invalide token (null)
  // - Retourner guarantor mis à jour

  // getGuarantors(tenantId: number) : Promise<Guarantor[]>
  // - Retourne tous les garants du tenant
  // - Inclut folder avec completion_percentage
  // - Inclut user si compte existant (sans données sensibles)

  // removeGuarantor(guarantorId, tenantId) : Promise<void>
  // - Vérifie que le garant appartient bien au tenant
  // - Supprime l'association (delete Guarantor)
  // - NE PAS supprimer le user ou le folder du garant
  // - Logger : 'guarantor.removed'

  // getGuarantorFolder(guarantorId, tenantId) : Promise<Folder>
  // - Vérifie ownership
  // - Retourne le folder du garant avec ses documents
}
```

### 7. Ajouter dans src/services/EmailService.ts
```typescript
// sendModerationAlert(adminEmail, folderId, priority, motifs) : Promise<void>
// Objet : "[RENTERS] Dossier suspect - Modération requise ({priority})"
// Corps : détails du dossier, lien /admin/moderation/{queueId}

// sendModerationInfoRequest(tenantEmail, message) : Promise<void>
// Objet : "Votre dossier - Complément d'information requis"
// Corps : message de l'admin (sans révéler l'analyse IA)
// CTA : lien vers /dashboard

// sendModerationResolved(tenantEmail, resolution) : Promise<void>
// Objet : "Votre dossier a été vérifié"
// Corps :
//   Si 'approved' : "Votre dossier est validé, vous pouvez le partager"
//   Si 'rejected' : "Des points nécessitent votre attention, connectez-vous"
//   NE PAS révéler la raison exacte ni le score

// sendGuarantorInvitation(email, tenantName, role, token) : Promise<void>
// Objet : "{tenantName} vous invite à compléter un dossier garant"
// Corps : explication du rôle + lien /guarantor/accept?token={token}
// Expiration : 7 jours
```

### 8. src/jobs/moderationSLA.job.ts
```typescript
// Planification : '0 */4 * * *' (toutes les 4 heures)
// - Appeler ModerationService.checkSLABreaches()
// - Logger récapitulatif
```

Brancher dans src/server.ts :
```typescript
import './jobs/moderationSLA.job';
```

### 9. src/validators/moderation.validator.ts
```typescript
// resolveItemSchema :
// - resolution: string, valid('approved','rejected','fraud_confirmed'), required
// - admin_notes: string, optional, max 2000
// - adjusted_score: number, optional, min 0, max 100

// requestMoreInfoSchema :
// - message: string, required, min 10, max 1000

// getModerationQueueSchema (query params) :
// - status: string, optional, valid('pending','in_review','validated','rejected')
// - priority: string, optional, valid('low','medium','high','critical')
// - page: number, optional, default 1
// - limit: number, optional, default 20, max 100
```

### 10. src/validators/guarantor.validator.ts
```typescript
// inviteGuarantorSchema :
// - email: string, email, required
// - role: string, valid('guarantor','co_tenant','spouse'), required
// - first_name: string, optional, max 100
// - last_name: string, optional, max 100
// - phone: string, optional, regex téléphone français

// uploadGuarantorDirectSchema :
// - first_name: string, required, max 100
// - last_name: string, required, max 100
// - role: string, valid('guarantor','co_tenant','spouse'), required
// - email: string, email, optional
// - phone: string, optional
```

### 11. src/controllers/ModerationController.ts
```typescript
class ModerationController {

  // getQueue(req, res) :
  // GET /api/v1/admin/moderation (AUTH: admin)
  // - Valide query avec getModerationQueueSchema
  // - Appelle ModerationService.getQueue(query)
  // - Retourne 200 avec { items, total, sla_stats }

  // assignItem(req, res) :
  // POST /api/v1/admin/moderation/:queueId/assign (AUTH: admin)
  // - Appelle ModerationService.assignToAdmin(params.queueId, req.user.id)
  // - Retourne 200 avec item mis à jour

  // resolveItem(req, res) :
  // POST /api/v1/admin/moderation/:queueId/resolve (AUTH: admin)
  // - Valide body avec resolveItemSchema
  // - Appelle ModerationService.resolveItem({
  //     queueId: params.queueId,
  //     adminUserId: req.user.id,
  //     ...body
  //   })
  // - Retourne 200 avec item résolu

  // requestMoreInfo(req, res) :
  // POST /api/v1/admin/moderation/:queueId/request-info (AUTH: admin)
  // - Valide body avec requestMoreInfoSchema
  // - Appelle ModerationService.requestMoreInfo({
  //     queueId: params.queueId,
  //     adminUserId: req.user.id,
  //     message: body.message
  //   })
  // - Retourne 200

  // triggerAnalysis(req, res) :
  // POST /api/v1/admin/moderation/trigger/:folderId (AUTH: admin)
  // - Permet de relancer manuellement l'analyse IA d'un dossier
  // - Appelle AIService.triggerAnalysis(params.folderId)
  // - Retourne 200 avec message "Analyse lancée"
}
```

### 12. src/controllers/GuarantorController.ts
```typescript
class GuarantorController {

  // inviteGuarantor(req, res) :
  // POST /api/v1/guarantors/invite (AUTH: tenant)
  // - Valide body avec inviteGuarantorSchema
  // - Appelle GuarantorService.inviteGuarantor({
  //     tenantId: req.user.id, ...body
  //   })
  // - Retourne 201 avec guarantor créé
  // - Message: "Invitation envoyée"

  // uploadDirect(req, res) :
  // POST /api/v1/guarantors/direct (AUTH: tenant)
  // - Valide body avec uploadGuarantorDirectSchema
  // - Appelle GuarantorService.uploadGuarantorDocumentsDirect({
  //     tenantId: req.user.id, ...body
  //   })
  // - Retourne 201 avec guarantor + folder_id
  // - Message: "Dossier garant créé, vous pouvez uploader ses documents"

  // acceptInvitation(req, res) :
  // POST /api/v1/guarantors/accept (PUBLIC)
  // Body: { token: string }
  // - Appelle GuarantorService.acceptInvitation(body.token, req.user?.id)
  // - Si user non connecté → 401 "Connectez-vous pour accepter l'invitation"
  // - Retourne 200

  // getMyGuarantors(req, res) :
  // GET /api/v1/guarantors (AUTH: tenant)
  // - Appelle GuarantorService.getGuarantors(req.user.id)
  // - Retourne 200 avec liste garants

  // removeGuarantor(req, res) :
  // DELETE /api/v1/guarantors/:guarantorId (AUTH: tenant)
  // - Appelle GuarantorService.removeGuarantor(params.guarantorId, req.user.id)
  // - Retourne 204

  // getGuarantorFolder(req, res) :
  // GET /api/v1/guarantors/:guarantorId/folder (AUTH: tenant)
  // - Appelle GuarantorService.getGuarantorFolder(params.guarantorId, req.user.id)
  // - Retourne 200 avec folder + documents du garant
}
```

### 13. src/routes/moderation.routes.ts
```typescript
// Routes (toutes AUTH: admin) :
// GET    /                       → ModerationController.getQueue
// POST   /:queueId/assign        → ModerationController.assignItem
// POST   /:queueId/resolve       → ModerationController.resolveItem
// POST   /:queueId/request-info  → ModerationController.requestMoreInfo
// POST   /trigger/:folderId      → ModerationController.triggerAnalysis
```

### 14. src/routes/guarantor.routes.ts
```typescript
// Routes :
// POST   /invite          → GuarantorController.inviteGuarantor (auth: tenant)
// POST   /direct          → GuarantorController.uploadDirect (auth: tenant)
// POST   /accept          → GuarantorController.acceptInvitation (public)
// GET    /                → GuarantorController.getMyGuarantors (auth: tenant)
// DELETE /:guarantorId    → GuarantorController.removeGuarantor (auth: tenant)
// GET    /:guarantorId/folder → GuarantorController.getGuarantorFolder
//                              (auth: tenant)
```

### 15. Brancher dans src/routes/index.ts
```typescript
import moderationRouter from './moderation.routes';
import guarantorRouter from './guarantor.routes';
app.use('/api/v1/admin/moderation', moderationRouter);
app.use('/api/v1/guarantors', guarantorRouter);
```

### 16. Mettre à jour src/services/DocumentService.ts
Ajouter appel IA après upload (sans modifier l'existant) :
```typescript
// Dans uploadDocument(), après calculateCompletion() :
// - Appeler AIService.triggerAnalysis(folder.id) de manière async
//   (ne pas await — ne pas bloquer la réponse upload)
```

### 17. Mettre à jour src/models/index.ts
```typescript
// Guarantor.belongsTo(User, { foreignKey: 'tenant_id', as: 'tenant' })
// Guarantor.belongsTo(User, { foreignKey: 'guarantor_user_id', as: 'guarantorUser' })
// Guarantor.belongsTo(Folder, { foreignKey: 'folder_id', as: 'folder' })
// User.hasMany(Guarantor, { foreignKey: 'tenant_id', as: 'guarantors' })
// ModerationQueue.belongsTo(Folder, { foreignKey: 'folder_id', as: 'folder' })
// ModerationQueue.belongsTo(User, { foreignKey: 'assigned_to', as: 'assignedAdmin' })
// ModerationQueue.belongsTo(User, { foreignKey: 'resolved_by', as: 'resolvedBy' })
```

### 18. Migration supplémentaire : ajouter is_fraud_flagged sur users
```typescript
// src/migrations/XXX-add-fraud-flag-to-users.ts
// up() : addColumn('users', 'is_fraud_flagged', {
//   type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false
// })
// down() : removeColumn('users', 'is_fraud_flagged')
```

---

## Tests à écrire

### src/__tests__/ai.test.ts
```typescript
describe('AIService.triggerAnalysis', () => {
  test('should call microservice and update folder scores on success', async () => {
    // Mock axios.post → retourne résultat IA fictif avec score 85
    // Appeler AIService.analyzeFolder(folderId)
    // Vérifie folder.ai_score_global = 85
    // Vérifie folder.ai_status = 'analyzed'
    // Vérifie folder.status = 'verified'
    // Vérifie documents mis à jour
    // Vérifie AuditLog créé
  });

  test('should add to moderation queue if score < 80', async () => {
    // Mock axios.post → score 55
    // Vérifie folder.ai_status = 'manual_review'
    // Vérifie ModerationQueue créée avec priority 'medium'
  });

  test('should handle AI service timeout gracefully', async () => {
    // Mock axios.post → timeout
    // Vérifie folder.ai_status reste 'pending'
    // Vérifie ModerationQueue créée avec motif 'ai_service_unavailable'
    // Vérifie aucune exception non catchée
  });

  test('should not block upload response (async trigger)', async () => {
    // Mock AIService.triggerAnalysis avec délai artificiel
    // Upload document → vérifier réponse 201 immédiate
    // Vérifier que l'analyse est lancée en arrière-plan
  });
});

describe('ModerationService', () => {
  test('should calculate priority correctly from score', async () => {
    // score 75 → priority 'low'
    // score 50 → priority 'medium'
    // score 30 → priority 'high'
    // score 15 → priority 'critical'
  });

  test('should resolve item as approved and update folder', async () => {
    // Auth admin
    // resolveItem({ resolution: 'approved', adjustedScore: 85 })
    // Vérifie folder.status = 'verified'
    // Vérifie folder.ai_score_global = 85
    // Vérifie ModerationQueue.status = 'validated'
  });

  test('should flag user on fraud_confirmed', async () => {
    // resolveItem({ resolution: 'fraud_confirmed' })
    // Vérifie user.is_fraud_flagged = true
    // Vérifie folder NE PAS supprimé
    // Vérifie user NE PAS banni
  });

  test('should not add duplicate to queue', async () => {
    // Appeler addToQueue 2x pour le même folder
    // Vérifie 1 seul item en BDD
  });

  test('should detect SLA breach', async () => {
    // Item avec sla_deadline dans le passé
    // Appeler checkSLABreaches()
    // Vérifie sla_breached = true
    // Vérifie email alerte envoyé
  });
});

describe('GuarantorService', () => {
  test('should invite guarantor by email', async () => {
    // Vérifie Guarantor créé avec invitation_token
    // Vérifie email envoyé
  });

  test('should associate existing user directly as guarantor', async () => {
    // Email d'un user déjà existant
    // Vérifie guarantor_user_id renseigné
    // Vérifie invitation_accepted_at = NOW()
  });

  test('should accept invitation and create folder for guarantor', async () => {
    // Token valide
    // Vérifie invitation_accepted_at renseigné
    // Vérifie Folder créé pour le garant
    // Vérifie token = null après acceptation
  });

  test('should reject expired invitation token', async () => {
    // Token expiré (invitation_expires_at dans le passé)
    // Vérifie 400 ou 410
  });

  test('should create direct guarantor without user account', async () => {
    // uploadGuarantorDocumentsDirect()
    // Vérifie guarantor_user_id = null
    // Vérifie Folder créé
  });
});

describe('POST /api/v1/admin/moderation/:queueId/resolve', () => {
  test('should reject if not admin role', async () => {
    // Auth tenant
    // Vérifie 403
  });
});
```

---

## Règles importantes à respecter

- Toutes les réponses utilisent successResponse / errorResponse
- Toute config passe par config de src/config/env.ts
- Logger Winston pour tous les events IA et modération
- AIService.triggerAnalysis() est TOUJOURS asynchrone (fire and forget)
  Ne jamais await dans DocumentService — la réponse upload ne doit pas
  attendre la fin de l'analyse IA
- En cas d'échec du microservice IA, NE JAMAIS faire échouer l'upload
  Gérer silencieusement + ajouter à la file de modération
- Les dossiers en manual_review (score < 80) sont VISIBLES par les agences
  mais avec un flag ai_status = 'manual_review' visible dans la réponse
  Les agences peuvent consulter mais voient clairement que la vérification
  est en cours
- Jamais révéler au locataire le score exact ni les détails de l'analyse
  dans les emails (éviter le gaming du système)
- is_fraud_flagged ne bannit pas le compte — c'est uniquement un tag
  informatif pour les admins et agences
- Le SLA de 48h est non négociable — alerter l'admin avant dépassement
- Installer si nécessaire : npm install axios