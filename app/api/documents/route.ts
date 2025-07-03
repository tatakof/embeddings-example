import { type NextRequest, NextResponse } from "next/server"
import { QdrantClient } from "@qdrant/js-client-rest"
// import { Agent } from "undici" // Removed to avoid TS resolution issues

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
    // Always trim to 512 token limit before sending to API
    const trimmedText = trimToTokenLimit(text, 512)
    
    console.log("Calling Surus API with:", {
      url: `${process.env.SURUS_API_URL}/v1/embeddings`,
      hasApiKey: !!process.env.SURUS_API_KEY,
      dimension,
      originalLength: text.length,
      trimmedLength: trimmedText.length,
      estimatedTokens: estimateTokens(trimmedText)
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
        input: [trimmedText], // Use trimmed text
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
    console.log("Surus API response structure:", {
      hasData: !!data.data,
      dataLength: data.data?.length,
      firstItemKeys: data.data?.[0] ? Object.keys(data.data[0]) : 'N/A',
      embeddingLength: data.data?.[0]?.embedding?.length
    })

    // Better error handling for response structure
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error("Invalid response structure from Surus API")
    }

    if (!data.data[0].embedding || !Array.isArray(data.data[0].embedding)) {
      throw new Error("Missing or invalid embedding in Surus API response")
    }

    console.log("Surus API success, embedding length:", data.data[0].embedding.length)
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
    savingsPercent: savingsPercent > 0 ? `${savingsPercent.toFixed(0)}% de ahorro vs OpenAI 1536D` : null,
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

// Token counting function (rough approximation)
function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for most languages
  // This is conservative for Spanish/English text
  return Math.ceil(text.length / 4)
}

// Trim text to fit within token limit
function trimToTokenLimit(text: string, maxTokens = 512): string {
  if (estimateTokens(text) <= maxTokens) {
    return text
  }
  
  // Rough approximation: trim to character count that should fit
  const targetLength = maxTokens * 4 // 4 chars per token estimate
  const trimmed = text.substring(0, targetLength)
  
  // Try to end at a word boundary
  const lastSpaceIndex = trimmed.lastIndexOf(' ')
  if (lastSpaceIndex > targetLength * 0.8) { // Only if we don't lose too much
    return trimmed.substring(0, lastSpaceIndex).trim()
  }
  
  return trimmed.trim()
}

// Enhanced text chunking with token awareness
function chunkTextWithTokens(text: string, maxTokens = 500, overlapTokens = 50): string[] {
  const chunks: string[] = []
  
  // For very short texts, return as single chunk if under token limit
  if (estimateTokens(text.trim()) <= maxTokens) {
    const trimmedText = trimToTokenLimit(text.trim())
    return trimmedText.length > 0 ? [trimmedText] : []
  }
  
  // Split into sentences first
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  
  let currentChunk = ""
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    const potentialChunk = currentChunk + (currentChunk ? " " : "") + trimmedSentence
    
    if (estimateTokens(potentialChunk) > maxTokens && currentChunk.length > 0) {
      // Trim to 512 token limit before adding to chunks
      chunks.push(trimToTokenLimit(currentChunk.trim()))
      
      // Create overlap from previous chunk
      const words = currentChunk.split(" ")
      const overlapWords = Math.floor(overlapTokens / 4) // Rough word count for overlap
      const overlap = words.slice(-overlapWords).join(" ")
      currentChunk = overlap + " " + trimmedSentence
    } else {
      currentChunk = potentialChunk
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(trimToTokenLimit(currentChunk.trim()))
  }
  
  return chunks.filter((chunk) => estimateTokens(chunk) > 5) // Filter very short chunks
}

// Process different input formats
interface ProcessedDocument {
  text: string
  metadata?: {
    sourceKey?: string
    format?: 'text' | 'json' | 'array'
    originalIndex?: number
    chunkIndex?: number
    totalChunks?: number
  }
}

function processInputContent(input: any, maxTokens = 500): ProcessedDocument[] {
  const documents: ProcessedDocument[] = []
  
  if (typeof input === 'string') {
    // Plain text input - chunk immediately if needed
    const chunks = chunkTextWithTokens(input, maxTokens)
    chunks.forEach((chunk, index) => {
      documents.push({
        text: chunk,
        metadata: { 
          format: 'text',
          chunkIndex: index,
          totalChunks: chunks.length
        }
      })
    })
  } else if (Array.isArray(input)) {
    // Array of strings - chunk each item immediately
    input.forEach((item, originalIndex) => {
      if (typeof item === 'string' && item.trim()) {
        const chunks = chunkTextWithTokens(item.trim(), maxTokens)
        chunks.forEach((chunk, chunkIndex) => {
          documents.push({
            text: chunk,
            metadata: { 
              format: 'array',
              originalIndex: originalIndex,
              chunkIndex: chunkIndex,
              totalChunks: chunks.length
            }
          })
        })
      }
    })
  } else if (typeof input === 'object' && input !== null) {
    // JSON object with key-value pairs - chunk each value immediately
    Object.entries(input).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim()) {
        const chunks = chunkTextWithTokens(value.trim(), maxTokens)
        chunks.forEach((chunk, chunkIndex) => {
          documents.push({
            text: chunk,
            metadata: { 
              format: 'json',
              sourceKey: key,
              chunkIndex: chunkIndex,
              totalChunks: chunks.length
            }
          })
        })
      }
    })
  }
  
  return documents
}

// No longer needed - chunking is done in processInputContent

// Legacy function for backward compatibility
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

// Simple sleep helper
function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms))
}

// -------- Batching helpers for Surus -------- //
const SURUS_BATCH_SIZE = 16 // Number of texts sent per request
const SURUS_CONCURRENCY = 4 // Max parallel Surus requests
const SURUS_MAX_RETRIES = 2 // Extra tries after first failure

// Re-use a single keep-alive agent so we don't open a new socket per call
// const surusAgent = new Agent({ keepAlive: true, keepAliveTimeout: 30_000 })

async function getSurusEmbeddingsBatch(texts: string[], dimension = 768): Promise<number[][]> {
  // Trim every text individually to 512 tokens
  const trimmed = texts.map((t) => trimToTokenLimit(t, 512))

  const res = await fetch(`${process.env.SURUS_API_URL}/v1/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SURUS_API_KEY}`,
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: "nomic-ai/nomic-embed-text-v2-moe",
      input: trimmed,
      dimensions: dimension,
    }),
    // Note: keep-alive Agent removed due to TS constraints; consider adding when type support available
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Surus API ${res.status}: ${errText}`)
  }

  const data: any = await res.json()
  if (!data?.data || !Array.isArray(data.data)) {
    throw new Error("Invalid Surus response structure")
  }

  return data.data.map((d: any) => d.embedding as number[])
}

async function callWithRetry(fn: () => Promise<number[][]>): Promise<number[][]> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (err) {
      if (attempt >= SURUS_MAX_RETRIES) throw err
      const delay = 1000 * Math.pow(2, attempt) // 1s, 2s, ...
      console.warn(`Surus batch failed (attempt ${attempt + 1}). Retrying in ${delay}ms`) // eslint-disable-line no-console
      await sleep(delay)
      attempt++
    }
  }
}

// Map chunks → embeddings using batching + concurrency limit
async function embedWithSurusBatched(chunks: ProcessedDocument[], dimension: number): Promise<number[][]> {
  const total = chunks.length
  const result: number[][] = new Array(total)

  // Build batches
  const batchIndexes: Array<[number, number]> = [] // [start, end)
  for (let i = 0; i < total; i += SURUS_BATCH_SIZE) {
    batchIndexes.push([i, Math.min(i + SURUS_BATCH_SIZE, total)])
  }

  // Process batches with concurrency limit
  let cursor = 0
  async function worker() {
    while (cursor < batchIndexes.length) {
      const myIndex = cursor++
      const [start, end] = batchIndexes[myIndex]
      const slice = chunks.slice(start, end)
      const embeddings = await callWithRetry(() => getSurusEmbeddingsBatch(slice.map((c) => c.text), dimension))
      embeddings.forEach((vec, idx) => {
        result[start + idx] = vec
      })
    }
  }

  const workers = Array.from({ length: Math.min(SURUS_CONCURRENCY, batchIndexes.length) }, () => worker())
  await Promise.all(workers)

  return result
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== Document indexing request started ===")

    const body = await request.json()
    const { content, dimension = 768, provider = "surus", format = "auto" } = body

    console.log("Request params:", {
      contentType: typeof content,
      contentLength: typeof content === 'string' ? content.length : 'N/A',
      isArray: Array.isArray(content),
      isObject: typeof content === 'object' && !Array.isArray(content),
      dimension,
      provider,
      format
    })

    if (!content) {
      return NextResponse.json({ error: "Se requiere contenido" }, { status: 400 })
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

    // Process input content based on format (chunking happens inside this function now)
    const maxTokens = provider === "surus" ? 500 : 1000 // 500 tokens for Surus, trim at 512
    const chunkedData = processInputContent(content, maxTokens)
    console.log("Text processed and chunked into", chunkedData.length, "pieces")

    if (chunkedData.length === 0) {
      return NextResponse.json({ 
        error: "No se pudo procesar el contenido. Verificá que el formato sea válido.",
        suggestion: "Enviá texto plano, un array de strings, o un objeto JSON con pares clave-valor."
      }, { status: 400 })
    }

    // Generate embeddings for each chunk using selected provider
    console.log(`Generating embeddings using ${provider}...`)
    let embeddings: number[][]
    if (provider === "openai") {
      embeddings = await Promise.all(chunkedData.map(async (chunkData) => await getOpenAIEmbedding(chunkData.text)))
    } else {
      embeddings = await embedWithSurusBatched(chunkedData, actualDimension)
    }

    console.log("All embeddings generated successfully")

    // Store chunks and embeddings in Qdrant
    const baseTimestamp = Date.now()
    const points = chunkedData.map((chunkData, index) => {
      // Generate a unique integer ID using timestamp and index
      const uniqueId = baseTimestamp * 1000 + index
      return {
        id: uniqueId,
        vector: embeddings[index],
        payload: {
          text: chunkData.text,
          timestamp: new Date().toISOString(),
          dimension: actualDimension,
          provider: provider,
          // Enhanced metadata
          sourceFormat: chunkData.metadata?.format,
          sourceKey: chunkData.metadata?.sourceKey,
          originalIndex: chunkData.metadata?.originalIndex,
          estimatedTokens: estimateTokens(chunkData.text)
        },
      }
    })

    console.log("Storing", points.length, "points in Qdrant...")
    await qdrant.upsert(getCollectionName(provider, actualDimension), {
      wait: true,
      points,
    })

    // Get current vector count for cost calculation
    const collectionInfo = await qdrant.getCollection(getCollectionName(provider, actualDimension))
    const vectorCount = collectionInfo.points_count || chunkedData.length
    const costMetrics = calculateStorageCosts(vectorCount, actualDimension, 1536)

    console.log("=== Document indexing completed successfully ===")

    return NextResponse.json({
      message: "Documento indexado exitosamente",
      chunks: chunkedData.length,
      dimension: actualDimension,
      provider: provider,
      costMetrics,
      processingDetails: {
        inputFormat: typeof content === 'string' ? 'text' : Array.isArray(content) ? 'array' : 'object',
        maxTokensPerChunk: maxTokens,
        averageTokensPerChunk: Math.round(chunkedData.reduce((sum: number, chunk: ProcessedDocument) => sum + estimateTokens(chunk.text), 0) / chunkedData.length)
      }
    })
  } catch (error) {
    console.error("=== Document indexing failed ===")
    console.error("Error details:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falló al indexar el documento",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
