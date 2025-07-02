# Qdrant Rag pipeline example

*Automatically synced with your [v0.dev](https://v0.dev) deployments*

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/tatakofs-projects/v0-qdrant-rag-pipeline-example)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.dev-black?style=for-the-badge)](https://v0.dev/chat/projects/3moMyhzZBDy)


# To run 

launch qdrant locally:

```bash
sudo docker run --rm -p 6333:6333 qdrant/qdrant
```
you can get into qdrant's instance at http://localhost:6333/dashboard

launch app:

```bash
pnpm dev
```

go into the app at http://localhost:3000/





# Overview

┌─────────────────┐    API calls    ┌─────────────────┐
│   Next.js App   │ ──────────────> │  Qdrant Vector  │
│  (port 3000)    │                 │  Database       │
│                 │ <────────────── │  (port 6333)    │
└─────────────────┘                 └─────────────────┘


────────────────────────────────────────────────────────
1. Top-level architecture
────────────────────────────────────────────────────────
• Full-stack Next.js 15 (App Router, React 19, server actions & Route Handlers)  
• Vector store: Qdrant (REST client, runs locally by default at http://localhost:6333)  
• Embedding providers (runtime-selectable):
  – Surus AI “matryoshka” model (128 / 256 / 512 / 768 dims)  
  – OpenAI text-embedding-3-large (1536 dims)  
• LLM for answer generation: GPT-4o invoked through `@ai-sdk/openai → ai.generateText()`  
• Styling & UI kit: Tailwind CSS + Radix + `components/ui/*` scaffolded from v0.dev  
• Build tooling: pnpm / TypeScript / Tailwind / PostCSS  
• No database other than Qdrant; metadata is stored as payloads on points.

────────────────────────────────────────────────────────
2. High-level data flow
────────────────────────────────────────────────────────
A. Document indexing (`POST /api/documents`)
   1. Request body: `{content, dimension?, provider?}` from the client.  
   2. Server route logic:
      • `chunkText()` splits prose into ~500-char overlapping chunks.  
      • For each chunk an embedding is requested from Surus or OpenAI.  
      • `ensureCollection()` guarantees a Qdrant collection exists using the chosen dimension.  
      • Chunks + vectors are upserted into the collection.  
      • Storage-cost metrics are calculated (simple in-memory formula).  
   3. Response contains `{chunks, dimension, provider, costMetrics}`.  
   4. The client adds the raw document to local React state and shows cost comparison.

B. Querying (`POST /api/query`)
   1. Request body: `{query}`.  
   2. Server route logic:
      • Reads collection config to infer embedding dimension ⇒ provider (heuristic).  
      • Generates a query embedding.  
      • Vector similarity search (limit 5, score ≥ 0.7).  
      • Concats retrieved chunks into a contextual prompt.  
      • Calls GPT-4o with a system prompt that instructs grounding to the provided context.  
      • Returns `{response, sources, dimension, provider, embeddingModel}`.

Client UI (`app/page.tsx`)
   • Two tabs: “Manage Documents” & “Query Knowledge Base”.  
   • Indexed documents are tracked only client-side; they are not fetched back from Qdrant on reload (state would be lost on refresh).  
   • Embedding provider & dimension selectors are surfaced only in the “Add Document” form.  
   • `components/CostComparison.tsx` renders a live price/size dashboard comparing the five dimension options.

────────────────────────────────────────────────────────
3. Key code locations
────────────────────────────────────────────────────────
• `app/api/documents/route.ts` – all indexing, chunking, embedding, upsert, cost logic  
• `app/api/query/route.ts`     – retrieval + GPT synthesis  
• `app/page.tsx`               – core client experience  
• `components/cost-comparison.tsx` – storage-cost UI widget  
• `lib/utils.ts`               – tailwind class concatenator (`cn`)  

────────────────────────────────────────────────────────
4. Environment variables expected
────────────────────────────────────────────────────────
OPENAI_API_KEY          – OpenAI account key  
SURUS_API_KEY           – Surus AI key  
SURUS_API_URL           – e.g. https://api.surus.ai  
QDRANT_URL              – Qdrant endpoint (default localhost:6333)  
QDRANT_API_KEY          – optional if using a cloud Qdrant instance  

Missing any of the above will surface as 500s from the route handlers.

────────────────────────────────────────────────────────
5. Observed strengths
────────────────────────────────────────────────────────
• Very small surface area: only two backend endpoints; easy to reason about.  
• Provider-agnostic vector dimension; Surus matryoshka makes storage trade-off easy.  
• Cost transparency: the UI shows realtime cost deltas per dimension.  
• Clear logging (console) for each major operation step; helpful for debugging.

────────────────────────────────────────────────────────
6. Potential gaps / next steps (if the project is to be hardened)
────────────────────────────────────────────────────────
1. Persistence of document list  
   – The React state is ephemeral; refreshing the browser loses the “Indexed Documents” view.  
   – Either hydrate from `qdrant.getPoints()` on page load or persist metadata in a database.

2. Duplicate document handling  
   – Same text indexed twice will produce duplicate chunks & vectors. Can hash chunk content to dedupe.

3. Scaling & performance  
   – Chunking and embedding are all awaited serially; batching or parallelism would speed up indexing.  
   – Qdrant `id` currently uses `Date.now()+index`; consider UUIDs to avoid collisions in high-throughput scenarios.

4. Query quality  
   – Retrieval limit fixed at 5 and score threshold set to 0.7; could be exposed as tunables.  
   – No reranking or metadata filters.

5. Security / rate-limits  
   – No auth on any route; any visitor can index documents and exhaust keys.  
   – Suggest adding basic auth or session checks before allowing writes.

6. Testing  
   – No unit / integration tests are present (`test/` folders are absent).  
   – If adopting the Testing Strategy from the project policy, start by unit-testing `chunkText()` and an integration test that mocks Surus/OpenAI and asserts a point is upserted.

────────────────────────────────────────────────────────
7. Summary
────────────────────────────────────────────────────────
This repository is a concise reference implementation of a RAG pipeline:

Frontend: Next.js single page that lets users POST documents and issue queries.  
Backend: Two route handlers that (a) embed & store documents in Qdrant, (b) perform similarity search and feed the results to GPT-4o for answer generation.  
The code is clean, mostly self-contained, and uses only hosted services plus a local Qdrant instance.  

Let me know if you’d like deeper dives into specific areas (e.g., chunking strategy, vector-store schema design, production deployment hardening, or adding tests).























## Overview

This repository will stay in sync with your deployed chats on [v0.dev](https://v0.dev).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.dev](https://v0.dev).

## Deployment

Your project is live at:

**[https://vercel.com/tatakofs-projects/v0-qdrant-rag-pipeline-example](https://vercel.com/tatakofs-projects/v0-qdrant-rag-pipeline-example)**

## Build your app

Continue building your app on:

**[https://v0.dev/chat/projects/3moMyhzZBDy](https://v0.dev/chat/projects/3moMyhzZBDy)**

## How It Works

1. Create and modify your project using [v0.dev](https://v0.dev)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository
