# Algorithmes de Validation des Documents pour la Location (2025)

---

## **1. Justificatifs d'Identité**
### **Règles de Validation**
- **Validité du numéro de document** :
  - Utiliser des expressions régulières pour vérifier le format (ex : numéro de passeport, carte d'identité).
  - Pour les cartes d'identité françaises, vérifier la validité via l'algorithme de Luhn ou une API officielle (ex : [API INPI](https://www.inpi.fr/)).
- **Date d'expiration** :
  - La date d'expiration doit être postérieure à la date actuelle.
- **Présence d'une photo** :
  - Détecter la présence d'une photo lisible (via OCR ou traitement d'image).

### **Exemple de Code (Python)**
```python
import re
from datetime import datetime

def valider_numero_passeport(numero):
    # Exemple : Vérifie que le numéro de passeport est au bon format (2 lettres + 6 chiffres)
    return bool(re.match(r'^[A-Za-z]{2}\d{6}\$', numero))

def valider_date_expiration(date_str):
    try:
        date_expiration = datetime.strptime(date_str, "%d/%m/%Y")
        return date_expiration > datetime.now()
    except ValueError:
        return False

def valider_photo_presente(image_path):
    # Utiliser une bibliothèque comme OpenCV pour détecter une photo
    # Exemple simplifié : retourne True si une photo est détectée
    return True  # À implémenter avec une vraie détection d'image
```

## **2. Justificatifs de Domicile**
### **Règles de Validation**

- **Cohérence de l'adresse** :

- Comparer l'adresse avec celle des autres documents (ex : justificatif d'identité).
- Utiliser une API de géocodage (ex : Google Maps API) pour vérifier l'existence de l'adresse.


- **Validité de la date** :

- Les quittances de loyer doivent dater de moins de 3 mois.
- Les avis de taxe foncière doivent dater de moins d'1 an.

### **Exemple de Code (Python)**
```python
from datetime import datetime, timedelta

def valider_date_quittance(date_str):
    try:
        date_quittance = datetime.strptime(date_str, "%d/%m/%Y")
        return date_quittance > (datetime.now() - timedelta(days=90))
    except ValueError:
        return False

def valider_adresse_coherence(adresse1, adresse2):
    # Normaliser les adresses (supprimer les espaces, majuscules)
    return adresse1.lower().strip() == adresse2.lower().strip()
```

## **3. Justificatifs de Situation Professionnelle**
### **Règles de Validation**

- **Validité du numéro SIRET/SIREN** :

- Vérifier le format et la validité via l'API INSEE (ex : API INSEE SIREN).


- **Cohérence des revenus ** :

- Vérifier que la rémunération est cohérente avec le type de contrat (ex : un stage ne doit pas dépasser un certain plafond).


Date d'entrée en fonctions :

La date doit être antérieure à la date de la demande.



Exemple de Code (Python)
python Copier