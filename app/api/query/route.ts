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
  try {
    console.log("Query: Calling Surus API...")
    const res = await fetch(`${process.env.SURUS_API_URL}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SURUS_API_KEY}`,
      },
      body: JSON.stringify({
        model: "nomic-ai/nomic-embed-text-v2-moe",
        input: [text], // MUST be an array
        dimensions: dimension,
      }),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText)
      throw new Error(`Surus API ${res.status}: ${err}`)
    }

    const { data } = (await res.json()) as { data: { embedding: number[] }[] }
    return data[0].embedding
  } catch (err) {
    console.error("Surus embedding error:", err)
    throw err
  }
}

// OpenAI embedding function
async function getOpenAIEmbedding(text: string): Promise<number[]> {
  try {
    console.log("Query: Calling OpenAI API...")
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-large",
        input: text,
      }),
    })

    if (!response.ok) {
      const err = await response.text().catch(() => response.statusText)
      throw new Error(`OpenAI API ${response.status}: ${err}`)
    }

    const { data } = await response.json()
    return data[0].embedding
  } catch (err) {
    console.error("OpenAI embedding error:", err)
    throw err
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== Query request started ===")
    const { query } = await request.json()

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query is required" }, { status: 400 })
    }

    console.log("Query text:", query)

    // Get collection info to determine dimension
    const collectionInfo = await qdrant.getCollection(COLLECTION_NAME)
    const dimension = collectionInfo.config?.params?.vectors?.size || 768
    console.log("Collection dimension:", dimension)

    // Determine provider based on dimension (simple heuristic)
    const provider = dimension === 1536 ? "openai" : "surus"
    console.log("Detected provider:", provider)

    // Generate embedding for the query using detected provider
    const embedding =
      provider === "openai" ? await getOpenAIEmbedding(query) : await getSurusEmbedding(query, dimension)

    console.log("Generated embedding, length:", embedding.length)

    // Search for similar documents in Qdrant
    const searchResult = await qdrant.search(COLLECTION_NAME, {
      vector: embedding,
      limit: 5,
      score_threshold: 0.7,
    })

    console.log("Search results:", searchResult.length, "matches")

    // Extract relevant text chunks
    const relevantChunks = searchResult.map((result) => result.payload?.text).filter(Boolean)

    if (relevantChunks.length === 0) {
      return NextResponse.json({
        response: "I couldn't find any relevant information in the knowledge base to answer your question.",
        dimension,
        provider,
        sources: 0,
      })
    }

    // Generate response using retrieved context
    const context = relevantChunks.join("\n\n")

    const { text } = await generateText({
      model: openai("gpt-4o"),
      system: `You are a helpful assistant powered by ${provider === "openai" ? "OpenAI" : "Surus AI"} embedding models. 
             Answer questions based on the provided context from documents embedded using 
             ${provider === "openai" ? "OpenAI text-embedding-3-large" : `Surus matryoshka embeddings with ${dimension} dimensions`}.
             Use only the information from the context to answer questions. 
             If the context doesn't contain enough information to answer the question, say so.
             Be concise and accurate in your responses.`,
      prompt: `Context:
${context}

Question: ${query}

Answer:`,
    })

    console.log("=== Query completed successfully ===")

    return NextResponse.json({
      response: text,
      sources: relevantChunks.length,
      dimension,
      provider,
      embeddingModel: provider === "openai" ? "text-embedding-3-large" : "nomic-ai/nomic-embed-text-v2-moe",
    })
  } catch (error) {
    console.error("=== Query failed ===")
    console.error("Error processing query:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process query",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
