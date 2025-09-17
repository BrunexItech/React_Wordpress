# --- Build stage: Vite build ---
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (expects package.json in your frontend/)
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Read build-time GraphQL URL from build args (provided by docker-compose)
ARG VITE_WORDPRESS_GRAPHQL_URL=http://localhost:8000/graphql
ENV VITE_WORDPRESS_GRAPHQL_URL=$VITE_WORDPRESS_GRAPHQL_URL

# Build the static site (Vite reads VITE_* from env at build time)
RUN npm run build

# --- Runtime stage: Apache 2.4 serving static files ---
FROM httpd:2.4

# Enable modules we need (rewrite, headers; proxy if you later want same-origin /graphql)
RUN sed -i 's/^#LoadModule rewrite_module/LoadModule rewrite_module/' /usr/local/apache2/conf/httpd.conf \
 && sed -i 's/^#LoadModule headers_module/LoadModule headers_module/' /usr/local/apache2/conf/httpd.conf \
 && sed -i 's/^#LoadModule proxy_module/LoadModule proxy_module/' /usr/local/apache2/conf/httpd.conf \
 && sed -i 's/^#LoadModule proxy_http_module/LoadModule proxy_http_module/' /usr/local/apache2/conf/httpd.conf

# Include our vhost for SPA fallback (no proxy needed since using full URL)
COPY vite-frontend.conf /usr/local/apache2/conf/extra/vite-frontend.conf
RUN echo "Include conf/extra/vite-frontend.conf" >> /usr/local/apache2/conf/httpd.conf

# Copy built assets into Apache docroot
COPY --from=build /app/dist/ /usr/local/apache2/htdocs/
