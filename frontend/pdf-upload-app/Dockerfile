FROM node:20-alpine AS build
WORKDIR /app

COPY frontend/pdf-upload-app/package*.json ./
RUN npm install

COPY frontend/pdf-upload-app .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
