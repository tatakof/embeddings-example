"use client"

import React, { useEffect, useRef, useState } from "react"
import { ChatBubble } from "@/components/chat/ChatBubble"
import { SourcesPanel } from "@/components/chat/SourcesPanel"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, Send } from "lucide-react"
import { useChatSession } from "@/hooks/useChatSession"
import { ModelLabDrawer } from "@/components/chat/ModelLabDrawer"

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
}

export default function ChatPage() {
  const {
    messages,
    provider,
    dimension,
    addMessage,
    setProvider,
    setDimension,
  } = useChatSession()

  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [selectedSources, setSelectedSources] = useState<SourceChunk[] | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Auto scroll to bottom when messages change
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim()) return

    const userMsg: Message = { role: "user", content: input }
    addMessage(userMsg)
    setInput("")
    setIsSending(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: messages, newMessage: input, provider, dimension }),
      })

      const data = await res.json()
      const assistantMsg: Message = {
        role: "assistant",
        content: data.response,
        sources: data.sources,
      }
      addMessage(assistantMsg)
    } catch (err) {
      console.error(err)
      addMessage({ role: "assistant", content: "(error al obtener respuesta)" })
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="container mx-auto max-w-4xl h-[calc(100vh-4rem)] flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">Chat con tu Base de Conocimiento</h1>

      <ScrollArea ref={scrollRef} className="flex-1 border rounded-lg p-4 space-y-4 bg-background">
        {messages.map((m, idx) => (
          <div key={idx} onClick={() => m.sources && setSelectedSources(m.sources.chunks)}>
            <ChatBubble role={m.role} content={m.content} sources={m.sources} />
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2 text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Generando...
            </div>
          </div>
        )}
      </ScrollArea>

      <div className="flex gap-2">
        <Input
          placeholder="Escribí tu mensaje..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />
        <Button onClick={sendMessage} disabled={isSending || !input.trim()}>
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
        <ModelLabDrawer
          provider={provider}
          dimension={dimension}
          setProvider={setProvider}
          setDimension={setDimension}
          vectorCount={messages.length * 1} // simplistic vector count estimate
        />
      </div>

      {selectedSources && (
        <SourcesPanel sources={selectedSources} onClose={() => setSelectedSources(null)} />
      )}
    </div>
  )
} 