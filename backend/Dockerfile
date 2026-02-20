# Backend POURACCORD — Node 20 LTS
FROM node:20-alpine

WORKDIR /app

# Fichiers de dépendances (monorepo : pas de package-lock ici, on utilise npm install)
COPY package.json ./

# Install (production + dev pour ts-node-dev en mode dev)
RUN npm install

# Code source
COPY tsconfig.json ./
COPY src ./src

# Port exposé
EXPOSE 3001

# En dev : hot reload (le volume monte src/ à la place)
# En prod : build puis node dist/server.js
CMD ["npm", "run", "dev"]
