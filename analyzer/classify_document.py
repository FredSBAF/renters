import os
import sys
import json
import argparse
import logging
import re
import tempfile
import requests
import pytesseract
from pdf2image import convert_from_path, convert_from_bytes
from PIL import Image
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Document Categories and Keywords
DOCUMENT_KEYWORDS = {
    "payslip": [
        r"bulletin\s+de\s+paie", r"salaire", r"net\s+a\s+payer", r"cotisations", 
        r"total\s+versé", r"employeur", r"matricule", r"cumul\s+imposable", 
        r"congés\s+payés"
    ],
    "company_registry": [
        r"kbis", r"registre\s+du\s+commerce", r"siret", r"siren", r"immatriculation",
        r"greffe\s+du\s+tribunal", r"guichet\s+unique", r"synthèse\s+de\s+dépôt",
        r"insee", r"extrait\s+k", r"extrait\s+kbis"
    ],
    "tax_notice": [
        r"avis\s+d'impôt", r"revenus", r"direction\s+générale\s+des\s+finances\s+publiques",
        r"impôt\s+sur\s+le\s+revenu", r"déclarant", r"numéro\s+fiscal", 
        r"référence\s+de\s+l'avis"
    ],
    "id_card": [
        r"carte\s+nationale\s+d'identité", r"passeport\s+à\s+usage\s+unique",
        r"toute\s+reproduction\s+est\s+interdite", r"carte\s+sécurisée",
        r"justificatif\s+d’identité", r"usage\s+unique"
    ],
    "passport": [
        r"passeport", r"passport", r"république\s+française", r"type\s+P", 
        r"code\s+du\s+pays", r"date\s+d'expiration"
    ],
    "rent_receipt": [
        r"quittance\s+de\s+loyer", r"reçu\s+de\s+paiement", r"bailleur", 
        r"locataire", r"période\s+du", r"total\s+à\s+payer", r"loyer", r"charges"
    ],
    "employment_contract": [
        r"contrat\s+de\s+travail", r"cdd", r"cdi", r"engagement", r"salarié", 
        r"convention\s+collective", r"période\s+d'essai"
    ],
    "proof_of_address": [
        r"facture", r"électricité", r"gaz", r"téléphone", r"internet", 
        r"edf", r"orange", r"sfr", r"bouygues", r"free", 
        r"attestation\s+titulaire\s+contrat", r"lieu\s+de\s+consommation"
    ]
}

def extract_text_from_image(image):
    """
    Extract text from a PIL Image using Tesseract.
    """
    try:
        # Use French language if available, fallback to English
        # You might need to install tesseract-lang-fra package
        text = pytesseract.image_to_string(image, lang='fra+eng')
        return text
    except Exception as e:
        logger.error(f"OCR Error: {e}")
        return ""

def load_document(file_path_or_url):
    """
    Load a document from a file path or URL and return a PIL Image of the first page.
    """
    try:
        is_url = urlparse(file_path_or_url).scheme in ('http', 'https')
        
        if is_url:
            response = requests.get(file_path_or_url, timeout=10)
            response.raise_for_status()
            content = response.content
            filename = os.path.basename(urlparse(file_path_or_url).path)
        else:
            if not os.path.exists(file_path_or_url):
                raise FileNotFoundError(f"File not found: {file_path_or_url}")
            with open(file_path_or_url, 'rb') as f:
                content = f.read()
            filename = os.path.basename(file_path_or_url)

        lower_filename = filename.lower()
        
        if lower_filename.endswith('.pdf'):
            # Convert first page of PDF to image
            # 200 DPI is usually enough for classification
            images = convert_from_bytes(content, first_page=1, last_page=1, dpi=200)
            if images:
                return images[0]
            else:
                raise ValueError("Could not convert PDF to image")
        elif lower_filename.endswith(('.jpg', '.jpeg', '.png', '.tiff', '.bmp')):
            # Save to temp file to open with PIL (BytesIO can work too but temp file is robust)
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            
            try:
                img = Image.open(tmp_path)
                img.load() # Force load
                return img
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
        else:
            raise ValueError(f"Unsupported file format: {filename}")

    except Exception as e:
        logger.error(f"Error loading document: {e}")
        raise

def classify_text(text):
    """
    Classify the document based on the extracted text specific keywords.
    Returns (detected_type, confidence_score, keyword_matches).
    """
    text_lower = text.lower()
    scores = {}

    # Special Check: MRZ detection (Machine Readable Zone)
    # This is a very strong signal for ID/Passport
    mrz_pattern = r"(idfra|p<fra|<<<<)"
    if re.search(mrz_pattern, text_lower):
        # If we see MRZ, it's very likely ID or Passport
        # We can bias the score heavily towards 'id_card' if no 'passport' keyword is found, or vice-versa
        scores['id_card'] = scores.get('id_card', 0) + 2.0 
        scores['passport'] = scores.get('passport', 0) + 1.0


    for doc_type, patterns in DOCUMENT_KEYWORDS.items():
        match_count = 0

        for pattern in patterns:
            if re.search(pattern, text_lower):
                match_count += 1
        
        # Simple scoring: ratio of matched keywords to total keywords for that type
        # Or just raw count. Let's do a weighted score.
        # Ensure at least 2 keywords match for high confidence
        if match_count > 0:
            scores[doc_type] = match_count / len(patterns)
    
    if not scores:
        return "unknown", 0.0, {}

    best_type = max(scores, key=scores.get)
    confidence = scores[best_type]
    
    # Normalize confidence a bit (if > 0.3 considered match roughly)
    # This logic can be tuned
    normalized_confidence = min(confidence * 2, 1.0) 

    return best_type, round(normalized_confidence, 2), scores

def process_document(doc_info, folder_id):
    """
    Process a single document info dictionary.
    """
    doc_id = doc_info.get('document_id', 'unknown')
    file_path = doc_info.get('file_url') or doc_info.get('file_path')
    declared_type = doc_info.get('declared_type')
    
    if not file_path:
        return {
            "document_id": doc_id,
            "success": False,
            "error": "No file path or URL provided"
        }

    logger.info(f"Processing document {doc_id} from {file_path}")

    try:
        # Step 1: Load and convert to image
        image = load_document(file_path)
        
        # Step 2: OCR
        text = extract_text_from_image(image)
        logger.debug(f"Extracted text length: {len(text)}")
        
        # Step 3: Classify
        detected_type, confidence, details = classify_text(text)
        
        status = "MATCH"
        if detected_type == "unknown":
            status = "UNKNOWN"
        elif declared_type and detected_type != declared_type:
            status = "MISMATCH"
            # If declared type is known but confidence is low, maybe we trust declared? 
            # For now, we report what we detect.

        return {
            "document_id": doc_id,
            "success": True,
            "declared_type": declared_type,
            "detected_type": detected_type,
            "confidence": confidence,
            "status": status,
            "extracted_text_snippet": text[:200].replace('\n', ' ') + "..." # Snippet for debugging
        }

    except Exception as e:
        logger.error(f"Error processing document {doc_id}: {e}")
        return {
            "document_id": doc_id,
            "success": False,
            "error": str(e)
        }

def main():
    parser = argparse.ArgumentParser(description="Classify documents using OCR and Keyword Matching.")
    parser.add_argument("--file", help="Path to a local file to classify.")
    parser.add_argument("--json", help="JSON string with input data (N8N format).")
    parser.add_argument("--stdin", action="store_true", help="Read JSON from stdin.")

    args = parser.parse_args()

    input_data = {}
    
    # Determine Input Source
    if args.file:
        # Local file mode - Construct a mock JSON structure for internal processing
        input_data = {
            "folder_id": 0,
            "step": "classify",
            "documents": [
                {
                    "document_id": "local_test",
                    "declared_type": None,
                    "file_path": args.file
                }
            ]
        }
    elif args.json:
        input_data = json.loads(args.json)
    elif args.stdin:
        input_data = json.load(sys.stdin)
    else:
        # If no arguments, try reading from stdin if text is available (piped)
        if not sys.stdin.isatty():
             try:
                 input_data = json.load(sys.stdin)
             except json.JSONDecodeError:
                 logger.error("Invalid JSON from stdin")
                 sys.exit(1)
        else:
            parser.print_help()
            sys.exit(1)

    # Process
    results = []
    folder_id = input_data.get('folder_id')
    
    # Flexible input handling: "documents" list or single document context
    documents = input_data.get('documents', [])
    
    # If the input is just a single file info (direct N8N object)
    if not documents and ('file_url' in input_data or 'file_path' in input_data):
        documents = [input_data]

    for doc in documents:
        result = process_document(doc, folder_id)
        results.append(result)

    # Construct Output
    output = {
        "success": True,
        "step": "classify",
        "folder_id": folder_id,
        "results": results
    }

    # Print Result as JSON to stdout
    print(json.dumps(output, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
