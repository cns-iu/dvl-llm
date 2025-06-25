# Use official Node.js LTS image
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the entire app source
COPY . .

# Create output folder and make it writable
# RUN mkdir -p output && chmod -R 777 output

# Expose the port (adjust if needed)
EXPOSE 5003

# Start the server
CMD ["npm", "start"]
