# Frontend POURACCORD — Node 20 + Vite
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
EXPOSE 3000

# Dev server (hot reload)
CMD ["npm", "run", "dev"]
