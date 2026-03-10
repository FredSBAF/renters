import sys
import json
import argparse
import logging
import re
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Regex Patterns ---
DATE_PATTERN = r'\b(\d{2}[\./-]\d{2}[\./-]\d{4})\b'
AMOUNT_PATTERN = r'(\d{1,3}(?:[\s\.,]\d{3})*(?:[\.,]\d{2})?)\s*[€eE]'
SIRET_PATTERN = r'\b\d{3}[\s\.]?\d{3}[\s\.]?\d{3}[\s\.]?\d{5}\b'
NIR_PATTERN = r'\b[12]\s?\d{2}\s?\d{2}\s?(?:2[AB]|\d{2})\s?\d{3}\s?\d{3}\s?\d{2}\b'
EMAIL_PATTERN = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
PHONE_PATTERN = r'\b(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}\b'

def extract_dates(text):
    matches = re.findall(DATE_PATTERN, text)
    return matches

def extract_amounts(text):
    # Returns list of floats
    matches = re.findall(AMOUNT_PATTERN, text)
    amounts = []
    for m in matches:
        try:
            # Clean string: remove spaces/dots used as thousand separators, replace comma with dot
            clean_m = m.replace(' ', '').replace('.', '').replace(',', '.')
            amounts.append(float(clean_m))
        except ValueError:
            pass
    return amounts

def parse_mrz(text):
    """
    Attempt to extract and parse MRZ (Machine Readable Zone) from ID Cards / Passports.
    Supports TD1 (3 lines, ID cards), TD2 (2 lines), TD3 (2 lines, Passports).
    """
    lines = text.split('\n')
    mrz_lines = []
    
    # Simple heuristic to find MRZ lines
    for line in lines:
        clean_line = line.strip().replace(' ', '')
        # Check if line contains '<<' and minimum length
        if '<<' in clean_line and len(clean_line) > 10: 
            mrz_lines.append(clean_line)
    
    data = {}
    
    if len(mrz_lines) >= 2:
        # Strategy: Look for the line that starts with alpha chars and contains <<
        # This line usually contains the NAME.
        # In Passports (TD3) and Old IDs (TD2-like): It's Line 1.
        # In New IDs (TD1): It's Line 3.
        # Common trait: The segment BEFORE '<<' (excluding header) has NO digits.
        
        name_line = None
        for l in mrz_lines:
            parts = l.split('<<')
            if len(parts) >= 2:
                candidate_surname = parts[0]
                
                # Check for headers to ignore in digit check
                headers = ['IDFRA', 'P<FRA', 'I<FRA', 'ID', 'P<', 'I<', 'F<', 'A<', 'C<']
                clean_candidate = candidate_surname
                for h in headers:
                    if candidate_surname.startswith(h):
                        clean_candidate = candidate_surname[len(h):]
                        break
                
                # If the candidate surname (minus header) has valid length and NO digits
                if len(clean_candidate) > 1 and not any(char.isdigit() for char in clean_candidate if char != '<'):
                    name_line = l
                    break
        
        if name_line:
            parts = name_line.split('<<')
            raw_surname = parts[0]
            
            # Re-clean header for final extraction
            headers = ['IDFRA', 'P<FRA', 'I<FRA', 'ID', 'P<', 'I<']
            for h in headers:
                if raw_surname.startswith(h):
                    raw_surname = raw_surname[len(h):]
                    break
            
            # First Name logic
            # parts[1] is the first name usually
            # But sometimes parts[1] is empty if '<<<' follows surname immediately (Old ID)
            # Or parts[1] contains "JEAN<LUC"
            
            raw_given = ""
            if len(parts) > 1:
                # Find the first non-empty part after surname?
                # Usually it is parts[1]
                raw_given = parts[1]
            
            data['last_name'] = raw_surname.replace('<', '').strip()
            data['first_name'] = raw_given.replace('<', ' ').strip()
            
    return data

def parse_payslip(text):
    data = {}
    
    # Net Pay
    # 1. Try specific labels first
    labels = [r'net\s+a\s+payer', r'net\s+paye', r'net\s+imposable', r'montant\s+net']
    for label in labels:
        # Look for Label ... Amount
        match = re.search(f"{label}" + r".*?(\d{1,3}(?:[\s\.]\d{3})*(?:,\d{2})?)", text, re.IGNORECASE | re.DOTALL)
        if match:
             try:
                # Remove spaces, replace comma with dot
                val_str = match.group(1).replace(' ', '').replace('.', '').replace(',', '.')
                data['net_salary'] = float(val_str)
                break
             except:
                 continue

    # Period
    # "Période du ... au ..."
    period_match = re.search(r'(?:période\s+du|du)\s+(\d{2}/\d{2}/\d{4})\s+au\s+(\d{2}/\d{2}/\d{4})', text, re.IGNORECASE)
    if period_match:
        data['period_start'] = period_match.group(1)
        data['period_end'] = period_match.group(2)
    else:
        # Fallback: look for a month and year? e.g. "Janvier 2025"
        pass
        
    # Employer - Hard to detect generically without NER, but can look for SIRET
    siret = re.search(SIRET_PATTERN, text)
    if siret:
        data['employer_siret'] = siret.group(0).replace(' ', '').replace('.', '')

    return data

def parse_tax_notice(text):
    data = {}
    
    # RFR - Revenu Fiscal de Référence
    rfr_match = re.search(r'revenu\s+fiscal\s+de\s+référence.*?(\d{1,3}(?:[\s\.]\d{3})*)', text, re.IGNORECASE)
    if rfr_match:
        try:
            val = rfr_match.group(1).replace(' ', '').replace('.', '') # Integer usually
            data['reference_tax_income'] = int(val)
        except:
            pass

    # Fiscal Number
    fiscal_num = re.search(r'numéro\s+fiscal\s*:\s*(\d[\d\s]+)', text, re.IGNORECASE)
    if fiscal_num:
        data['fiscal_number'] = fiscal_num.group(1).replace(' ', '')
        
    # Tax Year (Context "Revenus de l'année ....")
    year_match = re.search(r'revenus\s+de\s+(?:l\'année\s+)?(\d{4})', text, re.IGNORECASE)
    if year_match:
        data['tax_year'] = int(year_match.group(1))

    return data

def parse_id_card(text):
    data = {}
    
    # MRZ is key
    mrz_data = parse_mrz(text)
    data.update(mrz_data)
    
    # Fallback / Confirmation regexes
    if 'last_name' not in data:
        name_match = re.search(r'Nom\s*:\s*([A-Z]+)', text)
        if name_match:
            data['last_name'] = name_match.group(1)
            
    # Dates extraction
    dates = extract_dates(text)
    if dates:
        # Heuristic: usually birth date is earlier than expiry.
        # But extracting specific semantic dates is hard with regex alone.
        # Just return all dates found for now.
        data['found_dates'] = dates
        
    return data

def parse_kbis(text):
    data = {}
    
    siret = re.search(SIRET_PATTERN, text)
    if siret:
        data['siret'] = siret.group(0).replace(' ', '').replace('.', '')
        
    # Registration Date
    reg_date = re.search(r'immatriculée\s+au\s+.*?(\d{2}/\d{2}/\d{4})', text, re.IGNORECASE)
    if reg_date:
        data['registration_date'] = reg_date.group(1)

    return data

def parse_rent_receipt(text):
    data = {}
    
    # Amount
    # Look for "Total à payer" or similar
    total_match = re.search(r'(?:total\s+à\s+payer|montant\s+du|total)\s*[\s:]\s*(\d{1,3}(?:[\s\.]\d{3})*(?:,\d{2})?)', text, re.IGNORECASE)
    if total_match:
         try:
            val = total_match.group(1).replace(' ', '').replace('.', '').replace(',', '.')
            data['amount'] = float(val)
         except:
             pass
    
    if 'amount' not in data:
        # Fallback: largest amount? Risky.
        pass
        
    # Period
    period_match = re.search(r'(?:période\s+du|du)\s+(\d{2}/\d{2}/\d{4})\s+au\s+(\d{2}/\d{2}/\d{4})', text, re.IGNORECASE)
    if period_match:
        data['period_start'] = period_match.group(1)
        data['period_end'] = period_match.group(2)
        
    return data

def process_document(doc, folder_id):
    """
    Main dispatch function
    """
    doc_id = doc.get('document_id', 'unknown')
    raw_text = doc.get('raw_text', '')
    
    # We need the document type efficiently. 
    # It might be in 'detected_type' (if classify ran) or 'document_type' (if manual).
    doc_type = doc.get('detected_type') or doc.get('document_type') or 'unknown'
    
    logger.info(f"Parsing fields for document {doc_id} (Type: {doc_type})")
    
    extracted_data = {}
    
    # 1. Common Fields
    # extracted_data['all_dates'] = extract_dates(raw_text)
    # extracted_data['emails'] = re.findall(EMAIL_PATTERN, raw_text)
    
    # 2. Specific Parsers
    if doc_type == 'payslip':
        extracted_data.update(parse_payslip(raw_text))
    elif doc_type == 'tax_notice':
        extracted_data.update(parse_tax_notice(raw_text))
    elif doc_type in ['id_card', 'passport']:
        extracted_data.update(parse_id_card(raw_text))
    elif doc_type == 'rent_receipt':
        extracted_data.update(parse_rent_receipt(raw_text))
    elif doc_type == 'company_registry':
        extracted_data.update(parse_kbis(raw_text))
    
    # Determine success (did we find anything useful?)
    success = len(extracted_data) > 0
    
    return {
        "document_id": doc_id,
        "success": success,
        "data": extracted_data,
        "warnings": [] if success else ["PARSE_INCOMPLETE"]
    }

def main():
    parser = argparse.ArgumentParser(description="Extract structured fields from OCR text.")
    parser.add_argument("--file", help="Path to input JSON file (result of ocr_extract).")
    parser.add_argument("--json", help="JSON string with input data.")
    parser.add_argument("--stdin", action="store_true", help="Read JSON from stdin.")

    args = parser.parse_args()

    input_data = {}
    
    try:
        if args.file:
            with open(args.file, 'r') as f:
                input_data = json.load(f)
        elif args.json:
            input_data = json.loads(args.json)
        elif args.stdin:
            input_data = json.load(sys.stdin)
        else:
            if not sys.stdin.isatty():
                 input_data = json.load(sys.stdin)
            else:
                parser.print_help()
                sys.exit(1)
    except Exception as e:
        logger.error(f"Failed to read input JSON: {e}")
        sys.exit(1)

    folder_id = input_data.get('folder_id')
    
    # Input format might vary. 
    # If chained from ocr_extract, it has "results" array.
    # We want to iterate over those results and add 'extracted_data'.
    
    results = []
    
    # The input documents might be in 'documents' (from start) or 'results' (from ocr step)
    # Let's handle both. 'ocr_extract' output puts processed docs in 'results'.
    
    input_docs = input_data.get('results', [])
    if not input_docs:
        input_docs = input_data.get('documents', []) # fallback
        
    # WE ALSO need the 'detected_type' from the classify step.
    # If the pipeline passes data cumulatively, the doc object should have it.
    
    for doc in input_docs:
        # If 'data' exists (from OCR step), raw_text is inside it usually? 
        # Wait, ocr_extract output format: { ... "data": { "raw_text": "..." } ... }
        # Let's flatten/normalize for the parser
        
        normalized_doc = doc.copy()
        if 'data' in doc and 'raw_text' in doc['data']:
             normalized_doc['raw_text'] = doc['data']['raw_text']
        
        # Parse
        extraction_result = process_document(normalized_doc, folder_id)
        
        # Merge result into document object for the next step?
        # Or just return the extraction result?
        # The pipeline spec says: "Output inputs for next step". 
        # Usually we enrich the object.
        
        # Let's return a result structure that matches previous steps
        # but specifically for this step's output.
        results.append(extraction_result)

    output = {
        "success": True,
        "step": "parse_fields",
        "folder_id": folder_id,
        "results": results
    }

    print(json.dumps(output, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
