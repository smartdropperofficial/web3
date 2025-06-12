# Fase 1: build
FROM node:20 AS builder

WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
RUN npm install
RUN npm run build

# Fase 2: esecuzione
FROM node:20-slim

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY .env .env

EXPOSE 3000
CMD ["node", "dist/index.js"]
