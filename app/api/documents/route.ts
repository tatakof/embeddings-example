import { type NextRequest, NextResponse } from "next/server"
import { QdrantClient } from "@qdrant/js-client-rest"

// Initialize Qdrant client
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY,
})

const COLLECTION_NAME = "documents"

// Surus AI embedding function
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
      dimensions: dimension, // Matryoshka embedding dimension
    }),
  })

  if (!response.ok) {
    throw new Error(`Surus API error: ${response.statusText}`)
  }

  const data = await response.json()
  return data.data[0].embedding
}

// Calculate storage costs
function calculateStorageCosts(vectorCount: number, dimension: number) {
  const bytesPerFloat = 4 // 32-bit float
  const bytesPerVector = dimension * bytesPerFloat
  const totalBytes = vectorCount * bytesPerVector
  const totalMB = totalBytes / (1024 * 1024)

  // Estimated Qdrant storage cost (approximate)
  const costPerMBPerMonth = 0.001 // $0.001 per MB per month (example)
  const monthlyCost = totalMB * costPerMBPerMonth

  return {
    totalVectors: vectorCount,
    storageSize: totalMB > 1024 ? `${(totalMB / 1024).toFixed(2)} GB` : `${totalMB.toFixed(2)} MB`,
    monthlyCost: `$${monthlyCost.toFixed(4)}`,
  }
}

// Ensure collection exists
async function ensureCollection(dimension: number) {
  try {
    await qdrant.getCollection(COLLECTION_NAME)
  } catch (error) {
    // Collection doesn't exist, create it
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: dimension, // Dynamic dimension based on matryoshka embedding
        distance: "Cosine",
      },
    })
  }
}

// Simple text chunking function
function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const chunks: string[] = []
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)

  let currentChunk = ""

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (currentChunk.length + trimmedSentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      // Keep some overlap
      const words = currentChunk.split(" ")
      currentChunk = words.slice(-overlap / 10).join(" ") + " " + trimmedSentence
    } else {
      currentChunk += (currentChunk ? " " : "") + trimmedSentence
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter((chunk) => chunk.length > 20) // Filter out very short chunks
}

export async function POST(request: NextRequest) {
  try {
    const { content, dimension = 768 } = await request.json()

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Ensure collection exists with correct dimension
    await ensureCollection(dimension)

    // Chunk the document
    const chunks = chunkText(content)

    // Generate embeddings for each chunk using Surus AI
    const embeddings = await Promise.all(
      chunks.map(async (chunk) => {
        return await getSurusEmbedding(chunk, dimension)
      }),
    )

    // Store chunks and embeddings in Qdrant
    const points = chunks.map((chunk, index) => ({
      id: Date.now() + index,
      vector: embeddings[index],
      payload: {
        text: chunk,
        timestamp: new Date().toISOString(),
        dimension: dimension,
      },
    }))

    await qdrant.upsert(COLLECTION_NAME, {
      wait: true,
      points,
    })

    // Get current vector count for cost calculation
    const collectionInfo = await qdrant.getCollection(COLLECTION_NAME)
    const vectorCount = collectionInfo.points_count || chunks.length
    const costMetrics = calculateStorageCosts(vectorCount, dimension)

    return NextResponse.json({
      message: "Document indexed successfully",
      chunks: chunks.length,
      dimension: dimension,
      costMetrics,
    })
  } catch (error) {
    console.error("Error indexing document:", error)
    return NextResponse.json({ error: "Failed to index document" }, { status: 500 })
  }
}
