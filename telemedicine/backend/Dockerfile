FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig.json ./
COPY prisma ./prisma/
RUN npm install
COPY src ./src/
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 5001
CMD ["node", "dist/index.js"]

