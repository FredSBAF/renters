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