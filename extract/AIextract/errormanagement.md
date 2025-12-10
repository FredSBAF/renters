Excellente question! Voici comment gérer les erreurs pendant et après l'entraînement:

## 1. Pendant le Few-Shot Prompting

Si l'IA se trompe avec le few-shot, tu peux **corriger immédiatement**:

### A. Ajoute des Exemples Négatifs

Montre-lui ce qu'elle fait mal et la bonne réponse:

```python
prompt = """Tu es un expert en extraction de baux.

EXEMPLE CORRECT:
Document: "Bail entre M. Dupont et Mme Martin, 12 rue de la Paix. Loyer: 1200€"
Extraction:
{
  "locataire": "Sophie Martin",
  "proprietaire": "Jean Dupont",
  "loyer_mensuel": 1200
}

⚠️ ERREUR À ÉVITER:
Si le document dit "Loyer charges comprises: 1200€ dont 150€ de charges"
NE FAIS PAS:
{
  "loyer_mensuel": 1200,  ❌ FAUX - inclut les charges
  "charges": 150
}

FAIS PLUTÔT:
{
  "loyer_mensuel": 1050,  ✅ CORRECT - 1200 - 150
  "charges": 150
}

AUTRE ERREUR À ÉVITER:
Si le document montre "M. et Mme Dupont"
NE METS PAS: "M. et Mme Dupont" ❌
METS: "Dupont" ✅ (juste le nom de famille)

Maintenant extrais ce document:"""
```

### B. Système de Validation et Correction

Crée une boucle de correction automatique:

```python
import ollama
import json

def extract_with_validation(image_bytes, max_retries=3):
    """Extrait avec validation et correction automatique"""
    
    for attempt in range(max_retries):
        # Première extraction
        response = ollama.chat(
            model='llama3.2-vision',
            messages=[{
                'role': 'user',
                'content': PROMPT_WITH_EXAMPLES,
                'images': [image_bytes]
            }]
        )
        
        result = parse_json(response['message']['content'])
        
        # Valide le résultat
        errors = validate_extraction(result)
        
        if not errors:
            return result  # Succès!
        
        # Si erreurs, demande correction
        print(f"Tentative {attempt+1}: Erreurs trouvées: {errors}")
        
        correction_prompt = f"""Tu as fait des erreurs dans l'extraction précédente:

Ton extraction:
{json.dumps(result, indent=2, ensure_ascii=False)}

Erreurs détectées:
{json.dumps(errors, indent=2, ensure_ascii=False)}

Règles à respecter:
- Le loyer doit être un nombre positif
- La date doit être au format YYYY-MM-DD
- L'adresse doit contenir un code postal
- Les noms ne doivent pas contenir "M." ou "Mme"

Corrige l'extraction en respectant ces règles:"""

        response = ollama.chat(
            model='llama3.2-vision',
            messages=[{
                'role': 'user',
                'content': correction_prompt,
                'images': [image_bytes]
            }]
        )
        
        result = parse_json(response['message']['content'])
    
    return {"error": "Max retries exceeded", "last_result": result}


def validate_extraction(data):
    """Valide les données extraites"""
    errors = []
    
    # Vérifie le loyer
    if 'loyer_mensuel' in data:
        if not isinstance(data['loyer_mensuel'], (int, float)):
            errors.append("loyer_mensuel doit être un nombre")
        elif data['loyer_mensuel'] <= 0 or data['loyer_mensuel'] > 50000:
            errors.append("loyer_mensuel semble irréaliste")
    
    # Vérifie la date
    if 'date_debut' in data:
        try:
            from datetime import datetime
            datetime.strptime(data['date_debut'], '%Y-%m-%d')
        except:
            errors.append("date_debut doit être au format YYYY-MM-DD")
    
    # Vérifie l'adresse
    if 'adresse' in data:
        if not any(char.isdigit() for char in data['adresse']):
            errors.append("adresse doit contenir un code postal")
    
    # Vérifie les noms (pas de civilités)
    for field in ['locataire', 'proprietaire']:
        if field in data:
            if any(title in data[field].lower() for title in ['m.', 'mme', 'mlle', 'mr']):
                errors.append(f"{field} ne doit pas contenir de civilité")
    
    return errors


def parse_json(text):
    """Parse le JSON de la réponse"""
    import re
    json_match = re.search(r'\{.*\}', text, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except:
            return {"error": "Invalid JSON"}
    return {"error": "No JSON found"}
```

### C. Système de Feedback Humain

Garde les erreurs pour améliorer:

```python
import json
from datetime import datetime

def extract_with_feedback(image_bytes, image_path):
    """Extraction avec sauvegarde pour feedback humain"""
    
    result = extract_document(image_bytes)
    
    # Sauvegarde pour review humaine
    feedback_entry = {
        "timestamp": datetime.now().isoformat(),
        "image_path": image_path,
        "extraction": result,
        "validated": False,
        "corrections": None
    }
    
    # Ajoute au fichier de feedback
    with open('extraction_feedback.jsonl', 'a') as f:
        f.write(json.dumps(feedback_entry, ensure_ascii=False) + '\n')
    
    return result


def review_and_correct():
    """Interface pour corriger les erreurs"""
    with open('extraction_feedback.jsonl', 'r') as f:
        entries = [json.loads(line) for line in f]
    
    unvalidated = [e for e in entries if not e['validated']]
    
    print(f"{len(unvalidated)} extractions à valider")
    
    for entry in unvalidated:
        print(f"\n--- {entry['image_path']} ---")
        print(json.dumps(entry['extraction'], indent=2, ensure_ascii=False))
        
        response = input("Correct? (y/n/q): ")
        
        if response == 'q':
            break
        elif response == 'n':
            print("Entre les corrections (JSON):")
            corrections = input()
            entry['corrections'] = json.loads(corrections)
        
        entry['validated'] = True
    
    # Sauvegarde les corrections
    with open('extraction_feedback.jsonl', 'w') as f:
        for entry in entries:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    
    # Génère des exemples pour améliorer le prompt
    generate_examples_from_corrections(entries)


def generate_examples_from_corrections(entries):
    """Crée des exemples few-shot depuis les corrections"""
    corrected = [e for e in entries if e.get('corrections')]
    
    print("\n=== NOUVEAUX EXEMPLES À AJOUTER ===\n")
    
    for entry in corrected[:5]:  # Top 5 erreurs
        print(f"Document: {entry['image_path']}")
        print(f"Erreur faite: {json.dumps(entry['extraction'], indent=2)}")
        print(f"Correction: {json.dumps(entry['corrections'], indent=2)}")
        print("---\n")
```

---

## 2. Pendant le Fine-Tuning

Si le modèle se trompe pendant l'entraînement:

### A. Analyse les Erreurs

```python
def evaluate_model(model, tokenizer, test_dataset):
    """Évalue le modèle et identifie les erreurs"""
    
    errors = []
    
    for example in test_dataset:
        prediction = model.generate(example['input'])
        expected = example['output']
        
        if prediction != expected:
            errors.append({
                'input': example['input'],
                'expected': expected,
                'predicted': prediction,
                'error_type': classify_error(expected, prediction)
            })
    
    # Analyse les patterns d'erreurs
    from collections import Counter
    error_types = Counter(e['error_type'] for e in errors)
    
    print("Types d'erreurs:")
    for error_type, count in error_types.most_common():
        print(f"  {error_type}: {count}")
    
    return errors


def classify_error(expected, predicted):
    """Classifie le type d'erreur"""
    if expected.get('loyer_mensuel') != predicted.get('loyer_mensuel'):
        return "loyer_incorrect"
    elif expected.get('date_debut') != predicted.get('date_debut'):
        return "date_incorrecte"
    elif expected.get('adresse') != predicted.get('adresse'):
        return "adresse_incorrecte"
    else:
        return "autre"
```

### B. Corrige le Dataset

```python
def fix_training_data(errors):
    """Améliore le dataset basé sur les erreurs"""
    
    # Charge le dataset
    with open('training_data.jsonl', 'r') as f:
        data = [json.loads(line) for line in f]
    
    # Pour chaque type d'erreur fréquent, ajoute des exemples
    error_patterns = analyze_error_patterns(errors)
    
    new_examples = []
    for pattern in error_patterns:
        # Crée des exemples synthétiques pour ce pattern
        new_example = create_synthetic_example(pattern)
        new_examples.append(new_example)
    
    # Ajoute au dataset
    data.extend(new_examples)
    
    # Sauvegarde
    with open('training_data_v2.jsonl', 'w') as f:
        for item in data:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    
    print(f"Ajouté {len(new_examples)} nouveaux exemples")
    
    # Relance l'entraînement
    return 'training_data_v2.jsonl'
```

### C. Ajuste les Hyperparamètres

Si le modèle sur-apprend (overfitting) ou sous-apprend:

```python
# Si overfitting (100% sur train, 60% sur test):
trainer = SFTTrainer(
    # ... autres params
    args = TrainingArguments(
        learning_rate = 1e-4,  # ⬇️ Réduis le learning rate
        max_steps = 50,        # ⬇️ Moins d'epochs
        warmup_steps = 20,     # ⬆️ Plus de warmup
        weight_decay = 0.01,   # ⬆️ Ajoute du weight decay
    ),
)

# Si underfitting (60% sur train et test):
trainer = SFTTrainer(
    args = TrainingArguments(
        learning_rate = 3e-4,  # ⬆️ Augmente le learning rate
        max_steps = 200,       # ⬆️ Plus d'epochs
        per_device_train_batch_size = 4,  # ⬆️ Plus gros batch
    ),
)
```

---

## 3. Stratégie Itérative (Recommandé)

La meilleure approche: **amélioration continue**

```python
class DocumentExtractor:
    def __init__(self):
        self.errors_log = []
        self.version = 1
    
    def extract(self, image_bytes, ground_truth=None):
        """Extrait avec logging des erreurs"""
        
        result = self._extract_internal(image_bytes)
        
        # Si ground truth fournie, compare
        if ground_truth:
            errors = self._compare(result, ground_truth)
            if errors:
                self.errors_log.append({
                    'result': result,
                    'expected': ground_truth,
                    'errors': errors
                })
        
        return result
    
    def improve_prompt(self):
        """Améliore le prompt basé sur les erreurs"""
        
        if len(self.errors_log) < 10:
            print("Pas assez d'erreurs pour améliorer")
            return
        
        # Analyse les erreurs communes
        common_errors = self._analyze_errors()
        
        # Génère de nouveaux exemples few-shot
        new_examples = self._generate_examples(common_errors)
        
        # Met à jour le prompt
        self._update_prompt(new_examples)
        
        self.version += 1
        print(f"Prompt mis à jour vers v{self.version}")
        
        # Reset les erreurs
        self.errors_log = []
    
    def _analyze_errors(self):
        """Identifie les patterns d'erreurs"""
        from collections import defaultdict
        
        error_types = defaultdict(list)
        
        for log in self.errors_log:
            for error in log['errors']:
                error_types[error['field']].append({
                    'wrong': log['result'][error['field']],
                    'correct': log['expected'][error['field']]
                })
        
        return error_types
```

---

## En Résumé: Mon Workflow Recommandé

```
1. Commence avec Few-Shot
   └─> Teste sur 20-30 documents
   └─> Note les erreurs

2. Ajoute validation automatique
   └─> Détecte les erreurs évidentes
   └─> Redemande à l'IA de corriger

3. Review humaine
   └─> Valide 100 premières extractions
   └─> Note les patterns d'erreurs

4. Améliore le prompt
   └─> Ajoute exemples négatifs
   └─> Ajoute règles spécifiques

5. Si toujours <90% précision
   └─> Passe au fine-tuning
   └─> Utilise les erreurs comme dataset
```

**L'important**: Les erreurs sont **normales et utiles**! Elles t'apprennent ce que l'IA ne comprend pas. Chaque erreur = un nouvel exemple pour améliorer.

**Tu veux que je te montre comment implémenter un système complet de validation et correction pour tes documents?**