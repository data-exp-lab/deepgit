FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN rm -rf node_modules && npm install --legacy-peer-deps
COPY . .
RUN npm run build
CMD ["npm", "start"]
