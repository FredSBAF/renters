Bien sûr! Voici des exemples concrets pour les deux approches:

## 1. Few-Shot Prompting

C'est la méthode **la plus simple** - tu donnes des exemples dans ton prompt:

### Exemple pour un Bail

```python
import ollama

def extract_bail(image_bytes):
    prompt = """Tu es un expert en extraction de baux immobiliers.

EXEMPLE 1:
Document: "Bail d'habitation entre M. Dupont Jean et Mme Martin Sophie pour l'appartement situé 12 rue de la Paix 75002 Paris. Loyer: 1200€ + 150€ de charges. Début: 01/03/2023. Durée: 3 ans."

Extraction:
{
  "locataire": "Sophie Martin",
  "proprietaire": "Jean Dupont",
  "adresse": "12 rue de la Paix, 75002 Paris",
  "loyer_mensuel": 1200,
  "charges": 150,
  "date_debut": "2023-03-01",
  "duree_mois": 36
}

EXEMPLE 2:
Document: "Contrat de location M. et Mme Robert, propriétaires, louent à M. Ahmed Ali le local commercial sis 45 avenue Victor Hugo 59100 Roubaix. Montant mensuel 2500 euros hors taxes. Prise d'effet le 15 janvier 2024 pour une période de 6 années."

Extraction:
{
  "locataire": "Ahmed Ali",
  "proprietaire": "M. et Mme Robert",
  "adresse": "45 avenue Victor Hugo, 59100 Roubaix",
  "loyer_mensuel": 2500,
  "charges": 0,
  "date_debut": "2024-01-15",
  "duree_mois": 72
}

Maintenant, extrais les informations du document suivant en suivant EXACTEMENT le même format JSON:"""

    response = ollama.chat(
        model='llama3.2-vision',
        messages=[{
            'role': 'user',
            'content': prompt,
            'images': [image_bytes]
        }]
    )
    
    return response['message']['content']
```

### Exemple pour un Diagnostic DPE

```python
def extract_diagnostic(image_bytes):
    prompt = """Extrais les informations de ce diagnostic de performance énergétique.

EXEMPLE:
Document montre: "Diagnostic DPE - 23 rue Gambetta 59000 Lille - Visite: 12/05/2023 - Classe énergie: C (145 kWh/m²/an) - Classe GES: D - Validité: 10 ans"

JSON:
{
  "type": "DPE",
  "adresse": "23 rue Gambetta, 59000 Lille",
  "date_visite": "2023-05-12",
  "classe_energie": "C",
  "consommation_kwh": 145,
  "classe_ges": "D",
  "date_validite": "2033-05-12"
}

Extrais maintenant le document ci-dessous:"""

    response = ollama.chat(
        model='llama3.2-vision',
        messages=[{
            'role': 'user',
            'content': prompt,
            'images': [image_bytes]
        }]
    )
    
    return response['message']['content']
```

### Conseils Few-Shot
- **2-3 exemples** suffisent généralement
- Utilise des **vrais exemples** de tes documents
- Montre la **diversité** (différents formats, cas limites)
- Sois **précis** sur le format de sortie

---
