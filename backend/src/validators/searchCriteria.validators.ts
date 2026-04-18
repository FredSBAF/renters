import Joi from 'joi';

const citySchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  place_id: Joi.string().min(1).max(255).required(),
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  radius_km: Joi.number().integer().min(0).max(50).default(5),
})
  .rename('placeId', 'place_id', { override: true, ignoreUndefined: true })
  .rename('radiusKm', 'radius_km', { override: true, ignoreUndefined: true });

const PROPERTY_TYPES = ['studio', 'T1', 'T2', 'T3', 'T4', 'T5+', 'house', 'colocation', 'loft'];

export const updateSearchCriteriaSchema = Joi.object({
  cities: Joi.array().items(citySchema).min(1).max(10).required().messages({
    'array.min': 'Au moins une ville est requise',
    'array.max': 'Maximum 10 villes autorisées',
  }),
  property_types: Joi.array()
    .items(Joi.string().valid(...PROPERTY_TYPES))
    .min(1)
    .max(9)
    .required()
    .messages({
      'array.min': 'Sélectionnez au moins un type de bien',
    }),
  budget_ideal: Joi.number().integer().min(300).max(10000).required(),
  budget_max: Joi.number().integer().min(300).max(10000).required().greater(Joi.ref('budget_ideal')).messages({
    'number.greater': 'Le loyer maximum doit être supérieur au loyer idéal',
  }),
  availability_type: Joi.string().valid('immediate', 'date').required(),
  availability_date: Joi.when('availability_type', {
    is: 'date',
    then: Joi.date().iso().min('now').required().messages({
      'date.min': 'La date de disponibilité doit être dans le futur',
    }),
    otherwise: Joi.valid(null).default(null),
  }),
  presentation_text: Joi.string().min(10).max(500).required().messages({
    'string.min': 'Le texte de présentation doit faire au moins 10 caractères',
    'string.max': 'Le texte de présentation ne doit pas dépasser 500 caractères',
  }),
});

export const generatePresentationSchema = Joi.object({
  cities: Joi.array().items(Joi.string()).min(1).required(),
  property_types: Joi.array().items(Joi.string()).min(1).required(),
  budget_ideal: Joi.number().integer().min(300).required(),
  budget_max: Joi.number().integer().min(300).required(),
  availability_type: Joi.string().valid('immediate', 'date').required(),
  availability_date: Joi.string().allow(null).optional(),
  tenant_profile: Joi.string().required(),
  first_name: Joi.string().required(),
});
