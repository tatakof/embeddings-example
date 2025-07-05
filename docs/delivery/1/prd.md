# PBI-1: End-to-End Chatbot Experience

## Overview
Provide a polished chatbot interface and supporting backend endpoint that leverages the existing RAG retrieval pipeline. Users can evaluate different embedding models and then chat naturally with their knowledge base.

## Problem Statement
The current demo proves retrieval works but offers no conversational interface, memory, or persistent sessions. Users cannot evaluate embeddings in a natural chat flow.

## User Stories
1. As a data scientist I want to chat with my indexed documents so I can verify retrieval quality in a realistic conversation.
2. As a developer I want to choose embedding provider/dimension per session so I can compare cost/performance.
3. As a user I want the chat to remember context so I don't repeat myself.

## Technical Approach
- Backend: new `/api/chat` route that wraps existing `/api/query`, maintains short-term memory and streams responses.
- Frontend: new Chat page with bubbles, streaming, citations sidebar, model lab panel, localStorage persistence.
- Memory window: last 6 user+assistant messages, truncated to max 1000 tokens.

## UX/UI Considerations
- Clean chat layout inspired by messenger interfaces.
- Model lab collapsible sidebar.
- Sources appear as footnotes or side panel.

## Acceptance Criteria
- A user can index documents then start a chat, receive grounded answers with citations.
- Switching provider/dimension in model lab affects subsequent turns.
- Chat survives page reload via localStorage.
- Memory window limits enforced.
- E2E test passes: indexing → chat → citations.

## Dependencies
Existing RAG endpoints `/api/documents` and `/api/query`.

## Open Questions
- Should chat support streaming tokens?
- Maximum memory size?

## Related Tasks
See task list. 