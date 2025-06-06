# Use Node.js base image
FROM node:20

# Set working directory inside container
WORKDIR /app

# Copy dependency definitions
COPY package.json ./

# Install dependencies
RUN npm install

# Copy rest of the application (e.g., app/main.js, templates, etc.)
COPY . .

# Expose port for service
EXPOSE 5003

# Run the service
CMD ["node", "app/main.js"]