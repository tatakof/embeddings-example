"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Upload, MessageSquare, Trash2 } from "lucide-react"
import { CostComparison } from "@/components/cost-comparison"

interface SourceChunk {
  text: string
  score: number
  collection: string
  provider: string
  dimension: number
  rank: number
}

interface Message {
  role: "user" | "assistant"
  content: string
  sources?: {
    count: number
    chunks: SourceChunk[]
  }
  metadata?: {
    textModel?: string
    collectionsSearched?: number
  }
}

export default function RAGPipeline() {
  const [documents, setDocuments] = useState<string[]>([])
  const [newDocument, setNewDocument] = useState("")
  const [isIndexing, setIsIndexing] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [query, setQuery] = useState("")
  const [isQuerying, setIsQuerying] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [embeddingDimension, setEmbeddingDimension] = useState(768)
  const [embeddingProvider, setEmbeddingProvider] = useState<"surus" | "openai">("surus")
  const [similarityThreshold, setSimilarityThreshold] = useState(0.1)
  const [costMetrics, setCostMetrics] = useState<{
    totalVectors: number
    storageSize: string
    monthlyCost: string
    savingsPercent?: string
  } | null>(null)

  // Reset dimension when provider changes
  useEffect(() => {
    if (embeddingProvider === "openai") {
      setEmbeddingDimension(1536)
    } else {
      setEmbeddingDimension(768)
    }
  }, [embeddingProvider])

  const addDocument = async () => {
    if (!newDocument.trim()) return

    setIsIndexing(true)
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newDocument,
          dimension: embeddingDimension,
          provider: embeddingProvider,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        setDocuments([...documents, newDocument])
        setCostMetrics(result.costMetrics)
        setNewDocument("")
      }
    } catch (error) {
      console.error("Error adding document:", error)
    } finally {
      setIsIndexing(false)
    }
  }

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    const userMessage: Message = { role: "user", content: query }
    setMessages((prev) => [...prev, userMessage])
    setIsQuerying(true)

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, similarityThreshold }),
      })

      const data = await response.json()
      const assistantMessage: Message = { 
        role: "assistant", 
        content: data.response,
        sources: data.sources,
        metadata: {
          textModel: data.textModel,
          collectionsSearched: data.collectionsSearched
        }
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Error querying:", error)
      const errorMessage: Message = { role: "assistant", content: "Sorry, there was an error processing your query." }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsQuerying(false)
      setQuery("")
    }
  }

  const clearKnowledgeBase = async () => {
    if (!confirm("Are you sure you want to clear the entire knowledge base? This will delete all indexed documents from all collections.")) {
      return
    }

    setIsClearing(true)
    try {
      const response = await fetch("/api/clear", {
        method: "DELETE",
      })

      if (response.ok) {
        const result = await response.json()
        console.log("Knowledge base cleared:", result)
        // Reset UI state
        setDocuments([])
        setCostMetrics(null)
        setMessages([])
        alert(`Successfully cleared ${result.deletedCollections} collections: ${result.collectionNames.join(", ")}`)
      } else {
        const error = await response.json()
        alert(`Failed to clear knowledge base: ${error.error}`)
      }
    } catch (error) {
      console.error("Error clearing knowledge base:", error)
      alert("Failed to clear knowledge base. Check console for details.")
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">RAG Pipeline with Qdrant, OpenAI & Surus</h1>
        <p className="text-muted-foreground">
          Add documents to your knowledge base using different embedding providers and dimensions. Query across all collections using retrieval-augmented generation.
        </p>
      </div>

      <Tabs defaultValue="documents" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Manage Documents
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Query Knowledge Base
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Add New Document</CardTitle>
              <CardDescription>
                Add text content to your knowledge base using Surus AI's matryoshka embeddings. Choose smaller
                dimensions to reduce storage costs while maintaining performance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste your document content here..."
                value={newDocument}
                onChange={(e) => setNewDocument(e.target.value)}
                rows={8}
              />
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label htmlFor="provider" className="text-sm font-medium">
                    Embedding Provider:
                  </label>
                  <select
                    id="provider"
                    value={embeddingProvider}
                    onChange={(e) => setEmbeddingProvider(e.target.value as "surus" | "openai")}
                    className="px-3 py-1 border rounded-md text-sm"
                  >
                    <option value="surus">Surus AI (Matryoshka)</option>
                    <option value="openai">OpenAI</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="dimension" className="text-sm font-medium">
                    Embedding Dimension:
                  </label>
                  <select
                    id="dimension"
                    value={embeddingDimension}
                    onChange={(e) => setEmbeddingDimension(Number(e.target.value))}
                    className="px-3 py-1 border rounded-md text-sm"
                    disabled={embeddingProvider === "openai"}
                  >
                    {embeddingProvider === "surus" ? (
                      <>
                        <option value={768}>768 (Standard)</option>
                        <option value={512}>512 (Balanced)</option>
                        <option value={256}>256 (Efficient)</option>
                        <option value={128}>128 (Ultra-compact)</option>
                      </>
                    ) : (
                      <option value={1536}>1536 (OpenAI Standard)</option>
                    )}
                  </select>
                </div>
                {costMetrics && (
                  <div className="text-sm text-muted-foreground">
                    Storage: {costMetrics.storageSize} | Est. monthly cost: {costMetrics.monthlyCost}
                    {costMetrics.savingsPercent && (
                      <span className="text-green-600 ml-2">• {costMetrics.savingsPercent}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={addDocument} disabled={isIndexing || !newDocument.trim()}>
                  {isIndexing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Indexing...
                    </>
                  ) : (
                    "Add Document"
                  )}
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={clearKnowledgeBase} 
                  disabled={isClearing}
                  className="ml-auto"
                >
                  {isClearing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Clear Knowledge Base
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Indexed Documents ({documents.length})</CardTitle>
              <CardDescription>Documents currently in your knowledge base</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {documents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No documents added yet. Add your first document above.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Document {index + 1}</p>
                        <p className="text-sm line-clamp-3">{doc}</p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
          {documents.length > 0 && <CostComparison vectorCount={documents.length * 3} />}
        </TabsContent>

        <TabsContent value="chat" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Query Your Knowledge Base</CardTitle>
              <CardDescription>
                Ask questions about your documents. The system will find relevant information and generate responses.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 mb-4 p-4 border rounded-lg">
                {messages.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Start a conversation by asking a question about your documents.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[85%] ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`p-3 rounded-lg ${
                              message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                            }`}
                          >
                            <p className="text-sm">{message.content}</p>
                            {message.metadata && (
                              <div className="mt-2 text-xs opacity-70">
                                Model: {message.metadata.textModel} • Collections: {message.metadata.collectionsSearched}
                              </div>
                            )}
                          </div>
                          
                          {/* Sources Section */}
                          {message.sources && message.sources.chunks.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">
                                Sources ({message.sources.count} chunks found):
                              </div>
                              <div className="space-y-2">
                                {message.sources.chunks.map((chunk, chunkIndex) => (
                                  <div key={chunkIndex} className="bg-secondary/50 p-2 rounded border-l-2 border-blue-500">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="font-medium">#{chunk.rank}</span>
                                        <span>Score: {chunk.score}</span>
                                        <span>{chunk.provider}</span>
                                        <span>{chunk.dimension}D</span>
                                      </div>
                                    </div>
                                    <p className="text-xs text-foreground/80 line-clamp-3">
                                      {chunk.text}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <div className="space-y-3">
                <div className="flex items-center gap-4 p-3 bg-secondary/30 rounded-lg">
                  <label htmlFor="similarity-threshold" className="text-sm font-medium whitespace-nowrap">
                    Similarity Threshold:
                  </label>
                  <div className="flex-1 flex flex-col">
                    <div className="text-xs text-muted-foreground mb-1">
                      Lower = more results, Higher = more relevant
                    </div>
                    <input
                      id="similarity-threshold"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={similarityThreshold}
                      onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                      className="h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <span className="text-sm font-mono bg-background px-2 py-1 rounded border min-w-[4rem] text-center">
                    {similarityThreshold.toFixed(2)}
                  </span>
                </div>
                <form onSubmit={handleQuery} className="flex gap-2">
                  <Input
                    placeholder="Ask a question about your documents..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={isQuerying}
                  />
                  <Button type="submit" disabled={isQuerying || !query.trim()}>
                    {isQuerying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
