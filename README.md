# renters

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

## Documentation API (OpenAPI)

Avec le backend démarré :

- **Swagger UI** : [http://localhost:3001/api/docs/](http://localhost:3001/api/docs/) (redirection depuis `/api/docs`)
- **Spécification YAML** : [http://localhost:3001/api/openapi.yaml](http://localhost:3001/api/openapi.yaml)

Fichier source : `backend/docs/openapi.yaml`.

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

Les tables sont créées avec Sequelize (migrations) :

```bash
cd backend && npm run migrate
```

Cette commande enchaîne d’abord les migrations **JavaScript** (`backend/migrations/`), puis les migrations **TypeScript** (`backend/src/migrations/`) — sans la 2ᵉ étape, seules les tables de base (`users`, `agencies`, tokens, etc.) existent.

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

## Docker (SETUP-06)

Lancer toute la stack (MySQL + backend + frontend) pour tester en local :

```bash
# 1. Créer le fichier d’env Docker (une fois)
cp backend/.env.docker.example backend/.env.docker

# 2. Démarrer les conteneurs
docker compose up --build
```

- **MySQL** : port 3306, base `renters`, user `root` / `root` (ou `renters` / `renters`)
- **Backend** : http://localhost:3001
- **Frontend** : http://localhost:3000 (Vite dev, rechargement à chaud)

Arrêter : `docker compose down`. Données MySQL conservées dans le volume `renters-mysql-data`.



## Récupération du code 6 chiffres
node -e "const {createHash}=require('crypto'); const token='9f6561fb-0bce-4097-9fa5-bbbb3523bb22'; const h=createHash('sha256').update(token).digest('hex'); const code=((parseInt(h.slice(0,12),16)%900000)+100000).toString(); console.log(code);"