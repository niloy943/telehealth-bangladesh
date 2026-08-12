# Stage 1: Build the React Application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy configuration and source files
COPY vite.config.js tailwind.config.js postcss.config.js ./
COPY public/ ./public/
COPY src/ ./src/

# Build the application
# Note: outDir is set to '../frontend' in vite.config.js, which maps to /frontend in the container filesystem
RUN npm run build

# Stage 2: Serve static files with Nginx
FROM nginx:stable-alpine

# Copy built assets from builder stage
COPY --from=builder /frontend /usr/share/nginx/html

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
