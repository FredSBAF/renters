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
```

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
