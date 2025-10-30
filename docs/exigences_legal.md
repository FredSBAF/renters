# Validation des Documents Administratifs pour la Location - Exigences Légales et Techniques (2025)

---

## **1. Contexte Légal et Réglementaire**
### **Textes de référence**
- **Loi n° 89-462 du 6 juillet 1989** (rapports locatifs).
- **Arrêtés et circulaires 2024-2025** sur la location et la décence des logements.
- **Service-Public.fr** : [Liste officielle des justificatifs autorisés (10 avril 2025)](https://www.service-public.gouv.fr/particuliers/vosdroits/F1169).
- **DossierFacile** : [Standards de validation](https://partenaire.dossierfacile.logement.gouv.fr/les-standards-de-validation).

---

## **2. Liste des Documents Autorisés et Champs Obligatoires**

### **A. Justificatif d'identité**
- **Documents acceptés** :
  - Carte d'identité française ou étrangère (avec photo).
  - Passeport français ou étranger (avec photo).
  - Permis de conduire français ou étranger (avec photo).
  - Carte de séjour temporaire, carte de résident, ou carte de ressortissant d'un État membre de l'UE/EEE.

- **Champs obligatoires** :
  - Nom et prénom.
  - Date de naissance.
  - Date d'expiration.
  - Numéro du document (si applicable).

---

### **B. Justificatif de domicile**
- **Documents acceptés** (1 seul requis) :
  - 3 dernières quittances de loyer.
  - Attestation sur l'honneur de l'hébergeant + pièce d'identité de l'hébergeant.
  - Attestation d'élection de domicile.
  - Dernier avis de taxe foncière ou titre de propriété.

- **Champs obligatoires** :
  - Adresse complète.
  - Nom du locataire ou de l'hébergeant.
  - Date de validité (moins de 3 mois pour les factures, 1 an pour les avis de taxe).

---

### **C. Justificatif de situation professionnelle**
- **Documents acceptés** (1 ou plusieurs) :
  - Contrat de travail ou attestation de l'employeur (avec rémunération, date d'entrée, durée de période d'essai).
  - Extrait K ou K bis (moins de 3 mois) pour les entreprises commerciales.
  - Fiche d'immatriculation au Registre national des entreprises (artisans).
  - Carte professionnelle (professions libérales).
  - Carte d'étudiant ou certificat de scolarité.

- **Champs obligatoires** :
  - Nom et prénom.
  - Type de contrat (CDI, CDD, stage, etc.).
  - Rémunération.
  - Date d'entrée en fonctions.

---

### **D. Justificatif de ressources**
- **Documents acceptés** (1 ou plusieurs) :
  - Dernier ou avant-dernier avis d'imposition ou de non-imposition.
  - 3 dernières fiches de paie.
  - 2 derniers bilans (pour les non-salariés).
  - Justificatifs de versement des indemnités, retraites, pensions, allocations (3 derniers mois).
  - Titre de propriété ou avis de taxe foncière (pour les revenus fonciers).
  - Attestation de simulation des aides au logement (CAF/MSA).

- **Champs obligatoires** :
  - Nom et prénom.
  - Montants en euros.
  - Date de validité (moins de 3 mois pour les fiches de paie, 1 an pour les avis d'imposition).

---

## **3. Règles de Validation par Document**

### **A. Justificatif d'identité**
- **Algorithmes** :
  - Vérification de la validité du numéro de document (ex : numéro de passeport ou de carte d'identité) via des expressions régulières ou des APIs officielles.
  - Vérification de la date d'expiration (doit être postérieure à la date de la demande).
  - Détection de la présence d'une photo lisible.

- **APIs utilisables** :
  - **API INPI** : Pour vérifier la validité des cartes de séjour ou titres de séjour.
  - **API Ameli** : Pour vérifier la validité du numéro de sécurité sociale (si présent sur le document).

---

### **B. Justificatif de domicile**
- **Algorithmes** :
  - Vérification de la cohérence de l'adresse avec les autres documents.
  - Vérification de la date de validité (moins de 3 mois pour les factures, 1 an pour les avis de taxe).
  - Détection des mentions d'hébergement (attestation sur l'honneur) et vérification de la pièce d'identité de l'hébergeant.

- **APIs utilisables** :
  - **API La Poste** : Pour vérifier la validité des adresses postales.
  - **API des impôts** : Pour vérifier la validité des avis de taxe foncière.

---

### **C. Justificatif de situation professionnelle**
- **Algorithmes** :
  - Vérification de la validité du numéro SIRET/SIREN (pour les extraits K/Kbis) via l'API INSEE.
  - Vérification de la cohérence entre le type de contrat et la rémunération déclarée.
  - Détection des périodes d'essai ou de stages.

- **APIs utilisables** :
  - **API INSEE** : Pour vérifier la validité des extraits K/Kbis.
  - **API Pôle Emploi** : Pour vérifier la validité des attestations employeur.

---

### **D. Justificatif de ressources**
- **Algorithmes** :
  - Vérification de la cohérence entre les montants déclarés sur les fiches de paie et l'avis d'imposition.
  - Détection des écarts de revenus (ex : salaire déclaré vs. avis d'imposition).
  - Vérification de la validité des numéros de sécurité sociale ou de SIRET.

- **APIs utilisables** :
  - **API des impôts** : Pour vérifier la validité des avis d'imposition.
  - **API CAF/MSA** : Pour vérifier la validité des attestations de simulation des aides au logement.

---

## **4. Règles de Cohérence entre Documents**

### **A. Cohérence des noms et adresses**
- **Règles** :
  - Le nom et prénom doivent être identiques sur tous les documents.
  - L'adresse doit être cohérente entre le justificatif de domicile et les autres documents.

- **Algorithmes** :
  - Utilisation de la distance de Levenshtein pour détecter les similitudes entre les noms.
  - Vérification de l'adresse via une API de géocodage (ex : Google Maps API).

---

### **B. Cohérence des revenus et situations professionnelles**
- **Règles** :
  - Les revenus déclarés sur les fiches de paie doivent correspondre à ceux de l'avis d'imposition.
  - Le type de contrat doit être cohérent avec la situation professionnelle déclarée.

- **Algorithmes** :
  - Calcul des écarts de revenus (ex : si le salaire mensuel moyen x 12 ne correspond pas au revenu annuel déclaré).
  - Détection des incohérences entre le type de contrat et les revenus (ex : un stage rémunéré à 2000€/mois).

---

### **C. Détection des anomalies**
- **Règles** :
  - Détection des périodes non justifiées (ex : absence de fiche de paie pendant 3 mois).
  - Détection des mentions de "maladie non autorisée" ou de congés sans solde sur les attestations employeur.

- **Algorithmes** :
  - Analyse des dates sur les fiches de paie et les attestations employeur.
  - Détection des mots-clés (ex : "maladie non autorisée", "congés sans solde").

---

## **5. Sanctions et Responsabilités**
- **Pour le propriétaire/agence** :
  - Amende jusqu'à **3 000 €** (15 000 € pour une personne morale) si demande de justificatifs non autorisés.
- **Pour le locataire** :
  - Refus de location si documents falsifiés ou incomplets.

---

## **6. APIs et Outils Recommandés**
| Type de document          | API/outil recommandé                     | Lien                                                                 |
|---------------------------|------------------------------------------|-----------------------------------------------------------------------|
| Justificatif d'identité   | API INPI, API Ameli                      | [INPI](https://www.inpi.fr/), [Ameli](https://www.ameli.fr/)         |
| Justificatif de domicile  | API La Poste, API des impôts             | [La Poste](https://www.laposte.fr/), [Impôts](https://www.impots.gouv.fr/) |
| Justificatif professionnel| API INSEE, API Pôle Emploi                | [INSEE](https://www.insee.fr/), [Pôle Emploi](https://www.pole-emploi.fr/) |
| Justificatif de ressources| API des impôts, API CAF/MSA              | [Impôts](https://www.impots.gouv.fr/), [CAF](https://www.caf.fr/)   |

---

## **7. Exemple de Code pour la Validation**
```python
import re
from datetime import datetime

def valider_numero_securite_sociale(numero):
    # <followup encodedFollowup="%7B%22id%22%3A%22ced41a91-2457-40b5-a66c-2d8df83cc2db%22%2C%22snippet%22%3A%22Algorithme%20de%20Luhn%22%2C%22question%22%3A%22Peux-tu%20fournir%20une%20impl%C3%A9mentation%20compl%C3%A8te%20et%20comment%C3%A9e%20de%20l'algorithme%20de%20Luhn%20pour%20valider%20un%20num%C3%A9ro%20de%20s%C3%A9curit%C3%A9%20sociale%20en%20Python%20%3F%22%7D" /> pour vérifier la validité du numéro de sécurité sociale
    # Exemple simplifié
    if len(numero) != 15 or not re.match(r'^\d+\$', numero):
        return False
    # Logique de validation ici
    return True

def valider_date_expiration(date_str):
    # Vérifie que la date d'expiration est postérieure à la date actuelle
    try:
        date_expiration = datetime.strptime(date_str, "%d/%m/%Y")
        return date_expiration > datetime.now()
    except ValueError:
        return False

def verifier_coherence_nom(nom1, nom2):
    # Vérifie la similitude entre deux noms (<followup encodedFollowup="%7B%22id%22%3A%22eef56698-73f5-4021-8a47-1b8a320de0e1%22%2C%22snippet%22%3A%22distance%20de%20Levenshtein%22%2C%22question%22%3A%22Quel%20seuil%20de%20tol%C3%A9rance%20recommandez-vous%20pour%20la%20distance%20de%20Levenshtein%20lors%20de%20la%20comparaison%20des%20noms%20sur%20les%20documents%20administratifs%20%3F%22%7D" />)
    # Exemple simplifié
    return nom1.lower() == nom2.lower()
