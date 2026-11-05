# ponytail: Alpine + ffmpeg for light container; upgrade to Debian bookworm if ALSA/Pulse audio pass-through needed
FROM node:20-alpine

RUN apk add --no-cache ffmpeg alsa-utils

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

ENV PORT=3000
CMD ["node", "src/main.js"]
