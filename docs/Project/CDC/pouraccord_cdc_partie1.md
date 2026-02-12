# POURACCORD - Cahier des Charges Détaillé
## Plateforme de Gestion et Validation de Dossiers Locataires

**Version** : 1.0  
**Date** : Février 2026  
**Statut** : Spécifications techniques pour développement MVP

---

## PARTIE 1/4

## TABLE DES MATIÈRES GÉNÉRALE

1. [INTRODUCTION](#1-introduction) ✓ (Partie 1)
2. [ARCHITECTURE GÉNÉRALE](#2-architecture-générale) ✓ (Partie 1)
3. [SPÉCIFICATIONS FONCTIONNELLES](#3-spécifications-fonctionnelles) ✓ (Parties 1-2)
4. [MODÈLE DE DONNÉES](#4-modèle-de-données) (Partie 2)
5. [API REST - ENDPOINTS](#5-api-rest---endpoints) (Partie 3)
6. [MODULE ANTI-FRAUDE IA](#6-module-anti-fraude-ia) (Partie 3)
7. [SÉCURITÉ ET RGPD](#7-sécurité-et-rgpd) (Partie 4)
8. [INTERFACES UTILISATEURS](#8-interfaces-utilisateurs) (Partie 4)
9. [NOTIFICATIONS](#9-notifications) (Partie 4)
10. [PLAN DE TESTS](#10-plan-de-tests) (Partie 4)
11. [DÉPLOIEMENT ET INFRASTRUCTURE](#11-déploiement-et-infrastructure) (Partie 4)
12. [ANNEXES](#12-annexes) (Partie 4)

---

## 1. INTRODUCTION

### 1.1 Objectif du Document

Ce cahier des charges détaillé définit l'ensemble des spécifications techniques et fonctionnelles pour le développement de la plateforme POURACCORD (version MVP). Il s'adresse aux équipes de développement, aux architectes techniques et aux chefs de projet.

### 1.2 Périmètre

**Inclus dans ce document** :
- Architecture technique complète
- Modèle de données (schémas MySQL)
- Spécifications API REST
- Règles métier détaillées
- Wireframes et flux utilisateurs
- Spécifications sécurité et RGPD
- Plan de tests

**Exclus** :
- Code source
- Design graphique final (mockups haute-fidélité)
- Documentation utilisateur finale
- Plan marketing

### 1.3 Rappel du Contexte

POURACCORD est une plateforme B2B2C permettant :
- Aux **locataires** (gratuit) : constituer un dossier unique sécurisé et le partager avec des agences
- Aux **agences** (400€ HT/mois) : accéder à des dossiers pré-vérifiés par IA anti-fraude
- Aux **admins** : modérer, gérer les utilisateurs et améliorer l'IA

**Valeur ajoutée clé** : Validation anti-fraude multicouche par IA + respect RGPD automatisé

---

## 2. ARCHITECTURE GÉNÉRALE

### 2.1 Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                     UTILISATEURS FINAUX                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Locataires  │  │   Agences    │  │    Admins    │         │
│  │   (React)    │  │   (React)    │  │   (React)    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │ HTTPS/TLS
                   ┌─────────▼──────────┐
                   │   LOAD BALANCER    │
                   │    (CloudFlare)    │
                   └─────────┬──────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
    ┌─────▼─────┐      ┌─────▼─────┐     ┌─────▼─────┐
    │  Frontend │      │  Backend  │     │    IA     │
    │   React   │◄────►│  Node.js  │◄───►│  Python   │
    │ (Statique)│      │  Express  │     │Microservice│
    └───────────┘      └─────┬─────┘     └───────────┘
                             │
                   ┌─────────┼──────────┐
                   │                    │
             ┌─────▼─────┐      ┌──────▼──────┐
             │   MySQL   │      │  AWS S3 /   │
             │ (RDS/OVH) │      │  OVH Object │
             └───────────┘      └─────────────┘
```

### 2.2 Stack Technologique Détaillée

#### Frontend
- **Framework** : React 18.x
- **État global** : Redux Toolkit (pour cohérence état complexe multi-modules)
- **Routage** : React Router v6
- **UI** : Tailwind CSS + Headless UI (flexibilité design)
- **Formulaires** : React Hook Form + Yup (validation)
- **HTTP** : Axios (interceptors pour JWT)
- **i18n** : react-i18next (FR/EN dès V1)
- **Build** : Vite (performance)

#### Backend
- **Runtime** : Node.js 20 LTS
- **Framework** : Express.js 4.x (léger, mature)
- **Langage** : TypeScript 5.x
- **ORM** : Sequelize 6.x (support MySQL, migrations)
- **Validation** : Joi (schémas validation inputs)
- **Auth** : jsonwebtoken, speakeasy (2FA)
- **Upload** : Multer + AWS SDK v3
- **Email** : Nodemailer + SendGrid
- **Paiement** : Stripe Node.js SDK
- **Logs** : Winston + Morgan
- **Cron** : node-cron (nettoyage quotidien)

#### Base de Données
- **SGBD** : MySQL 8.0+
- **Hébergement** : OVH Managed MySQL ou RDS AWS (backups automatiques)
- **Charset** : utf8mb4 (support emojis, multilingue)
- **Moteur** : InnoDB (transactions ACID)

#### Stockage Fichiers
- **Service** : AWS S3 (Standard) ou OVH Object Storage
- **Régions** : EU (Paris/Strasbourg)
- **Buckets** :
  - `pouraccord-documents-prod` : documents utilisateurs
  - `pouraccord-documents-staging` : environnement preprod
- **Chiffrement** : SSE-S3 (AES-256)
- **Lifecycle** : suppression automatique objets expirés (6 mois)

#### IA & OCR
- **Microservice Python** :
  - FastAPI (API REST haute performance)
  - Python 3.11+
  - Conteneurisé Docker
- **OCR** :
  - Tesseract 5.x (gratuit, multilingue FR/EN/ES/IT/DE)
  - Fallback AWS Textract si échec Tesseract (facturation au volume)
- **Analyse fraude** :
  - Règles métier (Python)
  - Modèle ML supervisé (scikit-learn) :
    - Random Forest ou XGBoost
    - Features : métadonnées PDF, cohérence champs, historique
  - Dataset initial : dossiers anonymisés labellisés (fraude/légitime)
- **APIs externes** :
  - API INSEE (SIRET) : https://api.insee.fr/entreprises/sirene/V3
  - API Adresse : https://api-adresse.data.gouv.fr/search/
  - Validation NIR : algorithme Luhn (pas d'API publique)

#### Authentification & Sécurité
- **JWT** : HS256, expiration 24h, refresh tokens (7j)
- **2FA** : TOTP (RFC 6238), QR code via qrcode.js
- **Chiffrement mots de passe** : bcrypt (salt rounds: 12)
- **Rate limiting** : express-rate-limit (100 req/15min par IP)
- **CORS** : whitelist domaines autorisés
- **Helmet.js** : headers sécurité HTTP

#### Emails
- **Service** : SendGrid (99% deliverability)
- **Templates** : MJML (responsive HTML)
- **Domaine** : @pouraccord.com (DKIM, SPF, DMARC configurés)
- **Types** :
  - Transactionnels (confirmation, alertes)
  - Notifications (nouveaux dossiers, expirations)
  - Marketing (onboarding agences, NL mensuelle)

#### Hébergement & Infrastructure
- **Cloud Provider** : OVH Cloud (souveraineté française)
- **Serveurs** :
  - Frontend : CDN CloudFlare (cache statique)
  - Backend : VPS 4 vCPU, 8 GB RAM (scalable)
  - IA : VPS 2 vCPU, 4 GB RAM (GPU optionnel V2)
  - BDD : Managed MySQL 2 vCPU, 4 GB RAM
- **Environnements** :
  - **Production** : prod.pouraccord.com
  - **Staging** : staging.pouraccord.com
  - **Dev** : localhost / dev.pouraccord.com
- **CI/CD** : GitHub Actions (tests auto, deploy)
- **Monitoring** :
  - Uptime : UptimeRobot (alertes SMS si down)
  - Logs : Datadog ou Grafana + Loki
  - Erreurs : Sentry

### 2.3 Architecture Applicative

#### Modèle 3-Tiers

**Tier 1 : Présentation** (Frontend React)
- SPA (Single Page Application)
- Communication API REST uniquement
- Stockage local : JWT (localStorage sécurisé)
- Pas de logique métier côté client (sauf validation formulaires)

**Tier 2 : Logique Métier** (Backend Node.js)
- API RESTful stateless
- Authentification/Autorisation (middleware JWT)
- Orchestration appels IA, paiements, emails
- Validation business rules
- Gestion transactions DB

**Tier 3 : Données** (MySQL + S3)
- MySQL : données structurées (users, folders, logs...)
- S3 : fichiers binaires (PDFs, images)
- IA microservice : isolé, appelé via HTTP

#### Communication Inter-Services

```
Frontend React ───────► Backend Node.js ───────► MySQL
                             │
                             ├──────────────────► S3 (upload/download)
                             │
                             ├──────────────────► IA Python (POST /analyze)
                             │
                             ├──────────────────► Stripe API (paiements)
                             │
                             └──────────────────► SendGrid (emails)
```

**Protocoles** :
- Frontend ↔ Backend : HTTPS REST JSON
- Backend ↔ IA : HTTP REST JSON (réseau interne VPC)
- Backend ↔ MySQL : TCP natif (Sequelize)
- Backend ↔ S3 : HTTPS SDK AWS

---

## 3. SPÉCIFICATIONS FONCTIONNELLES

### 3.1 Module Locataire

#### 3.1.1 Inscription & Connexion

**US-LOC-001 : Inscription Simple**

**Description** : Un visiteur peut créer un compte locataire gratuitement.

**Préconditions** : Aucune

**Flux nominal** :
1. Utilisateur accède à `/register`
2. Saisit : email, mot de passe, confirmation mot de passe
3. Accepte CGU et politique confidentialité (checkboxes obligatoires)
4. Clique "S'inscrire"
5. Système :
   - Vérifie email non déjà utilisé
   - Valide format email (regex RFC 5322)
   - Valide mot de passe (min 8 car, 1 maj, 1 min, 1 chiffre)
   - Hash mot de passe (bcrypt)
   - Crée user en BDD (statut : `pending_verification`)
   - Génère token validation email (UUID, expire 24h)
   - Envoie email confirmation avec lien `/verify-email?token=XXX`
6. Message "Email de confirmation envoyé"

**Règles métier** :
- Email unique en BDD
- Mot de passe : min 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre, optionnel caractère spécial
- Token validation : expire 24h, usage unique
- Compte inaccessible tant que email non validé

**Messages d'erreur** :
- "Cet email est déjà utilisé"
- "Le mot de passe ne respecte pas les critères de sécurité"
- "Les mots de passe ne correspondent pas"

**Wireframe** :
```
┌─────────────────────────────────────┐
│         POURACCORD - Inscription     │
├─────────────────────────────────────┤
│  Email : [___________________]      │
│  Mot de passe : [___________]       │
│  Confirmer : [______________]       │
│                                      │
│  ☑ J'accepte les CGU                │
│  ☑ J'accepte la politique RGPD      │
│                                      │
│  [      S'INSCRIRE      ]           │
│                                      │
│  Déjà un compte ? Se connecter      │
└─────────────────────────────────────┘
```

---

**US-LOC-002 : Validation Email**

**Description** : Le locataire valide son email via lien reçu.

**Préconditions** : Compte créé (statut `pending_verification`)

**Flux nominal** :
1. Utilisateur clique lien email `/verify-email?token=XXX`
2. Système :
   - Vérifie token existe et non expiré
   - Met à jour statut user : `active`
   - Supprime token
   - Redirige vers `/login` avec message "Email validé, connectez-vous"

**Flux alternatif** :
- Token expiré : message "Lien expiré, demander un nouveau lien" + bouton
- Token invalide : erreur 404

---

**US-LOC-003 : Connexion**

**Description** : Un locataire se connecte à son compte.

**Préconditions** : Compte actif (email validé)

**Flux nominal** :
1. Utilisateur accède `/login`
2. Saisit email + mot de passe
3. Système :
   - Vérifie email existe
   - Compare hash mot de passe (bcrypt)
   - Si 2FA activé : demande code TOTP (voir US-LOC-005)
   - Génère JWT (payload : user_id, role, exp)
   - Retourne JWT + refresh token
4. Redirection vers dashboard `/dashboard`

**Règles métier** :
- JWT : expire 24h
- Refresh token : expire 7j, stocké en BDD (table `refresh_tokens`)
- Max 3 tentatives échouées / 15 min (rate limiting)

**Messages d'erreur** :
- "Email ou mot de passe incorrect"
- "Votre compte n'est pas encore validé"
- "Trop de tentatives, réessayez dans 15 minutes"

---

**US-LOC-004 : Mot de Passe Oublié**

**Flux** :
1. Utilisateur clique "Mot de passe oublié ?" sur `/login`
2. Saisit email
3. Système envoie lien reset (`/reset-password?token=XXX`, expire 1h)
4. Utilisateur clique lien, saisit nouveau mot de passe
5. Système met à jour hash, invalide tous JWT/refresh tokens existants

---

**US-LOC-005 : 2FA Optionnel**

**Description** : Le locataire peut activer 2FA pour sécurité renforcée.

**Flux activation** :
1. Depuis `/settings/security`, clic "Activer 2FA"
2. Système génère secret TOTP, affiche QR code
3. Utilisateur scanne QR avec app (Google Authenticator, Authy...)
4. Saisit code 6 chiffres pour validation
5. Système stocke secret chiffré en BDD, active 2FA

**Flux connexion avec 2FA** :
1. Après email/mot de passe valides, système demande code 2FA
2. Utilisateur saisit code 6 chiffres
3. Système vérifie code via speakeasy.verify()
4. Si OK : génère JWT

**Note** : 2FA obligatoire pour comptes agences (voir US-AGE-002)

---

#### 3.1.2 Constitution du Dossier

**US-LOC-010 : Tableau de Bord Locataire**

**Description** : Vue d'ensemble du dossier avec progression et actions rapides.

**Éléments affichés** :
```
┌─────────────────────────────────────────────────────┐
│  Bonjour Jean, votre dossier est complet à 75%     │
│  ████████████████░░░░░░░░  75%                      │
├─────────────────────────────────────────────────────┤
│  DOCUMENTS (12/16)                                  │
│  ✅ Pièce d'identité (CNI)                         │
│  ✅ Justificatif domicile (Facture EDF)            │
│  ✅ 3 fiches de paie (Oct, Nov, Dec 2025)          │
│  ✅ Contrat de travail                             │
│  ⏳ Avis d'imposition 2024 (expire dans 5j)        │
│  ❌ RIB (manquant)                                 │
│  ...                                                │
├─────────────────────────────────────────────────────┤
│  STATUT : 🔍 En vérification (délai 24-48h)        │
├─────────────────────────────────────────────────────┤
│  ACTIONS                                            │
│  [➕ Ajouter un document]                          │
│  [🔗 Partager mon dossier]                         │
│  [👥 Ajouter un garant]                            │
└─────────────────────────────────────────────────────┘
```

**Règles métier** :
- Calcul progression : nb_docs_validés / nb_docs_requis * 100
- Statuts possibles :
  - `incomplete` : < 100%
  - `complete` : 100% + tous docs validés
  - `verifying` : analyse IA en cours
  - `verified` : analyse OK
  - `attention` : points vigilance détectés

---

**US-LOC-011 : Upload Documents**

**Description** : Le locataire upload un ou plusieurs documents.

**Flux** :
1. Clic "Ajouter un document" ou clic sur doc manquant
2. Sélection type document (liste déroulante selon profil)
3. Upload fichier (drag & drop ou parcourir)
4. Système :
   - Vérifie format (PDF, JPG, PNG)
   - Vérifie taille (max 5 Mo)
   - Upload vers S3 (`/users/{user_id}/documents/{uuid}.{ext}`)
   - Crée entrée BDD table `documents` (statut : `pending_analysis`)
   - Si dossier complet : trigger analyse IA (voir section 6)

**Règles métier** :
- Formats autorisés : PDF (multi-pages OK), JPG, PNG
- Taille max : 5 Mo / fichier
- Nommage S3 : UUID pour éviter collisions
- Support multi-pages PDF : un PDF = un document
- Remplacement : si doc déjà existant → version précédente archivée (soft delete)

**Messages** :
- "Document uploadé avec succès"
- "Format non supporté (utilisez PDF, JPG ou PNG)"
- "Fichier trop volumineux (max 5 Mo)"

---

**US-LOC-012 : Liste Documents Requis Selon Profil**

**Description** : Affichage dynamique des documents obligatoires selon profil locataire.

**Profils** :
1. **Salarié CDI** :
   - CNI/Passeport
   - Justificatif domicile (< 3 mois)
   - Contrat de travail
   - 3 dernières fiches de paie
   - Avis d'imposition N-1
   - RIB (optionnel mais recommandé)

2. **Salarié CDD** :
   - Idem + dernier contrat CDD

3. **Étudiant** :
   - CNI/Passeport
   - Carte étudiante
   - Justificatif domicile
   - Avis d'imposition parents (si rattaché)
   - Justificatif bourse / ressources (Crous, job étudiant...)

4. **Indépendant / Freelance** :
   - CNI/Passeport
   - Justificatif domicile
   - KBIS (< 3 mois)
   - 2 derniers bilans comptables
   - Avis d'imposition N-1

5. **Retraité** :
   - CNI/Passeport
   - Justificatif domicile
   - Attestation retraite
   - 3 derniers relevés pension
   - Avis d'imposition N-1

**Implémentation** :
- Champ `tenant_profile` en BDD (enum)
- Mapping profil → liste docs dans config backend
- Frontend adapte checklist dynamiquement

---

**US-LOC-013 : Commentaires sur Documents**

**Description** : Le locataire peut ajouter un commentaire si document indisponible ou spécificité.

**Exemple** :
- "Avis d'imposition 2024 non encore reçu, fournirai dès réception"
- "En cours de changement d'employeur, nouveau contrat à venir"

**Champ BDD** : `documents.comment` (TEXT, nullable)

---

**US-LOC-014 : Cycle de Vie Documents**

**Description** : Gestion automatique expiration et suppression documents.

**Règles métier** :
- **Fiche de paie** : valide 3 mois après date émission
- **CNI** : valide jusqu'à date expiration légale (lue OCR si possible)
- **Justificatif domicile** : valide 3 mois après date facture
- **Avis imposition** : valide jusqu'à N+1 (nouvel avis)
- **Autres** : paramétrable par type (table `document_types.validity_months`)

**Processus automatique (CRON quotidien)** :
1. Scan table `documents` : `WHERE expires_at < NOW()`
2. Pour chaque doc expiré :
   - Envoie alerte locataire (7j avant expiration)
   - Supprime fichier S3
   - Soft delete en BDD (`deleted_at = NOW()`)
   - Recalcule progression dossier

**Alerte locataire** :
- Email : "Votre [type doc] expire dans 7 jours, pensez à le renouveler"
- Notification in-app

---

#### 3.1.3 Partage du Dossier

**US-LOC-020 : Génération Lien Partage**

**Description** : Le locataire crée un lien unique pour partager son dossier avec une agence.

**Flux** :
1. Clic "Partager mon dossier" (dashboard ou page dédiée `/share`)
2. Optionnel : saisie contexte demande :
   - Type bien recherché (T1, T2, T3...)
   - Localisation (ville, quartier)
   - Budget max (€/mois)
   - Date disponibilité
   - Référence annonce externe (SeLoger, LBC...)
3. Clic "Générer lien de partage"
4. Système :
   - Génère UUID unique
   - Crée entrée table `sharing_links` :
     ```
     {
       id: UUID,
       tenant_id: user_id,
       context: {...}, // JSON optionnel
       created_at: NOW(),
       expires_at: NOW() + 30 jours (configurable),
       views_count: 0
     }
     ```
   - Retourne lien : `https://pouraccord.com/view/{UUID}`
5. Affichage lien + bouton copier

**Règles métier** :
- Lien valide 30 jours par défaut (configurable)
- Lien réutilisable (même agence peut consulter plusieurs fois)
- Possibilité créer plusieurs liens (multi-agences)
- Lien révocable (voir US-LOC-021)

**Wireframe** :
```
┌─────────────────────────────────────────────────────┐
│  PARTAGER MON DOSSIER                               │
├─────────────────────────────────────────────────────┤
│  Contexte de la demande (optionnel)                │
│  Type bien : [T2 ▼]                                 │
│  Ville : [Paris ___________]                        │
│  Budget : [1200]€/mois                              │
│  Disponible : [01/03/2026]                          │
│  Ref annonce : [SeLoger-123456]                     │
│                                                      │
│  [    GÉNÉRER LE LIEN    ]                          │
├─────────────────────────────────────────────────────┤
│  Votre lien : https://pouraccord.com/view/abc123    │
│  [📋 Copier]  [✉️ Envoyer par email]                │
│                                                      │
│  ⚠️ Ce lien est valide 30 jours                     │
└─────────────────────────────────────────────────────┘
```

---

**US-LOC-021 : Gestion Liens Partagés**

**Description** : Historique et gestion des liens créés.

**Page** : `/shares/history`

**Affichage** :
```
┌─────────────────────────────────────────────────────┐
│  MES PARTAGES                                       │
├─────────────────────────────────────────────────────┤
│  📍 T2 Paris 15e - 1200€ (ref: SeLoger-123)        │
│     Créé le 05/02/2026 - Expire le 07/03/2026      │
│     👁️ Consulté 3 fois (dernière : 10/02/2026)      │
│     [Révoquer] [Copier lien]                        │
├─────────────────────────────────────────────────────┤
│  📍 T3 Lille - 900€                                │
│     Créé le 01/02/2026 - Expire le 03/03/2026      │
│     👁️ Jamais consulté                              │
│     [Révoquer] [Copier lien]                        │
└─────────────────────────────────────────────────────┘
```

**Actions** :
- **Révoquer** : soft delete lien (`revoked_at = NOW()`), lien devient invalide
- **Prolonger** : ajoute 30j à `expires_at` (si dossier toujours valide)

---

**US-LOC-022 : Historique Consultations**

**Description** : Traçabilité de qui a consulté le dossier.

**Table BDD** : `sharing_views`
```sql
{
  id: INT AUTO_INCREMENT,
  sharing_link_id: UUID,
  agency_id: INT (nullable, si agence connectée),
  viewer_email: VARCHAR(255) (si non-connecté),
  viewed_at: DATETIME,
  ip_address: VARCHAR(45),
  user_agent: TEXT,
  documents_downloaded: JSON (array doc_ids)
}
```

**Affichage locataire** :
```
┌─────────────────────────────────────────────────────┐
│  ACTIVITÉ RÉCENTE                                   │
├─────────────────────────────────────────────────────┤
│  🏢 Agence Dupont Immobilier                        │
│     Consulté le 10/02 à 14:32                       │
│     📥 Téléchargé : CNI, 3 fiches paie              │
├─────────────────────────────────────────────────────┤
│  📧 contact@agence-martin.fr (non-cliente)          │
│     Consulté le 08/02 à 10:15                       │
│     📥 Aucun téléchargement (vue limitée)           │
└─────────────────────────────────────────────────────┘
```

---

#### 3.1.4 Gestion Garants & Co-locataires

**US-LOC-030 : Ajouter Garant par Invitation**

**Description** : Le locataire invite son garant à créer un compte et compléter son dossier.

**Flux** :
1. Depuis dashboard, clic "Ajouter un garant"
2. Saisie email garant
3. Système :
   - Génère lien invitation `/garant/invite?token=XXX&tenant_id=YYY`
   - Envoie email au garant avec lien
4. Garant clique lien :
   - Si compte existe : connexion + association au locataire
   - Sinon : inscription + création dossier garant
5. Garant complète son dossier (mêmes docs que locataire principal, selon profil)
6. Dossier garant lié au locataire (table `guarantors` : `tenant_id`, `guarantor_id`)

**Règles métier** :
- Un garant peut garantir plusieurs locataires (table many-to-many)
- Analyse IA du dossier garant indépendante
- Scoring global prend en compte garant

---

**US-LOC-031 : Ajouter Garant par Upload Direct**

**Description** : Le locataire upload directement les docs de son garant.

**Flux** :
1. Clic "Ajouter un garant" → option "Uploader les documents moi-même"
2. Upload docs garant (même checklist que locataire)
3. Documents stockés sous dossier garant virtuel (table `guarantors`)

**Différence** :
- Pas de compte séparé garant
- Locataire seul responsable exactitude docs

---

**US-LOC-032 : Co-locataires & Conjoints**

**Description** : Logique identique garants, rôle différent.

**Champ BDD** : `guarantors.role` (enum : `guarantor`, `co_tenant`, `spouse`)

**Règles** :
- Co-locataire : dossier indépendant, revenus cumulés pour calcul adéquation loyer
- Conjoint : dossier lié, revenus cumulés

---

#### 3.1.5 Dépôt par Email

**US-LOC-040 : Envoi Documents par Email**

**Description** : Le locataire peut envoyer ses docs par email.

**Adresse** : `dossier@pouraccord.com`

**Flux** :
1. Locataire envoie email avec pièces jointes
2. Serveur SMTP (SendGrid Inbound Parse ou équivalent) :
   - Parse email
   - Extrait pièces jointes
   - Identifie utilisateur via email expéditeur (match BDD)
   - Upload fichiers vers S3
   - Crée entrées `documents` (statut `pending_classification`)
3. IA classifie automatiquement type doc (CNI, fiche paie...) via OCR
4. Notification locataire : "3 documents reçus par email, veuillez vérifier la classification"

**Règles métier** :
- Email expéditeur doit correspondre à email compte (sinon : email rejeté)
- Max 10 Mo total pièces jointes
- Formats acceptés : PDF, JPG, PNG

**Limitations MVP** :
- Classification auto basique (mots-clés OCR : "bulletin de salaire", "carte nationale d'identité"...)
- Locataire doit valider/corriger classification depuis dashboard

---

**FIN PARTIE 1/4**

---

**SUITE DANS PARTIE 2** :
- 3.2 Module Agence
- 3.3 Module Anti-Fraude IA (aperçu)
- 3.4 Module Administration
- 4. Modèle de Données (schémas MySQL complets)
