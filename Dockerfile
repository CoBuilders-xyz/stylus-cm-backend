FROM node:20.18.0-bullseye


RUN mkdir /app && chown node:node /app
WORKDIR /app

USER node

COPY --chown=node:node ./package*.json ./
RUN npm install

COPY --chown=node:node . .