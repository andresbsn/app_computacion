FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts
COPY credenciales ./credenciales
COPY assets ./assets

EXPOSE 3000

CMD ["sh", "-c", "npm run db:init && npm start"]
