FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# NEXT_PUBLIC_* vars are inlined into the client-side bundle at `next build`
# time (the browser reads them, not the server) — so the API URL has to be
# supplied as a build arg here, not as a runtime .env file. See
# docker-compose.yml for how this gets set.
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
