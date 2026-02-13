# POURACCORD

Plateforme B2B2C de gestion et validation de dossiers locataires.

## Structure du projet

Monorepo avec npm workspaces :
- `backend/` : API Node.js + Express + TypeScript
- `frontend/` : Application React + Vite + TypeScript

## Installation

```bash
# Installer toutes les dépendances (backend + frontend)
npm install
```

## Développement

```bash
# Démarrer le backend (port 3001)
npm run dev:backend

# Démarrer le frontend (port 3000)
npm run dev:frontend
```

## Configuration

### Backend

1. Copier `.env.example` vers `.env` dans `backend/`
2. Remplir les variables (JWT_SECRET ≥ 32 caractères, TOTP_SECRET_ENCRYPTION_KEY = 32 caractères exactement)
3. Au démarrage, la config est validée avec Joi ; en cas d’erreur le serveur affiche les messages et quitte

```bash
cp backend/.env.example backend/.env
```

### Frontend

La configuration frontend est prête à l'emploi.

## Tests

```bash
# Tests backend
npm test

# Tests avec couverture
npm run test:coverage --workspace=backend
```

## Lint

```bash
# Linter backend + frontend
npm run lint
```

## Build

```bash
# Build frontend
npm run build
```
