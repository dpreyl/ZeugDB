# ---- Build Stage ----
FROM node:22-alpine AS build

WORKDIR /app

# Alle Dependencies (dev + prod) für den Build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Source + Build
COPY . .
RUN npm run build

# ---- Production Stage (statische Dateien nur) ----
FROM nginx:alpine AS production

# Statische Build-Ausgabe nach /usr/share/nginx/html
COPY --from=build /app/build /usr/share/nginx/html

# Custom nginx Config für SPA-Routing (alle Routen → index.html)
RUN echo 'server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    # Service Worker muss ohne Fallback serviert werden
    location = /sw.js {
        try_files /sw.js =404;
    }
}' > /etc/nginx/conf.d/default.conf

# Expose Port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
