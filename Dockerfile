FROM node:18-alpine 

WORKDIR /app

COPY package.json package-lock.json ./

# Remove problematic dependencies and force a fresh install
RUN rm -rf node_modules package-lock.json && \
    npm cache clean --force && \
    npm install --force

COPY . .

EXPOSE 5173
ENV PORT=5173
ENV HOST=0.0.0.0

CMD ["npm", "start"]
