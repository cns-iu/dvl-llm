FROM node:18

# Install Chromium and necessary fonts/deps
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Use a non-root user for security
USER node

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY --chown=node:node package*.json ./

# Skip Puppeteer's own Chromium download and point it to the system install
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN npm install

# Copy the rest of the app
COPY --chown=node:node . .

# Expose the port
EXPOSE 5003

# Start the server
CMD ["npm", "start"]