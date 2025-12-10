1. Llama 3.2 Vision (Recommended for documents)
Meta's latest model can process images and text, perfect for documents:

```bash
# Install Ollama (easiest way to run models locally)
curl -fsSL https://ollama.com/install.sh | sh

# Download Llama 3.2 Vision (11B parameters)
ollama pull llama3.2-vision

# Run it
ollama run llama3.2-vision
```

Then use it in Python:
```python
import ollama

# For image-based documents
with open('document.jpg', 'rb') as f:
    response = ollama.chat(
        model='llama3.2-vision',
        messages=[{
            'role': 'user',
            'content': 'Extrais le nom du locataire, le loyer et la date de ce bail',
            'images': [f.read()]
        }]
    )
print(response['message']['content'])
```
2. Llama 3.1 (For text extraction)
If you pre-process PDFs to text:

```bash
ollama pull llama3.1:8b  # Or 70b if you have GPU power
```
3. LLaMA.cpp (More control)
For maximum customization and efficiency:

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make

# Download a model from HuggingFace
# Run inference
./main -m models/your-model.gguf -p "Your prompt"

Complete Pipeline Example
For PDFs, you'll need OCR first:

# Install: pip install ollama pymupdf pytesseract pillow
```python
import fitz  # PyMuPDF
from PIL import Image
import ollama
import io

def extract_from_pdf(pdf_path):
    # Convert PDF to images
    doc = fitz.open(pdf_path)
    page = doc[0]
    pix = page.get_pixmap()
    img_bytes = pix.tobytes()
    
    # Extract with Llama Vision
    response = ollama.chat(
        model='llama3.2-vision',
        messages=[{
            'role': 'user',
            'content': '''Extrais ces informations en JSON:
            - locataire
            - adresse
            - loyer
            - date_debut
            - duree''',
            'images': [img_bytes]
        }]
    )
    
    return response['message']['content']
    ```

Parfait! Avec 16GB de RAM, tu peux faire tourner des modèles efficaces. Voici la meilleure approche:

## Configuration Optimale pour ton Serveur

### Option 1: **Llama 3.2 Vision 11B** (Recommandé)
C'est le meilleur compromis pour l'extraction de documents avec 16GB:

```bash
# Installation d'Ollama sur ton serveur
curl -fsSL https://ollama.com/install.sh | sh

# Télécharge le modèle (environ 7GB)
ollama pull llama3.2-vision:11b

# Lance le serveur Ollama (écoute sur toutes les interfaces)
OLLAMA_HOST=0.0.0.0:11434 ollama serve
```

### Option 2: **Llama 3.1 8B** (Plus rapide, texte seulement)
Si tu extrais d'abord le texte des PDFs:

```bash
ollama pull llama3.1:8b
```

## API REST Simple

Une fois Ollama lancé, tu as une API REST automatique:

```python
import requests
import base64

# Depuis n'importe quelle machine
url = "http://ton-serveur:11434/api/chat"

with open("bail.pdf", "rb") as f:
    img_base64 = base64.b64encode(f.read()).decode()

response = requests.post(url, json={
    "model": "llama3.2-vision",
    "messages": [{
        "role": "user",
        "content": "Extrais le locataire, loyer, date de ce bail en JSON",
        "images": [img_base64]
    }],
    "stream": False
})

print(response.json()["message"]["content"])
```

## Application Web Complète

Voici une application Flask simple pour uploader et extraire:

```python
# app.py
from flask import Flask, request, jsonify
import ollama
import base64

app = Flask(__name__)

@app.route('/extract', methods=['POST'])
def extract():
    file = request.files['document']
    doc_type = request.form.get('type', 'bail')
    
    # Prompts selon le type
    prompts = {
        'bail': '''Extrais en JSON:
            - locataire
            - proprietaire
            - adresse_bien
            - loyer_mensuel
            - charges
            - date_debut
            - duree''',
        'diagnostic': '''Extrais en JSON:
            - type_diagnostic
            - adresse
            - date_visite
            - resultat
            - validite''',
        'amortissement': '''Extrais en JSON:
            - montant_total
            - taux_interet
            - duree
            - mensualite
            - tableau (array)'''
    }
    
    img_bytes = file.read()
    
    response = ollama.chat(
        model='llama3.2-vision',
        messages=[{
            'role': 'user',
            'content': prompts.get(doc_type, prompts['bail']),
            'images': [img_bytes]
        }]
    )
    
    return jsonify({
        'extracted': response['message']['content']
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

## Interface Web Simple

```html
<!DOCTYPE html>
<html>
<head>
    <title>Extraction Documents</title>
</head>
<body>
    <h1>Extracteur de Documents</h1>
    <form id="uploadForm">
        <select name="type">
            <option value="bail">Bail</option>
            <option value="diagnostic">Diagnostic</option>
            <option value="amortissement">Tableau d'amortissement</option>
        </select>
        <input type="file" name="document" accept=".pdf,.jpg,.png">
        <button type="submit">Extraire</button>
    </form>
    <pre id="result"></pre>
    
    <script>
        document.getElementById('uploadForm').onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            
            const response = await fetch('/extract', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            document.getElementById('result').textContent = 
                JSON.stringify(data, null, 2);
        };
    </script>
</body>
</html>
```

## Performance avec 16GB

- **Llama 3.2 Vision 11B**: ~8-9GB RAM utilisés, inférence en 5-15 secondes par document
- **Llama 3.1 8B**: ~5-6GB RAM, inférence en 2-5 secondes

## Améliorer la Précision

Pour de meilleurs résultats:

1. **Few-shot prompting**: Donne des exemples dans le prompt
2. **OCR préalable**: Utilise Tesseract d'abord pour le texte brut
3. **Fine-tuning**: Entraîne le modèle sur tes documents spécifiques





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

## 2. Fine-Tuning

C'est plus complexe mais **beaucoup plus précis** pour ton cas d'usage spécifique.

### Préparation des Données

Crée un dataset de tes documents annotés:

```python
# prepare_dataset.py
import json

# Format JSONL pour le fine-tuning
training_data = [
    {
        "image": "bail_001.jpg",
        "text": "Extrais les informations de ce bail.",
        "output": {
            "locataire": "Marie Dubois",
            "proprietaire": "SCI Immobilière",
            "adresse": "8 rue du Commerce, 59200 Tourcoing",
            "loyer_mensuel": 850,
            "charges": 100,
            "date_debut": "2023-09-01",
            "duree_mois": 36
        }
    },
    {
        "image": "bail_002.jpg",
        "text": "Extrais les informations de ce bail.",
        "output": {
            "locataire": "Pierre Laurent",
            "proprietaire": "Jacques Martin",
            "adresse": "15 avenue de la République, 59100 Roubaix",
            "loyer_mensuel": 1200,
            "charges": 150,
            "date_debut": "2024-01-15",
            "duree_mois": 12
        }
    }
    # ... minimum 50-100 exemples pour un bon résultat
]

# Sauvegarde au format attendu
with open('training_data.jsonl', 'w') as f:
    for item in training_data:
        f.write(json.dumps(item) + '\n')
```

### Fine-Tuning avec Llama (méthode simple)

Utilise **Unsloth** - c'est le plus simple et rapide:

```bash
# Installation
pip install unsloth
pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
```

```python
# fine_tune.py
from unsloth import FastLanguageModel
import torch

# Charge le modèle de base
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "unsloth/llama-3.2-11b-vision-instruct",
    max_seq_length = 2048,
    dtype = None,
    load_in_4bit = True,  # Utilise 4-bit pour économiser la RAM
)

# Prépare pour le fine-tuning
model = FastLanguageModel.get_peft_model(
    model,
    r = 16,  # Rang LoRA
    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj",
                      "gate_proj", "up_proj", "down_proj"],
    lora_alpha = 16,
    lora_dropout = 0,
    bias = "none",
    use_gradient_checkpointing = "unsloth",
    random_state = 3407,
)

# Prépare tes données
from datasets import load_dataset

dataset = load_dataset('json', data_files='training_data.jsonl')

def format_prompts(examples):
    texts = []
    for img, prompt, output in zip(examples['image'], 
                                     examples['text'], 
                                     examples['output']):
        text = f"""### Instruction:
{prompt}

### Response:
{json.dumps(output, ensure_ascii=False)}"""
        texts.append(text)
    return {"text": texts}

dataset = dataset.map(format_prompts, batched=True)

# Entraîne
from trl import SFTTrainer
from transformers import TrainingArguments

trainer = SFTTrainer(
    model = model,
    tokenizer = tokenizer,
    train_dataset = dataset["train"],
    dataset_text_field = "text",
    max_seq_length = 2048,
    args = TrainingArguments(
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        warmup_steps = 10,
        max_steps = 100,  # Augmente pour plus d'epochs
        learning_rate = 2e-4,
        fp16 = not torch.cuda.is_bf16_supported(),
        bf16 = torch.cuda.is_bf16_supported(),
        logging_steps = 1,
        optim = "adamw_8bit",
        output_dir = "outputs",
    ),
)

trainer.train()

# Sauvegarde le modèle fine-tuné
model.save_pretrained("mon_modele_baux")
tokenizer.save_pretrained("mon_modele_baux")
```

### Utilisation du Modèle Fine-Tuné

```python
# use_finetuned.py
from unsloth import FastLanguageModel

# Charge ton modèle personnalisé
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "mon_modele_baux",
    max_seq_length = 2048,
    dtype = None,
    load_in_4bit = True,
)

FastLanguageModel.for_inference(model)

# Utilise-le
def extract_with_finetuned(image_bytes):
    inputs = tokenizer(
        "Extrais les informations de ce bail.",
        return_tensors="pt"
    ).to("cuda")
    
    outputs = model.generate(**inputs, max_new_tokens=256)
    result = tokenizer.decode(outputs[0], skip_special_tokens=True)
    
    return result
```

### Alternative: Fine-Tuning avec Ollama (Plus simple)

Ollama supporte aussi le fine-tuning:

```bash
# Crée un Modelfile
cat > Modelfile <<EOF
FROM llama3.2-vision

# Tes exemples d'entraînement
SYSTEM Tu es un expert en extraction de baux immobiliers français.

TEMPLATE """{{ .System }}
{{ .Prompt }}"""

PARAMETER temperature 0.1
PARAMETER top_p 0.9
EOF

# Crée ton modèle personnalisé
ollama create mon-extracteur -f Modelfile
```

## Comparaison

| Méthode | Difficulté | Précision | Coût | Temps |
|---------|-----------|-----------|------|-------|
| **Few-Shot** | ⭐ Facile | 70-80% | Gratuit | Immédiat |
| **Fine-Tuning** | ⭐⭐⭐ Avancé | 90-95% | Gratuit mais GPU utile | 2-8h |

## Ma Recommandation

**Commence par Few-Shot!** C'est largement suffisant pour la plupart des cas:

```python
# Version production-ready avec Few-Shot
def extract_document(image_path, doc_type='bail'):
    with open(image_path, 'rb') as f:
        img_bytes = f.read()
    
    # Prompts avec exemples
    prompts = {
        'bail': BAIL_PROMPT_WITH_EXAMPLES,  # Comme ci-dessus
        'diagnostic': DIAGNOSTIC_PROMPT_WITH_EXAMPLES,
        'amortissement': AMORTISSEMENT_PROMPT_WITH_EXAMPLES
    }
    
    response = ollama.chat(
        model='llama3.2-vision',
        messages=[{
            'role': 'user',
            'content': prompts[doc_type],
            'images': [img_bytes]
        }],
        options={
            'temperature': 0.1,  # Plus déterministe
            'top_p': 0.9
        }
    )
    
    # Parse le JSON
    import json
    import re
    
    text = response['message']['content']
    # Trouve le JSON dans la réponse
    json_match = re.search(r'\{.*\}', text, re.DOTALL)
    if json_match:
        return json.loads(json_match.group())
    
    return {"error": "JSON non trouvé", "raw": text}
```

**Passe au fine-tuning** seulement si:
- Tu as 100+ documents annotés
- Tu as besoin de 95%+ de précision
- Les few-shots ne suffisent pas

**Tu as des exemples de documents à traiter?** Je peux t'aider à créer les prompts few-shot parfaits pour ton cas!