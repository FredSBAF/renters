# RENTERS — Partie 9 : Notifications (In-App + Email Brevo)

## Contexte
Tu travailles sur le backend Node.js 20 + Express + TypeScript du projet RENTERS.
La structure existante inclut :
- src/models/User.ts
- src/models/Folder.ts
- src/models/Document.ts
- src/models/SharingLink.ts
- src/models/SharingView.ts
- src/models/Agency.ts
- src/services/EmailService.ts (Brevo)
- src/services/FolderService.ts
- src/services/SharingService.ts
- src/middlewares/auth.middleware.ts
- src/utils/response.ts (successResponse / errorResponse)
- src/config/env.ts (config centralisée)
- src/utils/logger.ts

Ne touche PAS aux fichiers existants sauf pour y ajouter des imports/routes.
Respecte strictement le pattern déjà en place.

---

## Ce qu'il faut créer

### 1. src/models/Notification.ts
```typescript
// Champs :
// id: BIGINT UNSIGNED AUTO_INCREMENT PK
// user_id: INT UNSIGNED NOT NULL (FK users, CASCADE DELETE)
//
// -- Type et contenu --
// type: VARCHAR(100) NOT NULL
//   Types possibles :
//   Locataire :
//   'document.expiring_soon'     — document expire dans 7j
//   'document.expired'           — document expiré et supprimé
//   'folder.complete'            — dossier 100% complet
//   'folder.verified'            — dossier validé par IA
//   'folder.attention'           — dossier nécessite attention
//   'folder.expiring_soon'       — dossier expire dans 30j
//   'folder.viewed'              — agence a consulté le dossier
//   'folder.document_downloaded' — agence a téléchargé un document
//   'guarantor.invitation'       — invitation garant reçue
//   'guarantor.accepted'         — garant a accepté l'invitation
//   Agence :
//   'folder.new_shared'          — nouveau dossier partagé
//   'folder.updated'             — dossier partagé mis à jour
//   'folder.expiring'            — dossier partagé va expirer
//   'subscription.trial_ending'  — essai se termine dans 7j
//   'subscription.payment_failed'— paiement échoué
//   'subscription.activated'     — abonnement activé
//
// title: VARCHAR(255) NOT NULL
// message: TEXT NOT NULL
// action_url: VARCHAR(500) NULLABLE  — lien vers page concernée
//
// -- Statut --
// is_read: BOOLEAN DEFAULT false
// read_at: DATETIME NULLABLE
//
// -- Email --
// email_sent: BOOLEAN DEFAULT false
// email_sent_at: DATETIME NULLABLE
//
// -- Données supplémentaires --
// metadata: JSON NULLABLE
//   — données contextuelles ex: { document_type, agency_name, score... }
//
// -- Timestamps --
// created_at: DATETIME DEFAULT NOW
//
// Index sur : user_id + is_read, user_id + created_at, type
```

### 2. src/models/NotificationPreference.ts
```typescript
// Préférences de notifications par utilisateur et par type
//
// Champs :
// id: INT UNSIGNED AUTO_INCREMENT PK
// user_id: INT UNSIGNED NOT NULL UNIQUE (FK users, CASCADE DELETE)
//   — 1 seule ligne de préférences par user
//
// -- Canaux globaux --
// email_enabled: BOOLEAN DEFAULT true
// inapp_enabled: BOOLEAN DEFAULT true
//
// -- Préférences par type (email) --
// email_document_expiring: BOOLEAN DEFAULT true
// email_document_expired: BOOLEAN DEFAULT true
// email_folder_complete: BOOLEAN DEFAULT true
// email_folder_verified: BOOLEAN DEFAULT true
// email_folder_viewed: BOOLEAN DEFAULT false
//   — désactivé par défaut (trop fréquent)
// email_folder_document_downloaded: BOOLEAN DEFAULT false
// email_new_folder_shared: BOOLEAN DEFAULT true  — agences uniquement
// email_subscription_alerts: BOOLEAN DEFAULT true — agences uniquement
//
// -- Récapitulatif hebdomadaire --
// weekly_digest_enabled: BOOLEAN DEFAULT true
// weekly_digest_day: TINYINT DEFAULT 1
//   — 0=dimanche, 1=lundi, 2=mardi... (DEFAULT lundi)
//
// -- Timestamps --
// created_at, updated_at
//
// Index sur : user_id (UNIQUE)
```

### 3. Migrations Sequelize

#### src/migrations/XXX-create-notifications.ts
```typescript
// up() :
// - createTable 'notifications' avec tous les champs
// - FK user_id → users (CASCADE DELETE)
// - INDEX sur (user_id, is_read), (user_id, created_at), type
// down() : dropTable
```

#### src/migrations/XXX-create-notification-preferences.ts
```typescript
// up() :
// - createTable 'notification_preferences' avec tous les champs
// - FK user_id → users (CASCADE DELETE)
// - UNIQUE sur user_id
// down() : dropTable
```

### 4. src/services/NotificationService.ts
Service central de toutes les notifications.
```typescript
class NotificationService {

  // send(params) : Promise<Notification>
  // Point d'entrée principal — appelé par tous les autres services
  // params: {
  //   userId: number,
  //   type: string,
  //   title: string,
  //   message: string,
  //   actionUrl?: string,
  //   metadata?: object,
  //   sendEmail?: boolean  // default: true (si préférence active)
  // }
  // PROCESS :
  // 1. Récupérer ou créer NotificationPreference pour ce user
  //    (getOrCreatePreferences)
  // 2. Créer notification in-app en BDD (toujours, si inapp_enabled)
  // 3. Si sendEmail ET email_enabled ET préférence spécifique au type active :
  //    - Appeler EmailService avec le bon template selon type
  //    - Mettre à jour email_sent = true, email_sent_at = NOW()
  // 4. Logger : 'notification.sent', details: { type, userId }
  // 5. Retourner notification créée

  // getOrCreatePreferences(userId: number) : Promise<NotificationPreference>
  // - Cherche NotificationPreference WHERE user_id = userId
  // - Si inexistant → créer avec valeurs par défaut
  // - Retourner préférences

  // isEmailEnabled(preferences, notificationType: string) : boolean
  // Méthode privée — vérifie si l'email est activé pour ce type
  // Mapping type → champ préférence :
  // 'document.expiring_soon'     → email_document_expiring
  // 'document.expired'           → email_document_expired
  // 'folder.complete'            → email_folder_complete
  // 'folder.verified'            → email_folder_verified
  // 'folder.viewed'              → email_folder_viewed
  // 'folder.document_downloaded' → email_folder_document_downloaded
  // 'folder.new_shared'          → email_new_folder_shared
  // 'subscription.trial_ending'  → email_subscription_alerts
  // 'subscription.payment_failed'→ email_subscription_alerts
  // 'subscription.activated'     → email_subscription_alerts
  // Autres types → email_enabled global

  // getNotifications(userId, params) : Promise<{ notifications, total, unread_count }>
  // params: { page: number, limit: number, unread_only?: boolean }
  // - Retourne notifications triées par created_at DESC
  // - Inclut unread_count total (pas juste sur la page)

  // markAsRead(notificationId, userId) : Promise<void>
  // - Vérifie ownership
  // - Met is_read = true, read_at = NOW()

  // markAllAsRead(userId: number) : Promise<void>
  // - UPDATE notifications SET is_read = true, read_at = NOW()
  //   WHERE user_id = userId AND is_read = false

  // deleteNotification(notificationId, userId) : Promise<void>
  // - Vérifie ownership
  // - Hard delete (les notifications ne sont pas des données sensibles)

  // getUnreadCount(userId: number) : Promise<number>
  // - COUNT WHERE user_id = userId AND is_read = false
  // - Utilisé pour le badge dans le header frontend

  // updatePreferences(userId, updates) : Promise<NotificationPreference>
  // - Récupère ou crée les préférences
  // - Met à jour seulement les champs fournis
  // - Retourne préférences mises à jour

  // -- Méthodes métier spécifiques --
  // Ces méthodes construisent le bon titre/message et appellent send()

  // notifyDocumentExpiringSoon(userId, documentType, daysLeft, folderId)
  //   : Promise<void>
  // title: "Document expire bientôt"
  // message: "Votre {documentType} expire dans {daysLeft} jours."
  // action_url: "/dashboard"
  // metadata: { document_type, days_left }

  // notifyDocumentExpired(userId, documentType) : Promise<void>
  // title: "Document expiré"
  // message: "Votre {documentType} a expiré et a été supprimé."
  // action_url: "/dashboard"

  // notifyFolderComplete(userId) : Promise<void>
  // title: "Dossier complet !"
  // message: "Votre dossier est complet. Vous pouvez le partager."
  // action_url: "/dashboard"

  // notifyFolderVerified(userId, score) : Promise<void>
  // title: "Dossier vérifié"
  // message: "Votre dossier a été vérifié avec succès (score: {score}/100)."
  // action_url: "/dashboard"
  // NE PAS révéler les détails de l'analyse dans la notif

  // notifyFolderViewed(userId, agencyName, linkId) : Promise<void>
  // title: "Dossier consulté"
  // message: "{agencyName} a consulté votre dossier."
  // action_url: "/shares/history"
  // metadata: { agency_name, link_id }

  // notifyDocumentDownloaded(userId, agencyName, documentTypes) : Promise<void>
  // title: "Documents téléchargés"
  // message: "{agencyName} a téléchargé {count} document(s)."
  // action_url: "/shares/history"
  // metadata: { agency_name, document_types, count }

  // notifyNewFolderShared(agencyOwnerId, tenantName, folderId, score) : Promise<void>
  // title: "Nouveau dossier reçu"
  // message: "{tenantName} a partagé son dossier avec votre agence."
  // action_url: "/dossiers/{folderId}"
  // metadata: { tenant_name, folder_id, score }
  // Envoyer à TOUS les agents de l'agence (pas seulement le owner)

  // notifyFolderExpiringSoon(userId, daysLeft) : Promise<void>
  // title: "Dossier expire bientôt"
  // message: "Votre dossier expire dans {daysLeft} jours."
  // action_url: "/dashboard"

  // notifyTrialEnding(userId, daysLeft) : Promise<void>
  // title: "Essai gratuit bientôt terminé"
  // message: "Votre essai gratuit se termine dans {daysLeft} jours."
  // action_url: "/billing"

  // notifyPaymentFailed(userId, attemptCount) : Promise<void>
  // title: "Échec de paiement"
  // message: "Votre paiement a échoué ({attemptCount}/3 tentatives)."
  // action_url: "/billing"

  // notifySubscriptionActivated(userId) : Promise<void>
  // title: "Abonnement activé"
  // message: "Votre abonnement Renters est actif. Bienvenue !"
  // action_url: "/dossiers"
}
```

### 5. src/services/WeeklyDigestService.ts
Récapitulatif hebdomadaire par email.
```typescript
class WeeklyDigestService {

  // sendDigestForUser(userId: number) : Promise<void>
  // - Récupérer préférences → vérifier weekly_digest_enabled
  // - Calculer période : 7 derniers jours
  //
  // Pour les LOCATAIRES, compiler :
  // {
  //   folder_completion: number,      // % actuel
  //   documents_expiring: number,     // nb docs qui expirent dans 14j
  //   sharing_views_count: number,    // nb consultations cette semaine
  //   downloads_count: number,        // nb téléchargements cette semaine
  //   agencies_that_viewed: string[], // noms agences (max 3)
  // }
  //
  // Pour les AGENCES, compiler :
  // {
  //   new_folders_count: number,      // nb nouveaux dossiers reçus
  //   total_folders_count: number,    // total dossiers accessibles
  //   shortlisted_count: number,      // nb présélectionnés
  //   subscription_status: string,
  //   trial_days_left?: number,       // si en trial
  // }
  //
  // - Envoyer via EmailService.sendWeeklyDigest(email, role, digestData)
  // - Logger : 'notification.weekly_digest_sent'

  // runWeeklyDigest() : Promise<void>
  // - Méthode appelée par le CRON
  // - Récupérer tous les users avec weekly_digest_enabled = true
  //   JOIN notification_preferences
  //   WHERE weekly_digest_enabled = true
  //   AND users.status = 'active'
  // - Filtrer selon weekly_digest_day = jour actuel (0-6)
  // - Pour chaque user : appeler sendDigestForUser()
  //   avec Promise.allSettled() (ne pas bloquer sur erreur individuelle)
  // - Logger récapitulatif : { sent, failed, total }
}
```

### 6. src/jobs/weeklyDigest.job.ts
```typescript
// Planification : '0 8 * * *' (tous les jours à 8h)
// — Le filtrage par jour se fait dans WeeklyDigestService.runWeeklyDigest()
//   selon weekly_digest_day de chaque user
//
// - Appeler WeeklyDigestService.runWeeklyDigest()
// - Logger récapitulatif
```

Brancher dans src/server.ts :
```typescript
import './jobs/weeklyDigest.job';
```

### 7. Mettre à jour src/services/EmailService.ts
Ajouter les templates email manquants (sans toucher à l'existant) :
```typescript
// sendFolderViewed(email, agencyName, viewDate) : Promise<void>
// Objet : "{agencyName} a consulté votre dossier"
// Corps : info consultation + CTA vers /shares/history

// sendDocumentDownloaded(email, agencyName, documentLabels[]) : Promise<void>
// Objet : "{agencyName} a téléchargé vos documents"
// Corps : liste documents téléchargés + CTA vers /shares/history

// sendNewFolderShared(email, tenantFirstName, score, folderUrl) : Promise<void>
// Objet : "Nouveau dossier reçu - {tenantFirstName}"
// Corps : résumé dossier + score (si disponible) + CTA vers folderUrl

// sendFolderExpiringSoon(email, daysLeft) : Promise<void>
// Objet : "Votre dossier expire dans {daysLeft} jours"
// Corps : rappel expiration + CTA vers /dashboard

// sendWeeklyDigest(email, role, digestData) : Promise<void>
// Objet : "Votre récap Renters de la semaine"
// Corps : template différent selon role ('tenant' ou 'agency_*')
//   Locataire : completion %, docs expirants, consultations semaine
//   Agence : nouveaux dossiers, présélectionnés, statut abonnement
```

### 8. Intégrer NotificationService dans les services existants
Ajouter les appels notifications sans modifier la logique existante :

#### Dans src/services/DocumentService.ts
```typescript
// Après uploadDocument() → si completion atteint 100% :
//   NotificationService.notifyFolderComplete(userId)
//
// Dans documentExpiry.job.ts → après expiration effective :
//   NotificationService.notifyDocumentExpired(userId, documentType)
//
// Dans documentExpiry.job.ts → pour alertes 7j :
//   NotificationService.notifyDocumentExpiringSoon(userId, documentType, daysLeft)
```

#### Dans src/services/SharingService.ts
```typescript
// Dans consultFolder() → après création SharingView :
//   Si accessLevel = 'full' (agence payante) :
//     NotificationService.notifyFolderViewed(tenantUserId, agencyName, linkId)
//
// Dans trackDocumentDownload() :
//   NotificationService.notifyDocumentDownloaded(tenantUserId, agencyName, types)
//
// Dans createSharingLink() :
//   NE PAS notifier ici (c'est le locataire qui crée le lien)
```

#### Dans src/services/AIService.ts
```typescript
// Dans processAnalysisResult() :
//   Si status = 'verified' :
//     NotificationService.notifyFolderVerified(userId, globalScore)
//   Si status = 'manual_review' :
//     (pas de notif locataire — éviter gaming)
```

#### Dans src/services/StripeService.ts
```typescript
// Dans handleWebhook() :
//   case 'checkout.session.completed' :
//     NotificationService.notifySubscriptionActivated(agencyOwnerId)
//   case 'invoice.payment_failed' :
//     NotificationService.notifyPaymentFailed(agencyOwnerId, attemptCount)
```

#### Dans src/services/AgencyService.ts
```typescript
// Quand un locataire partage un dossier avec une agence
// (appelé depuis SharingService.createSharingLink) :
//   NotificationService.notifyNewFolderShared(
//     agencyOwnerId, tenantName, folderId, score
//   )
// Note : envoyer à tous les agents de l'agence via Promise.all
```

#### Dans src/jobs/trialReminder.job.ts existant
```typescript
// Remplacer l'appel EmailService direct par :
//   NotificationService.notifyTrialEnding(ownerId, daysLeft)
// (qui gère à la fois in-app + email selon préférences)
```

#### Dans src/jobs/documentExpiry.job.ts existant
```typescript
// Remplacer les appels EmailService directs par :
//   NotificationService.notifyDocumentExpiringSoon(userId, type, daysLeft)
//   NotificationService.notifyDocumentExpired(userId, type)
```

### 9. src/validators/notification.validator.ts
```typescript
// getNotificationsSchema (query params) :
// - page: number, optional, default 1
// - limit: number, optional, default 20, max 100
// - unread_only: boolean, optional, default false

// updatePreferencesSchema :
// - email_enabled: boolean, optional
// - inapp_enabled: boolean, optional
// - email_document_expiring: boolean, optional
// - email_document_expired: boolean, optional
// - email_folder_complete: boolean, optional
// - email_folder_verified: boolean, optional
// - email_folder_viewed: boolean, optional
// - email_folder_document_downloaded: boolean, optional
// - email_new_folder_shared: boolean, optional
// - email_subscription_alerts: boolean, optional
// - weekly_digest_enabled: boolean, optional
// - weekly_digest_day: number, optional, min 0, max 6
// Au moins un champ requis (Joi.object().min(1))
```

### 10. src/controllers/NotificationController.ts
```typescript
class NotificationController {

  // getNotifications(req, res) :
  // GET /api/v1/notifications (AUTH: any)
  // - Valide query avec getNotificationsSchema
  // - Appelle NotificationService.getNotifications(req.user.id, query)
  // - Retourne 200 avec { notifications, total, unread_count, page, limit }

  // getUnreadCount(req, res) :
  // GET /api/v1/notifications/unread-count (AUTH: any)
  // - Appelle NotificationService.getUnreadCount(req.user.id)
  // - Retourne 200 avec { unread_count }
  // - Endpoint léger pour polling frontend (badge header)

  // markAsRead(req, res) :
  // PATCH /api/v1/notifications/:id/read (AUTH: any)
  // - Appelle NotificationService.markAsRead(params.id, req.user.id)
  // - Retourne 200

  // markAllAsRead(req, res) :
  // PATCH /api/v1/notifications/read-all (AUTH: any)
  // - Appelle NotificationService.markAllAsRead(req.user.id)
  // - Retourne 200 avec message "Toutes les notifications marquées comme lues"

  // deleteNotification(req, res) :
  // DELETE /api/v1/notifications/:id (AUTH: any)
  // - Appelle NotificationService.deleteNotification(params.id, req.user.id)
  // - Retourne 204

  // getPreferences(req, res) :
  // GET /api/v1/notifications/preferences (AUTH: any)
  // - Appelle NotificationService.getOrCreatePreferences(req.user.id)
  // - Retourne 200 avec préférences

  // updatePreferences(req, res) :
  // PATCH /api/v1/notifications/preferences (AUTH: any)
  // - Valide body avec updatePreferencesSchema
  // - Appelle NotificationService.updatePreferences(req.user.id, body)
  // - Retourne 200 avec préférences mises à jour
}
```

### 11. src/routes/notification.routes.ts
```typescript
// Toutes les routes AUTH: any (tenant, agency_owner, agency_agent, admin)
//
// GET    /                    → NotificationController.getNotifications
// GET    /unread-count        → NotificationController.getUnreadCount
// PATCH  /read-all            → NotificationController.markAllAsRead
// PATCH  /:id/read            → NotificationController.markAsRead
// DELETE /:id                 → NotificationController.deleteNotification
// GET    /preferences         → NotificationController.getPreferences
// PATCH  /preferences         → NotificationController.updatePreferences
//
// ATTENTION ordre des routes :
// Déclarer /read-all et /preferences AVANT /:id
// pour éviter que Express interprète 'read-all' comme un :id
```

### 12. Brancher dans src/routes/index.ts
```typescript
import notificationRouter from './notification.routes';
app.use('/api/v1/notifications', notificationRouter);
```

### 13. Mettre à jour src/models/index.ts
```typescript
// Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' })
// User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' })
// NotificationPreference.belongsTo(User,
//   { foreignKey: 'user_id', as: 'user' })
// User.hasOne(NotificationPreference,
//   { foreignKey: 'user_id', as: 'notificationPreference' })
```

---

## Tests à écrire

### src/__tests__/notification.test.ts
```typescript
describe('NotificationService.send', () => {
  test('should create in-app notification', async () => {
    // Appeler send() avec userId valide
    // Vérifie Notification créée en BDD
    // Vérifie is_read = false
    // Vérifie email_sent selon préférences
  });

  test('should not send email if email_enabled = false', async () => {
    // Mettre email_enabled = false dans préférences
    // Appeler send()
    // Vérifie EmailService NON appelé
    // Vérifie notification in-app quand même créée
  });

  test('should not send email if type preference disabled', async () => {
    // email_folder_viewed = false
    // notifyFolderViewed()
    // Vérifie EmailService NON appelé
  });

  test('should create preferences with defaults if not exist', async () => {
    // User sans préférences existantes
    // Appeler getOrCreatePreferences()
    // Vérifie NotificationPreference créée avec valeurs par défaut
    // Vérifie weekly_digest_enabled = true
    // Vérifie email_folder_viewed = false (désactivé par défaut)
  });
});

describe('GET /api/v1/notifications', () => {
  test('should return paginated notifications', async () => {
    // Créer 5 notifications pour user
    // Vérifie 200 + { notifications, total, unread_count }
    // Vérifie tri par created_at DESC
  });

  test('should filter unread only', async () => {
    // Créer 3 notifications dont 1 lue
    // ?unread_only=true
    // Vérifie 2 notifications retournées
  });

  test('should return correct unread_count', async () => {
    // Créer 3 non lues + 2 lues
    // Vérifie unread_count = 3 (pas juste sur la page)
  });
});

describe('GET /api/v1/notifications/unread-count', () => {
  test('should return unread count only', async () => {
    // Créer 4 notifications non lues
    // Vérifie 200 + { unread_count: 4 }
    // Vérifie réponse légère (pas de notifications complètes)
  });
});

describe('PATCH /api/v1/notifications/:id/read', () => {
  test('should mark notification as read', async () => {
    // Vérifie 200
    // Vérifie is_read = true + read_at IS NOT NULL en BDD
  });

  test('should reject if notification belongs to another user', async () => {
    // Auth user différent
    // Vérifie 403 ou 404
  });
});

describe('PATCH /api/v1/notifications/read-all', () => {
  test('should mark all notifications as read', async () => {
    // Créer 5 notifications non lues
    // Appeler read-all
    // Vérifie 200
    // Vérifie toutes les notifications is_read = true en BDD
  });
});

describe('PATCH /api/v1/notifications/preferences', () => {
  test('should update preferences partially', async () => {
    // Body: { email_folder_viewed: true, weekly_digest_enabled: false }
    // Vérifie 200 + champs mis à jour
    // Vérifie autres champs inchangés
  });

  test('should reject empty body', async () => {
    // Body: {}
    // Vérifie 400 (Joi.object().min(1))
  });

  test('should reject invalid weekly_digest_day', async () => {
    // weekly_digest_day: 7 (max est 6)
    // Vérifie 400
  });
});

describe('WeeklyDigestService', () => {
  test('should send digest only for users with correct day', async () => {
    // Lundi → weekly_digest_day = 1
    // Mock Date pour simuler un lundi
    // Créer users avec weekly_digest_day = 1, 2, 3
    // Appeler runWeeklyDigest()
    // Vérifie EmailService appelé uniquement pour user avec day = 1
  });

  test('should not send digest if weekly_digest_enabled = false', async () => {
    // weekly_digest_enabled = false
    // Vérifie EmailService NON appelé
  });

  test('should compile correct tenant digest data', async () => {
    // Créer tenant avec dossier à 75%
    // Créer 2 SharingViews cette semaine
    // sendDigestForUser()
    // Vérifie EmailService.sendWeeklyDigest appelé avec
    //   digestData.folder_completion = 75
    //   digestData.sharing_views_count = 2
  });

  test('should use Promise.allSettled (not fail on single error)', async () => {
    // Mock EmailService pour échouer sur 1 user sur 3
    // runWeeklyDigest() ne doit pas throw
    // Vérifie 2 emails envoyés + 1 erreur loggée
  });
});

describe('Integration: document upload triggers notification', () => {
  test('should notify folder complete when 100% reached', async () => {
    // Uploader le dernier document manquant
    // Vérifie Notification créée avec type 'folder.complete'
  });
});

describe('Integration: folder viewed triggers notification', () => {
  test('should notify tenant when agency views folder', async () => {
    // Agence active consulte via SharingService.consultFolder()
    // Vérifie Notification créée pour le tenant
    //   avec type 'folder.viewed'
    // Vérifie metadata.agency_name présent
  });

  test('should NOT notify for limited access views', async () => {
    // Agence non payante consulte (accessLevel = 'limited')
    // Vérifie Notification NON créée
  });
});
```

---

## Règles importantes à respecter

- Toutes les réponses utilisent successResponse / errorResponse
- Toute config passe par config de src/config/env.ts
- Logger Winston pour envois notifications et erreurs
- NotificationService.send() ne doit JAMAIS faire échouer
  l'opération principale qui l'appelle
  → Wrapper tous les appels dans try/catch silencieux :
```typescript
  try {
    await NotificationService.notifyFolderViewed(...)
  } catch (err) {
    logger.error('Notification failed', { err });
    // Ne pas propager l'erreur
  }
```
- Les notifications in-app sont TOUJOURS créées si inapp_enabled
  même si l'email échoue
- Ne JAMAIS révéler le score IA exact dans les notifications locataire
  (éviter gaming du système)
- L'ordre des routes dans notification.routes.ts est critique :
  /read-all et /preferences AVANT /:id
- WeeklyDigestService utilise Promise.allSettled() (pas Promise.all())
  pour ne pas bloquer l'envoi de tous les digests si 1 échoue
- Les notifications ne sont PAS soft deleted — hard delete direct
  (ce ne sont pas des données sensibles RGPD)
- Limiter l'historique notifications à 100 par user en BDD :
  Après création d'une nouvelle notif, supprimer les plus anciennes
  si COUNT > 100 pour ce user
- La préférence email_folder_viewed est false par défaut
  car très fréquente — ne pas spammer le locataire