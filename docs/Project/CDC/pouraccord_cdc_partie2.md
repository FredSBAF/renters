# POURACCORD - Cahier des Charges Détaillé
## PARTIE 2/4

## TABLE DES MATIÈRES DE CETTE PARTIE

- 3.2 Module Agence
- 3.3 Module Anti-Fraude IA (aperçu)
- 3.4 Module Administration
- 4. Modèle de Données (Schémas MySQL)

---

## 3.2 Module Agence

### 3.2.1 Inscription & Abonnement

**US-AGE-001 : Inscription B2B**

**Description** : Une agence crée son compte entreprise.

**Flux** :
1. Accès `/agency/register`
2. Saisie :
   - Nom agence
   - SIRET
   - Adresse siège social
   - Email responsable (deviendra compte gérant)
   - Mot de passe
   - Carte professionnelle (optionnel pour MVP, validation manuelle admin)
3. Système :
   - Vérifie SIRET via API INSEE
   - Extrait nom légal entreprise, adresse (validation cohérence)
   - Crée compte agence (statut : `trial`, `trial_ends_at` = NOW() + 30 jours)
   - Crée user gérant (rôle : `agency_owner`)
   - Envoie email confirmation + lien validation
4. Validation email → accès compte (pas de paiement immédiat)

**Règles métier** :
- SIRET unique en BDD
- Essai gratuit 30j démarre dès validation email
- Carte pro : upload PDF (validation admin si activé, sinon accepté automatiquement)

**API INSEE** :
```
GET https://api.insee.fr/entreprises/sirene/V3/siret/{SIRET}
Headers: Authorization: Bearer {TOKEN_INSEE}
Response:
{
  "etablissement": {
    "siren": "123456789",
    "siret": "12345678900010",
    "denominationUniteLegale": "AGENCE DUPONT IMMO",
    "adresseEtablissement": {...}
  }
}
```

---

**US-AGE-002 : Activation 2FA Obligatoire**

**Description** : Les comptes agences doivent activer 2FA.

**Flux** :
1. Première connexion après validation email → redirection forcée `/setup-2fa`
2. Génération QR code TOTP
3. Scan + saisie code validation
4. 2FA activé → accès plateforme

**Règle** : Impossible accéder plateforme sans 2FA actif (middleware backend vérifie)

---

**US-AGE-003 : Gestion Abonnement Stripe**

**Description** : Transition essai gratuit → abonnement payant.

**Flux essai gratuit** :
1. À J-7 de fin essai : email rappel + lien `/billing`
2. Gérant clique → redirection Stripe Checkout :
   - Produit : "Abonnement POURACCORD Agence"
   - Prix : 400€ HT/mois (480€ TTC)
   - Facturation : mensuelle récurrente
   - Paiement : CB uniquement (MVP)
3. Paiement OK :
   - Webhook Stripe → backend met à jour statut : `active`
   - `subscription_id` Stripe stocké en BDD
   - `next_billing_date` = NOW() + 1 mois
4. Email confirmation avec facture (auto-générée Stripe)

**Flux renouvellement** :
- Stripe facture automatiquement chaque mois
- Webhook `invoice.payment_succeeded` → logs BDD
- Webhook `invoice.payment_failed` → email agence + 3 tentatives (config Stripe)
- Après 3 échecs : statut `suspended` (accès lecture seule)

**Page `/billing`** :
```
┌─────────────────────────────────────────────────────┐
│  FACTURATION                                        │
├─────────────────────────────────────────────────────┤
│  Abonnement : ACTIF ✅                              │
│  Prochain prélèvement : 480€ TTC le 10/03/2026     │
│                                                      │
│  [Modifier carte bancaire]                          │
│  [Télécharger factures]                             │
│  [Résilier abonnement]                              │
├─────────────────────────────────────────────────────┤
│  HISTORIQUE FACTURES                                │
│  📄 Facture #001 - Jan 2026 - 480€ TTC             │
│  📄 Facture #002 - Fév 2026 - 480€ TTC             │
└─────────────────────────────────────────────────────┘
```

**Résiliation** :
- Bouton "Résilier" → confirmation modale
- Si confirmé : annulation abonnement Stripe (fin période en cours)
- Statut agence : `cancelled` à date fin période
- Accès lecture seule jusqu'à expiration

---

### 3.2.2 Gestion Équipe

**US-AGE-010 : Invitation Agents**

**Description** : Le gérant invite des agents immobiliers à rejoindre le compte agence.

**Flux** :
1. Depuis `/team`, clic "Inviter un agent"
2. Saisie email agent
3. Système :
   - Génère lien invitation `/agent/join?token=XXX&agency_id=YYY`
   - Envoie email agent
4. Agent clique lien :
   - Si compte existe : association agence (un user peut appartenir à 1 seule agence)
   - Sinon : inscription + association
5. Agent accède aux dossiers de l'agence (partage implicite)

**Règles métier** :
- Tous les agents voient tous les dossiers de l'agence
- Pas de granularité permissions (MVP simple)
- Seul gérant peut inviter/supprimer agents

**Page `/team`** :
```
┌─────────────────────────────────────────────────────┐
│  ÉQUIPE (5 membres)                                 │
├─────────────────────────────────────────────────────┤
│  👤 Marie Dupont (Gérant) - marie@agence.fr         │
│  👤 Jean Martin (Agent) - jean@agence.fr            │
│     [Retirer]                                        │
│  👤 Sophie Durand (Agent) - sophie@agence.fr        │
│     [Retirer]                                        │
│                                                      │
│  [➕ Inviter un agent]                              │
└─────────────────────────────────────────────────────┘
```

---

### 3.2.3 Accès aux Dossiers

**US-AGE-020 : Consultation Dossier (Agence Non-Cliente)**

**Description** : Une agence non-payante clique sur un lien partagé par un locataire.

**Flux** :
1. Clic lien `https://pouraccord.com/view/{UUID}`
2. Système vérifie :
   - Lien valide (non expiré, non révoqué)
   - Agence connectée ? (JWT présent)
3. Si agence non-connectée OU non-payante :
   - Affiche **fiche limitée** :
     ```
     ┌────────────────────────────────────────────┐
     │  PRÉVISUALISATION DOSSIER                  │
     ├────────────────────────────────────────────┤
     │  👤 Prénom : Jean                          │
     │  📅 Âge : 28 ans                           │
     │  💼 Situation : Salarié CDI                │
     │  💰 Revenus : ~3500€/mois (détails ⚠️)    │
     │  🏠 Recherche : T2 Paris 15e - 1200€      │
     │                                             │
     │  📊 Score : ████░░░░░░ (détails ⚠️)       │
     │                                             │
     │  ⚠️ Points de vigilance : 2 (détails ⚠️)  │
     ├────────────────────────────────────────────┤
     │  🔒 ACCÈS COMPLET RÉSERVÉ AUX ABONNÉS     │
     │                                             │
     │  Pour accéder au dossier complet :         │
     │  [  DÉMARRER L'ESSAI GRATUIT 30J  ]       │
     │                                             │
     │  Déjà client ? [Se connecter]              │
     └────────────────────────────────────────────┘
     ```
   - Formulaire capture email (si non-connecté) pour lead
4. Log consultation (table `sharing_views`)

**Règles métier** :
- Fiche limitée : données partielles, scoring flouté
- Bouton CTA : essai gratuit (redirection `/agency/register`)
- Capture email = lead pour sales

---

**US-AGE-021 : Consultation Dossier (Agence Payante)**

**Description** : Une agence abonnée accède au dossier complet.

**Flux** :
1. Clic lien ou accès depuis `/dossiers`
2. Système vérifie :
   - Agence abonnée (statut `active` ou `trial`)
   - 2FA validé cette session
3. Affiche **fiche complète** :
   ```
   ┌────────────────────────────────────────────────────┐
   │  DOSSIER : Jean MARTIN                            │
   ├────────────────────────────────────────────────────┤
   │  📋 INFORMATIONS PERSONNELLES                     │
   │  Nom complet : Jean MARTIN                         │
   │  Date naissance : 15/03/1997 (28 ans)             │
   │  Téléphone : 06 12 34 56 78                        │
   │  Email : jean.martin@email.com                     │
   │  Adresse actuelle : 12 rue de la Paix, Paris 10e  │
   ├────────────────────────────────────────────────────┤
   │  💼 SITUATION PROFESSIONNELLE                     │
   │  Statut : Salarié CDI                              │
   │  Employeur : ACME Corp (SIRET validé ✅)          │
   │  Poste : Développeur Senior                        │
   │  Ancienneté : 3 ans 2 mois                         │
   │  Revenus nets : 3542€/mois (moyenne 3 derniers)   │
   ├────────────────────────────────────────────────────┤
   │  🏠 DEMANDE                                        │
   │  Type : T2                                         │
   │  Localisation : Paris 15e                          │
   │  Budget max : 1200€/mois                           │
   │  Disponibilité : 01/03/2026                        │
   │  Ref annonce : SeLoger-123456                      │
   ├────────────────────────────────────────────────────┤
   │  📊 ANALYSE ANTI-FRAUDE                           │
   │  Score global : 92/100 🟢 EXCELLENT               │
   │                                                     │
   │  Détails :                                         │
   │  • Identité : 95/100 ✅                           │
   │  • Revenus : 90/100 ✅                            │
   │  • Stabilité : 88/100 ✅                          │
   │  • Cohérence : 94/100 ✅                          │
   │                                                     │
   │  ⚠️ Points de vigilance (2) :                     │
   │  • Justificatif domicile date de 2 mois et 28j    │
   │    (proche limite 3 mois)                          │
   │  • Changement employeur il y a 4 mois             │
   │    (vérifier période d'essai passée)              │
   ├────────────────────────────────────────────────────┤
   │  📄 DOCUMENTS (12)                                │
   │  ✅ CNI Recto-Verso (expire 2030) - [📥 Téléch.] │
   │  ✅ Fiche paie Oct 2025 - [📥 Téléch.]           │
   │  ✅ Fiche paie Nov 2025 - [📥 Téléch.]           │
   │  ✅ Fiche paie Déc 2025 - [📥 Téléch.]           │
   │  ✅ Contrat de travail - [📥 Téléch.]            │
   │  ✅ Justificatif domicile - [📥 Téléch.]         │
   │  ✅ Avis imposition 2024 - [📥 Téléch.]          │
   │  ...                                               │
   ├────────────────────────────────────────────────────┤
   │  ACTIONS                                           │
   │  [⭐ Favori] [✅ Présélectionner] [❌ Refuser]    │
   │  [📧 Contacter] [📥 Télécharger tout (ZIP)]      │
   └────────────────────────────────────────────────────┘
   ```
4. Log consultation + chaque téléchargement

**Règles métier** :
- Toutes données factuelles affichées
- Score détaillé par domaine
- Points vigilance explicites (actionables)
- Téléchargement individuel ou ZIP global

---

**US-AGE-022 : Téléchargement Documents avec Watermark**

**Description** : Les documents téléchargés par l'agence sont watermarkés.

**Flux** :
1. Agence clique "Télécharger" sur un document PDF
2. Backend :
   - Récupère fichier original S3
   - Applique watermark visible :
     ```
     ┌─────────────────────────────────────────┐
     │  Document consulté par :                │
     │  AGENCE DUPONT IMMOBILIER               │
     │  Le 10/02/2026 à 14:32                  │
     │  Référence : WM-ABC123XYZ               │
     └─────────────────────────────────────────┘
     ```
   - Applique stéganographie invisible :
     - Métadonnées : `agency_id`, `user_id`, `timestamp`, `doc_id`
     - Technique : modification LSB pixels (images) ou espaces (PDF texte)
   - Retourne fichier watermarké (nom : `original_name_watermarked.pdf`)
3. Log téléchargement en BDD

**Librairies** :
- Watermark visible : `pdfkit` (Node.js) ou `pypdf` (Python)
- Stéganographie : `stegano` (Python) ou custom LSB

**But** :
- Dissuasion partage non autorisé
- Traçabilité en cas de fuite

---

**US-AGE-023 : Upload Dossier par Agence**

**Description** : L'agence peut uploader un dossier reçu par canal traditionnel pour analyse.

**Flux** :
1. Depuis `/dossiers/upload`, saisie infos locataire :
   - Nom, prénom
   - Email (optionnel)
   - Téléphone (optionnel)
2. Upload documents (même processus que locataire)
3. Système :
   - Crée dossier temporaire (pas de compte locataire associé)
   - Lance analyse IA
   - Affiche fiche synthèse
4. Agence peut supprimer dossier après consultation

**Règles métier** :
- Dossier temporaire : durée vie 30j max
- Pas de partage (usage interne agence uniquement)
- RGPD : consentement implicite si agence détient déjà docs

---

### 3.2.4 Actions sur Dossiers

**US-AGE-030 : Gestion Statuts Dossier**

**Description** : L'agence peut marquer un dossier avec un statut.

**Statuts possibles** :
- `new` : non encore traité (défaut)
- `viewed` : consulté
- `shortlisted` : présélectionné
- `rejected` : refusé
- `selected` : dossier retenu (logement attribué)

**Champ BDD** : `folder_agency_status` (table pivot `agency_folders`)

**Page `/dossiers`** :
```
┌─────────────────────────────────────────────────────┐
│  DOSSIERS (23)                                      │
├─────────────────────────────────────────────────────┤
│  Filtres : [Tous ▼] [⭐ Favoris] [✅ Présélec.]    │
├─────────────────────────────────────────────────────┤
│  👤 Jean MARTIN - 28 ans - 3542€/mois              │
│     📍 T2 Paris 15e - 1200€                        │
│     📊 92/100 🟢  |  ⭐ Favori  |  ✅ Présélec.    │
│     Reçu le 10/02/2026                              │
├─────────────────────────────────────────────────────┤
│  👤 Sophie DURAND - 25 ans - 2800€/mois            │
│     📍 T1 Paris 18e - 950€                         │
│     📊 78/100 🟡  |  ☆  |  État : Nouveau          │
│     Reçu le 09/02/2026                              │
└─────────────────────────────────────────────────────┘
```

---

**US-AGE-031 : Contact Locataire**

**Description** : L'agence peut contacter le locataire via email/téléphone.

**Règles** :
- Email/téléphone affichés uniquement si locataire a partagé (optionnel dans contexte partage)
- Bouton "Contacter" ouvre modal :
  ```
  ┌────────────────────────────────────┐
  │  CONTACTER JEAN MARTIN             │
  ├────────────────────────────────────┤
  │  📧 Email : jean.martin@email.com  │
  │     [Envoyer un email]             │
  │                                     │
  │  📞 Tél : 06 12 34 56 78           │
  │     [Copier]                        │
  └────────────────────────────────────┘
  ```
- Log action contact en BDD (traçabilité)

---

## 3.3 Module Anti-Fraude IA (Aperçu)

**Note** : Détails complets dans Partie 3, Section 6.

### Analyse Multicouche

**Niveau 1 : Exhaustivité**
- Vérification présence documents obligatoires selon profil

**Niveau 2 : Conformité**
- Respect des champs obligatoires
- Formats requis (PDF lisible, image nette)
- OCR : extraction texte

**Niveau 3 : Validité**
- Vérification données structurées :
  - Numéro de sécurité sociale (NIR) : format et cohérence date naissance
  - SIRET entreprise : existence via API INSEE
  - Bande MRZ (passeport/CNI) : checksum et cohérence
  - Adresses : validation via API adresse.data.gouv.fr

**Niveau 4 : Authenticité**
- Vérification existence entreprise (SIRET)
- Validation adresse (API gouvernementale)

**Niveau 5 : Cohérence Intra-Documentaire**
- Cohérence interne d'un document (dates, montants, identité)

**Niveau 6 : Cohérence Inter-Documentaire**
- Croisement informations entre documents

**Niveau 7 : Intégrité & Falsification**
- Analyse métadonnées PDF
- Détection tampons/signatures suspects
- Détection altérations visuelles

**Niveau 8 : Adéquation**
- Vérification critères financiers (revenus x3 loyer)
- Contexte de la demande

---

## 3.4 Module Administration

### 3.4.1 File de Modération

**US-ADM-001 : Queue Dossiers Suspects**

**Description** : Les admins valident manuellement les dossiers détectés suspects par l'IA.

**Page** : `/admin/moderation`

**Affichage** :
```
┌─────────────────────────────────────────────────────┐
│  FILE DE MODÉRATION (12 en attente)                │
├─────────────────────────────────────────────────────┤
│  👤 Marc DUBOIS - Dossier #12345                   │
│     📊 Score : 45/100 🔴 SUSPECT                   │
│     ⚠️ Motifs :                                     │
│     • Incohérence revenus (fiche paie vs impôts)   │
│     • Métadonnées PDF modifiées récemment          │
│     • Adresse employeur invalide (API)             │
│                                                      │
│     [📄 Voir dossier] [✅ Valider] [❌ Rejeter]    │
├─────────────────────────────────────────────────────┤
│  👤 Julie MARTIN - Dossier #12346                  │
│     📊 Score : 52/100 🟡 À VÉRIFIER                │
│     ...                                             │
└─────────────────────────────────────────────────────┘
```

**Actions** :
- **Valider** : dossier passe statut `verified`, score ajusté manuellement (optionnel)
- **Rejeter** : dossier marqué `rejected`, raison stockée
- **Demander complément** : email locataire avec détails
- **Signaler fraude** : tag `fraud_confirmed`, notification agences ayant consulté

**Règles métier** :
- Dossiers triés par priorité (score le plus bas d'abord)
- SLA : traitement sous 48h (alerte si dépassé)

---

### 3.4.2 Dashboard Admin

**US-ADM-010 : Métriques Business**

**Page** : `/admin/dashboard`

**KPIs affichés** :
```
┌─────────────────────────────────────────────────────┐
│  DASHBOARD ADMIN                                    │
├─────────────────────────────────────────────────────┤
│  📊 MÉTRIQUES BUSINESS (30 derniers jours)         │
│                                                      │
│  👥 Locataires                                      │
│     Inscrits : 5 234 (+12% vs mois précédent)      │
│     Actifs : 3 847 (73% des inscrits)              │
│     Dossiers complets : 2 910 (76% des actifs)     │
│                                                      │
│  🏢 Agences                                         │
│     Payantes : 52 (+8 ce mois)                      │
│     Essais en cours : 14                            │
│     Taux conversion : 11.2% (14/125 essais)        │
│     Churn : 3.8% (2/52)                             │
│                                                      │
│  💰 REVENUS                                         │
│     MRR : 20 800€ HT (25 000€ TTC)                 │
│     ARR : 249 600€ HT                               │
│     LTV/CAC : 3.2                                   │
├─────────────────────────────────────────────────────┤
│  🔍 MÉTRIQUES OPÉRATIONNELLES                      │
│                                                      │
│  File modération : 12 en attente (SLA OK ✅)       │
│  Taux fraude détectée : 4.2%                        │
│  Taux faux positifs : 1.8%                          │
│  Délai moyen analyse IA : 12 sec                    │
├─────────────────────────────────────────────────────┤
│  📈 MÉTRIQUES EFFICACITÉ                           │
│                                                      │
│  Temps moyen constitution dossier : 22 min         │
│  Taux partage dossiers : 68%                        │
│  Délai moyen dépôt → logement trouvé : 18 jours    │
└─────────────────────────────────────────────────────┘
```

**Implémentation** :
- Requêtes SQL aggregates (COUNT, AVG, GROUP BY date)
- Cache Redis pour performance (refresh toutes les heures)
- Export CSV (bouton en haut de page)

---

### 3.4.3 Gestion Utilisateurs

**US-ADM-020 : Recherche & Consultation User**

**Page** : `/admin/users`

**Filtres** :
- Recherche par email, nom, SIRET (agences)
- Type : locataire / agence / admin
- Statut : actif / trial / suspendu / supprimé

**Actions** :
- **Voir détails** : profil complet, activité, logs
- **Suspendre** : désactive accès (temporaire)
- **Supprimer** : hard delete (après confirmation, RGPD)
- **Changer abonnement** : manuel (cas exceptionnels)

---

## 4. MODÈLE DE DONNÉES

### 4.1 Schémas MySQL

#### Table : `users`

```sql
CREATE TABLE users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('tenant', 'agency_owner', 'agency_agent', 'admin') NOT NULL DEFAULT 'tenant',
  status ENUM('pending_verification', 'active', 'suspended', 'deleted') NOT NULL DEFAULT 'pending_verification',
  
  -- Profil
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  date_of_birth DATE,
  tenant_profile ENUM('employee_cdi', 'employee_cdd', 'student', 'freelance', 'retired', 'other'),
  
  -- 2FA
  totp_secret VARCHAR(255), -- chiffré
  is_2fa_enabled BOOLEAN DEFAULT FALSE,
  
  -- Agence (si role = agency_*)
  agency_id INT UNSIGNED,
  
  -- Timestamps
  email_verified_at DATETIME,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME, -- soft delete
  
  INDEX idx_email (email),
  INDEX idx_agency (agency_id),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

#### Table : `agencies`

```sql
CREATE TABLE agencies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  siret VARCHAR(14) UNIQUE NOT NULL,
  legal_name VARCHAR(255), -- depuis API INSEE
  address TEXT,
  city VARCHAR(100),
  postal_code VARCHAR(10),
  country VARCHAR(2) DEFAULT 'FR',
  
  -- Carte pro (optionnel)
  professional_card_number VARCHAR(50),
  professional_card_file VARCHAR(255), -- S3 path
  
  -- Abonnement
  status ENUM('trial', 'active', 'suspended', 'cancelled') DEFAULT 'trial',
  trial_ends_at DATETIME,
  subscription_id VARCHAR(255), -- Stripe subscription ID
  customer_id VARCHAR(255), -- Stripe customer ID
  next_billing_date DATE,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_siret (siret),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

#### Table : `folders`

```sql
CREATE TABLE folders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL, -- propriétaire (locataire principal)
  
  -- Métadonnées
  status ENUM('incomplete', 'complete', 'verifying', 'verified', 'attention') DEFAULT 'incomplete',
  completion_percentage TINYINT UNSIGNED DEFAULT 0,
  
  -- Dossier statut (pour locataire)
  folder_status ENUM('active', 'standby', 'archived') DEFAULT 'active',
  
  -- IA Analysis
  ai_score_global INT, -- 0-100
  ai_score_identity INT,
  ai_score_income INT,
  ai_score_stability INT,
  ai_score_coherence INT,
  ai_status ENUM('pending', 'analyzed', 'manual_review', 'rejected') DEFAULT 'pending',
  ai_analyzed_at DATETIME,
  ai_warnings JSON, -- [{type, message, severity}]
  
  -- Cycle de vie
  expires_at DATETIME, -- date suppression auto (6 mois après création ou dernière MAJ)
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id),
  INDEX idx_status (status),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

#### Table : `documents`

```sql
CREATE TABLE documents (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  folder_id INT UNSIGNED NOT NULL,
  
  -- Type
  document_type ENUM(
    'identity_card', 'passport', 'residence_permit',
    'proof_of_residence', 'payslip', 'employment_contract',
    'tax_notice', 'bank_statement', 'student_card',
    'pension_statement', 'kbis', 'other'
  ) NOT NULL,
  
  -- Fichier
  file_path VARCHAR(255) NOT NULL, -- S3 key
  file_name VARCHAR(255) NOT NULL, -- nom original
  file_size INT UNSIGNED, -- bytes
  mime_type VARCHAR(100),
  
  -- Métadonnées extraction IA
  extracted_text TEXT, -- OCR
  extracted_data JSON, -- {name, date_of_birth, nir, siret, amounts...}
  
  -- Validité
  status ENUM('pending_analysis', 'valid', 'invalid', 'expired', 'attention') DEFAULT 'pending_analysis',
  issued_at DATE, -- date émission doc (si applicable)
  expires_at DATE, -- date expiration doc (CNI, passeport...)
  
  -- Analyse IA
  ai_score INT, -- 0-100
  ai_warnings JSON,
  ai_metadata JSON, -- métadonnées PDF (creation_date, producer...)
  
  -- Commentaire locataire
  comment TEXT,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  INDEX idx_folder (folder_id),
  INDEX idx_type (document_type),
  INDEX idx_status (status),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

#### Table : `guarantors`

```sql
CREATE TABLE guarantors (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT UNSIGNED NOT NULL, -- locataire principal
  guarantor_user_id INT UNSIGNED, -- si garant a un compte
  
  role ENUM('guarantor', 'co_tenant', 'spouse') DEFAULT 'guarantor',
  
  -- Si upload direct (pas de compte garant)
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  
  -- Dossier garant (même structure que tenant)
  folder_id INT UNSIGNED, -- peut pointer vers un folder séparé
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (guarantor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
  INDEX idx_tenant (tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

#### Table : `sharing_links`

```sql
CREATE TABLE sharing_links (
  id CHAR(36) PRIMARY KEY, -- UUID
  folder_id INT UNSIGNED NOT NULL,
  
  -- Contexte demande
  context JSON, -- {property_type, city, budget, availability, listing_ref}
  
  -- Validité
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  revoked_at DATETIME,
  
  -- Stats
  views_count INT UNSIGNED DEFAULT 0,
  last_viewed_at DATETIME,
  
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  INDEX idx_folder (folder_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

#### Table : `sharing_views`

```sql
CREATE TABLE sharing_views (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sharing_link_id CHAR(36) NOT NULL,
  
  -- Viewer
  agency_id INT UNSIGNED, -- si connecté
  viewer_email VARCHAR(255), -- si non-connecté (lead)
  
  -- Métadonnées
  viewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  -- Documents téléchargés
  documents_downloaded JSON, -- [doc_id1, doc_id2...]
  
  FOREIGN KEY (sharing_link_id) REFERENCES sharing_links(id) ON DELETE CASCADE,
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL,
  INDEX idx_link (sharing_link_id),
  INDEX idx_agency (agency_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

#### Table : `agency_folders`

```sql
-- Pivot table : relation agence <-> dossiers
CREATE TABLE agency_folders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  agency_id INT UNSIGNED NOT NULL,
  folder_id INT UNSIGNED NOT NULL,
  
  -- Statut côté agence
  status ENUM('new', 'viewed', 'shortlisted', 'rejected', 'selected') DEFAULT 'new',
  is_favorite BOOLEAN DEFAULT FALSE,
  
  -- Notes internes agence
  internal_notes TEXT,
  
  -- Timestamps
  first_viewed_at DATETIME,
  status_updated_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  UNIQUE KEY unique_agency_folder (agency_id, folder_id),
  INDEX idx_agency_status (agency_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

#### Table : `audit_logs`

```sql
CREATE TABLE audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  
  -- Qui
  user_id INT UNSIGNED,
  agency_id INT UNSIGNED,
  ip_address VARCHAR(45),
  
  -- Quoi
  action VARCHAR(100) NOT NULL, -- 'document.uploaded', 'folder.shared', 'document.downloaded'...
  entity_type VARCHAR(50), -- 'folder', 'document', 'user'...
  entity_id INT UNSIGNED,
  
  -- Détails
  details JSON, -- {file_name, sharing_link_id, ...}
  
  -- Quand
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_user (user_id),
  INDEX idx_agency (agency_id),
  INDEX idx_action (action),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

#### Table : `notifications`

```sql
CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  
  -- Type
  type VARCHAR(100) NOT NULL, -- 'document.expiring', 'folder.shared', 'subscription.ending'...
  
  -- Contenu
  title VARCHAR(255) NOT NULL,
  message TEXT,
  action_url VARCHAR(255), -- lien vers page concernée
  
  -- Statut
  is_read BOOLEAN DEFAULT FALSE,
  read_at DATETIME,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_unread (user_id, is_read),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

#### Table : `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

#### Table : `document_types`

```sql
-- Référentiel types documents avec règles métier
CREATE TABLE document_types (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL, -- 'identity_card', 'payslip'...
  label_fr VARCHAR(255) NOT NULL,
  label_en VARCHAR(255) NOT NULL,
  
  -- Règles validité
  validity_months INT UNSIGNED, -- NULL = pas d'expiration auto (sauf date légale)
  is_required BOOLEAN DEFAULT FALSE,
  required_for_profiles JSON, -- ['employee_cdi', 'employee_cdd']
  
  -- Ordre affichage
  sort_order INT UNSIGNED DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Données initiales** :
```sql
INSERT INTO document_types (code, label_fr, label_en, validity_months, is_required, required_for_profiles, sort_order) VALUES
('identity_card', 'Carte Nationale d''Identité', 'National ID Card', NULL, TRUE, '["all"]', 1),
('passport', 'Passeport', 'Passport', NULL, FALSE, '["all"]', 2),
('proof_of_residence', 'Justificatif de domicile', 'Proof of Residence', 3, TRUE, '["all"]', 3),
('payslip', 'Bulletin de salaire', 'Payslip', 3, TRUE, '["employee_cdi","employee_cdd"]', 4),
('employment_contract', 'Contrat de travail', 'Employment Contract', NULL, TRUE, '["employee_cdi","employee_cdd"]', 5),
('tax_notice', 'Avis d''imposition', 'Tax Notice', 12, TRUE, '["all"]', 6),
('student_card', 'Carte étudiante', 'Student Card', 12, TRUE, '["student"]', 7),
('kbis', 'Extrait KBIS', 'KBIS Extract', 3, TRUE, '["freelance"]', 8);
```

---

### 4.2 Relations & Contraintes

**Diagramme ER simplifié** :

```
users (1) ──┬─── (*) folders
            │
            └─── (*) guarantors
                 
folders (1) ──┬─── (*) documents
              │
              └─── (*) sharing_links
              
sharing_links (1) ─── (*) sharing_views

agencies (1) ──┬─── (*) users (role = agency_*)
               │
               └─── (*) agency_folders (*) ─── folders
               
audit_logs ─── (*) users, agencies, folders, documents
notifications ─── (*) users
```

**Contraintes clés** :
- `folders.user_id` → cascade delete (supprimer user supprime ses folders)
- `documents.folder_id` → cascade delete
- `sharing_links.folder_id` → cascade delete
- `agency_folders` → cascade delete si agency ou folder supprimé
- Soft delete sur `users`, `folders`, `documents` (RGPD : audit trail)

---

**FIN PARTIE 2/4**

---

**SUITE DANS PARTIE 3** :
- 5. API REST - Endpoints (détaillés)
- 6. Module Anti-Fraude IA (spécifications complètes)
