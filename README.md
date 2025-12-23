# PDF Chat RAG Application

A full-stack application that allows users to upload PDFs and chat with them using
Retrieval-Augmented Generation (RAG).

## Tech Stack
- Frontend: React
- Backend: FastAPI
- Vector Store: FAISS
- Cache / Memory: Redis
- LLM: OpenAI
- Reverse Proxy: Nginx
- Deployment: Docker + Docker Compose

## Setup (Local)

```bash
cp .env.example .env
# add OPENAI_API_KEY
docker compose up --build
