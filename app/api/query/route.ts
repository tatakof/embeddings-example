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

// Surus AI embedding function (same as in documents route)
async function getSurusEmbedding(text: string, dimension = 768): Promise<number[]> {
  try {
    console.log("Query: Calling Surus API...")
    const res = await fetch(`${process.env.SURUS_API_URL}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SURUS_API_KEY}`,
        Accept: "application/json",
        "Accept-Encoding": "identity",
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

// Surus AI text generation function
async function generateSurusResponse(context: string, query: string): Promise<string> {
  try {
    console.log("Query: Calling Surus Chat Completions API...")
    const response = await fetch('https://api.surus.dev/functions/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SURUS_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen3-1.7B',
        messages: [
          {
            role: 'system',
            content: `Sos un asistente útil basado en múltiples modelos de embeddings.
Respondé preguntas usando solo el contexto de documentos procesados con
diferentes proveedores de embeddings (OpenAI y Surus AI, con varias dimensiones).
Si el contexto no tiene suficiente info para responder, decilo.
Sé breve y preciso en tus respuestas.`
          },
          {
            role: 'user',
            content: `Context:
${context}

Question: ${query}

Answer:`
          }
        ],
        max_tokens: 500
      })
    })

    if (!response.ok) {
      const err = await response.text().catch(() => response.statusText)
      throw new Error(`Surus Chat API ${response.status}: ${err}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  } catch (err) {
    console.error("Surus text generation error:", err)
    throw err
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== Query request started ===")
    const { query, similarityThreshold = 0.1, maxChunks = 5 } = await request.json()

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Se requiere una consulta" }, { status: 400 })
    }

    console.log("Query text:", query)
    console.log("Similarity threshold:", similarityThreshold)

    // Get all available collections
    const allCollections = await qdrant.getCollections()
    const documentCollections = allCollections.collections.filter(c => 
      c.name.startsWith('documents_')
    )

    if (documentCollections.length === 0) {
      return NextResponse.json({
        response: "No se encontraron colecciones de documentos. Agregá algunos documentos primero.",
        sources: {
          count: 0,
          chunks: []
        },
      })
    }

    console.log("Found document collections:", documentCollections.map(c => c.name))

    // Search across all collections and combine results
    let allResults: any[] = []
    let searchMetadata: any = {}

    for (const collection of documentCollections) {
      try {
        // Parse collection name to determine provider and dimension
        const nameMatch = collection.name.match(/documents_(\w+)_(\d+)d/)
        if (!nameMatch) continue
        
        const [, provider, dimensionStr] = nameMatch
        const dimension = parseInt(dimensionStr)
        
        console.log(`Searching in ${collection.name} (${provider}, ${dimension}D)`)

        // Generate embedding for this provider/dimension
        const embedding = provider === "openai" 
          ? await getOpenAIEmbedding(query)
          : await getSurusEmbedding(query, dimension)

        // Search this collection (no threshold to see all results)
        const searchResult = await qdrant.search(collection.name, {
      vector: embedding,
      limit: maxChunks,
        })
        
        console.log(`Search results for ${collection.name}:`, searchResult.length, "matches")
        if (searchResult.length > 0) {
          console.log("All scores:", searchResult.map(r => ({ score: r.score, text: (r.payload?.text as string)?.substring(0, 50) + "..." })))
        } else {
          console.log("No results found - checking collection info...")
          const collectionInfo = await qdrant.getCollection(collection.name)
          console.log("Collection points count:", collectionInfo.points_count)
        }
        
        // Add metadata to results
        const resultsWithMetadata = searchResult.map(result => ({
          ...result,
          collection: collection.name,
          provider,
          dimension
        }))
        
        allResults.push(...resultsWithMetadata)
        
        if (!searchMetadata.primaryProvider && searchResult.length > 0) {
          searchMetadata = { provider, dimension, embeddingModel: provider === "openai" ? "text-embedding-3-large" : "nomic-ai/nomic-embed-text-v2-moe" }
        }
        
      } catch (error) {
        console.warn(`Failed to search collection ${collection.name}:`, error)
      }
    }

    // Sort all results by score (highest first) and take top 5
    allResults.sort((a, b) => (b.score || 0) - (a.score || 0))
    
    // Apply user-defined threshold after seeing all scores
    const filteredResults = allResults.filter(result => (result.score || 0) > similarityThreshold)
    const topResults = filteredResults.slice(0, maxChunks)
    
    console.log("All results before filtering:", allResults.length)
    console.log(`Results after ${similarityThreshold} threshold:`, filteredResults.length)
    console.log("Final top results:", topResults.length)

    console.log("Combined search results:", topResults.length, "matches from", documentCollections.length, "collections")

    // Extract relevant text chunks
    const relevantChunks = topResults.map((result) => result.payload?.text).filter(Boolean)

    if (relevantChunks.length === 0) {
      return NextResponse.json({
        response: "No pude encontrar información relevante en la base de conocimiento para responder tu pregunta.",
        collectionsSearched: documentCollections.length,
        collectionsFound: documentCollections.map(c => c.name),
        sources: {
          count: 0,
          chunks: []
        },
      })
    }

    // Generate response using retrieved context with Surus
    const context = relevantChunks.join("\n\n")
    const text = await generateSurusResponse(context, query)

    console.log("=== Query completed successfully ===")

    return NextResponse.json({
      response: text,
      sources: {
        count: relevantChunks.length,
        chunks: topResults.map((result, index) => ({
          text: result.payload?.text || "",
          score: Math.round((result.score || 0) * 100) / 100, // Round to 2 decimal places
          collection: result.collection,
          provider: result.provider,
          dimension: result.dimension,
          rank: index + 1
        }))
      },
      collectionsSearched: documentCollections.length,
      collectionsFound: documentCollections.map(c => c.name),
      textModel: "Qwen/Qwen3-1.7B",
      ...searchMetadata,
    })
  } catch (error) {
    console.error("=== Query failed ===")
    console.error("Error processing query:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falló al procesar la consulta",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
