# POURACCORD - Cahier des Charges DÃ©taillÃ©
## PARTIE 3/4

## TABLE DES MATIÃˆRES DE CETTE PARTIE

- 5. API REST - ENDPOINTS (dÃ©taillÃ©s)
- 6. MODULE ANTI-FRAUDE IA (spÃ©cifications complÃ¨tes)

---

## 5. API REST - ENDPOINTS

### 5.1 Convention

**Base URL** : `https://api.pouraccord.com/v1`

**Format** :
- RequÃªtes : JSON (`Content-Type: application/json`)
- RÃ©ponses : JSON
- Authentification : Bearer token JWT (`Authorization: Bearer {token}`)

**Codes HTTP** :
- 200 OK : succÃ¨s
- 201 Created : ressource crÃ©Ã©e
- 204 No Content : succÃ¨s sans body
- 400 Bad Request : erreur validation
- 401 Unauthorized : non authentifiÃ©
- 403 Forbidden : authentifiÃ© mais pas autorisÃ©
- 404 Not Found : ressource inexistante
- 409 Conflict : conflit (ex: email dÃ©jÃ  utilisÃ©)
- 500 Internal Server Error : erreur serveur

**Structure rÃ©ponse** :
```json
{
  "success": true,
  "data": {...},
  "message": "Operation successful",
  "errors": [] // si success = false
}
```

---

### 5.2 Authentification

#### POST /auth/register
**Description** : Inscription locataire

**Body** :
```json
{
  "email": "jean.martin@email.com",
  "password": "SecureP@ss123",
  "password_confirmation": "SecureP@ss123",
  "accept_terms": true,
  "accept_privacy": true
}
```

**Response 201** :
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 123,
      "email": "jean.martin@email.com",
      "status": "pending_verification"
    }
  },
  "message": "Email de confirmation envoyÃ©"
}
```

---

#### POST /auth/verify-email
**Description** : Validation email

**Body** :
```json
{
  "token": "abc123xyz..."
}
```

**Response 200** :
```json
{
  "success": true,
  "message": "Email validÃ© avec succÃ¨s"
}
```

---

#### POST /auth/login
**Description** : Connexion

**Body** :
```json
{
  "email": "jean.martin@email.com",
  "password": "SecureP@ss123",
  "totp_code": "123456" // optionnel, requis si 2FA activÃ©
}
```

**Response 200** :
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "def456...",
    "token_type": "Bearer",
    "expires_in": 86400,
    "user": {
      "id": 123,
      "email": "jean.martin@email.com",
      "role": "tenant",
      "is_2fa_enabled": false
    }
  }
}
```

---

#### POST /auth/refresh
**Description** : Renouveler JWT avec refresh token

**Body** :
```json
{
  "refresh_token": "def456..."
}
```

**Response 200** :
```json
{
  "success": true,
  "data": {
    "access_token": "newJWT...",
    "expires_in": 86400
  }
}
```

---

#### POST /auth/logout
**Description** : DÃ©connexion (invalide refresh token)

**Headers** : `Authorization: Bearer {access_token}`

**Response 204** : No Content

---

### 5.3 Gestion Profil

#### GET /users/me
**Description** : RÃ©cupÃ©rer profil utilisateur connectÃ©

**Response 200** :
```json
{
  "success": true,
  "data": {
    "id": 123,
    "email": "jean.martin@email.com",
    "first_name": "Jean",
    "last_name": "Martin",
    "phone": "0612345678",
    "date_of_birth": "1997-03-15",
    "tenant_profile": "employee_cdi",
    "is_2fa_enabled": false,
    "created_at": "2026-01-15T10:30:00Z"
  }
}
```

---

#### PATCH /users/me
**Description** : Mettre Ã  jour profil

**Body** :
```json
{
  "first_name": "Jean",
  "last_name": "Martin",
  "phone": "0612345678",
  "tenant_profile": "employee_cdi"
}
```

**Response 200** : user object mis Ã  jour

---

#### POST /users/me/enable-2fa
**Description** : Activer 2FA

**Response 200** :
```json
{
  "success": true,
  "data": {
    "qr_code_url": "data:image/png;base64,iVBORw0KG...",
    "secret": "JBSWY3DPEHPK3PXP" // Ã  sauvegarder par user (backup codes)
  },
  "message": "Scannez le QR code avec votre app d'authentification"
}
```

---

#### POST /users/me/verify-2fa
**Description** : Confirmer activation 2FA

**Body** :
```json
{
  "totp_code": "123456"
}
```

**Response 200** :
```json
{
  "success": true,
  "message": "2FA activÃ© avec succÃ¨s"
}
```

---

### 5.4 Gestion Dossiers

#### GET /folders/me
**Description** : RÃ©cupÃ©rer dossier du locataire connectÃ©

**Response 200** :
```json
{
  "success": true,
  "data": {
    "id": 456,
    "status": "complete",
    "completion_percentage": 100,
    "folder_status": "active",
    "ai_score_global": 92,
    "ai_status": "verified",
    "ai_warnings": [
      {
        "type": "expiring_soon",
        "message": "Justificatif domicile expire dans 5 jours",
        "severity": "medium"
      }
    ],
    "documents_count": 12,
    "documents": [...], // voir GET /documents
    "created_at": "2026-01-20T08:00:00Z",
    "updated_at": "2026-02-10T14:30:00Z",
    "expires_at": "2026-07-20T08:00:00Z"
  }
}
```

---

#### PATCH /folders/me
**Description** : Mettre Ã  jour statut dossier (locataire)

**Body** :
```json
{
  "folder_status": "standby" // ou "active", "archived"
}
```

**Response 200** : folder object mis Ã  jour

---

### 5.5 Gestion Documents

#### GET /documents
**Description** : Liste documents du dossier

**Query params** :
- `folder_id` (optionnel, dÃ©faut = dossier du user connectÃ©)

**Response 200** :
```json
{
  "success": true,
  "data": [
    {
      "id": 789,
      "document_type": "identity_card",
      "file_name": "CNI_Jean_Martin.pdf",
      "file_size": 2048576,
      "status": "valid",
      "ai_score": 95,
      "ai_warnings": [],
      "issued_at": "2020-03-15",
      "expires_at": "2030-03-15",
      "created_at": "2026-01-20T08:15:00Z"
    },
    {
      "id": 790,
      "document_type": "payslip",
      "file_name": "Fiche_paie_dec_2025.pdf",
      "file_size": 1024000,
      "status": "valid",
      "ai_score": 88,
      "issued_at": "2025-12-31",
      "expires_at": "2026-03-31",
      "created_at": "2026-01-22T10:00:00Z"
    }
  ]
}
```

---

#### POST /documents/upload
**Description** : Upload un document

**Content-Type** : `multipart/form-data`

**Body** :
- `file` : fichier (PDF/JPG/PNG, max 5 Mo)
- `document_type` : type (enum)
- `comment` : commentaire optionnel

**Response 201** :
```json
{
  "success": true,
  "data": {
    "id": 791,
    "document_type": "employment_contract",
    "file_name": "Contrat_ACME.pdf",
    "status": "pending_analysis",
    "created_at": "2026-02-10T15:00:00Z"
  },
  "message": "Document uploadÃ©, analyse en cours..."
}
```

**Process backend** :
1. Validation fichier (format, taille)
2. Upload S3 (`/users/{user_id}/documents/{uuid}.{ext}`)
3. CrÃ©ation entrÃ©e BDD (statut `pending_analysis`)
4. Trigger async job analyse IA (queue)
5. RÃ©ponse immÃ©diate au client (ne pas attendre analyse)

---

#### GET /documents/:id/download
**Description** : TÃ©lÃ©charger document (locataire ou agence)

**Headers** : `Authorization: Bearer {token}`

**Response 200** :
- **Si locataire** : fichier original (redirect S3 presigned URL)
- **Si agence** : fichier watermarkÃ© (stream gÃ©nÃ©rÃ© Ã  la volÃ©e)

**Process agence** :
1. VÃ©rifier droits (agence a consultÃ© le dossier)
2. RÃ©cupÃ©rer fichier S3 original
3. Appliquer watermark (backend ou microservice Python)
4. Log tÃ©lÃ©chargement (`audit_logs`, `sharing_views.documents_downloaded`)
5. Stream fichier watermarkÃ©

---

#### DELETE /documents/:id
**Description** : Supprimer document

**Response 204** : No Content

**Process** :
1. Soft delete BDD (`deleted_at = NOW()`)
2. Suppression fichier S3 (async)
3. Recalcul progression dossier

---

### 5.6 Partage

#### POST /sharing/links
**Description** : CrÃ©er lien partage

**Body** :
```json
{
  "context": {
    "property_type": "T2",
    "city": "Paris 15e",
    "budget": 1200,
    "availability": "2026-03-01",
    "listing_ref": "SeLoger-123456"
  }
}
```

**Response 201** :
```json
{
  "success": true,
  "data": {
    "id": "abc123-def456-ghi789",
    "url": "https://pouraccord.com/view/abc123-def456-ghi789",
    "created_at": "2026-02-10T16:00:00Z",
    "expires_at": "2026-03-12T16:00:00Z"
  }
}
```

---

#### GET /sharing/links
**Description** : Liste liens partagÃ©s (locataire)

**Response 200** :
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123...",
      "url": "https://pouraccord.com/view/abc123...",
      "context": {...},
      "views_count": 3,
      "last_viewed_at": "2026-02-10T14:30:00Z",
      "created_at": "2026-02-05T10:00:00Z",
      "expires_at": "2026-03-07T10:00:00Z",
      "revoked_at": null
    }
  ]
}
```

---

#### DELETE /sharing/links/:id
**Description** : RÃ©voquer lien

**Response 204** : No Content

---

#### GET /sharing/view/:link_id
**Description** : Consulter dossier partagÃ© (public endpoint, agence ou non)

**Query params** :
- `email` (optionnel, si non-connectÃ© pour capture lead)

**Response 200** :
```json
{
  "success": true,
  "data": {
    "folder": {
      // Fiche limitÃ©e si non-payant, complÃ¨te si payant
      "tenant": {
        "first_name": "Jean",
        "age": 28,
        "situation": "SalariÃ© CDI",
        "income": "~3500â‚¬/mois" // ou montant exact si payant
      },
      "context": {...},
      "score": {
        "global": 92, // ou null si non-payant
        "details": {...} // ou null
      },
      "documents": [...] // ou []
    },
    "access_level": "limited" // ou "full"
  }
}
```

**Process** :
1. VÃ©rifier lien valide (non expirÃ©, non rÃ©voquÃ©)
2. Identifier user :
   - JWT prÃ©sent + role = agency_* â†’ vÃ©rifier abonnement
   - JWT prÃ©sent + role = tenant â†’ interdit (locataires ne peuvent pas consulter dossiers autres)
   - Pas de JWT â†’ accÃ¨s limitÃ©
3. Log consultation (`sharing_views`)
4. Retourner donnÃ©es selon niveau accÃ¨s

---

### 5.7 Agences

#### POST /agencies/register
**Description** : Inscription agence

**Body** :
```json
{
  "name": "Agence Dupont Immobilier",
  "siret": "12345678900010",
  "address": "10 rue de la RÃ©publique",
  "city": "Paris",
  "postal_code": "75001",
  "owner_email": "contact@dupont-immo.fr",
  "owner_password": "SecureP@ss123"
}
```

**Response 201** :
```json
{
  "success": true,
  "data": {
    "agency": {
      "id": 10,
      "name": "Agence Dupont Immobilier",
      "siret": "12345678900010",
      "status": "trial",
      "trial_ends_at": "2026-03-12T10:00:00Z"
    },
    "owner": {
      "id": 200,
      "email": "contact@dupont-immo.fr",
      "role": "agency_owner"
    }
  },
  "message": "Email de confirmation envoyÃ©"
}
```

**Process** :
1. Validation SIRET (API INSEE)
2. CrÃ©ation `agencies` + `users` (owner)
3. Email confirmation
4. Statut trial (30j)

---

#### POST /agencies/subscribe
**Description** : CrÃ©er abonnement Stripe (aprÃ¨s essai ou immÃ©diat)

**Response 200** :
```json
{
  "success": true,
  "data": {
    "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_abc123..."
  }
}
```

**Process** :
1. CrÃ©er Stripe Customer (si pas dÃ©jÃ  existant)
2. CrÃ©er Stripe Checkout Session :
   - Produit : "Abonnement POURACCORD Agence"
   - Prix : 800â‚¬ HT/mois
   - Mode : subscription
   - `success_url` : `/billing/success`
   - `cancel_url` : `/billing/cancel`
3. Retourner URL checkout

---

#### Webhooks Stripe

**Endpoint** : `POST /webhooks/stripe`

**Events** :
- `checkout.session.completed` :
  - Mettre Ã  jour `agencies.status = 'active'`
  - Stocker `subscription_id`, `customer_id`
- `invoice.payment_succeeded` :
  - Log paiement
  - Mettre Ã  jour `next_billing_date`
- `invoice.payment_failed` :
  - Email alerte agence
  - AprÃ¨s 3 Ã©checs : `status = 'suspended'`
- `customer.subscription.deleted` :
  - `status = 'cancelled'`

---

#### GET /agencies/folders
**Description** : Liste dossiers accessibles par l'agence

**Query params** :
- `status` : filtrer par statut (`new`, `shortlisted`...)
- `is_favorite` : boolean
- `page`, `limit` : pagination

**Response 200** :
```json
{
  "success": true,
  "data": {
    "folders": [
      {
        "id": 456,
        "tenant": {
          "first_name": "Jean",
          "last_name": "Martin",
          "age": 28
        },
        "context": {...},
        "ai_score_global": 92,
        "agency_status": "shortlisted",
        "is_favorite": true,
        "shared_at": "2026-02-10T14:00:00Z",
        "last_viewed_at": "2026-02-10T15:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45
    }
  }
}
```

---

#### PATCH /agencies/folders/:folder_id
**Description** : Mettre Ã  jour statut dossier cÃ´tÃ© agence

**Body** :
```json
{
  "status": "shortlisted",
  "is_favorite": true,
  "internal_notes": "Candidat intÃ©ressant, budget correct"
}
```

**Response 200** : agency_folder object mis Ã  jour

---

### 5.8 Administration

#### GET /admin/users
**Description** : Liste utilisateurs (recherche, filtres)

**Query params** :
- `search` : email, nom, SIRET
- `role` : tenant / agency_owner / agency_agent / admin
- `status` : actif / trial / suspendu
- `page`, `limit`

**Response 200** :
```json
{
  "success": true,
  "data": {
    "users": [...],
    "pagination": {...}
  }
}
```

---

#### GET /admin/moderation/queue
**Description** : File de modÃ©ration (dossiers suspects)

**Response 200** :
```json
{
  "success": true,
  "data": [
    {
      "folder_id": 456,
      "tenant": {...},
      "ai_score_global": 45,
      "ai_warnings": [
        "IncohÃ©rence revenus",
        "MÃ©tadonnÃ©es PDF suspectes"
      ],
      "created_at": "2026-02-10T08:00:00Z"
    }
  ]
}
```

---

#### POST /admin/moderation/:folder_id/validate
**Description** : Valider dossier suspect

**Body** :
```json
{
  "action": "approve", // ou "reject", "request_more_info"
  "reason": "VÃ©rification manuelle OK",
  "adjusted_score": 85 // optionnel
}
```

**Response 200** :
```json
{
  "success": true,
  "message": "Dossier validÃ©"
}
```

---

#### GET /admin/dashboard/metrics
**Description** : MÃ©triques business/opÃ©rationnelles

**Response 200** :
```json
{
  "success": true,
  "data": {
    "business": {
      "tenants_total": 5234,
      "tenants_active": 3847,
      "folders_complete": 2910,
      "agencies_paying": 52,
      "agencies_trial": 14,
      "mrr": 40000,
      "arr": 480000
    },
    "operational": {
      "moderation_queue": 12,
      "fraud_rate": 4.2,
      "false_positive_rate": 1.8,
      "avg_analysis_time": 12
    },
    "efficiency": {
      "avg_folder_completion_time": 22,
      "sharing_rate": 68,
      "avg_time_to_success": 18
    }
  }
}
```

---

## 6. MODULE ANTI-FRAUDE IA

### 6.1 Architecture du Microservice

**Stack** :
- FastAPI (Python 3.11+)
- Tesseract 5.x (OCR)
- scikit-learn / XGBoost (modÃ¨le ML)
- Conteneur Docker
- DÃ©ploiement : serveur sÃ©parÃ©, communication HTTP

**Endpoint principal** : `POST /analyze`

**Input** :
```json
{
  "folder_id": 456,
  "documents": [
    {
      "document_id": 789,
      "document_type": "identity_card",
      "file_url": "https://s3.../CNI.pdf"
    },
    {
      "document_id": 790,
      "document_type": "payslip",
      "file_url": "https://s3.../paie.pdf"
    }
  ]
}
```

**Output** :
```json
{
  "folder_id": 456,
  "global_score": 92,
  "scores": {
    "identity": 95,
    "income": 90,
    "stability": 88,
    "coherence": 94
  },
  "status": "verified", // ou "manual_review", "rejected"
  "warnings": [
    {
      "type": "expiring_soon",
      "message": "Justificatif domicile expire dans 5 jours",
      "severity": "medium",
      "document_id": 791
    }
  ],
  "documents": [
    {
      "document_id": 789,
      "score": 95,
      "status": "valid",
      "extracted_data": {
        "name": "Jean MARTIN",
        "date_of_birth": "1997-03-15",
        "nir": "197035012345678",
        "document_number": "AB123456",
        "expiry_date": "2030-03-15"
      },
      "warnings": []
    },
    {
      "document_id": 790,
      "score": 88,
      "status": "valid",
      "extracted_data": {
        "employer": "ACME Corp",
        "siret": "12345678900010",
        "net_salary": 3542.50,
        "period": "2025-12"
      },
      "warnings": [
        {
          "type": "employer_validation",
          "message": "Employeur vÃ©rifiÃ© via API INSEE"
        }
      ]
    }
  ],
  "analysis_time_ms": 12340
}
```

---

### 6.2 Niveaux d'Analyse DÃ©taillÃ©s

#### Niveau 1 : ExhaustivitÃ©

**Objectif** : VÃ©rifier prÃ©sence documents obligatoires selon profil.

**Process** :
1. RÃ©cupÃ©rer profil locataire (`tenant_profile`)
2. RÃ©cupÃ©rer liste docs requis (table `document_types`)
3. Comparer avec docs uploadÃ©s
4. Score : (nb_docs_prÃ©sents / nb_docs_requis) * 100

**Output** :
```json
{
  "exhaustivity_score": 87,
  "missing_documents": [
    {
      "type": "bank_statement",
      "label": "RelevÃ© bancaire (RIB)"
    }
  ]
}
```

---

#### Niveau 2 : ConformitÃ©

**Objectif** : VÃ©rifier qualitÃ© technique documents.

**Checks** :
- Format fichier valide (PDF, JPG, PNG)
- Fichier lisible (pas corrompu)
- OCR possible (texte extractible)
- RÃ©solution suffisante (images > 300 DPI)
- Orientation correcte

**Process** :
1. TÃ©lÃ©charger fichier depuis S3
2. VÃ©rifier mÃ©tadonnÃ©es fichier
3. Tenter extraction texte (Tesseract)
4. Si Ã©chec OCR : fallback AWS Textract

**Output par document** :
```json
{
  "conformity_score": 95,
  "ocr_success": true,
  "text_coverage": 98, // % du doc avec texte extractible
  "warnings": []
}
```

---

#### Niveau 3 : ValiditÃ© DonnÃ©es StructurÃ©es

**Objectif** : VÃ©rifier cohÃ©rence donnÃ©es formelles.

##### 3.1 NumÃ©ro de SÃ©curitÃ© Sociale (NIR)

**Format** : `1 YY MM DD CCC NNN KK`
- `1` : sexe (1=homme, 2=femme)
- `YY` : annÃ©e naissance (2 chiffres)
- `MM` : mois naissance (01-12)
- `DD` : dÃ©partement naissance (01-99 ou 2A/2B)
- `CCC` : commune INSEE
- `NNN` : numÃ©ro d'ordre
- `KK` : clÃ© (checksum)

**Validation** :
```python
def validate_nir(nir: str) -> dict:
    # Extraction composants
    sexe = int(nir[0])
    annee = int(nir[1:3])
    mois = int(nir[3:5])
    dept = nir[5:7]
    
    # Checks basiques
    if sexe not in [1, 2]:
        return {"valid": False, "reason": "Sexe invalide"}
    if mois < 1 or mois > 12:
        return {"valid": False, "reason": "Mois invalide"}
    
    # Calcul clÃ© Luhn
    base = int(nir[:13])
    cle_calculee = 97 - (base % 97)
    cle_fournie = int(nir[13:15])
    
    if cle_calculee != cle_fournie:
        return {"valid": False, "reason": "ClÃ© de contrÃ´le invalide"}
    
    # CohÃ©rence avec date naissance CNI
    # (comparaison avec `extracted_data.date_of_birth`)
    
    return {"valid": True, "extracted_birth_year": 1900 + annee}
```

##### 3.2 SIRET Entreprise

**Format** : 14 chiffres (9 SIREN + 5 NIC)

**Validation** :
```python
import requests

def validate_siret(siret: str) -> dict:
    # Validation format
    if len(siret) != 14 or not siret.isdigit():
        return {"valid": False, "reason": "Format invalide"}
    
    # Appel API INSEE
    url = f"https://api.insee.fr/entreprises/sirene/V3/siret/{siret}"
    headers = {"Authorization": f"Bearer {INSEE_TOKEN}"}
    
    response = requests.get(url, headers=headers)
    
    if response.status_code == 404:
        return {"valid": False, "reason": "Entreprise inexistante"}
    
    data = response.json()
    etablissement = data["etablissement"]
    
    return {
        "valid": True,
        "company_name": etablissement["denominationUniteLegale"],
        "address": etablissement["adresseEtablissement"],
        "active": etablissement["etatAdministratifEtablissement"] == "A"
    }
```

##### 3.3 Bande MRZ (CNI / Passeport)

**Format** : 2-3 lignes de 30-44 caractÃ¨res (norme ICAO)

**Exemple CNI franÃ§aise** :
```
IDFRAMARTIN<<<<<<<<<<<<<<<<<<<<<<<<<<
9701234AB1234<<<<<<<<<<<<<<<<<<<<<<<<
JEAN<<MARIE<<<<<<<<<<970315M300315<<<
```

**Validation** :
```python
import mrz

def validate_mrz(mrz_text: str) -> dict:
    try:
        mrz_data = mrz.parse(mrz_text)
        
        # VÃ©rification checksums internes
        if not mrz_data.check_digits_ok:
            return {"valid": False, "reason": "Checksums invalides"}
        
        return {
            "valid": True,
            "extracted": {
                "document_type": mrz_data.type,
                "country": mrz_data.country,
                "surname": mrz_data.surname,
                "given_names": mrz_data.names,
                "document_number": mrz_data.number,
                "nationality": mrz_data.nationality,
                "date_of_birth": mrz_data.date_of_birth,
                "sex": mrz_data.sex,
                "expiry_date": mrz_data.expiry_date
            }
        }
    except Exception as e:
        return {"valid": False, "reason": str(e)}
```

##### 3.4 Adresses

**Validation via API Adresse** :
```python
def validate_address(address: str) -> dict:
    url = "https://api-adresse.data.gouv.fr/search/"
    params = {"q": address, "limit": 1}
    
    response = requests.get(url, params=params)
    data = response.json()
    
    if not data["features"]:
        return {"valid": False, "reason": "Adresse introuvable"}
    
    feature = data["features"][0]
    score = feature["properties"]["score"]
    
    if score < 0.5:
        return {"valid": False, "reason": "Adresse imprÃ©cise (score faible)"}
    
    return {
        "valid": True,
        "normalized": feature["properties"]["label"],
        "city": feature["properties"]["city"],
        "postcode": feature["properties"]["postcode"],
        "coordinates": feature["geometry"]["coordinates"]
    }
```

---

#### Niveau 4 : AuthenticitÃ©

**Objectif** : VÃ©rifier existence rÃ©elle des entitÃ©s (employeur, adresse...).

**Checks** :
- Employeur existe (SIRET validÃ© via INSEE)
- Adresse existe (API Adresse)
- CohÃ©rence gÃ©ographique (adresse employeur vs domicile)

**Process** :
1. Extraire SIRET depuis fiche paie (OCR)
2. Appeler API INSEE
3. Si entreprise existe ET active â†’ score +20
4. Si inexistante â†’ alerte majeure

---

#### Niveau 5 : CohÃ©rence Intra-Documentaire

**Objectif** : VÃ©rifier cohÃ©rence interne d'un document.

**Exemples** :

##### Fiche de Paie
- Nom employeur identique partout
- PÃ©riode cohÃ©rente (mois/annÃ©e)
- Calculs corrects :
  - `Net Ã  payer = Brut - Cotisations sociales`
  - `Net imposable = Net avant impÃ´t`
- Dates cohÃ©rentes (Ã©mission aprÃ¨s pÃ©riode travaillÃ©e)

**Process** :
```python
def check_payslip_coherence(extracted_data: dict) -> dict:
    warnings = []
    
    # Calculs
    brut = extracted_data.get("gross_salary")
    cotisations = extracted_data.get("social_contributions")
    net = extracted_data.get("net_salary")
    
    if brut and cotisations and net:
        expected_net = brut - cotisations
        if abs(expected_net - net) > 10:  # tolÃ©rance 10â‚¬
            warnings.append({
                "type": "calculation_error",
                "message": f"IncohÃ©rence calcul net: attendu {expected_net}, trouvÃ© {net}"
            })
    
    # Dates
    period = extracted_data.get("period")  # "2025-12"
    issue_date = extracted_data.get("issue_date")  # "2026-01-05"
    
    if period and issue_date:
        from datetime import datetime
        period_dt = datetime.strptime(period + "-01", "%Y-%m-%d")
        issue_dt = datetime.strptime(issue_date, "%Y-%m-%d")
        
        if issue_dt < period_dt:
            warnings.append({
                "type": "date_inconsistency",
                "message": "Date Ã©mission antÃ©rieure Ã  pÃ©riode travaillÃ©e"
            })
    
    score = 100 - (len(warnings) * 10)
    return {"score": max(score, 0), "warnings": warnings}
```

---

#### Niveau 6 : CohÃ©rence Inter-Documentaire

**Objectif** : Croiser informations entre documents.

**Checks clÃ©s** :

##### IdentitÃ©
- Nom/prÃ©nom identiques : CNI, fiches paie, contrat travail, avis imposition
- Date naissance cohÃ©rente : CNI vs NIR (2 premiers chiffres NIR)

##### Adresse
- Adresse domicile cohÃ©rente : justificatif domicile vs fiche paie vs CNI

##### Revenus
- Montants cohÃ©rents :
  - Moyenne 3 fiches paie â‰ˆ revenu dÃ©clarÃ© impÃ´ts (tolÃ©rance Â±10%)
  - Contrat travail (salaire brut annoncÃ©) â‰ˆ fiches paie

**Process** :
```python
def check_cross_document_coherence(documents: list) -> dict:
    warnings = []
    
    # Extraction donnÃ©es par type
    identity_doc = next((d for d in documents if d["type"] == "identity_card"), None)
    payslips = [d for d in documents if d["type"] == "payslip"]
    tax_notice = next((d for d in documents if d["type"] == "tax_notice"), None)
    
    # CohÃ©rence nom
    names = set()
    for doc in documents:
        if "name" in doc["extracted_data"]:
            names.add(doc["extracted_data"]["name"].upper())
    
    if len(names) > 1:
        warnings.append({
            "type": "identity_mismatch",
            "message": f"Noms diffÃ©rents dÃ©tectÃ©s: {', '.join(names)}"
        })
    
    # CohÃ©rence revenus
    if payslips and tax_notice:
        avg_payslip = sum(p["extracted_data"]["net_salary"] for p in payslips) / len(payslips)
        tax_income = tax_notice["extracted_data"].get("annual_income", 0) / 12
        
        diff_pct = abs(avg_payslip - tax_income) / avg_payslip * 100
        
        if diff_pct > 15:
            warnings.append({
                "type": "income_inconsistency",
                "message": f"Ã‰cart revenus {diff_pct:.1f}% (paie: {avg_payslip}â‚¬, impÃ´ts: {tax_income}â‚¬)"
            })
    
    score = 100 - (len(warnings) * 15)
    return {"score": max(score, 0), "warnings": warnings}
```

---

#### Niveau 7 : IntÃ©gritÃ© & Falsification

**Objectif** : DÃ©tecter altÃ©rations, manipulations, faux documents.

##### 7.1 MÃ©tadonnÃ©es PDF

**Analyse** :
- Date crÃ©ation vs date modification
- Logiciel crÃ©ateur (ex: "Microsoft Word" vs "PDFtk" suspect)
- Historique modifications (nombre de versions)

**Process** :
```python
import PyPDF2

def analyze_pdf_metadata(file_path: str) -> dict:
    warnings = []
    
    with open(file_path, 'rb') as f:
        pdf = PyPDF2.PdfReader(f)
        metadata = pdf.metadata
        
        # Dates
        creation_date = metadata.get("/CreationDate")
        mod_date = metadata.get("/ModDate")
        
        if creation_date and mod_date:
            from datetime import datetime
            created = datetime.strptime(creation_date, "D:%Y%m%d%H%M%S")
            modified = datetime.strptime(mod_date, "D:%Y%m%d%H%M%S")
            
            # Modification rÃ©cente suspecte
            if (datetime.now() - modified).days < 7:
                warnings.append({
                    "type": "recent_modification",
                    "message": f"PDF modifiÃ© il y a {(datetime.now() - modified).days} jours"
                })
            
            # CrÃ©ation trÃ¨s rÃ©cente pour doc ancien
            if (datetime.now() - created).days < 30:
                warnings.append({
                    "type": "recent_creation",
                    "message": "PDF crÃ©Ã© rÃ©cemment (< 30j)"
                })
        
        # Producteur
        producer = metadata.get("/Producer")
        suspicious_producers = ["PDFtk", "FPDF", "iText", "PDFlib"]
        
        if any(sp in str(producer) for sp in suspicious_producers):
            warnings.append({
                "type": "suspicious_producer",
                "message": f"Producteur PDF suspect: {producer}"
            })
    
    return {"warnings": warnings}
```

##### 7.2 DÃ©tection AltÃ©rations Visuelles

**Techniques** :
- **ELA (Error Level Analysis)** : dÃ©tecte zones rÃ©compressÃ©es (signe de manipulation)
- **Clone Detection** : dÃ©tecte copier-coller de zones (ex: montants dupliquÃ©s)
- **Font Analysis** : dÃ©tecte polices diffÃ©rentes (signe d'Ã©dition)

**Process** (simplifiÃ©) :
```python
from PIL import Image
import numpy as np

def detect_visual_tampering(image_path: str) -> dict:
    img = Image.open(image_path)
    img_array = np.array(img)
    
    # Analyse simplifiÃ©e: dÃ©tection zones uniformes anormales
    # (implÃ©mentation rÃ©elle utiliserait CNN ou algo avancÃ©)
    
    # Placeholder: dÃ©tection changements brutaux
    gray = np.mean(img_array, axis=2)
    diff_h = np.abs(np.diff(gray, axis=0))
    diff_v = np.abs(np.diff(gray, axis=1))
    
    suspicious_regions = (diff_h > 100).sum() + (diff_v > 100).sum()
    
    if suspicious_regions > 1000:
        return {
            "tampering_detected": True,
            "confidence": 0.7,
            "reason": "Zones Ã  contraste Ã©levÃ© dÃ©tectÃ©es (possibles Ã©ditions)"
        }
    
    return {"tampering_detected": False}
```

---

#### Niveau 8 : AdÃ©quation FinanciÃ¨re

**Objectif** : VÃ©rifier capacitÃ© financiÃ¨re locataire.

**RÃ¨gle standard** : Revenus nets â‰¥ 3Ã— loyer

**Process** :
```python
def check_financial_adequacy(folder_data: dict, context: dict) -> dict:
    # Extraction revenus
    payslips = folder_data.get("payslips", [])
    guarantor = folder_data.get("guarantor")
    
    if not payslips:
        return {"score": 0, "reason": "Aucune fiche de paie"}
    
    avg_income = sum(p["net_salary"] for p in payslips) / len(payslips)
    
    # Ajout revenus garant si prÃ©sent
    if guarantor and guarantor.get("income"):
        avg_income += guarantor["income"]
    
    # Budget demandÃ©
    budget = context.get("budget", 0)
    
    if budget == 0:
        return {"score": None, "reason": "Budget non spÃ©cifiÃ©"}
    
    # Ratio revenus/loyer
    ratio = avg_income / budget
    
    if ratio >= 3:
        score = 100
        status = "excellent"
    elif ratio >= 2.5:
        score = 85
        status = "bon"
    elif ratio >= 2:
        score = 70
        status = "acceptable"
    else:
        score = 50
        status = "insuffisant"
    
    return {
        "score": score,
        "status": status,
        "income": avg_income,
        "budget": budget,
        "ratio": round(ratio, 2),
        "message": f"Revenus: {avg_income}â‚¬, Loyer: {budget}â‚¬, Ratio: {ratio:.1f}x"
    }
```

---

### 6.3 Scoring Global

**Calcul** :
```
Score Global = (
    ExhaustivitÃ© * 0.10 +
    ConformitÃ© * 0.10 +
    ValiditÃ© * 0.15 +
    AuthenticitÃ© * 0.15 +
    CohÃ©rence Intra * 0.15 +
    CohÃ©rence Inter * 0.20 +
    IntÃ©gritÃ© * 0.10 +
    AdÃ©quation * 0.05
)
```

**Seuils dÃ©cision** :
- Score â‰¥ 80 : ðŸŸ¢ **Excellent** (validation auto)
- Score 60-79 : ðŸŸ¡ **Acceptable** (validation auto, points vigilance)
- Score 40-59 : ðŸŸ  **Ã€ vÃ©rifier** (modÃ©ration humaine)
- Score < 40 : ðŸ”´ **Suspect** (modÃ©ration prioritaire)

---

### 6.4 ModÃ¨le ML SupervisÃ©

**Objectif** : AmÃ©liorer dÃ©tection fraude via apprentissage.

**Features** :
- Scores niveaux 1-8
- MÃ©tadonnÃ©es PDF (age fichier, producteur...)
- Historique user (nb dossiers soumis, taux rejet...)
- Contexte (montant loyer, localisation...)

**Algorithme** : Random Forest ou XGBoost

**Dataset initial** :
- 1000 dossiers labellisÃ©s (fraude / lÃ©gitime)
- Anonymisation donnÃ©es personnelles
- Augmentation donnÃ©es (variations synthÃ©tiques)

**EntraÃ®nement** :
```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import joblib

# Chargement dataset
X = df[['exhaustivity_score', 'conformity_score', ..., 'pdf_age_days']]
y = df['is_fraud']  # 0 = lÃ©gitime, 1 = fraude

# Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

# EntraÃ®nement
model = RandomForestClassifier(n_estimators=100, max_depth=10)
model.fit(X_train, y_train)

# Ã‰valuation
score = model.score(X_test, y_test)
print(f"Accuracy: {score}")

# Sauvegarde
joblib.dump(model, 'fraud_detector_v1.pkl')
```

**PrÃ©diction** :
```python
def predict_fraud(features: dict) -> dict:
    model = joblib.load('fraud_detector_v1.pkl')
    
    X = np.array([[
        features['exhaustivity_score'],
        features['conformity_score'],
        # ... autres features
    ]])
    
    proba = model.predict_proba(X)[0][1]  # P(fraude)
    
    return {
        "fraud_probability": round(proba, 3),
        "risk_level": "high" if proba > 0.7 else "medium" if proba > 0.4 else "low"
    }
```

---

### 6.5 Interface EntraÃ®nement IA

**Page Admin** : `/admin/ml/training`

**FonctionnalitÃ©s** :
- **Feedback Loop** :
  - Admin valide/rejette dossier â†’ label ajoutÃ© au dataset
  - Re-entraÃ®nement pÃ©riodique (hebdomadaire)
- **MÃ©triques** :
  - PrÃ©cision, Rappel, F1-score
  - Ã‰volution temporelle (graphes)
  - Matrice de confusion
- **Feature Importance** :
  - Quels features influencent le plus ?
  - Ajustement pondÃ©rations si besoin

**Wireframe** :
```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  ENTRAÃŽNEMENT IA                                    â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  DATASET                                            â”‚
â”‚  Total dossiers labellisÃ©s : 2,340                  â”‚
â”‚  LÃ©gitimes : 2,200 (94%)                            â”‚
â”‚  Fraudes : 140 (6%)                                 â”‚
â”‚                                                      â”‚
â”‚  [â¬†ï¸ Uploader nouveaux labels] [ðŸ”„ RÃ©-entraÃ®ner]   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  PERFORMANCES MODÃˆLE (v1.3)                         â”‚
â”‚  PrÃ©cision : 96.2%                                  â”‚
â”‚  Rappel : 89.3%                                     â”‚
â”‚  F1-Score : 92.6%                                   â”‚
â”‚                                                      â”‚
â”‚  ðŸ“Š [Graphe Ã©volution]                              â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  FEATURES IMPORTANTES                               â”‚
â”‚  1. CohÃ©rence inter-doc : 28%                       â”‚
â”‚  2. IntÃ©gritÃ© PDF : 22%                             â”‚
â”‚  3. ValiditÃ© NIR : 18%                              â”‚
â”‚  ...                                                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

**FIN PARTIE 3/4**

---

**SUITE DANS PARTIE 4** :
- 7. SÃ©curitÃ© et RGPD
- 8. Interfaces Utilisateurs (Wireframes dÃ©taillÃ©s)
- 9. Notifications
- 10. Plan de Tests
- 11. DÃ©ploiement et Infrastructure
- 12. Annexes
