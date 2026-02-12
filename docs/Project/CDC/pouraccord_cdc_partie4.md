# POURACCORD - Cahier des Charges Détaillé
## PARTIE 4/4 (FINALE)

## TABLE DES MATIÈRES DE CETTE PARTIE

- 7. Sécurité et RGPD
- 8. Interfaces Utilisateurs
- 9. Notifications
- 10. Plan de Tests
- 11. Déploiement et Infrastructure
- 12. Annexes

---

## 7. SÉCURITÉ ET RGPD

### 7.1 Consentements Obligatoires

À l'inscription, le locataire consent explicitement à :

```
┌─────────────────────────────────────────────────────┐
│  CONSENTEMENTS RGPD                                 │
├─────────────────────────────────────────────────────┤
│  ☑ J'accepte que mes données personnelles soient   │
│     stockées de manière sécurisée pendant 6 mois    │
│     maximum (détails)                               │
│                                                      │
│  ☑ J'accepte de partager mon dossier avec des      │
│     agences immobilières de mon choix (détails)     │
│                                                      │
│  ☑ J'accepte que mes données anonymisées soient    │
│     utilisées pour améliorer les algorithmes de     │
│     détection de fraude (détails)                   │
│                                                      │
│  [  EN SAVOIR PLUS  ]  [  CONTINUER  ]             │
└─────────────────────────────────────────────────────┘
```

**Implémentation** :
- Table `user_consents` :
  ```sql
  CREATE TABLE user_consents (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    consent_type ENUM('data_storage', 'data_sharing', 'ml_training') NOT NULL,
    consented_at DATETIME NOT NULL,
    ip_address VARCHAR(45),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  ```
- Consentement enregistré avec timestamp + IP (preuve)

---

### 7.2 Droits des Utilisateurs

#### Droit d'Accès

**Implémentation** : Endpoint `/users/me/data-export`

**Process** :
1. User clique "Télécharger mes données" dans `/settings/privacy`
2. Backend génère :
   - JSON complet (user, folder, documents metadata, logs)
   - ZIP avec tous fichiers S3
3. Envoi lien téléchargement par email (presigned URL S3, expire 24h)

**Format export** :
```
mon_dossier_pouraccord.zip
├── user_data.json
│   ├── profile: {...}
│   ├── folder: {...}
│   ├── documents: [{...}, {...}]
│   ├── sharing_links: [{...}]
│   └── audit_logs: [{...}]
└── documents/
    ├── CNI.pdf
    ├── fiche_paie_oct.pdf
    └── ...
```

---

#### Droit de Rectification

**Implémentation** : Toutes données modifiables via `/settings` ou dashboard

**Actions** :
- Modifier profil (nom, prénom, téléphone...)
- Remplacer document (upload nouveau fichier)
- Modifier commentaires documents

**Log** : Toute modification enregistrée dans `audit_logs`

---

#### Droit à l'Effacement

**Implémentation** : Endpoint `/users/me/delete`

**Process** :
1. User clique "Supprimer mon compte" dans `/settings/privacy`
2. Confirmation modale avec password
3. Backend :
   - Soft delete user (`deleted_at = NOW()`)
   - Suppression tous fichiers S3 (async job)
   - Hard delete données sensibles (documents metadata, extracted_data)
   - Anonymisation logs (remplacer user_id par `<deleted>`)
   - Email confirmation suppression

**Délai grâce** : 30 jours (restauration possible si demande)

**Après 30j** : Hard delete définitif

---

#### Droit à la Portabilité

**Implémentation** : Même que droit d'accès (export ZIP)

**Limitation** : Scoring IA non inclus (propriété intellectuelle POURACCORD)

---

### 7.3 Traçabilité

#### Logs d'Audit

**Table** : `audit_logs` (voir Partie 2)

**Events loggés** :
```javascript
// Authentification
'auth.login', 'auth.logout', 'auth.password_reset'

// Documents
'document.uploaded', 'document.downloaded', 'document.deleted', 'document.replaced'

// Partage
'folder.shared', 'sharing_link.created', 'sharing_link.revoked', 'folder.viewed'

// Modifications
'profile.updated', 'folder.status_changed'

// Administration
'admin.moderation.validated', 'admin.moderation.rejected', 'admin.user.suspended'
```

**Middleware Express** :
```javascript
function auditLog(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode < 400) {  // Log seulement succès
      const log = {
        user_id: req.user?.id,
        agency_id: req.user?.agency_id,
        ip_address: req.ip,
        action: `${req.method} ${req.path}`,
        entity_type: extractEntityType(req.path),
        entity_id: req.params.id,
        details: JSON.stringify({
          query: req.query,
          body: sanitize(req.body)  // Masquer mots de passe, etc.
        })
      };
      
      AuditLog.create(log);
    }
  });
  
  next();
}

app.use(auditLog);
```

---

### 7.4 Conservation et Suppression

#### Durées de Vie

**Documents** :
```javascript
const DOCUMENT_VALIDITY = {
  payslip: 3,  // mois
  proof_of_residence: 3,
  identity_card: null,  // date légale CNI
  passport: null,  // date légale passeport
  tax_notice: 12,
  employment_contract: null,  // pas d'expiration auto
  student_card: 12,
  kbis: 3
};
```

**Dossier complet** :
- Durée max : **6 mois** après création ou dernière modification
- Alerte : 30 jours avant expiration
- Possibilité prolongation si docs toujours valides (re-upload)

---

#### Nettoyage Automatique (CRON)

**Script quotidien** (3h du matin) :
```javascript
const cron = require('node-cron');

// Tous les jours à 3h
cron.schedule('0 3 * * *', async () => {
  console.log('[CRON] Lancement nettoyage quotidien...');
  
  // 1. Documents expirés
  const expiredDocs = await Document.findAll({
    where: {
      expires_at: { [Op.lt]: new Date() },
      deleted_at: null
    }
  });
  
  for (const doc of expiredDocs) {
    // Suppression S3
    await s3.deleteObject({
      Bucket: 'pouraccord-documents-prod',
      Key: doc.file_path
    }).promise();
    
    // Soft delete BDD
    await doc.update({ deleted_at: new Date() });
    
    // Notification locataire
    await sendEmail({
      to: doc.folder.user.email,
      subject: 'Document expiré',
      body: `Votre ${doc.document_type} a expiré et a été supprimé.`
    });
  }
  
  // 2. Dossiers expirés (6 mois)
  const expiredFolders = await Folder.findAll({
    where: {
      expires_at: { [Op.lt]: new Date() },
      deleted_at: null
    }
  });
  
  for (const folder of expiredFolders) {
    // Suppression tous documents
    const docs = await folder.getDocuments();
    for (const doc of docs) {
      await s3.deleteObject({
        Bucket: 'pouraccord-documents-prod',
        Key: doc.file_path
      }).promise();
    }
    
    // Soft delete dossier
    await folder.update({ deleted_at: new Date() });
    
    // Notification locataire
    await sendEmail({
      to: folder.user.email,
      subject: 'Dossier expiré',
      body: 'Votre dossier a expiré après 6 mois.'
    });
  }
  
  // 3. Alertes pré-expiration (7j avant)
  const expiringDocs = await Document.findAll({
    where: {
      expires_at: {
        [Op.between]: [new Date(), addDays(new Date(), 7)]
      },
      deleted_at: null
    }
  });
  
  for (const doc of expiringDocs) {
    await sendEmail({
      to: doc.folder.user.email,
      subject: 'Document expire bientôt',
      body: `Votre ${doc.document_type} expire dans ${daysUntil(doc.expires_at)} jours.`
    });
  }
  
  console.log('[CRON] Nettoyage terminé.');
});
```

---

#### Suppression Hard Delete (RGPD)

**Après 3 ans** : Anonymisation logs d'audit

```sql
-- CRON annuel
UPDATE audit_logs
SET user_id = NULL,
    ip_address = '0.0.0.0',
    details = JSON_SET(details, '$.email', 'anonymized@example.com')
WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 YEAR);
```

---

### 7.5 Sécurité

#### Chiffrement

**Au repos** :
- **S3** : SSE-S3 (AES-256) activé par défaut
- **MySQL** : Encryption at rest (AWS RDS : `encrypt_at_rest = true`)
- **Secrets** : Variables d'environnement chiffrées (AWS Secrets Manager ou Vault)

**En transit** :
- **HTTPS/TLS 1.3** : Obligatoire (redirection HTTP → HTTPS)
- **HSTS** : Header `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

#### Watermarking & Stéganographie

**Watermark visible** (pypdf ou pdfkit) :
```python
from reportlab.pdfgen import canvas
from PyPDF2 import PdfReader, PdfWriter

def add_watermark(input_pdf: str, agency_name: str, timestamp: str) -> bytes:
    # Création watermark
    watermark_buffer = io.BytesIO()
    c = canvas.Canvas(watermark_buffer)
    c.setFont("Helvetica", 10)
    c.setFillColorRGB(0.5, 0.5, 0.5, alpha=0.3)
    c.drawString(50, 50, f"Consulté par {agency_name} le {timestamp}")
    c.save()
    
    # Fusion avec PDF original
    watermark_pdf = PdfReader(watermark_buffer)
    original_pdf = PdfReader(input_pdf)
    output_pdf = PdfWriter()
    
    for page_num in range(len(original_pdf.pages)):
        page = original_pdf.pages[page_num]
        page.merge_page(watermark_pdf.pages[0])
        output_pdf.add_page(page)
    
    output_buffer = io.BytesIO()
    output_pdf.write(output_buffer)
    return output_buffer.getvalue()
```

**Stéganographie invisible** (LSB) :
```python
def embed_steganography(image_path: str, data: dict) -> bytes:
    from stegano import lsb
    
    secret_message = json.dumps(data)
    secret_image = lsb.hide(image_path, secret_message)
    
    output_buffer = io.BytesIO()
    secret_image.save(output_buffer, format='PNG')
    return output_buffer.getvalue()

# Usage
data_to_hide = {
    "agency_id": 10,
    "user_id": 200,
    "document_id": 789,
    "timestamp": "2026-02-10T14:32:00Z"
}
watermarked_image = embed_steganography("document.png", data_to_hide)
```

---

#### Rate Limiting

**express-rate-limit** :
```javascript
const rateLimit = require('express-rate-limit');

// Général : 100 req / 15 min
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Trop de requêtes, réessayez dans 15 minutes.'
});

// Login : 5 tentatives / 15 min
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', loginLimiter);
```

---

#### Protection Injections

**Validation inputs** (Joi) :
```javascript
const Joi = require('joi');

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
  password_confirmation: Joi.ref('password')
});

app.post('/auth/register', (req, res) => {
  const { error, value } = registerSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({ success: false, errors: error.details });
  }
  
  // Proceed...
});
```

**ORM Sequelize** : Protection automatique contre SQL injection

---

#### Headers Sécurité (Helmet)

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://s3.amazonaws.com"],
      connectSrc: ["'self'", "https://api.pouraccord.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));
```

---

#### Audits & Certifications

**Roadmap sécurité** :
- **Mois 3** : Audit interne (checklist OWASP Top 10)
- **Mois 6** : Pentest externe (cabinet spécialisé)
- **Année 2** : Certification ISO 27001 (objectif)
- **Continue** : Scans automatiques Snyk (dépendances npm/python)

---

## 8. INTERFACES UTILISATEURS

### 8.1 Design System

**Principes** :
- **Clarity** : Navigation claire, actions évidentes
- **Feedback** : Loading states, messages succès/erreur
- **Accessibility** : WCAG 2.1 AA (contraste, alt text, keyboard nav)

**Palette couleurs** :
- **Primary** : Bleu #2563EB (confiance, sécurité)
- **Success** : Vert #10B981
- **Warning** : Orange #F59E0B
- **Error** : Rouge #EF4444
- **Neutral** : Gris #6B7280

**Typographie** :
- **Headings** : Inter Bold
- **Body** : Inter Regular
- **Monospace** : Fira Code (logs, code)

---

### 8.2 Wireframes Clés

#### Dashboard Locataire

```
┌────────────────────────────────────────────────────────────────┐
│  POURACCORD          [🔍 Rechercher]        [Jean M. ▼]       │
├────────────────────────────────────────────────────────────────┤
│  ← Tableau de bord                                             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Bonjour Jean 👋                                               │
│  Votre dossier est complet à 87%                               │
│                                                                 │
│  ████████████████████░░░░░  87%                                │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│  📄 DOCUMENTS (14/16)                      [➕ Ajouter]        │
│                                                                 │
│  ✅ Pièce d'identité                    Expire: 2030          │
│  ✅ Justificatif domicile              Expire dans 12j ⏳     │
│  ✅ Fiche paie Oct 2025                Valide ✅              │
│  ✅ Fiche paie Nov 2025                Valide ✅              │
│  ✅ Fiche paie Déc 2025                Valide ✅              │
│  ❌ RIB                                 Manquant               │
│  ❌ Avis d'imposition                   Manquant               │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│  📊 STATUT: 🟢 Vérifié (Score: 92/100)                        │
│                                                                 │
│  ⚠️ 2 points de vigilance:                                     │
│  • Justificatif domicile expire bientôt                        │
│  • Avis d'imposition manquant                                  │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│  🔗 PARTAGES (3)                         [Partager]            │
│                                                                 │
│  📍 T2 Paris 15e - 1200€                                       │
│     Consulté 2 fois • Expire dans 18j                          │
│                                                                 │
│  📍 T3 Lille - 900€                                            │
│     Non consulté • Expire dans 25j                             │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│  🔔 ACTIVITÉ RÉCENTE                                           │
│                                                                 │
│  🏢 Agence Dupont a consulté votre dossier (Il y a 2h)        │
│  📥 Agence Martin a téléchargé 3 documents (Hier)             │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

#### Dashboard Agence

```
┌────────────────────────────────────────────────────────────────┐
│  POURACCORD          [🔍 Rechercher]    [Agence Dupont ▼]     │
├────────────────────────────────────────────────────────────────┤
│  ← Tableau de bord                                             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 STATISTIQUES (30 derniers jours)                           │
│                                                                 │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐   │
│  │ 45 Dossiers │ 18 Nouveaux │ 12 Favoris  │ 60h Gagnées │   │
│  │  consultés  │  cette sem. │ actifs      │  (~30 min/  │   │
│  │             │             │             │   dossier)  │   │
│  └─────────────┴─────────────┴─────────────┴─────────────┘   │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│  📋 DOSSIERS (45)                                              │
│                                                                 │
│  Filtres: [Tous ▼] [Favoris ⭐] [Présélec. ✅] [Refusés ❌]  │
│  Tri: [Plus récents ▼]                                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 👤 Jean MARTIN • 28 ans • CDI • 3542€/mois              │ │
│  │    📍 T2 Paris 15e - 1200€ • Dispo: 01/03/2026          │ │
│  │    📊 92/100 🟢 EXCELLENT  |  ⭐ Favori  |  ✅ Présélec. │ │
│  │    Reçu le 10/02 • Consulté le 10/02 à 14h32            │ │
│  │    [👁️ Voir dossier] [📧 Contacter] [📥 Télécharger]   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 👤 Sophie DURAND • 25 ans • CDD • 2800€/mois            │ │
│  │    📍 T1 Paris 18e - 950€ • Dispo: 15/03/2026           │ │
│  │    📊 78/100 🟡 BON  |  ☆  |  État: Nouveau             │ │
│  │    Reçu le 09/02 • Non consulté                          │ │
│  │    [👁️ Voir dossier]                                     │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [Charger plus...]                                             │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

#### Modal Upload Document

```
┌─────────────────────────────────────────┐
│  Ajouter un document               [✕]  │
├─────────────────────────────────────────┤
│                                          │
│  Type de document *                      │
│  [Fiche de paie                    ▼]   │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │                                    │ │
│  │      📄 Glissez votre fichier     │ │
│  │          ou cliquez ici           │ │
│  │                                    │ │
│  │   PDF, JPG, PNG • Max 5 Mo        │ │
│  │                                    │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Commentaire (optionnel)                 │
│  [____________________________]          │
│  [____________________________]          │
│                                          │
│  [  Annuler  ]      [  Ajouter  ]       │
│                                          │
└─────────────────────────────────────────┘
```

---

### 8.3 Responsive

**Breakpoints** :
- **Mobile** : < 640px
- **Tablet** : 640px - 1024px
- **Desktop** : > 1024px

**Adaptations** :
- Navigation mobile : hamburger menu
- Tableaux : scroll horizontal ou cards
- Actions : FAB (Floating Action Button) sur mobile

---

## 9. NOTIFICATIONS

### 9.1 Types de Notifications

#### Locataire

| Type | Déclencheur | Canal | Priorité |
|------|-------------|-------|----------|
| Confirmation compte | Inscription | Email | Haute |
| Dossier complet | 100% docs | Email + In-app | Moyenne |
| Document expire bientôt | 7j avant | Email + In-app | Haute |
| Document expiré | J | Email | Haute |
| Dossier consulté | Agence vue | In-app | Basse |
| Document téléchargé | Agence DL | In-app | Basse |
| Dossier en vérification | IA review | Email | Moyenne |
| Dossier expire bientôt | 30j avant | Email | Haute |
| Dossier supprimé | Après 6 mois | Email | Haute |

---

#### Agence

| Type | Déclencheur | Canal | Priorité |
|------|-------------|-------|----------|
| Nouveau dossier | Locataire partage | Email + In-app | Haute |
| Dossier mis à jour | Locataire MAJ | Email + In-app | Moyenne |
| Dossier va expirer | 7j avant | Email | Moyenne |
| Fin essai | 7j avant | Email | Haute |
| Paiement échoué | Stripe webhook | Email | Critique |
| Paiement réussi | Stripe webhook | Email | Basse |

---

### 9.2 Templates Email

**Exemple : Document expire bientôt**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { background: #2563EB; color: white; padding: 12px 24px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h2>⏰ Votre document expire bientôt</h2>
    
    <p>Bonjour Jean,</p>
    
    <p>Votre <strong>Justificatif de domicile</strong> expire dans <strong>7 jours</strong> (le 17/02/2026).</p>
    
    <p>Pour maintenir votre dossier actif, pensez à uploader un nouveau justificatif récent.</p>
    
    <a href="https://pouraccord.com/dashboard" class="button">Mettre à jour mon dossier</a>
    
    <hr>
    
    <p style="color: #6B7280; font-size: 12px;">
      Vous recevez cet email car vous avez un compte sur POURACCORD.<br>
      <a href="https://pouraccord.com/settings/notifications">Gérer mes notifications</a>
    </p>
  </div>
</body>
</html>
```

---

### 9.3 Notifications In-App

**Composant React** :
```jsx
function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  useEffect(() => {
    // Fetch notifications
    fetch('/api/notifications?unread=true')
      .then(res => res.json())
      .then(data => {
        setNotifications(data.notifications);
        setUnreadCount(data.unread_count);
      });
  }, []);
  
  return (
    <div className="relative">
      <button onClick={() => setShowDropdown(!showDropdown)}>
        🔔
        {unreadCount > 0 && (
          <span className="badge">{unreadCount}</span>
        )}
      </button>
      
      {showDropdown && (
        <div className="dropdown">
          <h3>Notifications</h3>
          {notifications.map(notif => (
            <NotificationItem key={notif.id} notif={notif} />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### 9.4 Préférences Notifications

**Page** : `/settings/notifications`

```
┌─────────────────────────────────────────────────────┐
│  PRÉFÉRENCES DE NOTIFICATIONS                       │
├─────────────────────────────────────────────────────┤
│  📧 Email                                           │
│  ☑ Dossier complet                                 │
│  ☑ Document expire bientôt                         │
│  ☑ Dossier consulté par agence                     │
│  ☐ Document téléchargé par agence                  │
│  ☑ Alertes importantes (toujours actif)            │
│                                                      │
│  🔔 In-App (application)                           │
│  ☑ Tout activer                                     │
│                                                      │
│  📊 Récapitulatif hebdomadaire                     │
│  ☑ Recevoir un résumé chaque lundi                 │
│                                                      │
│  [  Enregistrer  ]                                  │
└─────────────────────────────────────────────────────┘
```

---

## 10. PLAN DE TESTS

### 10.1 Tests Unitaires

**Couverture cible** : 80% minimum

**Stack** :
- Backend : Jest + Supertest
- Frontend : Jest + React Testing Library

**Exemples** :

```javascript
// Backend: Test validation NIR
describe('NIR Validation', () => {
  test('should validate correct NIR', () => {
    const result = validateNIR('197035012345678');
    expect(result.valid).toBe(true);
  });
  
  test('should reject invalid checksum', () => {
    const result = validateNIR('197035012345699');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Clé de contrôle invalide');
  });
});

// Frontend: Test composant Upload
describe('DocumentUpload', () => {
  test('should accept PDF file', () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    render(<DocumentUpload />);
    
    const input = screen.getByLabelText('Upload');
    fireEvent.change(input, { target: { files: [file] } });
    
    expect(screen.getByText('test.pdf')).toBeInTheDocument();
  });
  
  test('should reject file > 5MB', () => {
    const largeFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'large.pdf');
    render(<DocumentUpload />);
    
    const input = screen.getByLabelText('Upload');
    fireEvent.change(input, { target: { files: [largeFile] } });
    
    expect(screen.getByText(/trop volumineux/i)).toBeInTheDocument();
  });
});
```

---

### 10.2 Tests d'Intégration

**Objectif** : Tester flux complets end-to-end (API)

**Exemples** :

```javascript
describe('Authentication Flow', () => {
  test('should register, verify email, and login', async () => {
    // 1. Register
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'SecureP@ss123',
        password_confirmation: 'SecureP@ss123',
        accept_terms: true,
        accept_privacy: true
      });
    
    expect(registerRes.status).toBe(201);
    
    // 2. Verify email (simulate)
    const token = await getVerificationToken('test@example.com');
    const verifyRes = await request(app)
      .post('/api/auth/verify-email')
      .send({ token });
    
    expect(verifyRes.status).toBe(200);
    
    // 3. Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'SecureP@ss123'
      });
    
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.access_token).toBeDefined();
  });
});

describe('Document Upload Flow', () => {
  let authToken;
  
  beforeAll(async () => {
    // Setup: Create user and get token
    authToken = await createTestUserAndGetToken();
  });
  
  test('should upload, analyze, and retrieve document', async () => {
    // 1. Upload
    const uploadRes = await request(app)
      .post('/api/documents/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', 'tests/fixtures/cni.pdf')
      .field('document_type', 'identity_card');
    
    expect(uploadRes.status).toBe(201);
    const docId = uploadRes.body.data.id;
    
    // 2. Wait for analysis (poll ou webhook mock)
    await waitForAnalysis(docId);
    
    // 3. Retrieve
    const getRes = await request(app)
      .get(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${authToken}`);
    
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.status).toBe('valid');
    expect(getRes.body.data.ai_score).toBeGreaterThan(80);
  });
});
```

---

### 10.3 Tests E2E (End-to-End)

**Stack** : Playwright ou Cypress

**Scénarios clés** :

```javascript
// Cypress
describe('Locataire Journey', () => {
  it('should complete full tenant flow', () => {
    // 1. Register
    cy.visit('/register');
    cy.get('input[name="email"]').type('jean@test.com');
    cy.get('input[name="password"]').type('SecureP@ss123');
    cy.get('input[name="password_confirmation"]').type('SecureP@ss123');
    cy.get('input[type="checkbox"][name="accept_terms"]').check();
    cy.get('button[type="submit"]').click();
    
    cy.contains('Email de confirmation envoyé').should('be.visible');
    
    // 2. Verify email (mock)
    cy.task('getVerificationToken', 'jean@test.com').then(token => {
      cy.visit(`/verify-email?token=${token}`);
    });
    
    // 3. Login
    cy.visit('/login');
    cy.get('input[name="email"]').type('jean@test.com');
    cy.get('input[name="password"]').type('SecureP@ss123');
    cy.get('button[type="submit"]').click();
    
    // 4. Dashboard
    cy.url().should('include', '/dashboard');
    cy.contains('Bonjour').should('be.visible');
    
    // 5. Upload document
    cy.contains('Ajouter un document').click();
    cy.get('select[name="document_type"]').select('identity_card');
    cy.get('input[type="file"]').attachFile('cni.pdf');
    cy.contains('Ajouter').click();
    
    cy.contains('Document uploadé').should('be.visible');
    
    // 6. Wait analysis (mock or wait)
    cy.wait(3000);
    cy.reload();
    
    cy.contains('Pièce d\'identité').parent().should('contain', '✅');
    
    // 7. Share folder
    cy.contains('Partager mon dossier').click();
    cy.get('input[name="city"]').type('Paris 15e');
    cy.get('input[name="budget"]').type('1200');
    cy.contains('Générer le lien').click();
    
    cy.contains('https://pouraccord.com/view/').should('be.visible');
  });
});
```

---

### 10.4 Tests de Charge

**Outil** : k6 (Grafana)

**Scénarios** :

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp-up
    { duration: '5m', target: 100 },  // Steady
    { duration: '2m', target: 0 }     // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% des requêtes < 500ms
    http_req_failed: ['rate<0.01']    // Taux erreur < 1%
  }
};

export default function() {
  // Login
  let loginRes = http.post('https://api.pouraccord.com/v1/auth/login', JSON.stringify({
    email: `user${__VU}@test.com`,
    password: 'Test1234!'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  check(loginRes, {
    'login status 200': (r) => r.status === 200
  });
  
  let token = loginRes.json('data.access_token');
  
  // Get folder
  let folderRes = http.get('https://api.pouraccord.com/v1/folders/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  check(folderRes, {
    'folder status 200': (r) => r.status === 200
  });
  
  sleep(1);
}
```

**Métriques attendues** (100 VU) :
- Latence p95 : < 500ms
- Latence p99 : < 1s
- Taux erreur : < 1%
- Throughput : > 1000 req/s

---

### 10.5 Tests Sécurité

**OWASP ZAP** : Scan automatique

**Checklist manuelle** :
- [ ] Injection SQL (tester via Burp Suite)
- [ ] XSS (tester inputs formulaires)
- [ ] CSRF (vérifier tokens)
- [ ] Auth bypass (tester JWT invalides)
- [ ] File upload (tenter PHP, EXE...)
- [ ] Rate limiting (tester brute-force login)
- [ ] CORS (vérifier whitelist)
- [ ] Secrets exposure (vérifier .env, logs)

---

## 11. DÉPLOIEMENT ET INFRASTRUCTURE

### 11.1 Architecture Production

```
                         Internet
                            │
                            ▼
                   ┌────────────────┐
                   │  CloudFlare    │
                   │  (CDN + WAF)   │
                   └────────┬───────┘
                            │
                   ┌────────▼───────┐
                   │ Load Balancer  │
                   │   (OVH LB)     │
                   └────┬───────┬───┘
                        │       │
            ┌───────────┘       └───────────┐
            ▼                               ▼
    ┌───────────────┐               ┌───────────────┐
    │  Backend-1    │               │  Backend-2    │
    │  Node.js      │               │  Node.js      │
    │  (VPS)        │               │  (VPS)        │
    └───────┬───────┘               └───────┬───────┘
            │                               │
            └───────────┬───────────────────┘
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
      ┌─────────┐ ┌─────────┐ ┌─────────┐
      │ MySQL   │ │   S3    │ │   IA    │
      │ (RDS)   │ │ (OVH)   │ │ (VPS)   │
      └─────────┘ └─────────┘ └─────────┘
```

---

### 11.2 Environnements

| Env | Domaine | Usage | Config |
|-----|---------|-------|--------|
| **Dev** | localhost:3000 | Développement local | SQLite, S3 mock |
| **Staging** | staging.pouraccord.com | Tests pré-prod | MySQL RDS, S3 test |
| **Prod** | pouraccord.com | Production | MySQL RDS, S3 prod |

---

### 11.3 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, staging]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run tests
        run: npm test
      
      - name: Coverage
        run: npm run test:coverage
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.5.4
        with:
          ssh-private-key: ${{ secrets.SSH_PRIVATE_KEY }}
      
      - name: Deploy to production
        run: |
          ssh user@prod.pouraccord.com << 'EOF'
            cd /var/www/pouraccord
            git pull origin main
            npm ci --production
            npm run build
            pm2 restart pouraccord
          EOF
      
      - name: Health check
        run: |
          sleep 10
          curl -f https://api.pouraccord.com/health || exit 1
      
      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

### 11.4 Monitoring

**Uptime** : UptimeRobot
- URL : https://api.pouraccord.com/health
- Intervalle : 5 min
- Alertes : Email + SMS

**Logs** : Datadog ou Grafana Loki
- Centralisation logs backend, IA, CRON
- Dashboard temps réel
- Alertes erreurs critiques

**Erreurs** : Sentry
- Capture exceptions frontend + backend
- Source maps pour stack traces
- Alertes email

**Métriques** : Prometheus + Grafana
- CPU, RAM, disk usage
- Latence API (p50, p95, p99)
- Taux erreur HTTP
- Queue lengths (jobs async)

---

### 11.5 Backups

**MySQL** :
- Snapshots automatiques quotidiens (AWS RDS ou OVH Managed)
- Rétention 7 jours
- Backup manuel avant déploiement majeur

**S3** :
- Versioning activé (restauration fichiers supprimés)
- Lifecycle policy : archivage Glacier après 6 mois

**Restauration** :
- RTO (Recovery Time Objective) : < 4h
- RPO (Recovery Point Objective) : < 24h

---

### 11.6 Scaling Plan

**Phase 1 (Mois 1-6)** :
- Backend : 2 VPS (4 vCPU, 8 GB RAM)
- MySQL : 1 instance (2 vCPU, 4 GB RAM)
- Limite : ~5000 users, 50 agencies

**Phase 2 (Mois 7-12)** :
- Backend : 4 VPS (load balancing)
- MySQL : Read replicas (1 master + 2 replicas)
- Cache : Redis (sessions, métriques)
- Limite : ~20000 users, 200 agencies

**Phase 3 (Année 2+)** :
- Kubernetes (auto-scaling)
- MySQL Cluster (sharding si nécessaire)
- CDN assets statiques
- Multi-région (EU-West + EU-Central)

---

## 12. ANNEXES

### 12.1 Glossaire Technique

| Terme | Définition |
|-------|------------|
| **NIR** | Numéro d'Inscription au Répertoire (numéro sécu sociale) |
| **MRZ** | Machine Readable Zone (bande CNI/passeport) |
| **SIRET** | Système d'Identification du Répertoire des Établissements |
| **OCR** | Optical Character Recognition (reconnaissance texte) |
| **2FA** | Two-Factor Authentication (double authentification) |
| **JWT** | JSON Web Token (authentification stateless) |
| **TOTP** | Time-based One-Time Password (code 6 chiffres) |
| **LSB** | Least Significant Bit (stéganographie) |
| **ELA** | Error Level Analysis (détection altération images) |

---

### 12.2 Bibliothèques & Dépendances

**Backend (Node.js)** :
```json
{
  "dependencies": {
    "express": "^4.18.0",
    "sequelize": "^6.35.0",
    "mysql2": "^3.6.0",
    "bcrypt": "^5.1.0",
    "jsonwebtoken": "^9.0.0",
    "speakeasy": "^2.0.0",
    "qrcode": "^1.5.0",
    "multer": "^1.4.0",
    "aws-sdk": "^2.1400.0",
    "stripe": "^12.0.0",
    "nodemailer": "^6.9.0",
    "joi": "^17.9.0",
    "helmet": "^7.0.0",
    "express-rate-limit": "^6.8.0",
    "winston": "^3.10.0",
    "node-cron": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "typescript": "^5.0.0",
    "jest": "^29.5.0",
    "supertest": "^6.3.0",
    "eslint": "^8.45.0"
  }
}
```

**Frontend (React)** :
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.14.0",
    "@reduxjs/toolkit": "^1.9.5",
    "react-redux": "^8.1.0",
    "axios": "^1.4.0",
    "react-hook-form": "^7.45.0",
    "yup": "^1.2.0",
    "react-i18next": "^13.0.0",
    "tailwindcss": "^3.3.0",
    "@headlessui/react": "^1.7.0"
  },
  "devDependencies": {
    "vite": "^4.4.0",
    "@vitejs/plugin-react": "^4.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^5.16.5",
    "cypress": "^12.17.0"
  }
}
```

**IA (Python)** :
```txt
fastapi==0.100.0
uvicorn==0.23.0
pytesseract==0.3.10
Pillow==10.0.0
PyPDF2==3.0.1
scikit-learn==1.3.0
pandas==2.0.3
numpy==1.25.0
requests==2.31.0
python-multipart==0.0.6
pydantic==2.0.0
```

---

### 12.3 Ressources Externes

**Documentation** :
- Express.js : https://expressjs.com/
- Sequelize : https://sequelize.org/
- React : https://react.dev/
- Stripe : https://stripe.com/docs/api
- FastAPI : https://fastapi.tiangolo.com/

**APIs Publiques** :
- INSEE (SIRET) : https://api.insee.fr/catalogue/
- API Adresse : https://adresse.data.gouv.fr/api-doc/adresse
- Service-Public (docs locataires) : https://www.service-public.fr/particuliers/vosdroits/F1169

**Sécurité** :
- OWASP Top 10 : https://owasp.org/www-project-top-ten/
- RGPD : https://www.cnil.fr/fr/reglement-europeen-protection-donnees

---

### 12.4 Contacts & Support

**Équipe Projet** :
- Chef de Projet : [Nom]
- Lead Dev Backend : [Nom]
- Lead Dev Frontend : [Nom]
- Data Scientist (IA) : [Nom]
- DevOps : [Nom]

**Prestataires** :
- Hébergement : OVH Cloud
- Paiement : Stripe
- Email : SendGrid
- Monitoring : Datadog

**Support Technique** :
- Email : tech@pouraccord.com
- Slack : #pouraccord-dev
- Documentation interne : Notion

---

### 12.5 Planning Estimatif

**Phase 1 : MVP (Mois 1-3)** :
- Semaine 1-2 : Setup infrastructure, CI/CD
- Semaine 3-4 : Auth, gestion users
- Semaine 5-6 : Upload documents, stockage S3
- Semaine 7-8 : Module IA (OCR, validation basique)
- Semaine 9-10 : Partage dossiers, consultation agences
- Semaine 11 : Abonnement Stripe
- Semaine 12 : Tests, corrections, déploiement staging

**Phase 2 : Beta Privée (Mois 4)** :
- Semaine 13 : Tests utilisateurs (10-20 locataires, 3-5 agences)
- Semaine 14-15 : Corrections bugs, UX
- Semaine 16 : Déploiement production, lancement beta

**Phase 3 : Lancement Public (Mois 5-6)** :
- Semaine 17-18 : Campagne marketing, acquisition
- Semaine 19-20 : Monitoring, optimisation performances
- Semaine 21-24 : Roadmap V1.1 (recherche opt-in, garants, app mobile...)

---

### 12.6 Budget Estimatif (6 mois)

**Développement** :
- 3 devs × 6 mois × 6000€/mois = 108 000€
- 1 data scientist × 3 mois × 7000€/mois = 21 000€
- **Total dev** : 129 000€

**Infrastructure** :
- Serveurs OVH : 300€/mois × 6 = 1 800€
- Stripe fees : 2% × CA (variable)
- SendGrid : 50€/mois × 6 = 300€
- Datadog : 100€/mois × 6 = 600€
- **Total infra** : 2 700€

**Licences & Services** :
- GitHub Pro : 50€/mois × 6 = 300€
- Figma : 100€/mois × 6 = 600€
- Notion : 50€/mois × 6 = 300€
- **Total licences** : 1 200€

**Marketing (optionnel)** :
- Landing page : 3 000€
- Ads Google/Facebook : 5 000€
- Relations presse : 2 000€
- **Total marketing** : 10 000€

**TOTAL ESTIMÉ** : 143 000€

---

## FIN DU CAHIER DES CHARGES

---

**Document complet en 4 parties** :
- ✅ Partie 1 : Introduction, Architecture, Module Locataire
- ✅ Partie 2 : Module Agence, Module Admin, Modèle de Données
- ✅ Partie 3 : API REST, Module IA
- ✅ Partie 4 : Sécurité RGPD, Interfaces, Notifications, Tests, Déploiement

**Version** : 1.0  
**Date** : Février 2026  
**Statut** : Prêt pour développement

---

Pour toute question ou clarification, contactez l'équipe projet.
