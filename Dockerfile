FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps && npm install --save-dev rollup
COPY . .
RUN npm run build
CMD ["npm", "start"]
