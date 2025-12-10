# example_usage.py
from extraction_system import DocumentExtractorSystem

# Initialise le système
extractor = DocumentExtractorSystem()

# Extrait un document
result = extractor.extract('mon_bail.pdf', doc_type='bail')

print(f"Status: {result['status']}")
print(f"Extraction: {result['extraction']}")
print(f"Erreurs: {result['validation_errors']}")

# Après validation manuelle
extractor.save_feedback(
    'mon_bail.pdf',
    result['extraction'],
    result['validation_errors'],
    corrections={'loyer_mensuel': 1200}  # Tes corrections
)

# Exporte pour training
extractor.export_training_data()

# Statistiques
stats = extractor.get_statistics()
print(f"Précision: {stats['accuracy']}%")