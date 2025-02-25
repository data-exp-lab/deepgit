FROM node:18-alpine 

WORKDIR /app
COPY package.json package-lock.json ./
# Remove problematic dependencies and force a fresh install
RUN rm -rf node_modules package-lock.json && \
    npm cache clean --force && \
    npm install --force

CMD ["npm", "start"]