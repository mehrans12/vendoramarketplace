# Vendora — The AI-Powered Artisan Marketplace

Vendora is an advanced, AI-driven digital marketplace built to connect local artisans, craftsmen, and traditional vendors with global buyers. By leveraging state-of-the-art Generative AI, natural language search, intelligent product quality assurance, and automated fraud prevention, Vendora creates a secure, personalized, and seamless shopping experience.

## Overview

Vendora operates across three distinct user roles:

- **Buyers**: Experience a highly personalized shopping interface featuring dynamic AI recommendations, semantic search, and an AI Shopping Assistant capable of understanding complex, natural-language queries.
- **Vendors**: Manage inventory effortlessly with AI-assisted product listing, automatic translation, image generation, and a dedicated AI Copilot for operational insights and optimization strategies.
- **Administrators**: Maintain platform integrity through an advanced, centralized Admin Dashboard equipped with an AI Admin Copilot, automated Trust Score systems, real-time safety logs, and a unified health monitor.

## Core Features & AI Integration

1. **Intelligent Search Engine**: Traditional keyword search is replaced by semantic, natural-language AI retrieval (RAG) that understands intent, context, and nuance.
2. **AI Shopping Assistant**: An interactive chat interface that guides buyers, recommends products dynamically, and answers questions using a conversational multi-turn AI context.
3. **Automated Fraud & Trust Engine**: Vendors are continuously evaluated via a dynamic Trust Score algorithm. Fraud detection models proactively scan activities, alerting admins to anomalies or high-risk behavior in real time.
4. **Product Intelligence**: Vendor listings are automatically audited for quality, relevance, and safety. AI automatically generates SEO-optimized descriptions and performs multi-language translations (e.g., English/Urdu).
5. **Observability & Analytics**: The platform captures granular events securely, streaming analytics data into comprehensive dashboards without compromising user privacy. 

## Technology Stack

- **Frontend**: React (Vite/Rolldown), vanilla CSS with CSS Variables for theme management, Lucide React icons.
- **Backend**: Firebase Cloud Functions (Node.js).
- **Database**: Firebase Firestore (NoSQL document database) for state, users, and catalog.
- **Storage**: Firebase Cloud Storage for product imagery and media.
- **Authentication**: Firebase Auth (Email/Password, Google).
- **AI Integration**: Custom abstraction layer utilizing Google Gemini or compatible large language models for RAG, embeddings, generation, and multi-turn chat.

## Getting Started

### Prerequisites

- Node.js (v18+)
- NPM or Yarn
- Firebase CLI (`npm install -g firebase-tools`)

### Local Setup

1. **Install Dependencies**
   ```bash
   npm install
   cd functions && npm install
   ```

2. **Configure Environment Variables**
   Create a `.env` file in the root directory for frontend settings (e.g., `VITE_FIREBASE_API_KEY`, etc.).
   Create a `.env` in the `functions/` directory for backend secrets (e.g., `AI_API_KEY`).

3. **Run the Development Server**
   ```bash
   npm run dev
   ```

4. **Deploy to Firebase**
   ```bash
   npm run build
   firebase deploy
   ```

## Security & Architecture

Vendora employs a security-first architecture. For a comprehensive overview of the system design, authorization flows, database schema, and monitoring strategies, please refer to [ARCHITECTURE.md](ARCHITECTURE.md).
