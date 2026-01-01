# 📄 PDF Chat RAG Application

**Enterprise-Ready Retrieval-Augmented Generation (RAG) Chatbot for PDFs**

A full-stack application that allows users to upload PDF documents and interact with them using natural language.  
All answers are generated **strictly from the PDF content** using a Retrieval-Augmented Generation (RAG) pipeline powered by embeddings and vector search.

---

## 🚀 Highlights

- FastAPI backend for RAG orchestration
- React frontend for chat-based interaction
- FAISS vector store for semantic retrieval
- Redis for caching and session context
- OpenAI (configurable LLM provider)
- Docker & Docker Compose for local and prod setups
- NGINX reverse proxy

---

## 🧠 Architecture Overview

```text
+-------------+       +----------------+       +-------------+
|   Frontend  | <---> |    FastAPI     | <---> |    Redis    |
|   (React)   |       |   Backend API  |       |   Cache     |
+-------------+       +----------------+       +-------------+
                              |
                              v
                         +-----------+
                         |   FAISS   |
                         | Vector DB |
                         +-----------+
                              |
                              v
                         +-------------+
                         |   OpenAI    |
                         |   LLM/API   |
                         +-------------+


pdf-chat-rag-app/
│
├── backend/
│   ├── app/
│   │   ├── api/                # FastAPI route definitions
│   │   ├── services/           # Ingestion, embeddings, retrieval, LLM logic
│   │   ├── db/                 # FAISS & Redis adapters
│   │   ├── models/             # Pydantic & domain models
│   │   ├── core/               # Config, logging, exceptions
│   │   └── tests/              # Unit & integration tests
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/         # UI components
│   │   ├── pages/              # Page-level views
│   │   ├── services/           # API calls
│   │   └── utils/              # Helpers
│   ├── package.json
│   └── vite.config.js
│
├── nginx/
├── docker-compose.yml
├── .env.example
└── README.md

```

## 📌 Features

- Upload and process PDF documents  
- Automatic text extraction and chunking  
- Vector embedding generation  
- Semantic similarity search using FAISS  
- Chat-based Q&A interface  
- Conversation context retention  
- Redis caching for performance  
- Containerized deployment  

---

## 🛠️ Prerequisites

Ensure you have the following installed:

- Docker & Docker Compose  
- OpenAI API Key (or compatible LLM provider)  
- Node.js (for local frontend development)  

---

## ⚙️ Setup & Run (Docker)

### 1. Clone the repository

```bash
git clone https://github.com/knirantar/pdf-chat-rag-app.git
cd pdf-chat-rag-app


cp .env.example .env


OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL_NAME=gpt-4o-mini
EMBEDDING_MODEL_NAME=text-embedding-3-small
REDIS_URL=redis://redis:6379/0


docker compose up --build
