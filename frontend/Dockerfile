# this Dockerfile defines a multi-stage build for the Thrifter frontend application. The first stage uses a Node.js image to build the application, while the second stage uses an Nginx image to serve the built files.
# Build step
FROM node:18 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

# Serve step
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
