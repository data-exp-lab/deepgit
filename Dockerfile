FROM seanyl/deepgit:app

WORKDIR /app

# Remove problematic dependencies and force a fresh install
RUN rm -rf node_modules package-lock.json && \
    npm cache clean --force && \
    npm install --force

CMD ["npm", "start"]