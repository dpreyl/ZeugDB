# ---- Build Stage ----
FROM node:22-alpine AS build

WORKDIR /app

# Dependencies zuerst (Caching)
COPY package.json ./
RUN npm install --production --ignore-scripts

# Source + Build
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/build build/
COPY --from=build /app/package.json package.json
COPY --from=build /app/node_modules node_modules/

# Expose Port (default 3000)
EXPOSE 3000

CMD ["node", "build"]
