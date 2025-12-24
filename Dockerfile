# -------------------------------
# Stage 1: Build React frontend
# -------------------------------
FROM node:20-bookworm AS frontend-build

WORKDIR /frontend
COPY frontend/pdf-upload-app/package*.json ./
RUN npm install
COPY frontend/pdf-upload-app/ ./
RUN npm run build


# -------------------------------
# Stage 2: Final image (Python + Nginx)
# -------------------------------
FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y \
    nginx \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# backend
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python - <<EOF
import nltk
nltk.download('punkt')
nltk.download('punkt_tab')
EOF
COPY backend ./backend

# -------------------------------
# Frontend
# -------------------------------
RUN rm -rf /usr/share/nginx/html/*
RUN rm -f /etc/nginx/sites-enabled/default
COPY --from=frontend-build /frontend/build/ /usr/share/nginx/html/

# -------------------------------
# Nginx config
# -------------------------------
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/app.conf

EXPOSE 80

# start both services
CMD sh -c "nginx && uvicorn backend.main:app --host 0.0.0.0 --port 8000"
