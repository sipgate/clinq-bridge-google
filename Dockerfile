# Multistage build is weird at the moment because
# of postinstall script after "npm install"

FROM node:16 AS builder
WORKDIR /usr/src/app
COPY package*.json .
COPY src .
COPY tsconfig.json .
RUN npm i --quiet

FROM node:16
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY package*.json .
COPY src .
COPY tsconfig.json .
RUN npm ci --quiet
COPY --from=builder /usr/src/app/dist/ dist/
USER node
EXPOSE 8080
ENTRYPOINT ["node", "dist/index.js"]
