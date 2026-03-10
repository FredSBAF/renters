import os
import sys
import json
import argparse
import logging
from typing import Dict, Any, List

# Add the current directory to sys.path to allow imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from ocr_extract import load_document_images, run_ocr_on_image
    from classify_document import classify_text
    from parse_fields import process_document
except ImportError as e:
    print(f"Error importing modules: {e}")
    sys.exit(1)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def analyze_document(file_path: str) -> Dict[str, Any]:
    """
    Orchestrates the analysis pipeline for a single document.
    1. Load Images
    2. Classify (using first page)
    3. Full OCR (using all pages)
    4. Parse Fields (using specific logic)
    """
    
    result = {
        "file_path": file_path,
        "status": "processing",
        "steps": {}
    }

    # 1. Load Images
    try:
        images = load_document_images(file_path)
        logger.info(f"Loaded {len(images)} images from {file_path}")
    except Exception as e:
        logger.error(f"Failed to load document: {e}")
        result["status"] = "failed"
        result["error"] = str(e)
        return result

    if not images:
        result["status"] = "failed"
        result["error"] = "No images loaded"
        return result

    # 2. Classification & First Page OCR
    # We run OCR on the first page to classify
    try:
        first_page_text, first_page_conf = run_ocr_on_image(images[0])
        doc_type, confidence, keywords = classify_text(first_page_text)
        
        result["steps"]["classification"] = {
            "detected_type": doc_type,
            "confidence": confidence,
            "keywords_found": keywords
        }
        logger.info(f"Classified as {doc_type} (conf: {confidence})")
    except Exception as e:
        logger.error(f"Classification failed: {e}")
        # Continue with "unknown" type if classification fails, or abort?
        # Usually we want to continue with full OCR at least
        doc_type = "unknown"
        first_page_text = ""
        result["steps"]["classification"] = {"error": str(e)}

    # 3. Full OCR (if more than 1 page)
    full_text = first_page_text
    avg_confidence = first_page_conf
    
    if len(images) > 1:
        logger.info(f"Processing {len(images)} pages for full OCR...")
        confidences = [first_page_conf]
        texts = [first_page_text]
        
        for i in range(1, len(images)):
            text, conf = run_ocr_on_image(images[i])
            texts.append(text)
            confidences.append(conf)
        
        full_text = "\n\n".join(texts)
        avg_confidence = sum(confidences) / len(confidences)
    
    result["steps"]["ocr"] = {
        "full_text": full_text, # Maybe truncate for log but keep for parsing
        "average_confidence": round(avg_confidence, 2),
        "page_count": len(images)
    }

    # 4. Parse Fields
    try:
        # Prepare doc object for parse_fields.process_document
        doc_obj = {
            "document_id": os.path.basename(file_path),
            "raw_text": full_text,
            "detected_type": doc_type
        }
        
        # We need to simulate the structure expected by parse_fields
        # simpler to just import the internal logic logic or adjust process_document
        # process_document returns a dict with "data", "success", etc.
        parse_result = process_document(doc_obj, folder_id=0) # folder_id dummy
        
        result["steps"]["extraction"] = parse_result.get("data", {})
        result["status"] = "success" if parse_result.get("success") else "partial_success"
        
    except Exception as e:
        logger.error(f"Parsing fields failed: {e}")
        result["steps"]["extraction"] = {"error": str(e)}
        result["status"] = "partial_success" # OCR succeeded at least

    return result

def main():
    parser = argparse.ArgumentParser(description="Run full document analysis pipeline.")
    parser.add_argument("file", help="Path to the document file.")
    parser.add_argument("--json", action="store_true", help="Output result as JSON string.")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.file):
        logger.error(f"File not found: {args.file}")
        sys.exit(1)
        
    result = analyze_document(args.file)
    
    if args.json:
        print(json.dumps(result, indent=2, default=str)) # default=str for dates
    else:
        # Human readable summary
        print(f"\nAnalysis Report for: {args.file}")
        print(f"Status: {result['status']}")
        print(f"Type: {result['steps'].get('classification', {}).get('detected_type', 'N/A')}")
        print("-" * 30)
        print("Extracted Data:")
        data = result['steps'].get('extraction', {})
        for k, v in data.items():
            print(f"  {k}: {v}")
        print("-" * 30)

if __name__ == "__main__":
    main()
