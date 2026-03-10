# POURACCORD - Pipeline d'Analyse Documentaire
## Spécifications Techniques — Module Anti-Fraude IA (Détail d'Implémentation)

**Version** : 1.0  
**Date** : Mars 2026  
**Statut** : Spécifications techniques pour développement  
**Référence CDC** : Partie 3, Section 6 — Module Anti-Fraude IA

> **Note** : Ce document est le complément technique de la Section 6 du CDC Partie 3. Il détaille l'implémentation atomique de chaque script d'analyse, le schéma d'orchestration N8N, les contrats d'interface entre scripts, et la stratégie de gestion d'erreurs. Le CDC Partie 3 reste la référence fonctionnelle (niveaux d'analyse, scoring, outputs JSON).

---

## TABLE DES MATIÈRES

1. [Philosophie d'Architecture](#1-philosophie-darchitecture)
2. [Vue d'ensemble du Pipeline](#2-vue-densemble-du-pipeline)
3. [Contrat d'Interface Standard](#3-contrat-dinterface-standard)
4. [Scripts Atomiques](#4-scripts-atomiques)
   - 4.1 [Reconnaissance de Documents](#41-reconnaissance-de-documents-classify_documentpy)
   - 4.2 [OCR & Extraction de Texte](#42-ocr--extraction-de-texte-ocr_extractpy)
   - 4.3 [Extraction de Données Structurées](#43-extraction-de-données-structurées-parse_fieldspy)
   - 4.4 [Validation des Règles Métier](#44-validation-des-règles-métier-validate_rulespy)
   - 4.5 [Cohérence Cross-Documentaire](#45-cohérence-cross-documentaire-cross_checkpy)
   - 4.6 [Intégrité & Détection de Falsification](#46-intégrité--détection-de-falsification-metadata_checkpy)
   - 4.7 [Scoring ML](#47-scoring-ml-ml_scorepy)
5. [Orchestration N8N](#5-orchestration-n8n)
   - 5.1 [Pourquoi N8N](#51-pourquoi-n8n)
   - 5.2 [Architecture du Workflow](#52-architecture-du-workflow)
   - 5.3 [Intégration avec la Plateforme](#53-intégration-avec-la-plateforme)
   - 5.4 [Déclenchement depuis Node.js](#54-déclenchement-depuis-nodejs)
   - 5.5 [Récupération du Résultat (Callback)](#55-récupération-du-résultat-callback)
6. [Gestion des Erreurs](#6-gestion-des-erreurs)
   - 6.1 [Niveaux de Gestion](#61-niveaux-de-gestion)
   - 6.2 [Schéma de Retry](#62-schéma-de-retry)
   - 6.3 [Surveillance des Dossiers Bloqués](#63-surveillance-des-dossiers-bloqués)
7. [Évolutions de Déploiement](#7-évolutions-de-déploiement)
8. [Variables d'Environnement](#8-variables-denvironnement)

---

## 1. Philosophie d'Architecture

### Principe : Atomicité des Scripts

Chaque étape d'analyse est un **script indépendant** avec une responsabilité unique. Ce principe permet :

- **Testabilité** : chaque script peut être lancé et validé en isolation via CLI
- **Remplaçabilité** : améliorer ou remplacer un script sans toucher aux autres (ex: passer de Tesseract à AWS Textract pour l'OCR)
- **Observabilité** : savoir exactement à quelle étape une analyse a échoué
- **Réutilisabilité** : certains scripts (OCR, extraction) pourront être réutilisés dans d'autres contextes (module RH, banques — Phase 4)

### Contrat d'Or

> Chaque script reçoit un **JSON en entrée** et produit un **JSON normalisé en sortie**. Aucune dépendance directe entre scripts — l'orchestrateur (N8N ou pipeline.py) transporte les données.

---

## 2. Vue d'ensemble du Pipeline

```
[Plateforme Node.js]
        |
        | POST /internal/n8n/analyze
        | { folder_id, documents[] }
        ↓
[N8N Webhook — Entrée]
        |
        ├──► [S1] classify_document.py    → Reconnaissance type de document
        |           ↓ (résultat enrichit les docs)
        ├──► [S2] ocr_extract.py          → Extraction texte brut (par document)
        |           ↓ (fallback AWS Textract si score < seuil)
        ├──► [S3] parse_fields.py         → Extraction données structurées
        |           ↓ (NIR, SIRET, MRZ, dates, montants…)
        ├──► [S4] validate_rules.py       → Validation règles métier
        |           ↓ (appels API INSEE, API Adresse, Luhn NIR)
        ├──► [S5] cross_check.py          → Cohérence inter-documentaire
        |           ↓ (noms, dates naissance, employeur, revenus)
        ├──► [S6] metadata_check.py       → Intégrité PDF & détection falsification
        |           ↓ (métadonnées, polices, altérations visuelles)
        └──► [S7] ml_score.py             → Score global ML (XGBoost)
                    ↓
        [N8N — Agrégation résultats]
                    |
                    | POST /internal/ai/callback
                    ↓
        [Plateforme Node.js — Mise à jour BDD + Notification]
```

---

## 3. Contrat d'Interface Standard

Tous les scripts respectent ce contrat d'entrée/sortie.

### Input Standard

```json
{
  "folder_id": 456,
  "step": "ocr_extract",
  "documents": [
    {
      "document_id": 789,
      "document_type": "payslip",
      "file_url": "https://s3.pouraccord.com/users/123/docs/789.pdf",
      "previous_results": {
        "classify": { "confidence": 0.97, "detected_type": "payslip" }
      }
    }
  ],
  "context": {
    "tenant_profile": "employee_cdi",
    "analysis_id": "uuid-xxxx"
  }
}
```

### Output Standard

```json
{
  "success": true,
  "step": "ocr_extract",
  "folder_id": 456,
  "analysis_id": "uuid-xxxx",
  "duration_ms": 1240,
  "results": [
    {
      "document_id": 789,
      "success": true,
      "data": { },
      "warnings": [],
      "fallback_triggered": false
    }
  ],
  "error": null
}
```

### Output en cas d'erreur

```json
{
  "success": false,
  "step": "ocr_extract",
  "folder_id": 456,
  "analysis_id": "uuid-xxxx",
  "duration_ms": 340,
  "results": [],
  "error": {
    "code": "OCR_FAILED",
    "message": "Impossible d'extraire le texte — document potentiellement corrompu",
    "document_id": 789,
    "recoverable": false
  }
}
```

**Codes d'erreur standardisés** :

| Code | Récupérable | Description |
|------|-------------|-------------|
| `FILE_NOT_FOUND` | Non | Le fichier S3 est introuvable |
| `FILE_CORRUPTED` | Non | Fichier illisible / corrompu |
| `OCR_LOW_CONFIDENCE` | Oui | Score OCR < seuil → fallback |
| `API_TIMEOUT` | Oui | Timeout API externe (INSEE, Adresse) |
| `API_UNAVAILABLE` | Oui | API externe indisponible → retry |
| `CLASSIFICATION_FAILED` | Non | Type de document non reconnu |
| `PARSE_INCOMPLETE` | Oui | Champs requis non trouvés |
| `ML_MODEL_ERROR` | Non | Erreur modèle ML → score par défaut |

---

## 4. Scripts Atomiques

### 4.1 Reconnaissance de Documents — `classify_document.py`

**Responsabilité** : Identifier le type de document (CNI, fiche de paie, avis d'imposition…) indépendamment de ce que l'utilisateur a déclaré lors de l'upload. Permet de détecter les mauvais documents uploadés dans la mauvaise catégorie.

**Méthode** :
- Extraction des premières lignes de texte via OCR rapide (basse résolution)
- Matching regex sur mots-clés caractéristiques par type de document
- Score de confiance : (0.0 — 1.0)
- Si confiance < 0.70 → warning `DOCUMENT_TYPE_MISMATCH`

**Input spécifique** :
```json
{
  "document_id": 789,
  "declared_type": "payslip",
  "file_url": "https://s3..."
}
```

**Output spécifique** :
```json
{
  "document_id": 789,
  "declared_type": "payslip",
  "detected_type": "payslip",
  "confidence": 0.97,
  "type_match": true,
  "keywords_found": ["bulletin de salaire", "net à payer", "cotisations"]
}
```

**Fallback** : Si classification impossible → `detected_type: "unknown"`, alerte admin, pipeline continue avec le type déclaré.

---

### 4.2 OCR & Extraction de Texte — `ocr_extract.py`

**Responsabilité** : Extraire le texte brut de chaque document. Fournir le texte aux scripts suivants (parse_fields, cross_check).

**Moteur principal** : Tesseract 5.x (langues : `fra+eng`)

**Logique de fallback** :
```
1. Lancer Tesseract → confidence_score
2. Si confidence_score < 0.75 → relancer avec prétraitement image (deskew, denoise)
3. Si toujours < 0.75 → appel AWS Textract (facturation au volume)
4. Si AWS Textract échoue → error CODE: OCR_FAILED (bloquant)
```

**Prétraitement image** (avant Tesseract) :
- Conversion en niveaux de gris
- Binarisation adaptive (Otsu)
- Correction d'orientation (deskew)
- Suppression du bruit (median blur)
- Upscaling si DPI < 150

**Output spécifique** :
```json
{
  "document_id": 789,
  "raw_text": "BULLETIN DE PAIE\nMois : Décembre 2025\nEmployeur : ACME Corp\n...",
  "confidence_score": 0.91,
  "engine_used": "tesseract",
  "fallback_triggered": false,
  "page_count": 1,
  "language_detected": "fr"
}
```

**Seuils de confiance** :

| Score | Action |
|-------|--------|
| ≥ 0.75 | Tesseract OK → passer à parse_fields |
| 0.50 – 0.74 | Prétraitement + retry Tesseract |
| < 0.50 | Fallback AWS Textract |
| Échec total | Erreur bloquante → warning `DOCUMENT_UNREADABLE` |

---

### 4.3 Extraction de Données Structurées — `parse_fields.py`

**Responsabilité** : À partir du texte brut (produit par ocr_extract), extraire les champs structurés selon le type de document.

**Méthode** : Regex par type de document + NLP léger (spaCy FR) pour les entités nommées (noms, adresses).

**Champs extraits par type de document** :

| Type | Champs extraits |
|------|----------------|
| `identity_card` | Nom, prénom, date de naissance, NIR, numéro de document, date d'expiration, MRZ |
| `passport` | Idem + nationalité, MRZ (2 lignes) |
| `payslip` | Employeur, SIRET, nom salarié, période, salaire net, salaire brut, date de paiement |
| `employment_contract` | Employeur, SIRET, type contrat (CDI/CDD), date début, poste |
| `tax_notice` | Nom, adresse fiscale, revenu fiscal de référence, année, numéro fiscal |
| `proof_of_residence` | Nom, adresse complète, date du document, émetteur |
| `kbis` | Raison sociale, SIRET, SIREN, adresse siège, date immatriculation, dirigeant |
| `student_card` | Établissement, nom, année universitaire, numéro étudiant |

**Output spécifique** :
```json
{
  "document_id": 789,
  "document_type": "payslip",
  "extracted_fields": {
    "employer_name": "ACME Corp",
    "siret": "12345678900010",
    "employee_name": "Jean MARTIN",
    "period": "2025-12",
    "net_salary": 3542.50,
    "gross_salary": 4510.00,
    "payment_date": "2025-12-28"
  },
  "missing_fields": [],
  "parse_confidence": 0.94
}
```

**Gestion des champs manquants** :
- Champs obligatoires manquants → `warning: FIELD_MISSING` (severity: high)
- Champs optionnels manquants → `warning: FIELD_MISSING` (severity: low)
- Pipeline ne bloque pas sur les champs optionnels

---

### 4.4 Validation des Règles Métier — `validate_rules.py`

**Responsabilité** : Valider les données extraites contre des règles métier et des APIs externes.

**Validations effectuées** :

#### NIR (Numéro de Sécurité Sociale)
```python
# Algorithme de Luhn adapté au NIR français
# Format : 15 chiffres → 13 chiffres + 2 chiffres de clé
# Cohérence : chiffre 2 = année naissance, chiffres 3-4 = mois naissance
def validate_nir(nir: str, birth_date: str) -> ValidationResult
```

#### SIRET
```python
# Appel API INSEE Sirene V3
# GET https://api.insee.fr/entreprises/sirene/V3/siret/{siret}
# Vérifier : existence + état actif (etatAdministratifEtablissement = "A")
def validate_siret(siret: str) -> ValidationResult
```

#### MRZ (Machine Readable Zone — Passeport/CNI)
```python
# Validation checksum selon ICAO Doc 9303
# Vérification cohérence MRZ vs champs extraits (nom, date naissance, expiration)
def validate_mrz(mrz_line1: str, mrz_line2: str) -> ValidationResult
```

#### Adresse
```python
# Appel API Adresse gouvernementale
# GET https://api-adresse.data.gouv.fr/search/?q={adresse}&limit=1
# Score de confiance retourné par l'API
def validate_address(address: str) -> ValidationResult
```

#### Validité temporelle des documents
```python
# Vérifier que la date du document est dans la fenêtre de validité
# Ex: justificatif domicile < 3 mois, avis imposition < 12 mois
def validate_document_freshness(doc_date: str, doc_type: str) -> ValidationResult
```

**Output spécifique** :
```json
{
  "document_id": 789,
  "validations": [
    {
      "rule": "siret_exists",
      "passed": true,
      "details": "ACME Corp — actif depuis 2010-03-15",
      "api_source": "insee_sirene_v3"
    },
    {
      "rule": "document_freshness",
      "passed": true,
      "details": "Document du 2025-12-28 — dans la fenêtre de 3 mois"
    }
  ],
  "score": 100,
  "warnings": []
}
```

**Gestion des timeouts API** :
- Timeout par appel : 3 secondes
- Retry automatique : 2 fois (délai 500ms)
- Si API indisponible après retries → warning `API_UNAVAILABLE` (non bloquant) + log pour monitoring

---

### 4.5 Cohérence Cross-Documentaire — `cross_check.py`

**Responsabilité** : Croiser les données extraites de tous les documents du dossier et détecter les incohérences.

**Ce script est le seul à travailler sur l'ensemble du dossier** (tous les documents en même temps). Il reçoit les résultats agrégés des étapes précédentes.

**Checks effectués** :

| Check | Documents comparés | Tolérance |
|-------|--------------------|-----------|
| Cohérence nom/prénom | CNI ↔ fiche de paie ↔ contrat ↔ avis imposition | Distance Levenshtein ≤ 2 (accents, abréviations) |
| Cohérence date de naissance | CNI ↔ NIR | Correspondance exacte requise |
| Cohérence employeur | Fiche de paie ↔ contrat de travail | SIRET identique |
| Cohérence revenus | Fiche de paie ↔ avis d'imposition | Écart ≤ 15% (saisonnalité, primes) |
| Cohérence adresse | Justificatif domicile ↔ avis imposition | Ville identique au minimum |
| Cohérence période | Fiches de paie : 3 mois consécutifs | Pas de trou > 1 mois |

**Output spécifique** :
```json
{
  "folder_id": 456,
  "cross_checks": [
    {
      "check": "name_consistency",
      "passed": true,
      "documents_compared": [789, 790, 791],
      "details": "Nom identique sur tous les documents : Jean MARTIN"
    },
    {
      "check": "income_consistency",
      "passed": false,
      "documents_compared": [790, 792],
      "details": "Écart revenus : fiche de paie 3 542€ vs avis imposition 2 100€/mois — écart 40%",
      "severity": "high"
    }
  ],
  "coherence_score": 72,
  "warnings": [
    {
      "type": "income_inconsistency",
      "message": "Écart important entre revenus déclarés et avis d'imposition",
      "severity": "high",
      "documents": [790, 792]
    }
  ]
}
```

---

### 4.6 Intégrité & Détection de Falsification — `metadata_check.py`

**Responsabilité** : Analyser les métadonnées des fichiers PDF et détecter les signes d'altération.

**Analyses effectuées** :

#### Métadonnées PDF
```python
# Via PyPDF2 / pdfminer
# Champs analysés :
# - CreationDate, ModDate : cohérence (ModDate > CreationDate ?)
# - Producer : logiciel ayant créé le PDF (Photoshop = suspect pour une fiche de paie)
# - Author : cohérence avec le document
# - Encrypted : tentative de masquage ?
```

#### Détection de polices multiples
```python
# Extraire la liste des polices utilisées dans le PDF
# Une fiche de paie officielle utilise 1-2 polices max
# > 4 polices différentes → suspect (assemblage de fragments)
```

#### Détection de couches cachées
```python
# Certains PDF falsifiés ont du texte en blanc sur blanc
# ou des couches supplémentaires masquées
# Extraire TOUS les textes (visibles + cachés) et comparer
```

#### Analyse d'image (pour photos de documents)
```python
# Détection de compression JPEG non uniforme (zones retravaillées)
# Détection de clonage de zones (copy-paste de pixels)
# Analyse ELA (Error Level Analysis) — niveaux de compression différents
```

**Output spécifique** :
```json
{
  "document_id": 789,
  "file_metadata": {
    "creation_date": "2025-12-28T10:15:00Z",
    "modification_date": "2025-12-28T10:15:00Z",
    "producer": "LibreOffice 7.4",
    "font_count": 2,
    "has_hidden_layers": false,
    "encrypted": false
  },
  "integrity_flags": [],
  "integrity_score": 95,
  "warnings": []
}
```

**Flags d'intégrité** :

| Flag | Sévérité | Description |
|------|----------|-------------|
| `MODIFIED_AFTER_CREATION` | Medium | ModDate significativement postérieure à CreationDate |
| `SUSPICIOUS_PRODUCER` | High | Logiciel de retouche image comme producteur |
| `MULTIPLE_FONTS` | Medium | > 4 polices dans un document simple |
| `HIDDEN_TEXT_DETECTED` | High | Texte invisible détecté |
| `ELA_ANOMALY` | High | Zones avec niveau de compression différent |
| `METADATA_STRIPPED` | Low | Métadonnées absentes (peut être normal) |

---

### 4.7 Scoring ML — `ml_score.py`

**Responsabilité** : Calculer le score global de fiabilité du dossier en agrégeant tous les résultats précédents via un modèle ML supervisé.

**Modèle** : XGBoost (Random Forest en alternative)

**Features du modèle** :

```python
features = {
    # Scores des étapes précédentes
    "ocr_confidence_avg": float,           # Moyenne confiance OCR
    "parse_confidence_avg": float,          # Moyenne confiance parsing
    "validation_score": float,              # Score validations règles
    "coherence_score": float,               # Score cohérence cross-doc
    "integrity_score_avg": float,           # Moyenne intégrité PDF

    # Flags binaires (warnings détectés)
    "has_siret_invalid": bool,
    "has_income_inconsistency": bool,
    "has_suspicious_metadata": bool,
    "has_hidden_text": bool,
    "has_document_type_mismatch": bool,
    "has_expired_document": bool,

    # Features contextuelles
    "documents_count": int,                 # Nb de documents dans le dossier
    "missing_required_docs": int,           # Nb de docs obligatoires manquants
    "days_since_oldest_doc": int,           # Fraîcheur du dossier

    # Features financières
    "income_to_rent_ratio": float,          # Revenus / loyer (si connu)
    "income_stability_months": int,         # Nb de fiches de paie cohérentes
}
```

**Output spécifique** :
```json
{
  "folder_id": 456,
  "global_score": 87,
  "scores_by_dimension": {
    "identity": 95,
    "income": 82,
    "stability": 88,
    "coherence": 90,
    "integrity": 93
  },
  "status": "verified",
  "model_version": "xgb_v2.1",
  "feature_importance": {
    "has_income_inconsistency": 0.23,
    "coherence_score": 0.18,
    "integrity_score_avg": 0.15
  },
  "warnings": []
}
```

**Seuils de décision** :

| Score | Statut | Action |
|-------|--------|--------|
| ≥ 80 | `verified` | Dossier validé automatiquement |
| 60 – 79 | `manual_review` | Envoi file de modération admin |
| < 60 | `rejected` | Dossier rejeté, locataire notifié |

> **Important** : Le statut `rejected` ne supprime pas le dossier. Le locataire peut remplacer les documents incriminés et relancer l'analyse.

---

## 5. Orchestration N8N

### 5.1 Pourquoi N8N

N8N est retenu pour orchestrer le pipeline pour les raisons suivantes :

- **Visualisation** : le workflow est visible et modifiable sans déploiement de code
- **Conditions et branches** : gestion native du fallback OCR, des erreurs récupérables
- **Retry intégré** : politique de retry configurable par nœud
- **Logs d'exécution** : chaque run est tracé avec ses inputs/outputs
- **Self-hostable** : obligatoire pour la conformité RGPD (données locataires sensibles)

**Contraintes à gérer** :
- Timeout HTTP N8N par défaut : 30 secondes → à augmenter à 120s pour les nœuds OCR et ML
- Pas de job queue natif → couplage avec la BDD pour le suivi d'état (voir Section 6.3)
- Déploiement : VPS OVH dédié, séparé du backend principal

### 5.2 Architecture du Workflow

Le workflow N8N "Analyse Dossier" est composé de nœuds **Execute Command** (appels Python) reliés par des nœuds **IF** pour la gestion des branches d'erreur.

```
[Webhook Entrée]
        |
[Nœud: Enregistrement analyse_id en BDD]
        |
[Nœud: S1 — classify_document.py]
        |
   [IF: success?]
   Oui ↓          Non → [Nœud: Log erreur, continuer avec type déclaré]
        |
[Nœud: S2 — ocr_extract.py]
        |
   [IF: success?]
   Oui ↓          Non → [IF: recoverable?]
        |                  Oui → [Nœud: Fallback AWS Textract]
        |                  Non → [Nœud: Erreur bloquante → callback error]
        |
[Nœud: S3 — parse_fields.py]
        |
[Nœud: S4 — validate_rules.py]
        |
[Nœud: S5 — cross_check.py]
        |
[Nœud: S6 — metadata_check.py]
        |
[Nœud: S7 — ml_score.py]
        |
[Nœud: Agrégation résultats finaux]
        |
[Nœud: POST /internal/ai/callback]
```

### 5.3 Intégration avec la Plateforme

```
Plateforme Node.js  ←──────────────────────────────────────►  N8N Self-hosted
                                                              (n8n.interne.pouraccord.com)

DÉCLENCHEMENT :
POST /internal/n8n/analyze  ──────────────────────────────►  Webhook /analyze
{ folder_id, documents[] }                                    (réponse immédiate 200)

RÉSULTAT (async, ~15-60s plus tard) :
                             ◄────────────────────────────  POST /internal/ai/callback
                                                            { folder_id, score, status... }
```

**Authentification entre les services** :
- N8N → Plateforme : Header `X-Internal-Secret: {secret}` (variable d'env)
- Plateforme → N8N : Header `X-N8N-API-Key: {api_key}` (variable d'env)
- Communication sur réseau privé OVH uniquement (pas exposé à Internet)

### 5.4 Déclenchement depuis Node.js

```typescript
// backend/src/services/analysis.service.ts

export async function triggerFolderAnalysis(
  folderId: number,
  documents: DocumentForAnalysis[]
): Promise<void> {
  
  // 1. Mettre à jour le statut en BDD
  await db.folders.update(
    { ai_status: 'processing', ai_started_at: new Date(), ai_retry_count: db.literal('ai_retry_count + 1') },
    { where: { id: folderId } }
  );

  // 2. Déclencher le workflow N8N
  const response = await fetch(process.env.N8N_WEBHOOK_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-Key': process.env.N8N_API_KEY!
    },
    body: JSON.stringify({
      folder_id: folderId,
      documents: documents.map(doc => ({
        document_id: doc.id,
        document_type: doc.type,
        file_url: doc.s3_url
      })),
      context: {
        analysis_id: uuidv4(),
        triggered_at: new Date().toISOString()
      }
    })
  });

  if (!response.ok) {
    // N8N indisponible → logguer et alerter (ne pas bloquer l'utilisateur)
    logger.error(`N8N trigger failed for folder ${folderId}`, { status: response.status });
    await db.folders.update({ ai_status: 'error', ai_error_step: 'trigger' }, { where: { id: folderId } });
  }
}
```

### 5.5 Récupération du Résultat (Callback)

```typescript
// backend/src/routes/internal.routes.ts

router.post(
  '/internal/ai/callback',
  verifyInternalSecret,   // Middleware : vérifie X-Internal-Secret
  async (req: Request, res: Response) => {
    const { folder_id, global_score, status, warnings, documents, analysis_id } = req.body;

    try {
      // 1. Mettre à jour le dossier
      await db.folders.update({
        ai_status: status,
        ai_score_global: global_score,
        ai_warnings: JSON.stringify(warnings),
        ai_completed_at: new Date(),
        ai_analysis_id: analysis_id
      }, { where: { id: folder_id } });

      // 2. Mettre à jour les documents individuels
      for (const doc of documents) {
        await db.documents.update({
          ai_score: doc.score,
          ai_status: doc.status,
          ai_extracted_data: JSON.stringify(doc.extracted_data),
          ai_warnings: JSON.stringify(doc.warnings)
        }, { where: { id: doc.document_id } });
      }

      // 3. Notifier l'agence si dossier partagé
      await notifyAgencyIfShared(folder_id, status, global_score);

      // 4. Si manual_review → créer une entrée dans la file de modération
      if (status === 'manual_review') {
        await createModerationTask(folder_id, warnings);
      }

      res.json({ success: true });
    } catch (err) {
      logger.error('Error processing AI callback', { folder_id, err });
      res.status(500).json({ success: false });
    }
  }
);
```

---

## 6. Gestion des Erreurs

### 6.1 Niveaux de Gestion

Le pipeline gère les erreurs à trois niveaux complémentaires.

**Niveau 1 — Script Python** : Chaque script catch ses propres exceptions et retourne toujours un JSON valide (jamais une exception non gérée).

```python
# Pattern à respecter dans tous les scripts
def run(input_data: dict) -> dict:
    try:
        result = process(input_data)
        return { "success": True, "step": STEP_NAME, "results": result, "error": None }
    except RecoverableError as e:
        return { "success": False, "step": STEP_NAME, "results": [], 
                 "error": { "code": e.code, "message": str(e), "recoverable": True } }
    except Exception as e:
        logger.error(f"Unexpected error in {STEP_NAME}", exc_info=e)
        return { "success": False, "step": STEP_NAME, "results": [],
                 "error": { "code": "UNEXPECTED_ERROR", "message": str(e), "recoverable": False } }
```

**Niveau 2 — Workflow N8N** : Politique par nœud.

| Situation | Comportement N8N |
|-----------|-----------------|
| Erreur récupérable (OCR low confidence) | Branche fallback → AWS Textract |
| Timeout API externe | Retry 2x avec délai 2s → si échec, warning non bloquant |
| Erreur bloquante (fichier corrompu) | Stop workflow → callback avec `status: error` |
| N8N lui-même plante | Script de watchdog → voir Section 6.3 |

**Niveau 3 — Plateforme Node.js** : Suivi d'état en BDD + cron de surveillance.

### 6.2 Schéma de Retry

```
Dossier soumis → ai_status: "processing"
                        |
                   [Analyse N8N]
                        |
          ┌─────────────┴──────────────┐
       Succès                        Erreur
          |                             |
  ai_status: "verified"           ai_retry_count++
  ou "manual_review"                   |
  ou "rejected"               [Si retry_count ≤ 2]
                                        |
                              Relancer l'analyse (auto)
                                        |
                              [Si retry_count > 2]
                                        |
                              ai_status: "error"
                              Alerte admin Slack/email
```

### 6.3 Surveillance des Dossiers Bloqués

Un cron job Node.js tourne toutes les 10 minutes pour détecter les dossiers bloqués en `processing`.

```typescript
// backend/src/jobs/analysis-watchdog.job.ts

export async function checkStuckAnalyses(): Promise<void> {
  const stuckThresholdMinutes = 10;
  const stuckFolders = await db.folders.findAll({
    where: {
      ai_status: 'processing',
      ai_started_at: { [Op.lt]: moment().subtract(stuckThresholdMinutes, 'minutes').toDate() }
    }
  });

  for (const folder of stuckFolders) {
    if (folder.ai_retry_count < 3) {
      logger.warn(`Stuck analysis detected for folder ${folder.id} — retrying`);
      await triggerFolderAnalysis(folder.id, await getDocuments(folder.id));
    } else {
      logger.error(`Analysis permanently failed for folder ${folder.id} after 3 retries`);
      await db.folders.update({ ai_status: 'error' }, { where: { id: folder.id } });
      await alertAdmins(`Analyse bloquée — dossier #${folder.id} — intervention manuelle requise`);
    }
  }
}
```

---

## 7. Évolutions de Déploiement

Le pipeline est conçu pour évoluer en 3 phases sans réécriture.

**Phase 1 — MVP (Sprint 0-2)** : Scripts Python testés individuellement en CLI. Enchaînés dans un `pipeline.py` simple appelé par FastAPI (`POST /analyze`). Pas de N8N. Idéal pour valider les scripts sans dépendance infrastructure.

```bash
# Test d'un script en isolation
python classify_document.py --input '{"document_id": 1, "file_url": "..."}'

# Pipeline complet en local
python pipeline.py --folder_id 456 --documents '[...]'
```

**Phase 2 — Beta (Sprint 3-4)** : Remplacement de `pipeline.py` par le workflow N8N. Les scripts ne changent pas — seul l'orchestrateur change. Gain : monitoring visuel, retry, branches d'erreur.

**Phase 3 — Scale (Post-MVP)** : Si volume > 500 dossiers/jour, introduction d'une queue Redis/Celery entre la plateforme et N8N pour absorber les pics de charge et paralléliser l'analyse de plusieurs documents d'un même dossier.

---

## 8. Variables d'Environnement

Variables spécifiques au pipeline d'analyse (à ajouter au `.env` du microservice Python et de N8N) :

```bash
# Microservice Python (FastAPI)
TESSERACT_PATH=/usr/bin/tesseract
TESSERACT_LANG=fra+eng
OCR_CONFIDENCE_THRESHOLD=0.75
AWS_TEXTRACT_REGION=eu-west-1
AWS_TEXTRACT_BUCKET=pouraccord-documents-prod

# APIs externes
INSEE_API_KEY=xxxx
INSEE_API_URL=https://api.insee.fr/entreprises/sirene/V3
ADRESSE_API_URL=https://api-adresse.data.gouv.fr/search/
API_TIMEOUT_SECONDS=3
API_MAX_RETRIES=2

# Modèle ML
ML_MODEL_PATH=/models/xgb_v2.1.pkl
ML_SCORE_VERIFIED_THRESHOLD=80
ML_SCORE_REVIEW_THRESHOLD=60

# N8N
N8N_WEBHOOK_URL=https://n8n.interne.pouraccord.com/webhook/analyze
N8N_API_KEY=xxxx

# Communication interne
INTERNAL_CALLBACK_URL=https://api.pouraccord.com/internal/ai/callback
INTERNAL_SECRET=xxxx

# Watchdog
ANALYSIS_STUCK_THRESHOLD_MINUTES=10
ANALYSIS_MAX_RETRIES=3
```

---

**FIN DU DOCUMENT**

**Références** :
- CDC Partie 3, Section 6 — Module Anti-Fraude IA (spécifications fonctionnelles)
- CDC Partie 1, Section 2 — Architecture Générale
- CDC Partie 4, Section 11 — Déploiement et Infrastructure
