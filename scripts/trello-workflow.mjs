#!/usr/bin/env node
/**
 * trello-workflow.mjs
 * Script autonome de gestion du workflow Trello ↔ Git ↔ GitHub PR
 * Usage: node scripts/trello-workflow.mjs [next|status|done|blocked]
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── CONFIG ────────────────────────────────────────────────────────────────

// Charger les vars d'environnement depuis .env
try {
  const env = readFileSync(resolve(process.cwd(), '.env'), 'utf-8');
  for (const line of env.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  }
} catch {
  console.log('⚠️  Pas de .env trouvé — utilisation des vars d\'environnement système');
}

const {
  TRELLO_API_KEY,
  TRELLO_API_TOKEN,
  TRELLO_TODO_LIST_ID,
  TRELLO_IN_PROGRESS_LIST_ID,
  TRELLO_REVIEW_LIST_ID,
  TRELLO_DONE_LIST_ID,
} = process.env;

const BASE_URL = 'https://api.trello.com/1';
const AUTH = `key=${TRELLO_API_KEY}&token=${TRELLO_API_TOKEN}`;

// ─── HELPERS ───────────────────────────────────────────────────────────────

async function trelloGet(path) {
  const res = await fetch(`${BASE_URL}${path}?${AUTH}`);
  if (!res.ok) throw new Error(`Trello GET ${path} → ${res.status}`);
  return res.json();
}

async function trelloPut(path, params) {
  const body = new URLSearchParams({ ...params });
  const res = await fetch(`${BASE_URL}${path}?${AUTH}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Trello PUT ${path} → ${res.status}`);
  return res.json();
}

async function trelloPost(path, params) {
  const body = new URLSearchParams({ ...params });
  const res = await fetch(`${BASE_URL}${path}?${AUTH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Trello POST ${path} → ${res.status}`);
  return res.json();
}

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
}

function gh(cmd) {
  return execSync(`gh ${cmd}`, { encoding: 'utf-8', stdio: 'pipe' }).trim();
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// ─── ACTIONS ───────────────────────────────────────────────────────────────

/**
 * Récupère la prochaine carte "À faire" selon les priorités de label
 */
async function getNextCard() {
  const cards = await trelloGet(`/lists/${TRELLO_TODO_LIST_ID}/cards`);

  if (!cards.length) {
    console.log('✅ Backlog vide — rien à faire !');
    return null;
  }

  // Priorité : critique > haute-priorité > normale
  const PRIORITY = { 'critique': 0, 'haute-priorité': 1, 'normale': 2 };

  const sorted = cards.sort((a, b) => {
    const pa = Math.min(...(a.labels.map(l => PRIORITY[l.name] ?? 99)));
    const pb = Math.min(...(b.labels.map(l => PRIORITY[l.name] ?? 99)));
    return pa - pb;
  });

  return sorted[0];
}

/**
 * Cycle complet : Trello → Branche → Dev prêt
 */
async function next() {
  console.log('\n🎯 Récupération de la prochaine carte Trello...\n');

  const card = await getNextCard();
  if (!card) return;

  // Extraire l'ID court de la carte (ex: "abc123" → "1a2b")
  const shortId = card.shortLink || card.id.slice(-6);
  const branchType = card.labels.some(l => l.name === 'bug') ? 'fix' : 'feature';
  const branchName = `${branchType}/${shortId}-${slugify(card.name)}`;

  console.log(`📋 Carte sélectionnée : "${card.name}"`);
  console.log(`🌿 Branche : ${branchName}`);
  console.log(`🔗 Lien : ${card.shortUrl}\n`);

  // 1. Déplacer en "En cours"
  await trelloPut(`/cards/${card.id}`, { idList: TRELLO_IN_PROGRESS_LIST_ID });
  console.log('✅ Carte déplacée → "En cours"');

  // 2. Commenter sur la carte
  await trelloPost(`/cards/${card.id}/actions/comments`, {
    text: `🚀 Développement démarré sur la branche \`${branchName}\`\n\n_Démarré le ${new Date().toLocaleString('fr-FR')}_`,
  });

  // 3. Créer la branche Git
  try {
    git('checkout main');
    git('pull origin main');
    git(`checkout -b ${branchName}`);
    git(`push -u origin ${branchName}`);
    console.log(`✅ Branche créée et pushée : ${branchName}`);
  } catch (err) {
    console.error('❌ Erreur Git :', err.message);
    return;
  }

  // 4. Afficher le plan de travail
  console.log('\n' + '─'.repeat(60));
  console.log('📝 DESCRIPTION DE LA CARTE :');
  console.log('─'.repeat(60));
  console.log(card.desc || '(aucune description)');
  console.log('─'.repeat(60));
  console.log('\n🔧 Tu es maintenant sur la branche', branchName);
  console.log('   → Implémenter la fonctionnalité');
  console.log('   → Écrire les tests');
  console.log('   → Committer les changements');
  console.log('   → Lancer `npm run pr:create` quand prêt\n');
}

/**
 * Créer la PR et déplacer la carte en "En revue"
 */
async function createPR() {
  console.log('\n🔃 Création de la Pull Request...\n');

  // Récupérer la branche courante
  const currentBranch = git('branch --show-current');
  const shortId = currentBranch.split('/')[1]?.split('-')[0];

  if (!shortId) {
    console.error('❌ Impossible de détecter l\'ID de la carte depuis la branche :', currentBranch);
    return;
  }

  // Récupérer la carte Trello
  let card;
  try {
    const cards = await trelloGet(`/lists/${TRELLO_IN_PROGRESS_LIST_ID}/cards`);
    card = cards.find(c => c.shortLink === shortId || c.id.includes(shortId));
  } catch {
    console.warn('⚠️  Impossible de récupérer la carte Trello — PR créée sans lien');
  }

  const cardName = card?.name || currentBranch;
  const cardUrl = card?.shortUrl || '';
  const cardDesc = card?.desc || '';

  // Générer le corps de la PR
  const prBody = `## 📋 Fiche Trello
${cardUrl ? `[${cardName}](${cardUrl})` : cardName}

## 🎯 Objectif
${cardDesc.split('\n')[0] || 'Voir la carte Trello pour les détails.'}

## 🔧 Changements
<!-- Remplir avec les changements effectués -->
- 

## ✅ Critères d'acceptance
- [ ] Fonctionnalité implémentée conformément à la carte
- [ ] Tests unitaires ajoutés ou mis à jour
- [ ] Lint sans erreur

## 🧪 Tests
- [ ] \`npm test\` → ✅ 
- [ ] \`npm run lint\` → ✅
- [ ] Pas de régression

## 📸 Screenshots
<!-- Si changement d'interface, ajouter ici -->

## ⚠️ Points d'attention
<!-- Signaler toute complexité ou risque pour le reviewer -->`;

  // Créer la PR
  try {
    const prUrl = gh(
      `pr create --title "[${shortId}] ${cardName}" --body "${prBody.replace(/"/g, '\\"')}" --base main --head ${currentBranch}`
    );
    console.log('✅ PR créée :', prUrl);

    // Déplacer la carte en "En revue"
    if (card) {
      await trelloPut(`/cards/${card.id}`, { idList: TRELLO_REVIEW_LIST_ID });
      await trelloPost(`/cards/${card.id}/actions/comments`, {
        text: `👁️ PR ouverte et en attente de review\n\n${prUrl}\n\n_${new Date().toLocaleString('fr-FR')}_`,
      });
      console.log('✅ Carte déplacée → "En revue"');
    }
  } catch (err) {
    console.error('❌ Erreur lors de la création de la PR :', err.message);
  }
}

/**
 * Marquer la carte courante comme terminée (après merge)
 */
async function done() {
  const currentBranch = git('branch --show-current');
  const shortId = currentBranch.split('/')[1]?.split('-')[0];

  const cards = await trelloGet(`/lists/${TRELLO_REVIEW_LIST_ID}/cards`);
  const card = cards.find(c => c.shortLink === shortId || c.id.includes(shortId));

  if (!card) {
    console.error('❌ Aucune carte trouvée en "En revue" pour la branche', currentBranch);
    return;
  }

  await trelloPut(`/cards/${card.id}`, { idList: TRELLO_DONE_LIST_ID });
  await trelloPost(`/cards/${card.id}/actions/comments`, {
    text: `✅ Mergé en production !\n\n_${new Date().toLocaleString('fr-FR')}_`,
  });

  console.log(`✅ Carte "${card.name}" déplacée → "Terminé"`);
}

/**
 * Afficher le statut des cartes en cours
 */
async function status() {
  console.log('\n📊 STATUT DU BOARD POURACCORD\n');

  const [todo, inProgress, review] = await Promise.all([
    trelloGet(`/lists/${TRELLO_TODO_LIST_ID}/cards`),
    trelloGet(`/lists/${TRELLO_IN_PROGRESS_LIST_ID}/cards`),
    trelloGet(`/lists/${TRELLO_REVIEW_LIST_ID}/cards`),
  ]);

  console.log(`🎯 À faire (${todo.length})`);
  todo.slice(0, 5).forEach(c => console.log(`   • ${c.name}`));
  if (todo.length > 5) console.log(`   ... et ${todo.length - 5} autres`);

  console.log(`\n🔧 En cours (${inProgress.length})`);
  inProgress.forEach(c => console.log(`   • ${c.name} — ${c.shortUrl}`));

  console.log(`\n👁️  En revue (${review.length})`);
  review.forEach(c => console.log(`   • ${c.name} — ${c.shortUrl}`));

  console.log();
}

/**
 * Marquer la carte comme bloquée
 */
async function blocked(reason = 'Raison non précisée') {
  const currentBranch = git('branch --show-current');
  const shortId = currentBranch.split('/')[1]?.split('-')[0];

  const cards = await trelloGet(`/lists/${TRELLO_IN_PROGRESS_LIST_ID}/cards`);
  const card = cards.find(c => c.shortLink === shortId || c.id.includes(shortId));

  if (!card) {
    console.error('❌ Aucune carte trouvée en "En cours"');
    return;
  }

  // Ajouter label "Bloqué" si disponible
  await trelloPost(`/cards/${card.id}/actions/comments`, {
    text: `🚫 BLOQUÉ\n\n${reason}\n\n_${new Date().toLocaleString('fr-FR')}_`,
  });

  console.log(`🚫 Carte "${card.name}" marquée comme bloquée`);
  console.log('   Raison :', reason);
}

// ─── ENTRÉE PRINCIPALE ─────────────────────────────────────────────────────

const [,, command, ...args] = process.argv;

const commands = { next, status, done, blocked: () => blocked(args.join(' ')), 'pr:create': createPR };
const fn = commands[command];

if (!fn) {
  console.log('Usage: node scripts/trello-workflow.mjs [next|status|done|blocked|pr:create]');
  console.log('\nCommandes :');
  console.log('  next       — Récupère la prochaine carte et démarre le développement');
  console.log('  status     — Affiche l\'état du board Trello');
  console.log('  done       — Marque la carte courante comme terminée');
  console.log('  blocked    — Signale un blocage sur la carte courante');
  console.log('  pr:create  — Crée la PR et déplace la carte en "En revue"');
  process.exit(1);
}

fn().catch(err => {
  console.error('💥 Erreur :', err.message);
  process.exit(1);
});
