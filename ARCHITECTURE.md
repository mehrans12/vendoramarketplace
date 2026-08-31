# Vendora Architecture & Security Guide

## 1. High-Level Architecture

Vendora is designed as a serverless, decoupled application consisting of three primary layers:
1. **Presentation Layer (Client):** A Vite-powered React single-page application (SPA).
2. **Business Logic Layer (Cloud):** Node.js Firebase Cloud Functions orchestrating AI interactions, secure data operations, and event processing.
3. **Data & Storage Layer (Backend):** Firebase Firestore for NoSQL document storage and Firebase Cloud Storage for unstructured media.

## 2. Component Design & Patterns

### 2.1 Frontend State & Routing
- **Routing**: Client-side routing maps directly to user personas (e.g., `/`, `/buyer/*`, `/vendor/*`, `/admin/*`).
- **Context API**: Global state management (Authentication, Global Loading, Notifications) is handled via React Context.
- **Service Abstraction**: Direct database access from the client is heavily abstracted. Complex operations invoke backend Cloud Functions via `httpsCallable`.

### 2.2 Artificial Intelligence Subsystem
The AI layer is integrated symmetrically across the client and server.
- **RAG & Embeddings**: Product descriptions and search queries are embedded using AI models. Semantic search logic is securely executed on the backend.
- **Copilot Interfaces**: Interactive AI agents (Shopping Assistant, Vendor Copilot, Admin Copilot) stream responses through secure APIs, sandboxed by system instructions.
- **Quality Assurance**: Automated AI agents evaluate product images, flag policy violations, and parse content asynchronously on document creation.

## 3. Data Schema (Firestore)

Vendora utilizes flat, collection-oriented data structures with appropriate indexing.
- **`users`**: Role-based profiles (`role: 'BUYER' | 'VENDOR' | 'ADMIN'`).
- **`products`**: Catalog items containing arrays of embedding vectors, localized titles/descriptions, pricing, and nested metrics.
- **`orders`**: Transaction records linking buyer ID, vendor ID, and product IDs.
- **`system_logs`**: Write-only telemetry data for operational monitoring.
- **`analytics`**: Aggregated performance metrics computed asynchronously.

## 4. Security Hardening & Authorization

Security is enforced at multiple boundaries:

### 4.1 Server-Side Authorization
Client-side role checks (hiding UI buttons) are purely for user experience. True authorization occurs exclusively on the server:
- **Cloud Functions Middleware**: Every protected HTTPS function verifies the decoded Auth token and asserts the user's role before processing the payload.
- **Firestore Security Rules**: Strict read/write policies ensure:
  - Buyers can only access their own private data and orders.
  - Vendors can only create, update, or delete their own inventory.
  - Admins exclusively possess read/write access to sensitive collections like `system_logs` and Trust Scores.

### 4.2 Data Sanitization
- All backend operations explicitly destructure expected fields to prevent mass-assignment vulnerabilities.
- Logger utilities perform recursive redaction on object payloads to scrub sensitive keys (`password`, `token`, `secret`, `credit_card`) before persistence.

### 4.3 Storage Security
- Firebase Storage Rules restrict file uploads to validated content types (`image/jpeg`, `image/png`, `image/webp`).
- Max payload size checks are enforced to mitigate denial-of-service (DoS) via massive uploads.

### 4.4 AI Security
- **Prompt Injection Defense**: System prompts use strict context boundaries and explicitly instruct the LLM to refuse manipulative directives.
- **Tool Access**: AI models cannot execute unvetted functions. Callable tools are strictly mapped to predefined, type-checked backend services.

## 5. Observability & Performance

### 5.1 Monitoring
- A centralized backend logger intercepts operational errors, AI generation failures, authentication anomalies, and payment issues.
- Logs are stamped with categorized severities (`ERROR`, `WARN`, `INFO`) and rendered visually in the Admin Dashboard.

### 5.2 Performance Optimization
- **Pagination**: Large Firestore collections (`products`, `orders`) implement cursor-based pagination.
- **Lazy Loading**: React Components and heavy assets (images) are asynchronously loaded to optimize Initial Time to Interactive (TTI).
- **Caching**: AI embeddings and frequently accessed configurations are cached where appropriate to reduce redundant API calls and token usage.

## 6. Future Extensibility
The modular Cloud Functions design allows seamless integration of future enhancements (e.g., third-party payment gateways like Stripe/JazzCash, SMS notifications, and multi-region deployment capabilities) without refactoring the core client logic.
