import { type NextRequest, NextResponse } from "next/server"
import { QdrantClient } from "@qdrant/js-client-rest"

// Initialize Qdrant client
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY,
})

// Generate collection name based on provider and dimension
function getCollectionName(provider: string, dimension: number): string {
  return `documents_${provider}_${dimension}d`
}

// Surus AI embedding function
async function getSurusEmbedding(text: string, dimension = 768): Promise<number[]> {
  try {
    console.log("Calling Surus API with:", {
      url: `${process.env.SURUS_API_URL}/v1/embeddings`,
      hasApiKey: !!process.env.SURUS_API_KEY,
      dimension,
      textLength: text.length,
    })

    const res = await fetch(`${process.env.SURUS_API_URL}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SURUS_API_KEY}`,
        Accept: "application/json",
        "Accept-Encoding": "identity",
      },
      body: JSON.stringify({
        model: "nomic-ai/nomic-embed-text-v2-moe",
        input: [text],
        dimensions: dimension,
      }),
    })

    console.log("Surus API response status:", res.status)

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText)
      console.error("Surus API error response:", err)
      throw new Error(`Surus API ${res.status}: ${err}`)
    }

    const data = await res.json()
    console.log("Surus API success, embedding length:", data.data?.[0]?.embedding?.length)
    return data.data[0].embedding
  } catch (err) {
    console.error("Surus embedding error:", err)
    throw new Error(`Surus embedding failed: ${err instanceof Error ? err.message : "Unknown error"}`)
  }
}

// OpenAI embedding function
async function getOpenAIEmbedding(text: string): Promise<number[]> {
  try {
    console.log("Calling OpenAI API with:", {
      hasApiKey: !!process.env.OPENAI_API_KEY,
      textLength: text.length,
    })

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

    console.log("OpenAI API response status:", response.status)

    if (!response.ok) {
      const err = await response.text().catch(() => response.statusText)
      console.error("OpenAI API error response:", err)
      throw new Error(`OpenAI API ${response.status}: ${err}`)
    }

    // Parse JSON safely and extract the embedding vector
    const { data } = (await response.json()) as { data: { embedding: number[] }[] }
    console.log("OpenAI API success, embedding length:", data?.[0]?.embedding?.length)
    return data[0].embedding
  } catch (err) {
    console.error("OpenAI embedding error:", err)
    throw new Error(`OpenAI embedding failed: ${err instanceof Error ? err.message : "Unknown error"}`)
  }
}

// Calculate storage costs
function calculateStorageCosts(vectorCount: number, dimension: number, baseline: number) {
  const bytesPerFloat = 4 // 32-bit float
  const bytesPerVector = dimension * bytesPerFloat
  const totalBytes = vectorCount * bytesPerVector
  const totalMB = totalBytes / (1024 * 1024)

  // Estimated Qdrant storage cost (approximate)
  const costPerMBPerMonth = 0.001 // $0.001 per MB per month (example)
  const monthlyCost = totalMB * costPerMBPerMonth

  // Calculate baseline cost for comparison (always OpenAI 1536D)
  const baselineBytes = vectorCount * baseline * bytesPerFloat
  const baselineMB = baselineBytes / (1024 * 1024)
  const baselineCost = baselineMB * costPerMBPerMonth
  const savingsPercent = baseline !== dimension ? ((baselineCost - monthlyCost) / baselineCost) * 100 : 0

  return {
    totalVectors: vectorCount,
    storageSize: totalMB > 1024 ? `${(totalMB / 1024).toFixed(2)} GB` : `${totalMB.toFixed(2)} MB`,
    monthlyCost: `$${monthlyCost.toFixed(4)}`,
    savingsPercent: savingsPercent > 0 ? `${savingsPercent.toFixed(0)}% savings vs OpenAI 1536D` : null,
  }
}

// Ensure collection exists
async function ensureCollection(provider: string, dimension: number) {
  const collectionName = getCollectionName(provider, dimension)
  try {
    console.log("Checking if collection exists...")
    const existingCollection = await qdrant.getCollection(collectionName)
    const existingDimension = existingCollection.config?.params?.vectors?.size
    
    if (existingDimension && existingDimension !== dimension) {
      console.log(`Collection exists with dimension ${existingDimension}, but need ${dimension}. Deleting and recreating...`)
      await qdrant.deleteCollection(collectionName)
      // Create new collection with correct dimension
      await qdrant.createCollection(collectionName, {
        vectors: {
          size: dimension, // Dynamic dimension based on matryoshka representation learning
          distance: "Cosine",
        },
      })
      console.log("Collection recreated with correct dimension:", dimension)
    } else {
      console.log(`Collection ${collectionName} exists with correct dimension:`, existingDimension)
    }
  } catch (error) {
    console.log(`Collection ${collectionName} doesn't exist, creating it with dimension:`, dimension)
    // Collection doesn't exist, create it
    await qdrant.createCollection(collectionName, {
      vectors: {
        size: dimension, // Dynamic dimension based on matryoshka representation learning
        distance: "Cosine",
      },
    })
    console.log(`Collection ${collectionName} created successfully`)
  }
}

// Simple text chunking function
function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const chunks: string[] = []
  
  // For very short texts or texts without sentence endings, treat as single chunk
  if (text.trim().length <= 50 || !/[.!?]/.test(text)) {
    return text.trim().length > 0 ? [text.trim()] : []
  }
  
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
    console.log("=== Document indexing request started ===")

    const body = await request.json()
    const { content, dimension = 768, provider = "surus" } = body

    console.log("Request params:", {
      contentLength: content?.length,
      dimension,
      provider,
      hasContent: !!content,
    })

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    // Check environment variables
    console.log("Environment check:", {
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasSurusKey: !!process.env.SURUS_API_KEY,
      surusUrl: process.env.SURUS_API_URL,
      qdrantUrl: process.env.QDRANT_URL,
    })

    // Set dimension based on provider
    const actualDimension = provider === "openai" ? 1536 : dimension
    console.log("Using dimension:", actualDimension)

    // Ensure collection exists with correct dimension
    await ensureCollection(provider, actualDimension)

    // Chunk the document
    const chunks = chunkText(content)
    console.log("Text chunked into", chunks.length, "pieces")

    // Safety check: ensure we have chunks to process
    if (chunks.length === 0) {
      return NextResponse.json({ 
        error: "Text could not be chunked. Please provide longer text or text with punctuation.",
        suggestion: "Try adding a period at the end of your text or provide more content."
      }, { status: 400 })
    }

    // Generate embeddings for each chunk using selected provider
    console.log(`Generating embeddings using ${provider}...`)
    const embeddings = await Promise.all(
      chunks.map(async (chunk, index) => {
        console.log(`Processing chunk ${index + 1}/${chunks.length}`)
        if (provider === "openai") {
          return await getOpenAIEmbedding(chunk)
        } else {
          return await getSurusEmbedding(chunk, actualDimension)
        }
      }),
    )

    console.log("All embeddings generated successfully")

    // Store chunks and embeddings in Qdrant
    const points = chunks.map((chunk, index) => ({
      id: Date.now() + index,
      vector: embeddings[index],
      payload: {
        text: chunk,
        timestamp: new Date().toISOString(),
        dimension: actualDimension,
        provider: provider,
      },
    }))

    console.log("Storing", points.length, "points in Qdrant...")
    await qdrant.upsert(getCollectionName(provider, actualDimension), {
      wait: true,
      points,
    })

    // Get current vector count for cost calculation
    const collectionInfo = await qdrant.getCollection(getCollectionName(provider, actualDimension))
    const vectorCount = collectionInfo.points_count || chunks.length
    const costMetrics = calculateStorageCosts(vectorCount, actualDimension, 1536)

    console.log("=== Document indexing completed successfully ===")

    return NextResponse.json({
      message: "Document indexed successfully",
      chunks: chunks.length,
      dimension: actualDimension,
      provider: provider,
      costMetrics,
    })
  } catch (error) {
    console.error("=== Document indexing failed ===")
    console.error("Error details:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to index document",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
