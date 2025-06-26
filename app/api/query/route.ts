import { type NextRequest, NextResponse } from "next/server"
import { openai } from "@ai-sdk/openai"
import { generateText } from "ai"
import { QdrantClient } from "@qdrant/js-client-rest"

// Initialize Qdrant client
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY,
})

const COLLECTION_NAME = "documents"

// Surus AI embedding function (same as in documents route)
async function getSurusEmbedding(text: string, dimension = 768): Promise<number[]> {
  const response = await fetch(`${process.env.SURUS_API_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SURUS_API_KEY}`,
    },
    body: JSON.stringify({
      model: "nomic-ai/nomic-embed-text-v2-moe",
      input: text,
      dimensions: dimension,
    }),
  })

  if (!response.ok) {
    throw new Error(`Surus API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    // Get collection info to determine dimension
    const collectionInfo = await qdrant.getCollection(COLLECTION_NAME)
    const dimension = collectionInfo.config?.params?.vectors?.size || 768

    // Generate embedding for the query using Surus AI
    const embedding = await getSurusEmbedding(query, dimension)

    // Search for similar documents in Qdrant
    const searchResult = await qdrant.search(COLLECTION_NAME, {
      vector: embedding,
      limit: 5,
      score_threshold: 0.7,
    })

    // Extract relevant text chunks
    const relevantChunks = searchResult.map((result) => result.payload?.text).filter(Boolean)

    if (relevantChunks.length === 0) {
      return NextResponse.json({
        response: "I couldn't find any relevant information in the knowledge base to answer your question.",
        dimension,
        sources: 0,
      })
    }

    // Generate response using retrieved context (keeping OpenAI for generation)
    const context = relevantChunks.join("\n\n")

    const { text } = await generateText({
      model: openai("gpt-4o"),
      system: `You are a helpful assistant powered by Surus AI's efficient embedding models. 
               Answer questions based on the provided context from documents embedded using 
               matryoshka embeddings with ${dimension} dimensions.
               Use only the information from the context to answer questions. 
               If the context doesn't contain enough information to answer the question, say so.
               Be concise and accurate in your responses.`,
      prompt: `Context:
${context}

Question: ${query}

Answer:`,
    })

    return NextResponse.json({
      response: text,
      sources: relevantChunks.length,
      dimension,
      embeddingModel: "nomic-ai/nomic-embed-text-v2-moe",
    })
  } catch (error) {
    console.error("Error processing query:", error)
    return NextResponse.json({ error: "Failed to process query" }, { status: 500 })
  }
}
