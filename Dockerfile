FROM node:16 AS builder
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm i --quiet
COPY . .
RUN npm run build

FROM node:16
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --quiet
COPY --from=builder /usr/src/app/dist/ dist/
USER node
EXPOSE 8080
ENTRYPOINT ["node", "dist/index.js"]
