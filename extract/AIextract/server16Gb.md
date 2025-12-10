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


