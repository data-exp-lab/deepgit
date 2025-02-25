# Use a minimal Node.js image
FROM node:18-alpine 

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install --force

# Copy the entire application
COPY . .

# Build the frontend
RUN npm run build

# Expose a port (Render provides it dynamically)
EXPOSE 5173

# Ensure the correct host and port are set
ENV HOST=0.0.0.0
ENV BASE_PATH=/deepgit

# Render assigns a PORT dynamically, so we use it
CMD ["sh", "-c", "npm start -- --port $PORT --host 0.0.0.0"]
