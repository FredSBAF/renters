# Backend POURACCORD — Node 20 LTS
# Build depuis la racine du monorepo pour utiliser package-lock.json (builds reproductibles)
FROM node:20-alpine

WORKDIR /app

# Manifeste et lock file racine (monorepo)
COPY package.json package-lock.json ./
# Workspace backend
COPY backend/package.json ./backend/
COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src

# Install reproductible à partir du lock file
RUN npm ci

# Port exposé
EXPOSE 3001

# En dev : hot reload (le volume monte backend/src/ à la place)
CMD ["npm", "run", "dev", "--workspace=@pouraccord/backend"]
