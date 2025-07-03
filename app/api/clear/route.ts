import { type NextRequest, NextResponse } from "next/server"
import { QdrantClient } from "@qdrant/js-client-rest"

// Initialize Qdrant client
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY,
})

export async function DELETE(request: NextRequest) {
  try {
    console.log("=== Clearing knowledge base ===")
    
    // Get all collections
    const allCollections = await qdrant.getCollections()
    const documentCollections = allCollections.collections.filter(c => 
      c.name.startsWith('documents_')
    )

    console.log("Found document collections to delete:", documentCollections.map(c => c.name))

    // Delete each document collection
    const deletedCollections = []
    for (const collection of documentCollections) {
      try {
        await qdrant.deleteCollection(collection.name)
        console.log(`Deleted collection: ${collection.name}`)
        deletedCollections.push(collection.name)
      } catch (error) {
        console.warn(`Failed to delete collection ${collection.name}:`, error)
      }
    }

    console.log("=== Knowledge base cleared successfully ===")

    return NextResponse.json({
      message: "Base de conocimiento limpiada exitosamente",
      deletedCollections: deletedCollections.length,
      collectionNames: deletedCollections,
    })
  } catch (error) {
    console.error("=== Failed to clear knowledge base ===")
    console.error("Error details:", error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falló al limpiar la base de conocimiento",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
