# VENDORA AI CHATBOT ARCHITECTURE

This document describes the design and integration of the domain-grounded Vendora AI Shopping Assistant.

## 1. Flow Diagram

```
[User Chat Widget]
       │  ▲
       │  │ (REST: POST /api/ai/chat)
       ▼  │
[Firebase Cloud Function: api]
       │
       ▼
[OpenRouter AI Gateway] (Gemini 2.5 Flash)
       │
       ▼ (Tool Calls)
 ┌─────┴───────────────────────────────────────────────────────┐
 │                                                             │
 ▼ (RAG Search)                                                ▼ (Structured Queries)
[searchVendoraKnowledgeBase]                                  [searchVendoraProducts]
 │                                                             │ (and getVendoraProduct, checkVendoraInventory,
 │                                                             │  getUserOrders, getVendoraReviews)
 ▼                                                             ▼
[Cosine Similarity Scan (vector_store.json)]                  [Firestore Database]
```

## 2. Component Design

### Frontend Component (`ChatWidget.jsx`)
- Built as a React floating component containing toggle modes for "Product Discovery" and "Help Center".
- Relies strictly on the backend API route `/api/ai/chat`. No client-side fallback calling OpenRouter directly is permitted.
- Renders rich interactive product cards including:
  - Product thumbnail
  - Title
  - Price (PKR)
  - Star Rating
  - Stock remaining status
  - Link directly to the item details via the `/product/:productId` route.

### Backend Orchestration (`functions/index.js`)
- Exposes a secure REST endpoint `api` via Firebase HTTP `onRequest` handlers.
- Enforces Rate Limiting (10 requests/min per IP) to prevent denial of service and API abuse.
- Inspects request `Authorization` header to authenticate the user and retrieve their UID securely from Firebase Auth.
- Implements standard system prompts directing the LLM to behave only as a Vendora Shopping Assistant and reject out-of-scope queries (general knowledge, prompt injection, etc.).

### Tools & Functions
The LLM selects and executes tools based on the user's intent:
1. **`searchVendoraProducts`**: Returns items matching criteria (category, min/max price, search keyword).
2. **`getVendoraProduct`**: Retrieves product details.
3. **`checkVendoraInventory`**: Fetches stock status.
4. **`getUserOrders`**: Accesses orders for the authenticated buyer (based on verified UID).
5. **`getVendoraVendor`**: Retrieves merchant business information.
6. **`getVendoraReviews`**: Retrieves product buyer reviews.
7. **`searchVendoraKnowledgeBase`**: Queries unstructured policy files.
8. **`getVendoraRecommendations`**: Pulls trending recommended products.

### Retrieval-Augmented Generation (RAG)
- Unstructured documentation (shipping policies, return guidelines, FAQs) are kept in `/functions/knowledge` as markdown.
- A build script (`build_rag.js`) chunks documents, fetches embeddings using OpenRouter's `openai/text-embedding-3-small` model, and compiles them into a fast, local index (`vector_store.json`).
- Similarity retrieval uses cosine similarity metrics on text vector embeddings to pull relevant policy contexts.
