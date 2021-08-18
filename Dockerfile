FROM node:16 AS builder
WORKDIR /usr/src/app
COPY package*.json ./
COPY src/ src/
COPY tsconfig.json ./
RUN npm ci --quiet
RUN npm run build

FROM node:16
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY package*.json ./
COPY --from=builder /usr/src/app/dist/ dist/
RUN npm ci --quiet
USER node
EXPOSE 8080
ENTRYPOINT ["node", "dist/index.js"]
