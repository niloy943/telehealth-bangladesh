FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy Node backend files
COPY . .

# Expose Node.js port
EXPOSE 5000

# Start Node auth service
CMD ["npm", "start"]
