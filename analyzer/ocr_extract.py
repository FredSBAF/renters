import os
import sys
import json
import argparse
import logging
import tempfile
import requests
import pytesseract
import numpy as np
from pdf2image import convert_from_path, convert_from_bytes
from PIL import Image, ImageEnhance, ImageOps
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def preprocess_image(image):
    """
    Apply image preprocessing to improve OCR accuracy.
    Same logic as in classify_document.py to ensure consistency.
    """
    try:
        # Convert to Grayscale
        processed_img = image.convert('L')
        
        # Increase Contrast
        enhancer = ImageEnhance.Contrast(processed_img)
        processed_img = enhancer.enhance(2.0) # Increase contrast significantly for faint text

        # Sharpness
        enhancer = ImageEnhance.Sharpness(processed_img)
        processed_img = enhancer.enhance(1.5)

        # Scale up if image is small (often the case with embedded ID cards)
        width, height = processed_img.size
        TARGET_WIDTH = 2500
        if width < TARGET_WIDTH:
            ratio = TARGET_WIDTH / width
            new_size = (int(width * ratio), int(height * ratio))
            processed_img = processed_img.resize(new_size, Image.Resampling.LANCZOS)

        return processed_img
    except Exception as e:
        logger.warning(f"Image preprocessing failed: {e}")
        return image

def run_ocr_on_image(image):
    """
    Run Tesseract OCR on a single image and return text + average confidence.
    """
    try:
        processed_image = preprocess_image(image)
        
        # Get detailed data including confidence
        # output_type='dict' returns a dictionary with lists of values
        data = pytesseract.image_to_data(processed_image, lang='fra+eng', output_type=pytesseract.Output.DICT)
        
        text_parts = []
        confidences = []
        
        n_boxes = len(data['text'])
        for i in range(n_boxes):
            # conf is -1 if no text is found in that block
            conf = int(data['conf'][i])
            text = data['text'][i].strip()
            
            if conf > -1 and text:
                text_parts.append(text)
                confidences.append(conf)
        
        full_text = " ".join(text_parts)
        
        # Calculate average confidence (0-100 normally, normalize to 0.0-1.0)
        avg_confidence = 0.0
        if confidences:
            avg_confidence = sum(confidences) / len(confidences) / 100.0
            
        return full_text, avg_confidence

    except Exception as e:
        logger.error(f"OCR execution failed: {e}")
        return "", 0.0

def load_document_images(file_path_or_url):
    """
    Load a document and return a list of PIL Images (one per page).
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
            # Convert ALL pages of PDF to images
            # 300 DPI for high quality extraction
            images = convert_from_bytes(content, dpi=300)
            if not images:
                raise ValueError("PDF content is empty or could not be converted")
            return images
            
        elif lower_filename.endswith(('.jpg', '.jpeg', '.png', '.tiff', '.bmp')):
            # Handle single image
            with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            
            try:
                img = Image.open(tmp_path)
                img.load()
                # If it's a multi-frame image (tiff/gif), we could handle it, but assuming single page for now
                return [img]
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
        else:
            raise ValueError(f"Unsupported file format: {filename}")

    except Exception as e:
        logger.error(f"Error loading document images: {e}")
        raise

def process_document(doc_info, folder_id):
    """
    Process a single document: load all pages, OCR them, concatenate text.
    """
    doc_id = doc_info.get('document_id', 'unknown')
    file_path = doc_info.get('file_url') or doc_info.get('file_path')
    
    if not file_path:
        return {
            "document_id": doc_id,
            "success": False,
            "error": {
                "code": "FILE_PATH_MISSING",
                "message": "No file path or URL provided",
                "recoverable": False
            }
        }

    logger.info(f"Extracting text from document {doc_id}")

    try:
        # Step 1: Load all pages
        images = load_document_images(file_path)
        page_count = len(images)
        logger.info(f"Document {doc_id} has {page_count} pages.")
        
        full_text_parts = []
        page_confidences = []
        
        # Step 2: OCR each page
        for i, img in enumerate(images):
            logger.info(f"Processing page {i+1}/{page_count}...")
            text, conf = run_ocr_on_image(img)
            full_text_parts.append(text)
            page_confidences.append(conf)
        
        # Concatenate text (separated by newlines for pages)
        full_text = "\n\n".join(full_text_parts)
        
        # Global confidence is average of page confidences
        global_confidence = 0.0
        if page_confidences:
            global_confidence = sum(page_confidences) / len(page_confidences)
            
        # Determine success/warnings based on confidence
        
        # Logic from specs:
        # ≥ 0.75 | Tesseract OK
        # 0.50 – 0.74 | Prétraitement + retry Tesseract (Use warning for now)
        # < 0.50 | Fallback AWS Textract (Use fallback_triggered flag)
        
        fallback_triggered = False
        warnings = []
        
        if global_confidence < 0.50:
            warnings.append("LOW_CONFIDENCE_OCR")
            # In a real scenario, this is where we'd trigger AWS Textract
            # fallback_triggered = True
            
        return {
            "document_id": doc_id,
            "success": True,
            "data": {
                "raw_text": full_text,
                "confidence_score": round(global_confidence, 2),
                "page_count": page_count,
                "engine_used": "tesseract",
                "language_detected": "fr" # Assumed for now, can be inferred from Tesseract data
            },
            "warnings": warnings,
            "fallback_triggered": fallback_triggered
        }

    except Exception as e:
        logger.error(f"Error processing document {doc_id}: {e}")
        return {
            "document_id": doc_id,
            "success": False,
            "error": {
                "code": "OCR_FAILED",
                "message": str(e),
                "recoverable": False 
            }
        }

def main():
    parser = argparse.ArgumentParser(description="Extract text from documents using OCR.")
    parser.add_argument("--file", help="Path to a local file to extract.")
    parser.add_argument("--json", help="JSON string with input data (N8N format).")
    parser.add_argument("--stdin", action="store_true", help="Read JSON from stdin.")

    args = parser.parse_args()

    input_data = {}
    
    if args.file:
        input_data = {
            "folder_id": 0,
            "step": "ocr_extract",
            "documents": [
                {
                    "document_id": "local_test",
                    "file_path": args.file
                }
            ]
        }
    elif args.json:
        input_data = json.loads(args.json)
    elif args.stdin:
        input_data = json.load(sys.stdin)
    else:
        if not sys.stdin.isatty():
             try:
                 input_data = json.load(sys.stdin)
             except json.JSONDecodeError:
                 logger.error("Invalid JSON from stdin")
                 sys.exit(1)
        else:
            parser.print_help()
            sys.exit(1)

    folder_id = input_data.get('folder_id')
    documents = input_data.get('documents', [])
    
    # Simple single-doc handling if passed directly
    if not documents and ('file_url' in input_data or 'file_path' in input_data):
        documents = [input_data]

    results = []
    for doc in documents:
        result = process_document(doc, folder_id)
        results.append(result)

    output = {
        "success": True,
        "step": "ocr_extract",
        "folder_id": folder_id,
        "results": results,
        "error": None
    }

    print(json.dumps(output, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
