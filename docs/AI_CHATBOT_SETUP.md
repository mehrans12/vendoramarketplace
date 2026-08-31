# VENDORA AI CHATBOT SETUP

This document outlines the setup steps for running and deploying the grounded Vendora AI Assistant.

## 1. Environment Configuration

The secure architecture keeps all API keys strictly server-side.

### Backend (`functions/.env`)
Create a `.env` file under the `/functions` directory and add your Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### Frontend (`.env`)
No AI keys are needed in the frontend! All AI communications are securely proxied.

---

## 2. RAG Index Compilation

To compile vector store indexes for the static policy guidelines:

1. Navigate to the project root:
   ```bash
   # From root
   node functions/build_rag.js
   ```
2. The script processes markdown files under `functions/knowledge/` and compiles them into `functions/knowledge/vector_store.json`.

---

## 3. Local Development

Start the Firebase emulators and the Vite development server:

```bash
# Terminal 1: Firebase Emulators
npm run serve --prefix functions

# Terminal 2: React Dev Server
npm run dev
```

The Vite proxy (`vite.config.js`) will route client requests from `/api/` to your local emulator endpoint at `http://127.0.0.1:5001/vendora-5fadc/us-central1/api/`.

---

## 4. Production Deployment

Deploy the Cloud Functions to Firebase:
```bash
firebase deploy --only functions
```
Ensure your backend environment config variables are populated in your live Firebase Functions dashboard environment settings.
