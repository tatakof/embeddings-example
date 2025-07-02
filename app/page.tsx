"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Upload, MessageSquare } from "lucide-react"
import { CostComparison } from "@/components/cost-comparison"

interface Message {
  role: "user" | "assistant"
  content: string
}

export default function RAGPipeline() {
  const [documents, setDocuments] = useState<string[]>([])
  const [newDocument, setNewDocument] = useState("")
  const [isIndexing, setIsIndexing] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [query, setQuery] = useState("")
  const [isQuerying, setIsQuerying] = useState(false)
  const [embeddingDimension, setEmbeddingDimension] = useState(768)
  const [embeddingProvider, setEmbeddingProvider] = useState<"surus" | "openai">("surus")
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
        body: JSON.stringify({ query }),
      })

      const data = await response.json()
      const assistantMessage: Message = { role: "assistant", content: data.response }
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
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
