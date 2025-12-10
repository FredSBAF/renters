# extraction_system.py
import ollama
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any

class DocumentExtractorSystem:
    def __init__(self, model='llama3.2-vision'):
        self.model = model
        self.feedback_file = 'extraction_feedback.jsonl'
        self.training_file = 'training_data.jsonl'
        
        # Prompts avec exemples
        self.prompts = {
            'bail': self._get_bail_prompt(),
            'diagnostic': self._get_diagnostic_prompt(),
            'amortissement': self._get_amortissement_prompt()
        }
    
    def _get_bail_prompt(self):
        return """Tu es un expert en extraction de baux immobiliers français.

EXEMPLE 1:
Document: "Bail d'habitation entre M. Dupont Jean et Mme Martin Sophie pour l'appartement situé 12 rue de la Paix 75002 Paris. Loyer: 1200€ + 150€ de charges. Début: 01/03/2023. Durée: 3 ans."
{
  "locataire": "Sophie Martin",
  "proprietaire": "Jean Dupont",
  "adresse": "12 rue de la Paix, 75002 Paris",
  "loyer_mensuel": 1200,
  "charges": 150,
  "date_debut": "2023-03-01",
  "duree_mois": 36
}

RÈGLES IMPORTANTES:
- NE METS PAS de civilités (M., Mme) dans les noms
- Date au format YYYY-MM-DD
- Loyer et charges en nombres (pas de symbole €)
- Inclure le code postal dans l'adresse

Extrais UNIQUEMENT le JSON du document suivant:"""

    def _get_diagnostic_prompt(self):
        return """Extrais les informations de ce diagnostic.

EXEMPLE:
{
  "type": "DPE",
  "adresse": "23 rue Gambetta, 59000 Lille",
  "date_visite": "2023-05-12",
  "classe_energie": "C",
  "consommation_kwh": 145,
  "classe_ges": "D"
}

Extrais UNIQUEMENT le JSON:"""

    def _get_amortissement_prompt(self):
        return """Extrais le tableau d'amortissement.

EXEMPLE:
{
  "montant_total": 200000,
  "taux_interet": 1.5,
  "duree_annees": 20,
  "mensualite": 965.02
}

Extrais UNIQUEMENT le JSON:"""
    
    def extract(self, image_path: str, doc_type: str = 'bail', 
                max_retries: int = 3) -> Dict[str, Any]:
        """
        Extrait les informations avec validation et correction automatique
        """
        with open(image_path, 'rb') as f:
            image_bytes = f.read()
        
        for attempt in range(max_retries):
            try:
                # Extraction
                response = ollama.chat(
                    model=self.model,
                    messages=[{
                        'role': 'user',
                        'content': self.prompts[doc_type],
                        'images': [image_bytes]
                    }],
                    options={
                        'temperature': 0.1,
                        'top_p': 0.9
                    }
                )
                
                # Parse le JSON
                result = self._parse_json(response['message']['content'])
                
                if not result:
                    continue
                
                # Valide
                errors = self.validate(result, doc_type)
                
                # Si pas d'erreurs critiques, retourne
                critical_errors = [e for e in errors if e['severity'] == 'error']
                
                if not critical_errors:
                    return {
                        'status': 'success' if not errors else 'warning',
                        'extraction': result,
                        'validation_errors': errors,
                        'attempt': attempt + 1
                    }
                
                # Sinon, demande correction
                if attempt < max_retries - 1:
                    result = self._request_correction(
                        image_bytes, result, critical_errors, doc_type
                    )
                
            except Exception as e:
                if attempt == max_retries - 1:
                    return {
                        'status': 'error',
                        'error': str(e),
                        'attempt': attempt + 1
                    }
        
        return {
            'status': 'max_retries',
            'extraction': result,
            'validation_errors': errors,
            'attempt': max_retries
        }
    
    def _parse_json(self, text: str) -> Dict:
        """Parse le JSON de la réponse de l'IA"""
        # Cherche le JSON dans la réponse
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text, re.DOTALL)
        
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
        
        return None
    
    def _request_correction(self, image_bytes: bytes, result: Dict, 
                           errors: List[Dict], doc_type: str) -> Dict:
        """Demande à l'IA de corriger ses erreurs"""
        
        error_details = "\n".join([
            f"- {e['field']}: {e['message']}" 
            for e in errors
        ])
        
        correction_prompt = f"""Tu as fait des erreurs dans l'extraction précédente:

Ton extraction:
{json.dumps(result, indent=2, ensure_ascii=False)}

Erreurs:
{error_details}

CORRIGE ces erreurs et retourne UNIQUEMENT le JSON corrigé:"""
        
        response = ollama.chat(
            model=self.model,
            messages=[{
                'role': 'user',
                'content': correction_prompt,
                'images': [image_bytes]
            }]
        )
        
        corrected = self._parse_json(response['message']['content'])
        return corrected if corrected else result
    
    def validate(self, data: Dict, doc_type: str) -> List[Dict]:
        """Valide les données extraites"""
        
        if doc_type == 'bail':
            return self._validate_bail(data)
        elif doc_type == 'diagnostic':
            return self._validate_diagnostic(data)
        elif doc_type == 'amortissement':
            return self._validate_amortissement(data)
        
        return []
    
    def _validate_bail(self, data: Dict) -> List[Dict]:
        """Validation spécifique pour les baux"""
        errors = []
        
        # Loyer
        if 'loyer_mensuel' in data:
            if not isinstance(data['loyer_mensuel'], (int, float)):
                errors.append({
                    'field': 'loyer_mensuel',
                    'severity': 'error',
                    'message': 'Le loyer doit être un nombre',
                    'current': data['loyer_mensuel'],
                    'suggestion': self._extract_number(str(data['loyer_mensuel']))
                })
            elif data['loyer_mensuel'] <= 0 or data['loyer_mensuel'] > 50000:
                errors.append({
                    'field': 'loyer_mensuel',
                    'severity': 'warning',
                    'message': 'Le montant semble irréaliste',
                    'current': data['loyer_mensuel']
                })
        
        # Date
        if 'date_debut' in data:
            if not re.match(r'^\d{4}-\d{2}-\d{2}$', str(data['date_debut'])):
                errors.append({
                    'field': 'date_debut',
                    'severity': 'error',
                    'message': 'Format de date invalide (requis: YYYY-MM-DD)',
                    'current': data['date_debut'],
                    'suggestion': self._convert_date(str(data['date_debut']))
                })
        
        # Adresse
        if 'adresse' in data:
            if not re.search(r'\d{5}', data['adresse']):
                errors.append({
                    'field': 'adresse',
                    'severity': 'warning',
                    'message': 'Pas de code postal détecté',
                    'current': data['adresse']
                })
        
        # Civilités
        for field in ['locataire', 'proprietaire']:
            if field in data:
                if re.search(r'\b(M\.|Mme|Mlle|Mr\.)\b', data[field], re.IGNORECASE):
                    errors.append({
                        'field': field,
                        'severity': 'error',
                        'message': 'Contient une civilité (à retirer)',
                        'current': data[field],
                        'suggestion': re.sub(r'\b(M\.|Mme|Mlle|Mr\.)\s*', '', data[field], flags=re.IGNORECASE).strip()
                    })
        
        return errors
    
    def _validate_diagnostic(self, data: Dict) -> List[Dict]:
        """Validation pour les diagnostics"""
        errors = []
        
        if 'classe_energie' in data:
            if data['classe_energie'] not in ['A', 'B', 'C', 'D', 'E', 'F', 'G']:
                errors.append({
                    'field': 'classe_energie',
                    'severity': 'error',
                    'message': 'Classe énergie invalide (A-G requis)',
                    'current': data['classe_energie']
                })
        
        return errors
    
    def _validate_amortissement(self, data: Dict) -> List[Dict]:
        """Validation pour tableaux d'amortissement"""
        errors = []
        
        if 'taux_interet' in data:
            if not 0 <= data['taux_interet'] <= 20:
                errors.append({
                    'field': 'taux_interet',
                    'severity': 'warning',
                    'message': 'Taux d\'intérêt inhabituel',
                    'current': data['taux_interet']
                })
        
        return errors
    
    def _extract_number(self, text: str) -> float:
        """Extrait un nombre d'une chaîne"""
        numbers = re.findall(r'\d+\.?\d*', text)
        return float(numbers[0]) if numbers else 0
    
    def _convert_date(self, date_str: str) -> str:
        """Convertit différents formats de date en YYYY-MM-DD"""
        # DD/MM/YYYY
        match = re.match(r'(\d{2})/(\d{2})/(\d{4})', date_str)
        if match:
            return f"{match.group(3)}-{match.group(2)}-{match.group(1)}"
        
        # DD-MM-YYYY
        match = re.match(r'(\d{2})-(\d{2})-(\d{4})', date_str)
        if match:
            return f"{match.group(3)}-{match.group(2)}-{match.group(1)}"
        
        return date_str
    
    def save_feedback(self, image_path: str, extraction: Dict, 
                     validation_errors: List[Dict], corrections: Dict = None):
        """Sauvegarde le feedback pour amélioration future"""
        
        feedback = {
            'timestamp': datetime.now().isoformat(),
            'image_path': image_path,
            'extraction': extraction,
            'validation_errors': validation_errors,
            'corrections': corrections,
            'validated': corrections is not None
        }
        
        with open(self.feedback_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(feedback, ensure_ascii=False) + '\n')
    
    def export_training_data(self, output_file: str = None):
        """Exporte les données validées pour le fine-tuning"""
        
        if output_file is None:
            output_file = self.training_file
        
        training_data = []
        
        # Lit le feedback
        if Path(self.feedback_file).exists():
            with open(self.feedback_file, 'r', encoding='utf-8') as f:
                for line in f:
                    entry = json.loads(line)
                    if entry['validated']:
                        training_data.append({
                            'image': entry['image_path'],
                            'text': 'Extrais les informations de ce document.',
                            'output': entry['corrections']
                        })
        
        # Sauvegarde
        with open(output_file, 'w', encoding='utf-8') as f:
            for item in training_data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')
        
        print(f"✅ Exporté {len(training_data)} exemples vers {output_file}")
        
        return len(training_data)
    
    def get_statistics(self) -> Dict:
        """Calcule les statistiques du système"""
        
        stats = {
            'total': 0,
            'validated': 0,
            'with_errors': 0,
            'error_types': {}
        }
        
        if Path(self.feedback_file).exists():
            with open(self.feedback_file, 'r', encoding='utf-8') as f:
                for line in f:
                    entry = json.loads(line)
                    stats['total'] += 1
                    
                    if entry['validated']:
                        stats['validated'] += 1
                    
                    if entry['validation_errors']:
                        stats['with_errors'] += 1
                        
                        for error in entry['validation_errors']:
                            field = error['field']
                            stats['error_types'][field] = stats['error_types'].get(field, 0) + 1
        
        if stats['total'] > 0:
            stats['accuracy'] = round((stats['total'] - stats['with_errors']) / stats['total'] * 100, 1)
        else:
            stats['accuracy'] = 0
        
        return stats
    
    def generate_improved_prompt(self):
        """Génère un prompt amélioré basé sur les erreurs fréquentes"""
        
        stats = self.get_statistics()
        
        if not stats['error_types']:
            print("Pas assez d'erreurs pour améliorer le prompt")
            return
        
        print("\n=== ERREURS FRÉQUENTES ===")
        for field, count in sorted(stats['error_types'].items(), key=lambda x: x[1], reverse=True)[:5]:
            print(f"  {field}: {count} fois")
        
        print("\n💡 Ajoute ces cas dans tes exemples few-shot!")


# API Flask pour l'interface web
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import base64

app = Flask(__name__)
CORS(app)

extractor = DocumentExtractorSystem()

@app.route('/api/extract', methods=['POST'])
def extract_document():
    """Endpoint pour extraire un document"""
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    doc_type = request.form.get('type', 'bail')
    
    # Sauvegarde temporaire
    temp_path = f"temp/{file.filename}"
    Path("temp").mkdir(exist_ok=True)
    file.save(temp_path)
    
    # Extraction
    result = extractor.extract(temp_path, doc_type)
    
    # Sauvegarde feedback
    if result['status'] == 'success':
        extractor.save_feedback(
            temp_path,
            result['extraction'],
            result['validation_errors']
        )
    
    return jsonify(result)

@app.route('/api/validate', methods=['POST'])
def validate_extraction():
    """Valide et corrige une extraction"""
    
    data = request.json
    image_path = data['image_path']
    corrections = data['corrections']
    original = data['original']
    
    extractor.save_feedback(
        image_path,
        original,
        [],
        corrections
    )
    
    return jsonify({'status': 'validated'})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Retourne les statistiques"""
    return jsonify(extractor.get_statistics())

@app.route('/api/export/training', methods=['GET'])
def export_training():
    """Exporte les données d'entraînement"""
    count = extractor.export_training_data()
    return jsonify({'exported': count, 'file': extractor.training_file})

if __name__ == '__main__':
    print("🚀 Serveur démarré sur http://localhost:5000")
    print("📊 Interface React sur http://localhost:3000")
    app.run(debug=True, host='0.0.0.0', port=5000)