# POURACCORD - Cahier des Charges DÃ©taillÃ©
## Plateforme de Gestion et Validation de Dossiers Locataires

**Version** : 1.0  
**Date** : FÃ©vrier 2026  
**Statut** : SpÃ©cifications techniques pour dÃ©veloppement MVP

---

## PARTIE 1/4

## TABLE DES MATIÃˆRES GÃ‰NÃ‰RALE

1. [INTRODUCTION](#1-introduction) âœ“ (Partie 1)
2. [ARCHITECTURE GÃ‰NÃ‰RALE](#2-architecture-gÃ©nÃ©rale) âœ“ (Partie 1)
3. [SPÃ‰CIFICATIONS FONCTIONNELLES](#3-spÃ©cifications-fonctionnelles) âœ“ (Parties 1-2)
4. [MODÃˆLE DE DONNÃ‰ES](#4-modÃ¨le-de-donnÃ©es) (Partie 2)
5. [API REST - ENDPOINTS](#5-api-rest---endpoints) (Partie 3)
6. [MODULE ANTI-FRAUDE IA](#6-module-anti-fraude-ia) (Partie 3)
7. [SÃ‰CURITÃ‰ ET RGPD](#7-sÃ©curitÃ©-et-rgpd) (Partie 4)
8. [INTERFACES UTILISATEURS](#8-interfaces-utilisateurs) (Partie 4)
9. [NOTIFICATIONS](#9-notifications) (Partie 4)
10. [PLAN DE TESTS](#10-plan-de-tests) (Partie 4)
11. [DÃ‰PLOIEMENT ET INFRASTRUCTURE](#11-dÃ©ploiement-et-infrastructure) (Partie 4)
12. [ANNEXES](#12-annexes) (Partie 4)

---

## 1. INTRODUCTION

### 1.1 Objectif du Document

Ce cahier des charges dÃ©taillÃ© dÃ©finit l'ensemble des spÃ©cifications techniques et fonctionnelles pour le dÃ©veloppement de la plateforme POURACCORD (version MVP). Il s'adresse aux Ã©quipes de dÃ©veloppement, aux architectes techniques et aux chefs de projet.

### 1.2 PÃ©rimÃ¨tre

**Inclus dans ce document** :
- Architecture technique complÃ¨te
- ModÃ¨le de donnÃ©es (schÃ©mas MySQL)
- SpÃ©cifications API REST
- RÃ¨gles mÃ©tier dÃ©taillÃ©es
- Wireframes et flux utilisateurs
- SpÃ©cifications sÃ©curitÃ© et RGPD
- Plan de tests

**Exclus** :
- Code source
- Design graphique final (mockups haute-fidÃ©litÃ©)
- Documentation utilisateur finale
- Plan marketing

### 1.3 Rappel du Contexte

POURACCORD est une plateforme B2B2C permettant :
- Aux **locataires** (gratuit) : constituer un dossier unique sÃ©curisÃ©, en une ou plusieurs fois, et le partager avec des agences
- Aux **agences** (800â‚¬ HT/mois) : accÃ©der Ã  des dossiers prÃ©-vÃ©rifiÃ©s par IA anti-fraude
- Aux **admins** : modÃ©rer, gÃ©rer les utilisateurs et amÃ©liorer l'IA

**Valeur ajoutÃ©e clÃ©** : Validation anti-fraude multicouche par IA + respect RGPD automatisÃ©

---

## 2. ARCHITECTURE GÃ‰NÃ‰RALE

### 2.1 Vue d'Ensemble

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     UTILISATEURS FINAUX                         â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”‚
â”‚  â”‚  Locataires  â”‚  â”‚   Agences    â”‚  â”‚    Admins    â”‚         â”‚
â”‚  â”‚   (React)    â”‚  â”‚   (React)    â”‚  â”‚   (React)    â”‚         â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
          â”‚                  â”‚                  â”‚
          â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                             â”‚ HTTPS/TLS
                   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                   â”‚   LOAD BALANCER    â”‚
                   â”‚    (CloudFlare)    â”‚
                   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                             â”‚
          â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
          â”‚                  â”‚                  â”‚
    â”Œâ”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”
    â”‚  Frontend â”‚      â”‚  Backend  â”‚     â”‚    IA     â”‚
    â”‚   React   â”‚â—„â”€â”€â”€â”€â–ºâ”‚  Node.js  â”‚â—„â”€â”€â”€â–ºâ”‚  Python   â”‚
    â”‚ (Statique)â”‚      â”‚  Express  â”‚     â”‚Microserviceâ”‚
    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                             â”‚
                   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                   â”‚                    â”‚
             â”Œâ”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”      â”Œâ”€â”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”€â”
             â”‚   MySQL   â”‚      â”‚  AWS S3 /   â”‚
             â”‚ (RDS/OVH) â”‚      â”‚  OVH Object â”‚
             â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### 2.2 Stack Technologique DÃ©taillÃ©e

#### Frontend
- **Framework** : React 18.x
- **Ã‰tat global** : Redux Toolkit (pour cohÃ©rence Ã©tat complexe multi-modules)
- **Routage** : React Router v6
- **UI** : Tailwind CSS + Headless UI (flexibilitÃ© design)
- **Formulaires** : React Hook Form + Yup (validation)
- **HTTP** : Axios (interceptors pour JWT)
- **i18n** : react-i18next (FR/EN dÃ¨s V1)
- **Build** : Vite (performance)

#### Backend
- **Runtime** : Node.js 20 LTS
- **Framework** : Express.js 4.x (lÃ©ger, mature)
- **Langage** : TypeScript 5.x
- **ORM** : Sequelize 6.x (support MySQL, migrations)
- **Validation** : Joi (schÃ©mas validation inputs)
- **Auth** : jsonwebtoken, speakeasy (2FA)
- **Upload** : Multer + AWS SDK v3
- **Email** : Nodemailer + SendGrid
- **Paiement** : Stripe Node.js SDK
- **Logs** : Winston + Morgan
- **Cron** : node-cron (nettoyage quotidien)

#### Base de DonnÃ©es
- **SGBD** : MySQL 8.0+
- **HÃ©bergement** : OVH Managed MySQL ou RDS AWS (backups automatiques)
- **Charset** : utf8mb4 (support emojis, multilingue)
- **Moteur** : InnoDB (transactions ACID)

#### Stockage Fichiers
- **Service** : AWS S3 (Standard) ou OVH Object Storage
- **RÃ©gions** : EU (Paris/Strasbourg)
- **Buckets** :
  - `pouraccord-documents-prod` : documents utilisateurs
  - `pouraccord-documents-staging` : environnement preprod
- **Chiffrement** : SSE-S3 (AES-256)
- **Lifecycle** : suppression automatique objets expirÃ©s (6 mois)

#### IA & OCR
- **Microservice Python** :
  - FastAPI (API REST haute performance)
  - Python 3.11+
  - ConteneurisÃ© Docker
- **OCR** :
  - Tesseract 5.x (gratuit, multilingue FR/EN/ES/IT/DE)
  - Fallback AWS Textract si Ã©chec Tesseract (facturation au volume)
- **Analyse fraude** :
  - RÃ¨gles mÃ©tier (Python)
  - ModÃ¨le ML supervisÃ© (scikit-learn) :
    - Random Forest ou XGBoost
    - Features : mÃ©tadonnÃ©es PDF, cohÃ©rence champs, historique
  - Dataset initial : dossiers anonymisÃ©s labellisÃ©s (fraude/lÃ©gitime)
- **APIs externes** :
  - API INSEE (SIRET) : https://api.insee.fr/entreprises/sirene/V3
  - API Adresse : https://api-adresse.data.gouv.fr/search/
  - Validation NIR : algorithme Luhn (pas d'API publique)

#### Authentification & SÃ©curitÃ©
- **JWT** : HS256, expiration 24h, refresh tokens (7j)
- **2FA** : TOTP (RFC 6238), QR code via qrcode.js
- **Chiffrement mots de passe** : bcrypt (salt rounds: 12)
- **Rate limiting** : express-rate-limit (100 req/15min par IP)
- **CORS** : whitelist domaines autorisÃ©s
- **Helmet.js** : headers sÃ©curitÃ© HTTP

#### Emails
- **Service** : SendGrid (99% deliverability)
- **Templates** : MJML (responsive HTML)
- **Domaine** : @pouraccord.com (DKIM, SPF, DMARC configurÃ©s)
- **Types** :
  - Transactionnels (confirmation, alertes)
  - Notifications (nouveaux dossiers, expirations)
  - Marketing (onboarding agences, NL mensuelle)

#### HÃ©bergement & Infrastructure
- **Cloud Provider** : OVH Cloud (souverainetÃ© franÃ§aise)
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

#### ModÃ¨le 3-Tiers

**Tier 1 : PrÃ©sentation** (Frontend React)
- SPA (Single Page Application)
- Communication API REST uniquement
- Stockage local : JWT (localStorage sÃ©curisÃ©)
- Pas de logique mÃ©tier cÃ´tÃ© client (sauf validation formulaires)

**Tier 2 : Logique MÃ©tier** (Backend Node.js)
- API RESTful stateless
- Authentification/Autorisation (middleware JWT)
- Orchestration appels IA, paiements, emails
- Validation business rules
- Gestion transactions DB

**Tier 3 : DonnÃ©es** (MySQL + S3)
- MySQL : donnÃ©es structurÃ©es (users, folders, logs...)
- S3 : fichiers binaires (PDFs, images)
- IA microservice : isolÃ©, appelÃ© via HTTP

#### Communication Inter-Services

```
Frontend React â”€â”€â”€â”€â”€â”€â”€â–º Backend Node.js â”€â”€â”€â”€â”€â”€â”€â–º MySQL
                             â”‚
                             â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º S3 (upload/download)
                             â”‚
                             â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º IA Python (POST /analyze)
                             â”‚
                             â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º Stripe API (paiements)
                             â”‚
                             â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–º SendGrid (emails)
```

**Protocoles** :
- Frontend â†” Backend : HTTPS REST JSON
- Backend â†” IA : HTTP REST JSON (rÃ©seau interne VPC)
- Backend â†” MySQL : TCP natif (Sequelize)
- Backend â†” S3 : HTTPS SDK AWS

---

## 3. SPÃ‰CIFICATIONS FONCTIONNELLES

### 3.1 Module Locataire

#### 3.1.1 Inscription & Connexion

**US-LOC-001 : Inscription Simple**

**Description** : Un visiteur peut crÃ©er un compte locataire gratuitement.

**PrÃ©conditions** : Aucune

**Flux nominal** :
1. Utilisateur accÃ¨de Ã  `/register`
2. Saisit : email, mot de passe, confirmation mot de passe
3. Accepte CGU et politique confidentialitÃ© (checkboxes obligatoires)
4. Clique "S'inscrire"
5. SystÃ¨me :
   - VÃ©rifie email non dÃ©jÃ  utilisÃ©
   - Valide format email (regex RFC 5322)
   - Valide mot de passe (min 8 car, 1 maj, 1 min, 1 chiffre)
   - Hash mot de passe (bcrypt)
   - CrÃ©e user en BDD (statut : `pending_verification`)
   - GÃ©nÃ¨re token validation email (UUID, expire 24h)
   - Envoie email confirmation avec lien `/verify-email?token=XXX`
6. Message "Email de confirmation envoyÃ©"

**RÃ¨gles mÃ©tier** :
- Email unique en BDD
- Mot de passe : min 8 caractÃ¨res, 1 majuscule, 1 minuscule, 1 chiffre, optionnel caractÃ¨re spÃ©cial
- Token validation : expire 24h, usage unique
- Compte inaccessible tant que email non validÃ©

**Messages d'erreur** :
- "Cet email est dÃ©jÃ  utilisÃ©"
- "Le mot de passe ne respecte pas les critÃ¨res de sÃ©curitÃ©"
- "Les mots de passe ne correspondent pas"

**Wireframe** :
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚         POURACCORD - Inscription     â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Email : [___________________]      â”‚
â”‚  Mot de passe : [___________]       â”‚
â”‚  Confirmer : [______________]       â”‚
â”‚                                      â”‚
â”‚  â˜‘ J'accepte les CGU                â”‚
â”‚  â˜‘ J'accepte la politique RGPD      â”‚
â”‚                                      â”‚
â”‚  [      S'INSCRIRE      ]           â”‚
â”‚                                      â”‚
â”‚  DÃ©jÃ  un compte ? Se connecter      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

**US-LOC-002 : Validation Email**

**Description** : Le locataire valide son email via lien reÃ§u.

**PrÃ©conditions** : Compte crÃ©Ã© (statut `pending_verification`)

**Flux nominal** :
1. Utilisateur clique lien email `/verify-email?token=XXX`
2. SystÃ¨me :
   - VÃ©rifie token existe et non expirÃ©
   - Met Ã  jour statut user : `active`
   - Supprime token
   - Redirige vers `/login` avec message "Email validÃ©, connectez-vous"

**Flux alternatif** :
- Token expirÃ© : message "Lien expirÃ©, demander un nouveau lien" + bouton
- Token invalide : erreur 404

---

**US-LOC-003 : Connexion**

**Description** : Un locataire se connecte Ã  son compte.

**PrÃ©conditions** : Compte actif (email validÃ©)

**Flux nominal** :
1. Utilisateur accÃ¨de `/login`
2. Saisit email + mot de passe
3. SystÃ¨me :
   - VÃ©rifie email existe
   - Compare hash mot de passe (bcrypt)
   - Si 2FA activÃ© : demande code TOTP (voir US-LOC-005)
   - GÃ©nÃ¨re JWT (payload : user_id, role, exp)
   - Retourne JWT + refresh token
4. Redirection vers dashboard `/dashboard`

**RÃ¨gles mÃ©tier** :
- JWT : expire 24h
- Refresh token : expire 7j, stockÃ© en BDD (table `refresh_tokens`)
- Max 3 tentatives Ã©chouÃ©es / 15 min (rate limiting)

**Messages d'erreur** :
- "Email ou mot de passe incorrect"
- "Votre compte n'est pas encore validÃ©"
- "Trop de tentatives, rÃ©essayez dans 15 minutes"

---

**US-LOC-004 : Mot de Passe OubliÃ©**

**Flux** :
1. Utilisateur clique "Mot de passe oubliÃ© ?" sur `/login`
2. Saisit email
3. SystÃ¨me envoie lien reset (`/reset-password?token=XXX`, expire 1h)
4. Utilisateur clique lien, saisit nouveau mot de passe
5. SystÃ¨me met Ã  jour hash, invalide tous JWT/refresh tokens existants

---

**US-LOC-005 : 2FA Optionnel**

**Description** : Le locataire peut activer 2FA pour sÃ©curitÃ© renforcÃ©e.

**Flux activation** :
1. Depuis `/settings/security`, clic "Activer 2FA"
2. SystÃ¨me gÃ©nÃ¨re secret TOTP, affiche QR code
3. Utilisateur scanne QR avec app (Google Authenticator, Authy...)
4. Saisit code 6 chiffres pour validation
5. SystÃ¨me stocke secret chiffrÃ© en BDD, active 2FA

**Flux connexion avec 2FA** :
1. AprÃ¨s email/mot de passe valides, systÃ¨me demande code 2FA
2. Utilisateur saisit code 6 chiffres
3. SystÃ¨me vÃ©rifie code via speakeasy.verify()
4. Si OK : gÃ©nÃ¨re JWT

**Note** : 2FA obligatoire pour comptes agences (voir US-AGE-002)

---

#### 3.1.2 Constitution du Dossier

**US-LOC-010 : Tableau de Bord Locataire**

**Description** : Vue d'ensemble du dossier avec progression et actions rapides.

**Ã‰lÃ©ments affichÃ©s** :
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Bonjour Jean, votre dossier est complet Ã  75%     â”‚
â”‚  â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘  75%                      â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  DOCUMENTS (12/16)                                  â”‚
â”‚  âœ… PiÃ¨ce d'identitÃ© (CNI)                         â”‚
â”‚  âœ… Justificatif domicile (Facture EDF)            â”‚
â”‚  âœ… 3 fiches de paie (Oct, Nov, Dec 2025)          â”‚
â”‚  âœ… Contrat de travail                             â”‚
â”‚  â³ Avis d'imposition 2024 (expire dans 5j)        â”‚
â”‚  âŒ RIB (manquant)                                 â”‚
â”‚  ...                                                â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  STATUT : ðŸ” En vÃ©rification (dÃ©lai 24-48h)        â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  ACTIONS                                            â”‚
â”‚  [âž• Ajouter un document]                          â”‚
â”‚  [ðŸ”— Partager mon dossier]                         â”‚
â”‚  [ðŸ‘¥ Ajouter un garant]                            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**RÃ¨gles mÃ©tier** :
- Calcul progression : nb_docs_validÃ©s / nb_docs_requis * 100
- Statuts possibles :
  - `incomplete` : < 100%
  - `complete` : 100% + tous docs validÃ©s
  - `verifying` : analyse IA en cours
  - `verified` : analyse OK
  - `attention` : points vigilance dÃ©tectÃ©s

---

**US-LOC-011 : Upload Documents**

**Description** : Le locataire upload un ou plusieurs documents.

**Flux** :
1. Clic "Ajouter un document" ou clic sur doc manquant
2. SÃ©lection type document (liste dÃ©roulante selon profil)
3. Upload fichier (drag & drop ou parcourir)
4. SystÃ¨me :
   - VÃ©rifie format (PDF, JPG, PNG)
   - VÃ©rifie taille (max 5 Mo)
   - Upload vers S3 (`/users/{user_id}/documents/{uuid}.{ext}`)
   - CrÃ©e entrÃ©e BDD table `documents` (statut : `pending_analysis`)
   - Si dossier complet : trigger analyse IA (voir section 6)

**RÃ¨gles mÃ©tier** :
- Formats autorisÃ©s : PDF (multi-pages OK), JPG, PNG
- Taille max : 5 Mo / fichier
- Nommage S3 : UUID pour Ã©viter collisions
- Support multi-pages PDF : un PDF = un document
- Remplacement : si doc dÃ©jÃ  existant â†’ version prÃ©cÃ©dente archivÃ©e (soft delete)

**Messages** :
- "Document uploadÃ© avec succÃ¨s"
- "Format non supportÃ© (utilisez PDF, JPG ou PNG)"
- "Fichier trop volumineux (max 5 Mo)"

---

**US-LOC-012 : Liste Documents Requis Selon Profil**

**Description** : Affichage dynamique des documents obligatoires selon profil locataire.

**Profils** :
1. **SalariÃ© CDI** :
   - CNI/Passeport
   - Justificatif domicile (< 3 mois)
   - Contrat de travail
   - 3 derniÃ¨res fiches de paie
   - Avis d'imposition N-1
   - RIB (optionnel mais recommandÃ©)

2. **SalariÃ© CDD** :
   - Idem + dernier contrat CDD

3. **Ã‰tudiant** :
   - CNI/Passeport
   - Carte Ã©tudiante
   - Justificatif domicile
   - Avis d'imposition parents (si rattachÃ©)
   - Justificatif bourse / ressources (Crous, job Ã©tudiant...)

4. **IndÃ©pendant / Freelance** :
   - CNI/Passeport
   - Justificatif domicile
   - KBIS (< 3 mois)
   - 2 derniers bilans comptables
   - Avis d'imposition N-1

5. **RetraitÃ©** :
   - CNI/Passeport
   - Justificatif domicile
   - Attestation retraite
   - 3 derniers relevÃ©s pension
   - Avis d'imposition N-1

**ImplÃ©mentation** :
- Champ `tenant_profile` en BDD (enum)
- Mapping profil â†’ liste docs dans config backend
- Frontend adapte checklist dynamiquement


**Référentiel Légal Documents (Décret n°2015-1437)**

Conformément au décret, voici les documents acceptables par catégorie. Ce référentiel est utilisé pour configurer la table `document_types` et la checklist détaillée affichée au locataire.

**Justificatif d’identité** (1 pièce obligatoire) :
- Carte d’identité française ou étrangère (avec photo)
- Passeport français ou étranger (avec photo)
- Permis de conduire français ou étranger (avec photo)
- Carte de séjour temporaire, carte de résident, ou carte de ressortissant d’un État membre de l’UE/EEE

**Justificatif de domicile** (1 seul justificatif) :
- 3 dernières quittances de loyer ou attestation du précédent propriétaire
- Attestation sur l’honneur de l’hébergeant
- Attestation d’élection de domicile
- Dernier avis de taxe foncière ou titre de propriété de la résidence principale

**Justificatif de situation professionnelle** (1 ou plusieurs) :
- Contrat de travail ou de stage (ou attestation employeur avec emploi, rémunération, date d’entrée, durée période d’essai si applicable)
- Extrait K ou K bis du registre du commerce (< 3 mois) — entreprise commerciale
- Fiche d’immatriculation au Registre national des entreprises (< 3 mois) — artisan
- Copie du certificat d’identification INSEE (travailleur indépendant)
- Copie de la carte professionnelle (profession libérale)
- Tout document récent attestant de l’activité professionnelle (autre professionnel)
- Carte d’étudiant ou certificat de scolarité pour l’année en cours

**Justificatif de ressources** (1 ou plusieurs) :
- Dernier ou avant-dernier avis d’imposition ou de non-imposition
- 3 dernières fiches de paie
- 2 derniers bilans ou attestation de ressources pour l’exercice en cours (professionnel non-salarié)
- Justificatif de versement des indemnités, retraites, pensions, prestations sociales/familiales et allocations (3 derniers mois)
- Titre de propriété d’un bien immobilier ou dernier avis de taxe foncière
- Justificatif de revenus fonciers, de rentes viagères ou de revenus de valeurs et capitaux mobiliers
- Attestation de simulation des aides au logement (CAF ou MSA)
- Justificatif de versement des indemnités de stage
- Avis d’attribution de bourse (étudiant boursier)

> 📌 **Note** : Les mêmes pièces sont requises pour le garant/co-locataire/conjoint.

---

**US-LOC-013 : Commentaires sur Documents**

**Description** : Le locataire peut ajouter un commentaire si document indisponible ou spÃ©cificitÃ©.

**Exemple** :
- "Avis d'imposition 2024 non encore reÃ§u, fournirai dÃ¨s rÃ©ception"
- "En cours de changement d'employeur, nouveau contrat Ã  venir"

**Champ BDD** : `documents.comment` (TEXT, nullable)

---

**US-LOC-014 : Cycle de Vie Documents**

**Description** : Gestion automatique expiration et suppression documents.

**RÃ¨gles mÃ©tier** :
- **Fiche de paie** : valide 3 mois aprÃ¨s date Ã©mission
- **CNI** : valide jusqu'Ã  date expiration lÃ©gale (lue OCR si possible)
- **Justificatif domicile** : valide 3 mois aprÃ¨s date facture
- **Avis imposition** : valide jusqu'Ã  N+1 (nouvel avis)
- **Autres** : paramÃ©trable par type (table `document_types.validity_months`) (Ã  dÃ©terminer)

**Processus automatique (CRON quotidien)** :
1. Scan table `documents` : `WHERE expires_at < NOW()`
2. Pour chaque doc expirÃ© :
   - Envoie alerte locataire (7j avant expiration)
   - Supprime fichier S3
   - Soft delete en BDD (`deleted_at = NOW()`)
   - Recalcule progression dossier

**Alerte locataire** :
- Email : "Votre [type doc] expire dans 7 jours, pensez Ã  le renouveler"
- Notification in-app

---

#### 3.1.3 Partage du Dossier

**US-LOC-020 : GÃ©nÃ©ration Lien Partage**

**Description** : Le locataire crÃ©e un lien unique pour partager son dossier avec une agence.

**Flux** :
1. Clic "Partager mon dossier" (dashboard ou page dÃ©diÃ©e `/share`)
2. Optionnel : saisie contexte demande :
   - Type bien recherchÃ© (T1, T2, T3...)
   - Localisation (ville, quartier)
   - Budget max (â‚¬/mois)
   - Date disponibilitÃ©
   - RÃ©fÃ©rence annonce externe (SeLoger, LBC...)
3. Clic "GÃ©nÃ©rer lien de partage"
4. SystÃ¨me :
   - GÃ©nÃ¨re UUID unique
   - CrÃ©e entrÃ©e table `sharing_links` :
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

**RÃ¨gles mÃ©tier** :
- Lien valide 30 jours par dÃ©faut (configurable)
- Lien rÃ©utilisable (mÃªme agence peut consulter plusieurs fois)
- PossibilitÃ© crÃ©er plusieurs liens (multi-agences)
- Lien rÃ©vocable (voir US-LOC-021)

**Wireframe** :
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  PARTAGER MON DOSSIER                               â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Contexte de la demande (optionnel)                â”‚
â”‚  Type bien : [T2 â–¼]                                 â”‚
â”‚  Ville : [Paris ___________]                        â”‚
â”‚  Budget : [1200]â‚¬/mois                              â”‚
â”‚  Disponible : [01/03/2026]                          â”‚
â”‚  Ref annonce : [SeLoger-123456]                     â”‚
â”‚                                                      â”‚
â”‚  [    GÃ‰NÃ‰RER LE LIEN    ]                          â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Votre lien : https://pouraccord.com/view/abc123    â”‚
â”‚  [ðŸ“‹ Copier]  [âœ‰ï¸ Envoyer par email]                â”‚
â”‚                                                      â”‚
â”‚  âš ï¸ Ce lien est valide 30 jours                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

**US-LOC-021 : Gestion Liens PartagÃ©s**

**Description** : Historique et gestion des liens crÃ©Ã©s.

**Page** : `/shares/history`

**Affichage** :
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  MES PARTAGES                                       â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  ðŸ“ T2 Paris 15e - 1200â‚¬ (ref: SeLoger-123)        â”‚
â”‚     CrÃ©Ã© le 05/02/2026 - Expire le 07/03/2026      â”‚
â”‚     ðŸ‘ï¸ ConsultÃ© 3 fois (derniÃ¨re : 10/02/2026)      â”‚
â”‚     [RÃ©voquer] [Copier lien]                        â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  ðŸ“ T3 Lille - 900â‚¬                                â”‚
â”‚     CrÃ©Ã© le 01/02/2026 - Expire le 03/03/2026      â”‚
â”‚     ðŸ‘ï¸ Jamais consultÃ©                              â”‚
â”‚     [RÃ©voquer] [Copier lien]                        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Actions** :
- **RÃ©voquer** : soft delete lien (`revoked_at = NOW()`), lien devient invalide
- **Prolonger** : ajoute 30j Ã  `expires_at` (si dossier toujours valide)

---

**US-LOC-022 : Historique Consultations**

**Description** : TraÃ§abilitÃ© de qui a consultÃ© le dossier.

**Table BDD** : `sharing_views`
```sql
{
  id: INT AUTO_INCREMENT,
  sharing_link_id: UUID,
  agency_id: INT (nullable, si agence connectÃ©e),
  viewer_email: VARCHAR(255) (si non-connectÃ©),
  viewed_at: DATETIME,
  ip_address: VARCHAR(45),
  user_agent: TEXT,
  documents_downloaded: JSON (array doc_ids)
}
```

**Affichage locataire** :
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  ACTIVITÃ‰ RÃ‰CENTE                                   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  ðŸ¢ Agence Dupont Immobilier                        â”‚
â”‚     ConsultÃ© le 10/02 Ã  14:32                       â”‚
â”‚     ðŸ“¥ TÃ©lÃ©chargÃ© : CNI, 3 fiches paie              â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  ðŸ“§ contact@agence-martin.fr (non-cliente)          â”‚
â”‚     ConsultÃ© le 08/02 Ã  10:15                       â”‚
â”‚     ðŸ“¥ Aucun tÃ©lÃ©chargement (vue limitÃ©e)           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

#### 3.1.4 Gestion Garants & Co-locataires

**US-LOC-030 : Ajouter Garant par Invitation**

**Description** : Le locataire invite son garant Ã  crÃ©er un compte et complÃ©ter son dossier.

**Flux** :
1. Depuis dashboard, clic "Ajouter un garant"
2. Saisie email garant
3. SystÃ¨me :
   - GÃ©nÃ¨re lien invitation `/garant/invite?token=XXX&tenant_id=YYY`
   - Envoie email au garant avec lien
4. Garant clique lien :
   - Si compte existe : connexion + association au locataire
   - Sinon : inscription + crÃ©ation dossier garant
5. Garant complÃ¨te son dossier (mÃªmes docs que locataire principal, selon profil)
6. Dossier garant liÃ© au locataire (table `guarantors` : `tenant_id`, `guarantor_id`)

**RÃ¨gles mÃ©tier** :
- Un garant peut garantir plusieurs locataires (table many-to-many)
- Analyse IA du dossier garant indÃ©pendante
- Scoring global prend en compte garant

---

**US-LOC-031 : Ajouter Garant par Upload Direct**

**Description** : Le locataire upload directement les docs de son garant.

**Flux** :
1. Clic "Ajouter un garant" â†’ option "Uploader les documents moi-mÃªme"
2. Upload docs garant (mÃªme checklist que locataire)
3. Documents stockÃ©s sous dossier garant virtuel (table `guarantors`)

**DiffÃ©rence** :
- Pas de compte sÃ©parÃ© garant
- Locataire seul responsable exactitude docs

---

**US-LOC-032 : Co-locataires & Conjoints**

**Description** : Logique identique garants, rÃ´le diffÃ©rent.

**Champ BDD** : `guarantors.role` (enum : `guarantor`, `co_tenant`, `spouse`)

**RÃ¨gles** :
- Co-locataire : dossier indÃ©pendant, revenus cumulÃ©s pour calcul adÃ©quation loyer
- Conjoint : dossier liÃ©, revenus cumulÃ©s

---

#### 3.1.5 DÃ©pÃ´t par Email

**US-LOC-040 : Envoi Documents par Email**

**Description** : Le locataire peut envoyer ses docs par email.

**Adresse** : `dossier@pouraccord.com`

**Flux** :
1. Locataire envoie email avec piÃ¨ces jointes
2. Serveur SMTP (SendGrid Inbound Parse ou Ã©quivalent) :
   - Parse email
   - Extrait piÃ¨ces jointes
   - Identifie utilisateur via email expÃ©diteur (match BDD)
   - Upload fichiers vers S3
   - CrÃ©e entrÃ©es `documents` (statut `pending_classification`)
3. IA classifie automatiquement type doc (CNI, fiche paie...) via OCR
4. Notification locataire : "3 documents reÃ§us par email, veuillez vÃ©rifier la classification"

**RÃ¨gles mÃ©tier** :
- Email expÃ©diteur doit correspondre Ã  email compte (sinon : email rejetÃ©)
- Max 10 Mo total piÃ¨ces jointes
- Formats acceptÃ©s : PDF, JPG, PNG

**Limitations MVP** :
- Classification auto basique (mots-clÃ©s OCR : "bulletin de salaire", "carte nationale d'identitÃ©"...)
- Locataire doit valider/corriger classification depuis dashboard

---

**FIN PARTIE 1/4**

---

**SUITE DANS PARTIE 2** :
- 3.2 Module Agence
- 3.3 Module Anti-Fraude IA (aperÃ§u)
- 3.4 Module Administration
- 4. ModÃ¨le de DonnÃ©es (schÃ©mas MySQL complets)
