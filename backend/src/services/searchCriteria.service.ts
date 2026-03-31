import Anthropic from '@anthropic-ai/sdk';
import { Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { config } from '../config/env';
import { SearchCriteria, SearchCriteriaCity, SearchCriteriaPropertyType } from '../models';

type UpdatePayload = {
  cities: Array<{ name: string; place_id: string; lat: number; lng: number; radius_km: number }>;
  property_types: string[];
  budget_ideal: number;
  budget_max: number;
  availability_type: 'immediate' | 'date';
  availability_date: string | null;
  presentation_text: string;
};

type GeneratePayload = {
  cities: string[];
  property_types: string[];
  budget_ideal: number;
  budget_max: number;
  availability_type: 'immediate' | 'date';
  availability_date?: string | null;
  tenant_profile: string;
  first_name: string;
};

export async function getByUserId(userId: number): Promise<SearchCriteria | null> {
  return SearchCriteria.findOne({
    where: { user_id: userId },
    include: [
      { model: SearchCriteriaCity, as: 'cities' },
      { model: SearchCriteriaPropertyType, as: 'propertyTypes' },
    ],
  });
}

export async function upsert(userId: number, payload: UpdatePayload): Promise<SearchCriteria> {
  const t: Transaction = await sequelize.transaction();
  try {
    let criteria = await SearchCriteria.findOne({ where: { user_id: userId }, transaction: t });

    if (!criteria) {
      criteria = await SearchCriteria.create(
        {
          user_id: userId,
          budget_ideal: payload.budget_ideal,
          budget_max: payload.budget_max,
          availability_type: payload.availability_type,
          availability_date: payload.availability_date,
          presentation_text: payload.presentation_text,
        },
        { transaction: t }
      );
    } else {
      await criteria.update(
        {
          budget_ideal: payload.budget_ideal,
          budget_max: payload.budget_max,
          availability_type: payload.availability_type,
          availability_date: payload.availability_date,
          presentation_text: payload.presentation_text,
        },
        { transaction: t }
      );
    }

    await SearchCriteriaCity.destroy({
      where: { search_criteria_id: criteria.id },
      transaction: t,
    });
    await SearchCriteriaCity.bulkCreate(
      payload.cities.map((c) => ({
        search_criteria_id: criteria!.id,
        ...c,
      })),
      { transaction: t }
    );

    await SearchCriteriaPropertyType.destroy({
      where: { search_criteria_id: criteria.id },
      transaction: t,
    });
    await SearchCriteriaPropertyType.bulkCreate(
      payload.property_types.map((propertyType) => ({
        search_criteria_id: criteria!.id,
        property_type: propertyType as
          | 'studio'
          | 'T1'
          | 'T2'
          | 'T3'
          | 'T4'
          | 'T5+'
          | 'house'
          | 'colocation'
          | 'loft',
      })),
      { transaction: t }
    );

    await t.commit();
    const reloaded = await getByUserId(userId);
    if (!reloaded) throw new Error('SEARCH_CRITERIA_NOT_FOUND_AFTER_UPSERT');
    return reloaded;
  } catch (error) {
    await t.rollback();
    throw error;
  }
}

export async function generatePresentation(payload: GeneratePayload): Promise<string> {
  const client = new Anthropic({ apiKey: config.anthropic.apiKey });

  const availabilityStr =
    payload.availability_type === 'immediate'
      ? 'disponible immédiatement'
      : `disponible à partir de ${payload.availability_date}`;

  const prompt = `Tu es un assistant qui aide des locataires à rédiger
leur mot de présentation pour un dossier immobilier.

Génère un texte de présentation naturel, chaleureux et professionnel
en français, en première personne, de 100 à 150 mots maximum.

Informations du locataire :
- Prénom : ${payload.first_name}
- Situation professionnelle : ${payload.tenant_profile}
- Recherche : ${payload.property_types.join(', ')}
  dans ${payload.cities.join(', ')}
- Budget : ${payload.budget_ideal}€ idéal, ${payload.budget_max}€ maximum
- Disponibilité : ${availabilityStr}

Consignes :
- Commence par une phrase d'accroche personnelle (pas "Je suis...")
- Mentionne la situation professionnelle et la stabilité
- Exprime la motivation pour ce type de logement
- Reste factuel, sincère, sans superlatifs excessifs
- Ne termine pas par une formule de politesse formelle
- Pas de guillemets dans le texte généré
- Texte brut uniquement, sans markdown`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  return text.slice(0, 500);
}
