# ---------- Frontend build ----------
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/pdf-upload-app/package*.json ./
RUN npm install
COPY frontend/pdf-upload-app .
RUN npm run build

# ---------- Backend ----------
FROM python:3.12-slim-bookworm
WORKDIR /app

RUN apt-get update && apt-get install -y \
    nginx \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend backend

# ---------- Nginx ----------
RUN rm -rf /usr/share/nginx/html/*
COPY --from=frontend-build /frontend/build /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD sh -c "nginx && uvicorn backend.main:app --host 0.0.0.0 --port 8000"
