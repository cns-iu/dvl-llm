# Step 1: Build the Angular app
FROM node:18 as build

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Use production configuration explicitly
RUN npm run build -- --configuration=production

# Step 2: Serve the built Angular app using nginx
FROM nginx:alpine

# Copy the correct static output folder
COPY --from=build /app/dist/client/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
