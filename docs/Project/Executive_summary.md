Bonne idée ! Voici le document de synthèse exécutif complet :

---

# POURACCORD - Document de Synthèse Exécutif
## Plateforme de Gestion et Validation de Dossiers Locataires

**Version** : 1.0  
**Date** : Février 2026  
**Statut** : Document de cadrage pour validation

---

## 1. VISION ET CONTEXTE

### 1.1 Problématique

**Côté Locataires :**
- Envoi répété de documents personnels sensibles à multiples agences (emails lourds, risque de perte)
- Inquiétude sur la confidentialité et le stockage des données
- Oublis fréquents de pièces justificatives
- Processus chronophage et stressant

**Côté Agences Immobilières :**
- Réception de dossiers sous formats hétérogènes (PDF, scans, photos)
- Charge de travail importante : tri, vérification d'exhaustivité, classement, analyse
- Risques RGPD majeurs (stockage prolongé, amendes, impact réputationnel)
- Biais potentiels dans la sélection des locataires
- Difficulté à constituer un vivier de candidats exploitable

### 1.2 Solution PourAccord

**Plateforme centralisée et sécurisée** permettant aux locataires de :
- Constituer **un dossier unique** avec tous les documents requis
- Le partager de manière **contrôlée et traçable** avec les agences
- Bénéficier d'une **validation anti-fraude par IA**

Et aux agences de :
- Accéder à des **dossiers pré-vérifiés et standardisés**
- Automatiser l'analyse (gain de temps : ~30 min/dossier)
- Respecter le **RGPD** (conservation limitée, traçabilité)
- Constituer un **vivier de locataires qualifiés**

### 1.3 Valeur Ajoutée Différenciante

🔐 **Validation anti-fraude IA multicouche** :
- Conformité des documents (champs obligatoires, formats)
- Validité des données structurées (NIR, SIRET, MRZ)
- Authenticité (vérification existence entreprise, adresse)
- Cohérence intra et inter-documentaire
- Détection d'altérations et métadonnées suspectes

📊 **Fiche de synthèse automatique** avec scoring et points de vigilance

---

## 2. UTILISATEURS ET BESOINS

### 2.1 Locataires (Gratuit)

**Profils** :
- Locataire principal
- Garants/cautions
- Co-locataires
- Conjoints

**Besoins** :
- Créer un dossier complet en une fois
- Partager sélectivement avec différentes agences
- Savoir qui consulte leur dossier
- Gérer la durée de vie des documents sensibles

**Accès** :
- Inscription simple (email + mot de passe)
- Vérification email obligatoire
- 2FA optionnel (recommandé)

### 2.2 Agences Immobilières (Payant - 400€ HT/mois)

**Besoins** :
- Recevoir des dossiers pré-qualifiés
- Accéder rapidement aux informations essentielles
- Automatiser l'analyse et réduire les biais
- Constituer un vivier de candidats
- Respecter le RGPD

**Accès** :
- Inscription B2B avec validation (SIRET, Carte pro)
- Compte gérant + invitation des agents
- Essai gratuit 30 jours (accès complet)
- Gestion d'équipe (tous les agents accèdent aux dossiers de l'agence)

### 2.3 Propriétaires Particuliers (Payant - Volume limité)

**Besoins** :
- Vérifier la qualité d'un dossier reçu
- Accès ponctuel sans engagement long terme

**Accès** :
- Abonnement mensuel renouvelable (résiliation flexible)
- Volume limité (30 dossiers/mois)
- Validation à déterminer (SCI : docs greffe + CNI)
- **Non prioritaire pour MVP**

### 2.4 Administrateurs PourAccord

**Besoins** :
- Modérer les dossiers suspects
- Gérer les utilisateurs et abonnements
- Piloter la plateforme (métriques, amélioration IA)
- Support client

---

## 3. FONCTIONNALITÉS MVP (V1)

### 3.1 Module Locataire

#### Inscription & Authentification
- [x] Inscription email/mot de passe
- [x] Validation email (lien de confirmation)
- [x] 2FA optionnel (recommandé pour sécurité)
- [x] Connexion sécurisée

#### Constitution du Dossier
- [x] **Tableau de bord** avec progression (% complétion)
- [x] **Liste des documents** requis selon profil (salarié, étudiant, retraité...)
- [x] Upload multiple formats : PDF (multi-pages ou unitaires), images (JPG, PNG)
- [x] Limite : 5 Mo par fichier
- [x] **Commentaires** sur documents (si indisponible, justification)
- [x] **Un seul dossier** par compte

#### Documents Acceptés (selon service-public.fr)
**Obligatoires pour tous** :
- Pièce d'identité (CNI, passeport)
- Justificatif de domicile

**Selon situation** :
- Contrat de travail / bulletins de salaire (3 derniers mois)
- Avis d'imposition
- Justificatifs de revenus alternatifs (retraite, bourse, ARE...)
- Documents garant (si applicable)

#### Analyse Anti-Fraude
- [x] **Upload global** → Analyse après soumission complète
- [x] **Pas de feedback détaillé** au locataire (éviter gaming du système)
- [x] Statuts : "Dossier complet" / "À compléter"
- [x] Si fraude détectée → Vérification humaine (équipe PourAccord)
- [x] Possibilité de remplacer/modifier documents → Re-validation automatique

#### Partage du Dossier
- [x] **Lien de partage unique** par agence
- [x] Optionnel : associer une **demande contextuelle** (T2 Paris 15e, budget 1200€, dispo mars 2026)
- [x] Possibilité de créer **plusieurs demandes** avec le même dossier
- [x] **Référencement d'annonce externe** (numéro de référence SeLoger, LBC...)
- [x] Historique des partages (qui a consulté, quand, téléchargé quoi)

#### Gestion Garants & Co-locataires
- [x] **Invitation par lien** : le garant/colocataire crée son compte et complète sa partie
- [x] **Upload direct** : le locataire principal uploade les docs du garant
- [x] **Réutilisation** : un garant peut être lié à plusieurs locataires
- [x] Logique unifiée : garant/colocataire/conjoint = même structure technique, rôle différent

#### Gestion du Cycle de Vie
- [x] **Durée de validité** des documents (paramétrée par type) :
  - Fiche de paie : 3 mois
  - CNI : validité légale
  - Autres : selon règle métier
- [x] **Alertes email** avant expiration (7 jours avant)
- [x] **Suppression automatique quotidienne** des docs expirés
- [x] Durée max conservation dossier : **6 mois**
- [x] Rappel avant suppression complète (30 jours avant)
- [x] **Statuts dossier** :
  - Actif (visible recherche opt-in)
  - En standby (non visible, mais accessible pour partages existants)
  - Logement trouvé (plus accessible)
- [x] Réactivation possible si standby

#### Dépôt par Email
- [x] Adresse email dédiée : **dossier@pouraccord.com**
- [x] Le locataire envoie ses docs par email → traitement automatique → association au compte

### 3.2 Module Agence

#### Inscription & Abonnement
- [x] **Formulaire B2B** avec vérification :
  - SIRET obligatoire
  - Carte professionnelle immobilière (optionnel ou validation admin)
  - Contact principal (gérant/responsable)
- [x] **Essai gratuit 30 jours** (accès complet, CB dès inscription)
- [x] **Tarification** : 400€ HT/mois (480€ TTC) - accès illimité
- [x] **Paiement Stripe** (CB uniquement pour MVP)
- [x] **Facturation automatique** mensuelle avec TVA (20%)
- [x] Téléchargement factures depuis espace client
- [x] Demande de devis : formulaire de contact (traitement manuel)

#### Gestion d'Équipe
- [x] Le **gérant** crée le compte agence
- [x] **Invitation agents** par email
- [x] Tous les agents accèdent aux dossiers de l'agence
- [x] 2FA **obligatoire** pour tous les comptes payants

#### Accès aux Dossiers

**Scénario 1 : Push du locataire** (principal)
- [x] Locataire envoie **lien de partage**
- [x] Agence **non-cliente** : fiche de synthèse limitée contre email (acquisition)
  - Prénom, âge, revenus globaux
  - Scoring flouté/partiel
  - Points de vigilance partiels
- [x] Agence **cliente** : fiche complète
  - Toutes données factuelles
  - Scoring anti-fraude détaillé (note/100, feu tricolore)
  - Points de vigilance précis
  - **Documents originaux téléchargeables** (avec watermark + stéganographie)

**Scénario 2 : Recherche proactive** (V1.1+)
- [ ] Recherche dans base de locataires **opt-in**
- [ ] Filtres : revenus, type contrat, localisation, disponibilité...
- [ ] **Non prioritaire pour MVP**

#### Upload de Dossier par Agence
- [x] L'agence peut **uploader un dossier** au nom d'un locataire (docs reçus par canal traditionnel)
- [x] Analyse anti-fraude identique
- [x] Use case : vérifier qualité d'un dossier papier reçu

#### Actions sur les Dossiers
- [x] **Favoris** (retrouver facilement)
- [x] **Changement de statut** : Présélectionné / Refusé / Dossier retenu
- [x] **Contact locataire** (email/téléphone si partagé)
- [x] **Téléchargement documents** (avec watermark visible + stéganographie invisible)
- [x] **Traçabilité** : tous les accès/téléchargements sont loggés

#### Notifications Agence
- [x] Nouveau dossier partagé
- [x] Dossier consulté va expirer/être supprimé
- [x] Mise à jour d'un dossier déjà consulté
- [x] Fin essai / renouvellement abonnement
- [x] Préférences configurables (email obligatoire, in-app, digest hebdo)

### 3.3 Module Anti-Fraude (IA)

#### Analyse Multicouche

**Niveau 1 : Exhaustivité**
- [x] Vérification présence documents obligatoires selon profil

**Niveau 2 : Conformité**
- [x] Respect des champs obligatoires
- [x] Formats requis (PDF lisible, image nette)
- [x] OCR : extraction texte (Tesseract ou AWS Textract/Google Vision)

**Niveau 3 : Validité**
- [x] Vérification données structurées :
  - Numéro de sécurité sociale (NIR) : format et cohérence date naissance
  - SIRET entreprise : existence via API INSEE
  - Bande MRZ (passeport/CNI) : checksum et cohérence
  - Adresses : validation via API adresse.data.gouv.fr

**Niveau 4 : Authenticité**
- [x] Vérification existence entreprise (SIRET)
- [x] Validation adresse (API gouvernementale)

**Niveau 5 : Cohérence Intra-Documentaire**
- [x] Cohérence interne d'un document (dates, montants, identité)

**Niveau 6 : Cohérence Inter-Documentaire**
- [x] Croisement informations entre documents :
  - Nom/prénom identiques partout
  - Date de naissance cohérente avec NIR
  - Adresse cohérente entre justificatif domicile et fiche de paie
  - Revenus cohérents entre bulletin salaire et avis imposition

**Niveau 7 : Intégrité & Falsification**
- [x] Analyse métadonnées PDF (date création, logiciel, modifications)
- [x] Détection tampons/signatures suspects
- [x] Détection altérations visuelles (zones effacées, polices différentes)

**Niveau 8 : Adéquation (optionnel)**
- [x] Vérification critères financiers (revenus x3 loyer)
- [x] Contexte de la demande (localisation, timing)

#### Output de l'Analyse
- [x] **Scoring global** (note/100)
- [x] **Scoring par domaine** (identité, revenus, stabilité...)
- [x] **Feu tricolore** (Vert / Orange / Rouge)
- [x] **Points de vigilance** détaillés
- [x] **Commentaires automatiques** sur chaque document

#### Cas Particuliers
- [x] **Fiche de paie incohérente mais vraie** : option d'appel à l'employeur (service différenciant)
- [x] **Fraude confirmée** : document non supprimé (preuve), dossier non bloqué mais signalé à l'agence
- [x] **Pas de blocage compte** fraudeur (sanction légale suffit)

### 3.4 Module Administration (Back-Office)

#### File de Modération
- [x] **Queue des dossiers suspects** nécessitant vérification humaine
- [x] Détails analyse IA (pourquoi suspect)
- [x] Validation/invalidation manuelle
- [x] Feedback pour amélioration modèle IA
- [x] Suggestions automatiques ou saisies manuellement
- [x] **Tag fraudeur** (pas de bannissement)

#### Gestion Utilisateurs
- [x] Recherche utilisateur (locataire/agence)
- [x] Consultation activité
- [x] Traçabilité complète des actions
- [x] Gestion abonnements (essais, renouvellements, impayés)

#### Dashboard Admin
- [x] **Métriques business** :
  - Nombre locataires inscrits
  - Nombre dossiers actifs (vs total inscrits)
  - Nombre agences payantes
  - MRR (Monthly Recurring Revenue)
  - Taux conversion agence gratuite → payante
- [x] **Métriques opérationnelles** :
  - File modération (N dossiers en attente)
  - Taux de fraude détectée
  - Taux de faux positifs
  - Délai moyen traitement
- [x] **Métriques efficacité** :
  - Délai moyen dépôt dossier → logement trouvé
  - Taux de succès utilisateurs

#### Interface Entraînement IA
- [x] Validation/rejet humain comme **feedback** pour modèle
- [x] Anonymisation des données avant entraînement
- [x] Métriques d'amélioration (précision, rappel)
- [x] **V1.1+ : interface avancée dédiée**

#### Support Client
- [x] Email : support@pouraccord.com
- [x] Chat/FAQ intégré avec **bot** (FR/EN)
- [x] Pas de système de tickets complexe (MVP)

### 3.5 Notifications

#### Locataire
- [x] Confirmation création compte (email)
- [x] Dossier complet (100% docs uploadés)
- [x] Document expiré/proche expiration (7j avant)
- [x] Dossier en cours de validation manuelle
- [x] Dossier consulté par agence
- [x] Documents téléchargés par agence
- [x] Demande doc complémentaire (équipe PourAccord)
- [x] Suppression imminente dossier (30j avant)

#### Agence
- [x] Nouveau dossier partagé
- [x] Dossier va expirer/être supprimé
- [x] Mise à jour dossier consulté
- [x] Fin essai / renouvellement
- [x] Matching potentiel (V1.1+ si recherche opt-in)

#### Canaux
- [x] **Email** : principal et obligatoire
- [x] **In-app** : quand connecté
- [x] **SMS** : optionnel (selon coût), pour actions critiques
- [x] **Push** : pour future app mobile
- [x] Préférences configurables (types, canaux, fréquence)
- [x] Récap hebdomadaire possible

### 3.6 Dashboards

#### Dashboard Locataire
- [x] **Statut global** dossier (Complet X%, À compléter, En vérification)
- [x] **Liste documents** avec statuts individuels (✓ OK, ⏳ Expire bientôt, ❌ Manquant, 🔍 Vérification)
- [x] **Historique partages** (envoyé à qui, quand, consulté quand, téléchargé)
- [x] **Activité récente** (3 consultations cette semaine)
- [x] **Alertes** (3 docs expirent sous 7j)

#### Dashboard Agence
- [x] **Statistiques globales** (120 dossiers consultés ce mois, 45 nouveaux cette semaine)
- [x] **Temps économisé** calculé (ex: 120 dossiers × 30 min = 60h économisées)
- [x] **Valorisation** optionnelle (60h × taux horaire saisi = X€)
- [x] **Liste dossiers** avec filtres (tous, favoris, présélectionnés, refusés)
- [x] **Alertes** (5 dossiers vont expirer sous 7j)
- [x] **Accès facturation** (mais pas dans dashboard principal)

#### Dashboard Admin
- [x] Métriques business, opérationnelles, efficacité (cf section 3.4)
- [x] File modération
- [x] Gestion utilisateurs & abonnements

---

## 4. ARCHITECTURE TECHNIQUE

### 4.1 Stack Technologique

**Backend**
- **Runtime** : Node.js (LTS)
- **Framework** : Express.js ou NestJS (à décider selon complexité)
- **Langage** : TypeScript (typage fort, maintenabilité)

**Frontend**
- **Framework** : React (latest stable)
- **État** : Redux ou Context API + hooks
- **UI** : Material-UI ou Tailwind CSS
- **Internationalisation** : react-i18next (FR/EN dès V1)

**Base de Données**
- **SGBD** : MySQL (version 8.0+)
- **ORM** : Sequelize ou TypeORM
- **Structure** :
  - Users (locataires, agences, admins)
  - Dossiers (folders)
  - Documents (avec métadonnées)
  - Logs (traçabilité complète)
  - Partages (sharing_links)
  - Abonnements (subscriptions)

**Stockage Fichiers**
- **Cloud** : AWS S3 (ou équivalent OVH Object Storage)
- **Chiffrement** : au repos (S3 encryption) et en transit (HTTPS/TLS)
- **Organisation** : 
  - `/users/{user_id}/documents/{doc_id}.pdf`
  - Watermarking avant téléchargement agence
  - Stéganographie pour traçabilité invisible

**IA & OCR**
- **OCR** : 
  - Tesseract (open-source, gratuit, correct)
  - OU AWS Textract / Google Cloud Vision (meilleurs mais coûteux)
  - Support multilingue (FR/EN prioritaire, ES/IT/DE pour futur)
- **Analyse métadonnées PDF** : PyPDF2 ou pdf-lib (Node.js)
- **ML Détection fraude** :
  - Modèle custom (Python + scikit-learn ou TensorFlow)
  - Microservice séparé (API REST appelée par backend Node.js)
  - Interface entraînement : feedback admin → amélioration continue
- **APIs externes** :
  - API INSEE (SIRET)
  - API Adresse (adresse.data.gouv.fr)
  - Potentiellement API impots.gouv.fr (vérification avis imposition)

**Paiement**
- **Stripe** : abonnements récurrents, gestion CB, webhooks

**Authentification**
- **JWT** (JSON Web Tokens)
- **2FA** : TOTP (Time-based One-Time Password) via authenticator apps (Google Authenticator, Authy)

**Emails**
- **Service** : SendGrid, Mailgun, ou AWS SES
- **Templates** : HTML responsive (confirmations, alertes, notifications)

**Hébergement**
- **Cloud** : OVH Cloud (français, souveraineté)
- **Alternative** : Scaleway, Outscale (français), ou AWS EU (Paris)
- **Environnements** :
  - Production (prod)
  - Staging (preprod)
  - Développement (dev/local)

### 4.2 Architecture Applicative

**Modèle 3-tiers**
```
[Frontend React] ←→ [Backend Node.js API] ←→ [MySQL DB + S3 Storage]
                            ↓
                    [Microservice IA Python]
```

**API RESTful**
- Authentification par JWT
- Endpoints :
  - `/auth/*` : inscription, login, 2FA
  - `/users/*` : gestion profil
  - `/folders/*` : CRUD dossiers
  - `/documents/*` : upload, download, delete
  - `/sharing/*` : création liens, consultation
  - `/subscriptions/*` : abonnements, paiements
  - `/admin/*` : modération, stats
  - `/ai/*` : trigger analyse, résultats

**Sécurité**
- HTTPS/TLS obligatoire
- CORS configuré strictement
- Rate limiting (anti-DDoS, anti-brute-force)
- Validation inputs (injection SQL, XSS)
- Chiffrement mots de passe (bcrypt)
- Logs d'audit complets (qui/quoi/quand)

### 4.3 Dimensionnement (6 mois)

**Volume estimé**
- 5 000 utilisateurs locataires
- 50 dossiers traités/jour (1 500/mois)
- Taille moyenne dossier : 10-15 Mo
- Stockage : ~75 Go après 6 mois (avec rotation 6 mois)
- Agences payantes : ~50 (objectif réaliste)

**Infrastructure**
- **Serveur backend** : 4 vCPU, 8 GB RAM (scalable)
- **Base de données** : 2 vCPU, 4 GB RAM, 100 GB SSD
- **Stockage S3** : 100 GB initial (évolutif)
- **CDN** : CloudFlare (cache assets frontend)

---

## 5. CONFORMITÉ RGPD & SÉCURITÉ

### 5.1 Consentements Obligatoires

À l'inscription, le locataire consent explicitement à :
- [x] Stockage documents sensibles (durée max 6 mois)
- [x] Partage avec tiers (agences) sur action volontaire
- [x] Utilisation anonymisée pour amélioration IA

### 5.2 Droits des Utilisateurs

- [x] **Droit d'accès** : téléchargement de toutes les données (ZIP + JSON métadonnées)
- [x] **Droit de rectification** : modifier/remplacer documents
- [x] **Droit à l'effacement** : suppression compte et TOUTES données associées
- [x] **Droit à la portabilité** : export format standard (sans scoring/analyse propriétaire)

### 5.3 Traçabilité

**Logs obligatoires (conservation 3 ans minimum)** :
- [x] Qui a consulté quel dossier (date, heure, IP)
- [x] Qui a téléchargé quel document (idem)
- [x] Toutes modifications dossier (upload, remplacement, suppression)
- [x] Changements statuts (complet, en vérification, validé, refusé)
- [x] Partages créés (avec qui, quand)

### 5.4 Conservation et Suppression

**Durées de vie documents** :
- Fiche de paie : 3 mois max
- CNI/Passeport : validité légale
- Autres : selon règle métier (paramétrable)

**Dossier complet** :
- Durée max : 6 mois
- Alerte 30 jours avant suppression (email + possibilité prolongation si docs valides)
- **Nettoyage automatique quotidien** (CRON)
- Notification agences concernées si dossier partagé va être supprimé

**Suppression définitive** :
- Fichiers S3 : suppression physique
- Base de données : hard delete (pas de soft delete pour données sensibles)
- Logs : anonymisation après 3 ans

### 5.5 Sécurité

- [x] **Chiffrement au repos** : S3 encryption, MySQL encryption at rest
- [x] **Chiffrement en transit** : HTTPS/TLS 1.3
- [x] **Watermarking** : visible sur PDFs téléchargés (nom agence + date)
- [x] **Stéganographie** : traçabilité invisible (identifiant unique agence/agent)
- [x] **2FA obligatoire** pour comptes payants
- [x] **Audits réguliers** : tests intrusion, revue code sécurité
- [x] **Hébergement France/UE** : OVH Cloud ou équivalent certifié
- [x] **Certifications visées** : ISO 27001 (à terme)

---

## 6. MODÈLE ÉCONOMIQUE

### 6.1 Tarification

**Locataires** : GRATUIT
- Acquisition par usage (effet réseau)
- Pas de limite nombre de dossiers
- Pas de limite partages

**Agences Immobilières** : 400€ HT/mois (480€ TTC)
- Accès illimité dossiers
- Toutes fonctionnalités (scoring complet, téléchargement docs, recherche opt-in V1.1+)
- Essai gratuit 30 jours (CB requise)
- Facturation automatique Stripe
- Résiliation possible à tout moment (mois entamé dû)

**Propriétaires Particuliers** : Volume limité (V1.1+)
- Abonnement mensuel renouvelable
- 30 dossiers/mois max
- Prix à définir (~50-100€/mois)

### 6.2 Stratégie d'Acquisition

**Acquisition agences** :
1. Locataire envoie lien partage → agence non-cliente voit **teaser** (scoring flouté)
2. Pour accéder au dossier complet → doit laisser email (lead qualifié)
3. Campagne email nurturing → essai 30j
4. Onboarding dédié (support, formation)

**Rétention** :
- ROI clair : temps économisé + valorisation (60h × taux horaire)
- Conformité RGPD simplifiée
- Vivier de candidats qualifiés

### 6.3 Projections (6 mois)

**Hypothèses conservatrices** :
- 5 000 locataires inscrits
- 50 agences payantes (taux conversion 10% des 500 agences contactées)
- MRR : 50 × 400€ = **20 000€ HT/mois**
- ARR : **240 000€ HT** (après 6 mois en rythme de croisière)

**Coûts estimés** :
- Infrastructure : ~500€/mois
- Stripe fees : ~2% (400€/mois)
- Support/modération : 1-2 ETP (selon volume)
- Développement : externalisé ou équipe interne

---

## 7. ROADMAP

### 7.1 Phase 1 : MVP (Mois 1-3)

**Objectif** : Valider le concept avec fonctionnalités essentielles

**Développement** :
- [ ] Infrastructure de base (backend Node.js, frontend React, MySQL, S3)
- [ ] Authentification (inscription, login, 2FA)
- [ ] Module locataire (upload docs, tableau de bord)
- [ ] Analyse anti-fraude IA (niveaux 1-7, scoring basique)
- [ ] Module agence (inscription, abonnement Stripe, consultation dossiers)
- [ ] Partage par lien (gratuit limité / payant complet)
- [ ] Back-office admin (modération, métriques de base)
- [ ] Notifications email (templates essentiels)
- [ ] RGPD (consentements, droits, traçabilité, suppression auto)

**Livrable** : Plateforme fonctionnelle en Beta privée

### 7.2 Phase 2 : Lancement Public (Mois 4)

**Objectif** : Acquisition premiers utilisateurs

**Actions** :
- [ ] Tests utilisateurs (10-20 locataires, 3-5 agences)
- [ ] Corrections bugs & UX
- [ ] Onboarding amélioré (tutoriels, tooltips)
- [ ] Landing page marketing (SEO, conversion)
- [ ] Campagne acquisition :
  - Partenariats agences (pilotes)
  - Ads ciblées (Google, Facebook)
  - Relations presse spécialisée immobilier

**Livrable** : Lancement public V1.0

### 7.3 Phase 3 : Optimisation & Fonctionnalités V1.1 (Mois 5-6)

**Objectif** : Amélioration continue et fonctionnalités différenciantes

**Développement** :
- [ ] **Recherche opt-in** locataires (agences cherchent proactivement)
- [ ] **Garants avec compte séparé** (invitation, dossier propre)
- [ ] **Interface entraînement IA avancée** (dashboard ML, métriques précision)
- [ ] **App mobile** (React Native ou PWA)
- [ ] **Intégration API annonces** (scraping léger SeLoger/LBC pour récupérer infos annonce)
- [ ] **Matching automatique** (IA suggère locataires aux agences selon critères)
- [ ] **Propriétaires particuliers** (module dédié, tarif adapté)
- [ ] **Analytics avancés** (funnel conversion, A/B testing)

**Livrable** : V1.1 avec fonctionnalités premium

### 7.4 Phase 4 : Scale & Pivot Potentiel (Mois 7-12)

**Objectif** : Croissance et exploration nouvelles verticales

**Développement** :
- [ ] **Multilingue** (ES, IT, DE) → expansion internationale
- [ ] **Module banques** (vérification dossiers prêts immobiliers)
- [ ] **Module assurances** (garantie loyers impayés)
- [ ] **Module RH** (vérification dossiers candidats)
- [ ] API publique (partenaires peuvent intégrer PourAccord)

**Livrable** : Plateforme multi-verticale

---

## 8. RISQUES & MITIGATION

### 8.1 Risques Techniques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Faux négatifs IA (fraude non détectée) | Réputation | Vérification humaine systématique dossiers suspects + amélioration continue modèle |
| Faux positifs IA (dossier légitime rejeté) | UX locataire | Idem + possibilité contestation/remplacement doc |
| Fuite de données (breach) | Légal (RGPD), réputation | Sécurité renforcée, audits réguliers, cyber-assurance |
| Performance OCR (docs illisibles) | Qualité analyse | Combinaison Tesseract + AWS Textract pour docs difficiles |
| Scalabilité (pic de charge) | Disponibilité | Architecture cloud scalable (load balancers, auto-scaling) |

### 8.2 Risques Business

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Adoption lente agences | Revenus | Stratégie acquisition agressive (freemium, essai 30j, ROI clair) |
| Chicken & egg (pas de locataires → agences partent) | Viabilité | Focus acquisition locataires d'abord (gratuit, viral) |
| Concurrence (grands acteurs entrent sur marché) | Parts de marché | Différenciation IA anti-fraude + time-to-market rapide |
| Réglementation (changement loi docs locataires) | Obsolescence fonctionnalités | Veille juridique, modularité code (facile à adapter) |

### 8.3 Risques Réglementaires

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Non-conformité RGPD | Amendes (jusqu'à 4% CA) | Conformité dès la conception (privacy by design), DPO externe si nécessaire |
| Responsabilité en cas de discrimination | Légal | Traçabilité complète, pas de décision automatique finale (agence décide) |
| Litige locataire (doc perdu/volé) | Réputationnel | Assurance RC Pro, CGU claires, logs exhaustifs |

---

## 9. INDICATEURS DE SUCCÈS (KPIs)

### 9.1 Acquisition (Mois 1-6)

- 5 000 locataires inscrits
- 500 agences contactées (leads)
- 50 agences payantes (taux conversion 10%)
- 1 500 dossiers créés et partagés

### 9.2 Engagement

- Taux de complétion dossiers : >80%
- Taux de partage (dossiers partagés / dossiers complets) : >60%
- Nombre moyen consultations par dossier : 3-5
- Temps moyen constitution dossier : <30 min

### 9.3 Qualité

- Taux de fraude détectée : <5% (objectif)
- Taux de faux positifs : <2%
- Score satisfaction utilisateurs : >4/5

### 9.4 Financier

- MRR (Mois 6) : 20 000€ HT
- CAC (Coût Acquisition Client agence) : <2 000€
- LTV/CAC ratio : >3
- Churn agences : <10%/mois

---

## 10. PROCHAINES ÉTAPES

### Validation de ce Document

**Action attendue** :
1. Lecture et validation de cette synthèse
2. Identification des points à ajuster/préciser
3. Validation finale du périmètre MVP

### Cahier des Charges Détaillé

**Contenu** (~40-50 pages) :
- Spécifications fonctionnelles complètes (use cases détaillés)
- Modèle de données (schémas tables MySQL)
- Wireframes/mockups interfaces
- Spécifications techniques API (endpoints, payloads)
- Architecture logicielle détaillée
- Plan de tests (unitaires, intégration, E2E)
- Documentation sécurité et RGPD exhaustive

### Décomposition en Tâches

**Backlog Produit** :
- User stories priorisées (format Agile)
- Découpage en sprints (2 semaines)
- Estimation efforts (story points)
- Dépendances techniques
- Critères d'acceptance

---

## ANNEXES

### A. Glossaire

- **NIR** : Numéro d'Inscription au Répertoire (= numéro sécurité sociale)
- **MRZ** : Machine Readable Zone (bande lisible optiquement sur passeports/CNI)
- **SIRET** : Système d'Identification du Répertoire des Établissements (identifiant entreprise)
- **OCR** : Optical Character Recognition (reconnaissance optique de caractères)
- **2FA** : Two-Factor Authentication (authentification à deux facteurs)
- **RGPD** : Règlement Général sur la Protection des Données
- **MRR** : Monthly Recurring Revenue (revenus récurrents mensuels)
- **ARR** : Annual Recurring Revenue (revenus récurrents annuels)
- **CAC** : Customer Acquisition Cost (coût d'acquisition client)
- **LTV** : Lifetime Value (valeur vie client)

### B. Références Légales

- Décret n°2015-1437 du 5 novembre 2015 (liste pièces justificatives locataires)
- https://www.service-public.fr/particuliers/vosdroits/F1169
- RGPD (Règlement UE 2016/679)
- Loi informatique et libertés (modifiée 2018)

### C. Contact

**PourAccord**  
Email : contact@pouraccord.com  
Support : support@pouraccord.com  
Documents : dossier@pouraccord.com

---

**FIN DU DOCUMENT DE SYNTHÈSE EXÉCUTIF**

---

Voilà ! Le document complet est maintenant devant vous. Prenez le temps de le lire et dites-moi ce que vous en pensez, quels ajustements vous souhaitez, et si je peux passer à l'étape suivante (cahier des charges détaillé).