# RENTERS — Partie 6 : Partage de Dossiers

## Contexte
Tu travailles sur le backend Node.js 20 + Express + TypeScript du projet RENTERS.
La structure existante inclut :
- src/models/Folder.ts
- src/models/Document.ts
- src/models/User.ts
- src/models/Agency.ts
- src/models/AuditLog.ts
- src/services/FolderService.ts (avec getFolderForSharing)
- src/services/DocumentService.ts (avec downloadDocumentForAgency)
- src/services/S3Service.ts
- src/middlewares/auth.middleware.ts (avec requireRole)
- src/utils/response.ts (successResponse / errorResponse)
- src/config/env.ts (config centralisée)
- src/utils/logger.ts

Ne touche PAS aux fichiers existants sauf pour y ajouter des imports/routes.
Respecte strictement le pattern déjà en place.

---

## Variables d'environnement à ajouter dans .env.example et config/env.ts
```env
# == PARTAGE ==
SHARING_LINK_EXPIRY_DAYS=30
SHARING_LINK_BASE_URL=https://renters.app/view
```

Ajouter dans src/config/env.ts :
```typescript
SHARING_LINK_EXPIRY_DAYS: Joi.number().default(30),
SHARING_LINK_BASE_URL: Joi.string().uri().required(),

// Dans l'objet config exporté :
sharing: {
  expiryDays: value.SHARING_LINK_EXPIRY_DAYS,
  baseLinkUrl: value.SHARING_LINK_BASE_URL,
},
```

---

## Ce qu'il faut créer

### 1. src/models/SharingLink.ts
```typescript
// Champs :
// id: CHAR(36) PK — UUID v4 généré à la création
// folder_id: INT UNSIGNED NOT NULL (FK folders, CASCADE DELETE)
//
// -- Contexte optionnel de la demande --
// context: JSON NULLABLE
//   Structure : {
//     property_type?: string,  // 'T1', 'T2', 'T3'...
//     city?: string,
//     budget?: number,         // en euros/mois
//     availability?: string,   // date ISO 'YYYY-MM-DD'
//     listing_ref?: string     // référence annonce externe SeLoger, LBC...
//   }
//
// -- Validité --
// created_at: DATETIME DEFAULT NOW
// expires_at: DATETIME NOT NULL
// revoked_at: DATETIME NULLABLE
//
// -- Stats --
// views_count: INT UNSIGNED DEFAULT 0
// last_viewed_at: DATETIME NULLABLE
//
// Index sur : folder_id, expires_at, revoked_at
```

### 2. src/models/SharingView.ts
```typescript
// Champs :
// id: INT UNSIGNED AUTO_INCREMENT PK
// sharing_link_id: CHAR(36) NOT NULL (FK sharing_links, CASCADE DELETE)
// agency_id: INT UNSIGNED NULLABLE (FK agencies, SET NULL on delete)
//   — null si agence non connectée
// viewer_email: VARCHAR(255) NULLABLE
//   — capturé si agence non connectée (lead)
// viewed_at: DATETIME DEFAULT NOW
// ip_address: VARCHAR(45) NULLABLE
// user_agent: VARCHAR(500) NULLABLE
// documents_downloaded: JSON NULLABLE
//   — tableau des document_ids téléchargés durant cette session
//   — ex: [123, 124, 125]
// access_level: ENUM('limited', 'full') NOT NULL DEFAULT 'limited'
//   — 'limited' si agence non payante ou non connectée
//   — 'full' si agence active ou trial
//
// Index sur : sharing_link_id, agency_id, viewed_at
```

### 3. Migrations Sequelize

#### src/migrations/XXX-create-sharing-links.ts
```typescript
// up() :
// - createTable 'sharing_links' avec tous les champs
// - PK id en CHAR(36) (UUID)
// - FK folder_id → folders (CASCADE DELETE)
// - INDEX sur folder_id, expires_at, revoked_at
// down() : dropTable
```

#### src/migrations/XXX-create-sharing-views.ts
```typescript
// up() :
// - createTable 'sharing_views' avec tous les champs
// - FK sharing_link_id → sharing_links (CASCADE DELETE)
// - FK agency_id → agencies (SET NULL on delete)
// - INDEX sur sharing_link_id, agency_id, viewed_at
// down() : dropTable
```

### 4. src/services/SharingService.ts
Toute la logique métier partage centralisée ici.
```typescript
class SharingService {

  // createSharingLink(params) : Promise<SharingLink>
  // params: { folderId: number, userId: number, context?: object }
  // - Vérifie que le folder appartient bien au userId
  // - Vérifie que folder.folder_status = 'active'
  //   (impossible de partager un dossier en standby ou archivé → 400)
  // - Génère UUID v4 comme id du lien
  // - Calcule expires_at = NOW() + config.sharing.expiryDays jours
  // - Crée SharingLink en BDD
  // - Logger dans AuditLog : action 'folder.shared',
  //   entity_type 'sharing_link', entity_id: link.id
  // - Retourne le lien avec url complète :
  //   url = `${config.sharing.baseLinkUrl}/${link.id}`

  // getSharingLinks(userId: number) : Promise<SharingLink[]>
  // - Récupère tous les liens du folder du userId
  // - Inclut views_count, last_viewed_at, context, expires_at, revoked_at
  // - Triés par created_at DESC
  // - Ajoute champ calculé is_active :
  //   true si revoked_at IS NULL AND expires_at > NOW()

  // revokeSharingLink(linkId: string, userId: number) : Promise<void>
  // - Vérifie que le lien appartient au folder du userId
  // - Vérifie que le lien n'est pas déjà révoqué
  // - Met à jour revoked_at = NOW()
  // - Logger dans AuditLog : action 'sharing_link.revoked'

  // extendSharingLink(linkId: string, userId: number) : Promise<SharingLink>
  // - Vérifie ownership
  // - Vérifie que le lien n'est pas révoqué
  // - Ajoute 30 jours à expires_at
  // - Retourne lien mis à jour

  // consultFolder(params) : Promise<{ folder: object, accessLevel: string }>
  // params: {
  //   linkId: string,
  //   requestingAgencyId?: number,   // si agence connectée
  //   viewerEmail?: string,          // si non connectée (lead)
  //   ipAddress: string,
  //   userAgent: string
  // }
  // PROCESS :
  // 1. Récupérer SharingLink WHERE id = linkId
  //    → 404 si inexistant
  //    → 410 Gone si revoked_at IS NOT NULL
  //    → 410 Gone si expires_at < NOW()
  //
  // 2. Déterminer accessLevel :
  //    - Si requestingAgencyId présent :
  //        Récupérer Agency
  //        Si status IN ('active', 'trial') → accessLevel = 'full'
  //        Sinon → accessLevel = 'limited'
  //    - Sinon → accessLevel = 'limited'
  //
  // 3. Créer SharingView en BDD :
  //    { sharing_link_id, agency_id, viewer_email, ip_address,
  //      user_agent, access_level }
  //
  // 4. Incrémenter SharingLink.views_count + last_viewed_at = NOW()
  //
  // 5. Appeler FolderService.getFolderForSharing(folder_id, accessLevel)
  //
  // 6. Logger dans AuditLog : action 'folder.viewed',
  //    details: { link_id, access_level, agency_id }
  //
  // 7. Retourner { folder: folderData, accessLevel, linkId }

  // trackDocumentDownload(params) : Promise<void>
  // params: { linkId: string, documentId: number, agencyId: number }
  // - Récupère la dernière SharingView pour ce linkId + agencyId
  // - Met à jour documents_downloaded (ajouter documentId si pas déjà présent)
  // - Logger dans AuditLog : action 'document.downloaded.via_link'

  // getSharingHistory(userId: number) : Promise<object[]>
  // - Récupère tous les liens du folder du userId
  // - Pour chaque lien, inclut les SharingViews associées :
  //   { viewed_at, agency_name (si connectée), viewer_email (si lead),
  //     access_level, documents_downloaded_count }
  // - Triés par viewed_at DESC
  // - Retourne historique complet pour affichage locataire

  // getActiveSharingLinksForFolder(folderId: number) : Promise<SharingLink[]>
  // - Retourne liens actifs (non révoqués, non expirés)
  // - Utilisé par les notifications (Partie 9)
}
```

### 5. src/validators/sharing.validator.ts
```typescript
// createSharingLinkSchema :
// - context: object, optional :
//     property_type: string, optional, max 10 (T1, T2, T3...)
//     city: string, optional, max 100
//     budget: number, optional, min 0, max 100000
//     availability: string, optional, date ISO format YYYY-MM-DD
//     listing_ref: string, optional, max 100

// consultFolderSchema (query params) :
// - email: string, email format, optional (lead capture)

// trackDownloadSchema :
// - document_id: number, required
// - link_id: string, uuid format, required
```

### 6. src/controllers/SharingController.ts
```typescript
class SharingController {

  // createLink(req, res) :
  // POST /api/v1/sharing/links (AUTH: tenant)
  // - Valide body avec createSharingLinkSchema
  // - Récupère folder du user (FolderService.getOrCreateFolder)
  // - Appelle SharingService.createSharingLink({
  //     folderId: folder.id,
  //     userId: req.user.id,
  //     context: body.context
  //   })
  // - Retourne 201 avec :
  //   { id, url, expires_at, created_at, context }
  // - Message: "Lien de partage créé"

  // getMyLinks(req, res) :
  // GET /api/v1/sharing/links (AUTH: tenant)
  // - Récupère folder du user
  // - Appelle SharingService.getSharingLinks(req.user.id)
  // - Retourne 200 avec liste des liens + is_active

  // revokeLink(req, res) :
  // DELETE /api/v1/sharing/links/:linkId (AUTH: tenant)
  // - Appelle SharingService.revokeSharingLink(params.linkId, req.user.id)
  // - Retourne 204

  // extendLink(req, res) :
  // PATCH /api/v1/sharing/links/:linkId/extend (AUTH: tenant)
  // - Appelle SharingService.extendSharingLink(params.linkId, req.user.id)
  // - Retourne 200 avec lien mis à jour
  // - Message: "Lien prolongé de 30 jours"

  // getSharingHistory(req, res) :
  // GET /api/v1/sharing/history (AUTH: tenant)
  // - Appelle SharingService.getSharingHistory(req.user.id)
  // - Retourne 200 avec historique consultations

  // consultFolder(req, res) :
  // GET /api/v1/sharing/view/:linkId (PUBLIC)
  // - Valide query params avec consultFolderSchema
  // - Détermine agencyId :
  //   Si JWT présent ET role = agency_* → req.user.agencyId
  //   Si JWT présent ET role = tenant → 403 "Accès non autorisé"
  //   Si pas de JWT → null (accès limité)
  // - Appelle SharingService.consultFolder({
  //     linkId: params.linkId,
  //     requestingAgencyId: agencyId,
  //     viewerEmail: query.email,
  //     ipAddress: req.ip,
  //     userAgent: req.headers['user-agent']
  //   })
  // - Retourne 200 avec { folder, accessLevel }
  // - Note : retourner 410 Gone si lien révoqué ou expiré

  // trackDownload(req, res) :
  // POST /api/v1/sharing/track-download (AUTH: agency_owner | agency_agent)
  // - Valide body avec trackDownloadSchema
  // - Appelle SharingService.trackDocumentDownload({
  //     linkId: body.link_id,
  //     documentId: body.document_id,
  //     agencyId: req.user.agencyId
  //   })
  // - Retourne 200
  // - Appelé automatiquement par le frontend après chaque téléchargement
}
```

### 7. src/routes/sharing.routes.ts
```typescript
// Routes :
// POST   /links                    → SharingController.createLink
//                                    (auth: tenant)
// GET    /links                    → SharingController.getMyLinks
//                                    (auth: tenant)
// DELETE /links/:linkId            → SharingController.revokeLink
//                                    (auth: tenant)
// PATCH  /links/:linkId/extend     → SharingController.extendLink
//                                    (auth: tenant)
// GET    /history                  → SharingController.getSharingHistory
//                                    (auth: tenant)
// GET    /view/:linkId             → SharingController.consultFolder
//                                    (PUBLIC — auth optionnel)
//                                    Note : utiliser middleware optionalAuth
//                                    qui parse le JWT si présent sans bloquer
//                                    si absent
// POST   /track-download           → SharingController.trackDownload
//                                    (auth: agency_owner | agency_agent)
```

### 8. src/middlewares/auth.middleware.ts
Ajouter sans toucher à l'existant :
```typescript
// optionalAuth(req, res, next) :
// - Si header Authorization présent → tenter de décoder JWT
//   Si valide → populer req.user normalement → next()
//   Si invalide → next() sans req.user (ne pas bloquer)
// - Si header absent → next() sans req.user
// - Utilisé pour les endpoints publics qui bénéficient
//   d'un contexte si l'utilisateur est connecté
```

### 9. Brancher dans src/routes/index.ts
```typescript
import sharingRouter from './sharing.routes';
app.use('/api/v1/sharing', sharingRouter);
```

### 10. Mettre à jour src/models/index.ts
```typescript
// SharingLink.belongsTo(Folder, { foreignKey: 'folder_id', as: 'folder' })
// Folder.hasMany(SharingLink, { foreignKey: 'folder_id', as: 'sharingLinks' })
// SharingView.belongsTo(SharingLink, { foreignKey: 'sharing_link_id', as: 'sharingLink' })
// SharingLink.hasMany(SharingView, { foreignKey: 'sharing_link_id', as: 'views' })
// SharingView.belongsTo(Agency, { foreignKey: 'agency_id', as: 'agency' })
```

---

## Tests à écrire

### src/__tests__/sharing.test.ts
```typescript
describe('POST /api/v1/sharing/links', () => {
  test('should create sharing link with context', async () => {
    // Auth tenant avec folder actif
    // Body: { context: { property_type: 'T2', city: 'Paris', budget: 1200 } }
    // Vérifie 201 + url contient linkId
    // Vérifie expires_at ≈ NOW + 30 jours
    // Vérifie AuditLog créé avec action 'folder.shared'
  });

  test('should create link without context', async () => {
    // Body vide
    // Vérifie 201
  });

  test('should reject if folder not active', async () => {
    // folder_status = 'standby'
    // Vérifie 400
  });

  test('should reject if not tenant role', async () => {
    // Auth agency_owner
    // Vérifie 403
  });
});

describe('GET /api/v1/sharing/view/:linkId', () => {
  test('should return limited view for unauthenticated visitor', async () => {
    // Pas de JWT
    // Vérifie 200 + accessLevel = 'limited'
    // Vérifie ai_score_global absent ou null
    // Vérifie SharingView créée en BDD
    // Vérifie views_count incrémenté
  });

  test('should return limited view for non-paying agency', async () => {
    // Auth agency avec status = 'cancelled'
    // Vérifie accessLevel = 'limited'
  });

  test('should return full view for active agency', async () => {
    // Auth agency avec status = 'active'
    // Vérifie 200 + accessLevel = 'full'
    // Vérifie données complètes (last_name, scores...)
  });

  test('should return full view for trial agency', async () => {
    // Auth agency avec status = 'trial'
    // Vérifie accessLevel = 'full'
  });

  test('should capture viewer email as lead', async () => {
    // GET /view/:linkId?email=lead@agence.fr (pas de JWT)
    // Vérifie SharingView.viewer_email = 'lead@agence.fr'
  });

  test('should return 410 for revoked link', async () => {
    // Link avec revoked_at IS NOT NULL
    // Vérifie 410
  });

  test('should return 410 for expired link', async () => {
    // Link avec expires_at dans le passé
    // Vérifie 410
  });

  test('should return 410 for non-existent link', async () => {
    // UUID inexistant
    // Vérifie 404
  });

  test('should reject if tenant tries to consult', async () => {
    // Auth tenant
    // Vérifie 403
  });
});

describe('DELETE /api/v1/sharing/links/:linkId', () => {
  test('should revoke link', async () => {
    // Vérifie 204
    // Vérifie revoked_at IS NOT NULL en BDD
    // Vérifie AuditLog créé
  });

  test('should reject if link belongs to another user', async () => {
    // Auth tenant différent
    // Vérifie 403 ou 404
  });
});

describe('PATCH /api/v1/sharing/links/:linkId/extend', () => {
  test('should extend link by 30 days', async () => {
    // Vérifie 200
    // Vérifie expires_at = ancien expires_at + 30 jours
  });

  test('should reject extension of revoked link', async () => {
    // Vérifie 400
  });
});

describe('GET /api/v1/sharing/history', () => {
  test('should return consultation history for tenant', async () => {
    // Créer 2 SharingViews pour 2 agences différentes
    // Vérifie 200 + array avec détails consultations
    // Vérifie agency_name présent si agence connectée
    // Vérifie viewer_email présent si lead
  });
});

describe('POST /api/v1/sharing/track-download', () => {
  test('should track document download in sharing view', async () => {
    // Auth agency_owner
    // Body: { link_id, document_id: 123 }
    // Vérifie SharingView.documents_downloaded contient 123
    // Vérifie AuditLog créé
  });

  test('should not duplicate document_id in tracking', async () => {
    // Appeler 2x avec le même document_id
    // Vérifie documents_downloaded ne contient 123 qu'une fois
  });
});
```

---

## Règles importantes à respecter

- Toutes les réponses utilisent successResponse / errorResponse
- Toute config passe par config de src/config/env.ts
- Logger Winston pour tous les events importants
- Les liens expirés ou révoqués retournent 410 Gone (pas 404)
  pour distinguer "n'existe pas" de "n'est plus accessible"
- L'email capturé (lead) ne doit jamais être retourné
  dans les réponses publiques (uniquement visible côté admin)
- Le middleware optionalAuth ne doit JAMAIS bloquer la requête
  même si le JWT est malformé — juste ignorer dans ce cas
- views_count doit être incrémenté de manière atomique :
  SharingLink.increment('views_count', { where: { id: linkId } })
- Toutes les consultations sont loggées (même les accès limités)
  pour la traçabilité RGPD
- La stéganographie (Partie 5) doit être déclenchée depuis
  DocumentService.downloadDocumentForAgency — penser à passer
  le linkId dans les params pour enrichir les métadonnées cachées