import { useEffect, useState } from "react"

type Provider = "surus" | "openai"

export interface SourceChunk {
  text: string
  score: number
  collection: string
  provider: string
  dimension: number
  rank: number
}

export interface Message {
  role: "user" | "assistant"
  content: string
  sources?: {
    count: number
    chunks: SourceChunk[]
  }
}

interface ChatSessionState {
  messages: Message[]
  provider: Provider
  dimension: number
}

const LS_KEY = "chat_session_v1"

export function useChatSession() {
  const [state, setState] = useState<ChatSessionState>(() => {
    if (typeof window === "undefined") return { messages: [], provider: "surus", dimension: 768 }
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return { messages: [], provider: "surus", dimension: 768 }
      const parsed = JSON.parse(raw)
      return {
        messages: parsed.messages || [],
        provider: parsed.provider || "surus",
        dimension: parsed.dimension || 768,
      }
    } catch {
      return { messages: [], provider: "surus", dimension: 768 }
    }
  })

  // Persist to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  }, [state])

  const addMessage = (msg: Message) => setState((s) => ({ ...s, messages: [...s.messages, msg] }))
  const clearChat = () => setState((s) => ({ ...s, messages: [] }))
  const setProvider = (p: Provider) => setState((s) => ({ ...s, provider: p, dimension: p === "openai" ? 1536 : 768 }))
  const setDimension = (d: number) => setState((s) => ({ ...s, dimension: d }))

  return {
    messages: state.messages,
    provider: state.provider,
    dimension: state.dimension,
    addMessage,
    clearChat,
    setProvider,
    setDimension,
  }
} 