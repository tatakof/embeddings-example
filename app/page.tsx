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
import Image from "next/image"

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
  const [inputFormat, setInputFormat] = useState<'text' | 'json' | 'array'>('text')
  const [jsonInput, setJsonInput] = useState('')
  const [arrayInput, setArrayInput] = useState('')
  const [isIndexing, setIsIndexing] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [query, setQuery] = useState("")
  const [isQuerying, setIsQuerying] = useState(false)
  const [embeddingDimension, setEmbeddingDimension] = useState(768)
  const [embeddingProvider, setEmbeddingProvider] = useState<"surus" | "openai">("surus")
  const [similarityThreshold, setSimilarityThreshold] = useState(0.2)
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
    let contentToSend: any = newDocument

    // Process different input formats
    if (inputFormat === 'json') {
      try {
        contentToSend = JSON.parse(jsonInput || '{}')
      } catch (error) {
        alert('JSON inválido. Verificá la sintaxis.')
        return
      }
    } else if (inputFormat === 'array') {
      try {
        contentToSend = JSON.parse(arrayInput || '[]')
        if (!Array.isArray(contentToSend)) {
          throw new Error('Debe ser un array')
        }
      } catch (error) {
        alert('Array inválido. Debe ser un array JSON válido.')
        return
      }
    }

    if (!contentToSend || (typeof contentToSend === 'string' && !contentToSend.trim())) {
      alert('Proporcioná contenido para indexar')
      return
    }

    setIsIndexing(true)
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: contentToSend,
          dimension: embeddingDimension,
          provider: embeddingProvider,
          format: inputFormat
        }),
      })

      const data = await response.json()
      if (response.ok) {
        setDocuments((prev) => [...prev, typeof contentToSend === 'string' ? contentToSend : JSON.stringify(contentToSend)])
        setNewDocument("")
        setJsonInput("")
        setArrayInput("")
        setCostMetrics(data.costMetrics)
        
        // Show processing details
        if (data.processingDetails) {
          console.log('Processing details:', data.processingDetails)
        }
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error("Error adding document:", error)
      alert("Falló al agregar el documento")
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
      const errorMessage: Message = { role: "assistant", content: "Disculpá, hubo un error procesando tu consulta." }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsQuerying(false)
      setQuery("")
    }
  }

  const clearKnowledgeBase = async () => {
    if (!confirm("¿Estás seguro de que querés limpiar toda la base de conocimiento? Esto va a eliminar todos los documentos indexados de todas las colecciones.")) {
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
        alert(`Se limpiaron exitosamente ${result.deletedCollections} colecciones: ${result.collectionNames.join(", ")}`)
      } else {
        const error = await response.json()
        alert(`Falló al limpiar la base de conocimiento: ${error.error}`)
      }
    } catch (error) {
      console.error("Error clearing knowledge base:", error)
      alert("Falló al limpiar la base de conocimiento. Revisá la consola para más detalles.")
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center justify-center gap-6 mb-6">
          <Image src="/logo_qdrant.png" alt="Qdrant" width={80} height={80} className="rounded-lg" />
          <Image src="/logo_surus.png" alt="Surus" width={80} height={80} className="rounded-lg" />
          <Image src="/vercel_logo.png" alt="Vercel" width={80} height={80} className="rounded-lg" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Pipeline RAG con Qdrant, Surus y Vercel</h1>
        <p className="text-muted-foreground">
          Agregá documentos a tu base de conocimiento usando diferentes proveedores de embeddings y dimensiones. Consultá todas las colecciones usando generación aumentada por recuperación.
        </p>
      </div>

      <Tabs defaultValue="documents" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Gestionar Documentos
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Consultar Base de Conocimiento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Agregar Nuevo Documento</CardTitle>
              <CardDescription>
                Agregá contenido de texto a tu base de conocimiento usando los embeddings matryoshka de Surus AI. Elegí dimensiones más chicas
                para reducir los costos de almacenamiento manteniendo el rendimiento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Format Selection */}
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Formato de Entrada:</label>
                <select
                  value={inputFormat}
                  onChange={(e) => setInputFormat(e.target.value as 'text' | 'json' | 'array')}
                  className="px-3 py-1 border rounded-md text-sm"
                >
                  <option value="text">Texto Plano</option>
                  <option value="json">JSON (Clave-Valor)</option>
                  <option value="array">Array de Strings</option>
                </select>
              </div>

              {/* Dynamic Input Fields */}
              {inputFormat === 'text' && (
                <Textarea
                  placeholder="Pegá el contenido de tu documento acá... El texto se fragmentará automáticamente según el límite de tokens."
                  value={newDocument}
                  onChange={(e) => setNewDocument(e.target.value)}
                  rows={8}
                />
              )}

              {inputFormat === 'json' && (
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">
                    JSON con pares clave-valor. Cada valor será procesado como un documento separado:
                  </label>
                  <Textarea
                    placeholder={`{
  "introduccion": "Este es el primer capítulo...",
  "desarrollo": "En esta sección discutimos...",
  "conclusion": "Para finalizar, podemos decir..."
}`}
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
              )}

              {inputFormat === 'array' && (
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">
                    Array de strings. Cada elemento será procesado como un documento separado:
                  </label>
                  <Textarea
                    placeholder={`[
  "Primer documento o párrafo...",
  "Segundo documento o párrafo...",
  "Tercer documento o párrafo..."
]`}
                    value={arrayInput}
                    onChange={(e) => setArrayInput(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>
              )}

              {/* Processing Info */}
              <div className="bg-blue-50 p-3 rounded-lg text-sm">
                <h4 className="font-medium mb-2">ℹ️ Información de Procesamiento:</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• <strong>Límite de tokens:</strong> {embeddingProvider === 'surus' ? '500 tokens (máx 512)' : '1000 tokens'} por fragmento</li>
                  <li>• <strong>Texto largo:</strong> Se chunkea automáticamente con superposición para mejor contexto</li>
                  <li>• <strong>JSON:</strong> Cada 'key' se convierte en metadatos, cada 'value' en documento</li>
                  <li>• <strong>Array:</strong> Cada elemento se procesa como un documento independiente</li>
                </ul>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label htmlFor="provider" className="text-sm font-medium">
                    Proveedor de Embeddings:
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
                    Dimensión de Embedding:
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
                        <option value={768}>768 (Estándar)</option>
                        <option value={512}>512 (Balanceado)</option>
                        <option value={256}>256 (Eficiente)</option>
                        <option value={128}>128 (Ultra-compacto)</option>
                      </>
                    ) : (
                      <option value={1536}>1536 (OpenAI Estándar)</option>
                    )}
                  </select>
                </div>
                {costMetrics && (
                  <div className="text-sm text-muted-foreground">
                    Almacenamiento: {costMetrics.storageSize} | Costo mensual est.: {costMetrics.monthlyCost}
                    {costMetrics.savingsPercent && (
                      <span className="text-green-600 ml-2">• {costMetrics.savingsPercent}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={addDocument} 
                  disabled={isIndexing || (
                    inputFormat === 'text' ? !newDocument.trim() :
                    inputFormat === 'json' ? !jsonInput.trim() :
                    !arrayInput.trim()
                  )}
                >
                  {isIndexing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Indexando...
                    </>
                  ) : (
                    "Agregar Documento"
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
                      Limpiando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Limpiar Base de Conocimiento
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documentos Indexados ({documents.length})</CardTitle>
              <CardDescription>Documentos actualmente en tu base de conocimiento</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                {documents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Todavía no agregaste documentos. Agregá tu primer documento arriba.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-1">Documento {index + 1}</p>
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
              <CardTitle>Consultá tu Base de Conocimiento</CardTitle>
              <CardDescription>
                Hacé preguntas sobre tus documentos. El sistema va a encontrar información relevante y generar respuestas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96 mb-4 p-4 border rounded-lg">
                {messages.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Empezá una conversación haciendo una pregunta sobre tus documentos.
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
                                Modelo: {message.metadata.textModel} • Colecciones: {message.metadata.collectionsSearched}
                              </div>
                            )}
                          </div>
                          
                          {/* Sources Section */}
                          {message.sources && message.sources.chunks.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">
                                Fuentes ({message.sources.count} fragmentos encontrados):
                              </div>
                              <div className="space-y-2">
                                {message.sources.chunks.map((chunk, chunkIndex) => (
                                  <div key={chunkIndex} className="bg-secondary/50 p-2 rounded border-l-2 border-blue-500">
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="font-medium">#{chunk.rank}</span>
                                        <span>Puntaje: {chunk.score}</span>
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
                    Umbral de Similitud:
                  </label>
                  <div className="flex-1 flex flex-col">
                    <div className="text-xs text-muted-foreground mb-1">
                      Más bajo = más resultados, Más alto = más relevantes
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
                    placeholder="Hacé una pregunta sobre tus documentos..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={isQuerying}
                  />
                  <Button type="submit" disabled={isQuerying || !query.trim()}>
                    {isQuerying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Preguntar"}
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
