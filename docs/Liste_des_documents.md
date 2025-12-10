# Liste Exhaustive des Documents à Valider pour une Demande de Logement (2025)

---

## **1. Justificatifs d'Identité**
### **Documents acceptés**
- Carte d'identité française ou étrangère (avec photo)
- Passeport français ou étranger (avec photo)
- Permis de conduire français ou étranger (avec photo)
- Carte de séjour temporaire
- Carte de résident
- Carte de ressortissant d'un État membre de l'UE/EEE

### **Champs à extraire**
| Champ                     | Type          | Description                                                                 |
|---------------------------|---------------|-----------------------------------------------------------------------------|
| Type de document          | Texte         | Ex: "Carte d'identité", "Passeport", etc.                                  |
| Numéro du document        | Texte         | Numéro unique du document (ex: numéro de passeport).                      |
| Nom                       | Texte         | Nom du titulaire.                                                           |
| Prénom                    | Texte         | Prénom du titulaire.                                                       |
| Date de naissance         | Date          | Date de naissance du titulaire.                                            |
| Date d'expiration         | Date          | Date d'expiration du document.                                             |
| Photo                     | Booléen       | Présence d'une photo lisible.                                              |
| Nationalité               | Texte         | Nationalité du titulaire (si applicable).                                  |

---

## **2. Justificatifs de Domicile**
### **Documents acceptés**
- 3 dernières quittances de loyer
- Attestation sur l'honneur de l'hébergeant + pièce d'identité de l'hébergeant
- Attestation d'élection de domicile
- Dernier avis de taxe foncière
- Titre de propriété de la résidence principale

### **Champs à extraire**
| Champ                     | Type          | Description                                                                 |
|---------------------------|---------------|-----------------------------------------------------------------------------|
| Type de document          | Texte         | Ex: "Quittance de loyer", "Attestation d'hébergement", etc.               |
| Adresse complète          | Texte         | Adresse postale complète.                                                  |
| Nom du locataire          | Texte         | Nom du locataire ou de l'hébergeant.                                       |
| Date du document          | Date          | Date d'émission du document.                                                |
| Période couverte           | Texte         | Ex: "Janvier 2025 - Mars 2025" (pour les quittances de loyer).            |
| Nom de l'hébergeant       | Texte         | Nom de la personne hébergeant (si applicable).                             |
| Pièce d'identité hébergeant| Texte         | Type et numéro de la pièce d'identité de l'hébergeant.                    |

---

## **3. Justificatifs de Situation Professionnelle**
### **Documents acceptés**
- Contrat de travail ou de stage
- Attestation de l'employeur (avec rémunération, date d'entrée, durée de période d'essai)
- Extrait K ou K bis du registre du commerce et des sociétés (moins de 3 mois)
- Fiche d'immatriculation au Registre national des entreprises (moins de 3 mois)
- Copie du certificat d'identification de l'Insee (travailleur indépendant)
- Copie de la carte professionnelle (profession libérale)
- Carte d'étudiant ou certificat de scolarité pour l'année en cours

### **Champs à extraire**
| Champ                     | Type          | Description                                                                 |
|---------------------------|---------------|-----------------------------------------------------------------------------|
| Type de document          | Texte         | Ex: "Contrat de travail", "Extrait Kbis", etc.                             |
| Nom de l'employeur        | Texte         | Nom de l'entreprise ou de l'établissement.                                 |
| Nom du titulaire          | Texte         | Nom du locataire.                                                           |
| Type de contrat           | Texte         | Ex: "CDI", "CDD", "Stage", "Indépendant", "Étudiant".                       |
| Rémunération              | Numérique     | Montant de la rémunération (brut/net).                                     |
| Date d'entrée en fonctions| Date          | Date de début du contrat ou de la scolarité.                               |
| Durée de la période d'essai| Texte        | Durée de la période d'essai (si applicable).                              |
| Numéro SIRET/SIREN        | Texte         | Numéro d'identification de l'entreprise (si applicable).                  |
| Date d'émission            | Date          | Date d'émission du document.                                                |

---

## **4. Justificatifs de Ressources**
### **Documents acceptés**
- Dernier ou avant-dernier avis d'imposition ou de non-imposition
- 3 dernières fiches de paie
- 2 derniers bilans (pour les non-salariés)
- Justificatif de versement des indemnités, retraites, pensions, allocations (3 derniers mois)
- Titre de propriété d'un bien immobilier ou dernier avis de taxe foncière
- Justificatif de revenus fonciers, de rentes viagères ou de revenus de valeurs et capitaux mobiliers
- Attestation de simulation des aides au logement (CAF/MSA)
- Justificatif de versement des indemnités de stage
- Avis d'attribution de bourse (étudiant boursier)

### **Champs à extraire**
| Champ                     | Type          | Description                                                                 |
|---------------------------|---------------|-----------------------------------------------------------------------------|
| Type de document          | Texte         | Ex: "Avis d'imposition", "Fiche de paie", etc.                             |
| Nom du titulaire          | Texte         | Nom du locataire.                                                           |
| Montant des revenus       | Numérique     | Montant des revenus déclarés.                                              |
| Période couverte           | Texte         | Ex: "Janvier 2025 - Décembre 2025" (pour les avis d'imposition).          |
| Date d'émission            | Date          | Date d'émission du document.                                                |
| Numéro de sécurité sociale| Texte         | Numéro de sécurité sociale (si applicable).                                |
| Numéro SIRET/SIREN        | Texte         | Numéro d'identification de l'employeur (si applicable).                   |
| Type de revenu            | Texte         | Ex: "Salaire", "Allocation", "Revenu foncier", etc.                         |

---

## **5. Documents Complémentaires (si applicable)**
### **Documents acceptés**
- Attestation de garant (caution)
- Diagnostic de performance énergétique (DPE)
- État des lieux

### **Champs à extraire**
| Champ                     | Type          | Description                                                                 |
|---------------------------|---------------|-----------------------------------------------------------------------------|
| Type de document          | Texte         | Ex: "Attestation de garant", "DPE", etc.                                   |
| Nom du garant              | Texte         | Nom de la caution.                                                         |
| Adresse du garant          | Texte         | Adresse de la caution.                                                     |
| Montant garanti           | Numérique     | Montant garanti par la caution.                                           |
| Date d'émission            | Date          | Date d'émission du document.                                                |
| Classe énergétique        | Texte         | Classe énergétique du logement (pour le DPE).                              |

---

## **6. Règles de Validation Générales**
- **Validité des documents** : Tous les documents doivent être en cours de validité (dates d'expiration, périodes couvertes).
- **Cohérence des informations** : Les noms, adresses et montants doivent être cohérents entre tous les documents.
- **Traduction** : Les documents en langue étrangère doivent être traduits en français.
- **Montants en euros** : Tous les montants doivent être convertis en euros.

---
