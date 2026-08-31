# VENDORA AI CHATBOT 2.0 — PHASE 1: SYSTEM AUDIT

This document serves as the technical audit of the existing Vendora AI Chatbot system and the surrounding architecture of the Vendora Marketplace.

## 1. Existing System Audit

### 1.1 Architecture Flow (User -> React -> Backend -> OpenRouter -> Response)
The current chatbot implementation relies on a secure cloud-based architecture using Firebase Cloud Functions:
1. **Frontend (React)**: The `ChatWidget.jsx` component captures user input and maintains local state for the chat interface. It has two modes: `product_discovery` and `buyer_support`.
2. **Persistence (Firestore)**: The frontend attempts to save user messages and assistant responses to a Firestore subcollection: `users/{uid}/chats`.
3. **Backend Communication**: The React app makes a `fetch` POST request to the `/api/ai/chat` endpoint (proxied by Vite to the Firebase emulator), passing the conversation history and authentication token in the `Authorization` header.
4. **Cloud Function (REST API)**: The `functions/index.js` implements an `onRequest` Firebase Function. It includes CORS handling, a native in-memory rate limiter (max 10 requests per minute), and auth token validation using `admin.auth().verifyIdToken()`.
5. **LLM Engine**: The function communicates securely with OpenRouter using the `google/gemini-2.5-flash` model. It injects a strict system prompt. Product tools have been temporarily disabled to ensure a stable foundational architecture.
6. **Response & Sanitization**: The Cloud Function receives the final LLM text, sanitizes any hallucinated external URLs, and returns the response in a structured JSON payload.
7. **UI Rendering**: The `ChatWidget.jsx` component displays the text and safely handles loading and error states.

### 1.2 OpenRouter API Key Security
**The OpenRouter API key is NOT exposed to the browser.** 
It is safely stored in the backend environment variables (`functions/.env`) and is only accessed server-side within the `chatWithAssistant` Cloud Function (`process.env.OPENROUTER_API_KEY`).

### 1.3 Firebase Schema & Data Utilization
The chatbot interacts heavily with the following Firestore collections:
- **`products`**: Searched by the AI using the `searchVendoraProducts`, `getVendoraProduct`, and `checkVendoraInventory` tools. 
  - **Fields used**: `productId`, `vendorId`, `title`, `description`, `price`, `category`, `images`, `stock`, `variants`.
- **`orders`**: Queried by the AI via the `getUserOrders` tool based on the user's `buyerId`.
- **`users`**: The AI attempts to store chat history in the `users/{uid}/chats` subcollection.

### 1.4 Product Routing & URLs
Product URLs are generated in the React Router using the format: `/product/:id`. 
In `ChatWidget.jsx`, inline product links are created dynamically via `react-router-dom`'s `<Link>` component: `to={\`/product/\${prod.id}\`}`.

### 1.5 Authentication
Users are authenticated via Firebase Auth (Google Provider). The authentication state is managed by an `AuthContext`. 
The authenticated user's ID (`uid`) is passed securely to Cloud Functions through the `request.auth` object (Firebase Callable Functions automatically inject this).

### 1.6 Backend Architecture
A Node.js backend already exists in the form of Firebase Cloud Functions (`functions/index.js`). 
It handles orders (`placeOrder`), payments (`initiatePayment`), and the AI interactions (`chatWithAssistant`). There is no separate Express server; Firebase Functions act as the serverless API.

---

## 2. Security Problems Identified

1. **Firestore Rules Missing for Chat History**:
   - The frontend `ChatWidget.jsx` attempts to save messages to `users/{uid}/chats`.
   - The `firestore.rules` file has explicit rules for the `users` collection and the `notifications` subcollection, but **lacks any rules for the `chats` subcollection**. 
   - **Impact**: In a production environment with enforced rules, all attempts to save chat history will fail with "Permission Denied", breaking chat persistence.
   
2. **Env Variable Fallback in Cloud Function**:
   - The cloud function checks for `process.env.VITE_OPENROUTER_API_KEY`. It is generally bad practice to prefix backend secrets with `VITE_` as it implies they might be leaked to the Vite build if misconfigured on the frontend.

---

## 3. Recommended Target Architecture

To build Vendora AI Chatbot 2.0, the architecture should be refined for better performance, richer UI interactions, and streaming capabilities.

- **Streaming Responses**: Migrate the `chatWithAssistant` function to support Server-Sent Events (SSE) or use the Gemini API streaming capabilities directly to reduce perceived latency.
- **Enhanced Context Awareness**: Inject user cart state and recent browsing history into the initial system prompt payload.
- **Robust Multi-Agent or Advanced Tooling**: Expand the toolset to allow the AI to directly add items to the user's cart or initiate a return/dispute process.
- **Vector Search (Optional)**: If the product catalog grows large, replace simple Firestore keyword matching (which is highly inefficient and case-sensitive) with a proper Vector Database (e.g., Pinecone or Firebase Vector Search using Vertex AI) for semantic product discovery.

---

## 4. File Modification Strategy

### 4.1 Files That Need Modification
1. **`src/components/ChatWidget.jsx`**: Will need updates for the 2.0 UI overhaul, improved state management, streaming support, and potentially richer multimodal inputs (e.g., image search).
2. **`functions/index.js`**: Needs updates to expand the AI tools, improve error handling, fix URL sanitization, and potentially switch to streaming.
3. **`firestore.rules`**: MUST be updated to explicitly allow `read`/`write` access to the `users/{userId}/chats` subcollection for the owner.

### 4.2 Files That Should Remain Untouched (For Now)
1. **`src/services/firebase.js`**: Initialization is standard and correct.
2. **`src/App.jsx`**: Routing structure is solid.
3. **`functions/package.json`**: Unless new backend SDKs (like vector search clients) are needed.
4. **`.env` and `functions/.env`**: Existing secrets structure is fundamentally sound.

### 4.3 Dependencies That May Be Needed
- **Frontend**: 
  - `react-markdown` (for better rich-text rendering of AI responses).
  - `framer-motion` (for advanced 2.0 fluid animations).
- **Backend**:
  - Optional: `@google/genai` (if migrating away from OpenRouter to direct Gemini API for native features like structured output or streaming).

### 4.4 Implementation Risks
1. **Latency**: Complex tool calling via OpenRouter adds significant latency (2-4 seconds per turn). Without streaming, users may abandon the chat.
2. **Firestore Query Limitations**: The current text-matching in `searchVendoraProducts` relies on `prodData.title?.toLowerCase().includes(kw)`. Pulling the entire collection into memory to filter it in Node.js will cause massive memory/performance bottlenecks and cost spikes as the product catalog grows.
3. **Hallucinations**: Despite the system prompt, the LLM might hallucinate product variants or promise policies that contradict the actual store policies. Strict structured outputs are required.
