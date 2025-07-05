import { type NextRequest, NextResponse } from "next/server"
import { buildPrompt, ChatMessage } from "@/lib/prompt"

// Helper to map conversation array coming from client to ChatMessage[]
function mapConversation(raw: any[]): ChatMessage[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: String(m.content) }))
}

export async function POST(request: NextRequest) {
  try {
    const {
      conversation = [],
      newMessage,
      provider = "surus",
      dimension = provider === "openai" ? 1536 : 768,
      similarityThreshold = 0.2,
      maxChunks = 5,
    } = await request.json()

    if (!newMessage || typeof newMessage !== "string") {
      return NextResponse.json({ error: "newMessage is required" }, { status: 400 })
    }

    // 1. Retrieve relevant context using existing /api/query endpoint
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

    const queryRes = await fetch(`${origin}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: newMessage,
        similarityThreshold,
        maxChunks,
      }),
    })

    const queryData = await queryRes.json()

    const contextChunks: string[] = (queryData?.sources?.chunks || []).map((c: any) => c.text)
    const context = contextChunks.join("\n\n")

    // 2. Build prompt with memory
    const systemPrompt = `Sos un asistente útil. Respondé preguntas usando solo el contexto provisto. Si no sabés la respuesta decilo.`
    const memoryMessages = mapConversation(conversation)

    const promptMessages = buildPrompt({
      systemPrompt,
      memory: memoryMessages,
      context,
      userMessage: newMessage,
    })

    // 3. Call Surus Chat Completions (or OpenAI if desired)
    const chatRes = await fetch("https://api.surus.dev/functions/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SURUS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "Qwen/Qwen3-1.7B",
        messages: promptMessages,
        max_tokens: 500,
      }),
    })

    if (!chatRes.ok) {
      const err = await chatRes.text().catch(() => chatRes.statusText)
      throw new Error(`Surus Chat API ${chatRes.status}: ${err}`)
    }

    const chatData = await chatRes.json()
    const assistantReply = chatData.choices?.[0]?.message?.content || "(sin respuesta)"

    return NextResponse.json({
      response: assistantReply,
      sources: queryData.sources,
    })
  } catch (err) {
    console.error("Chat route error", err)
    return NextResponse.json({ error: (err as Error).message || "Unknown error" }, { status: 500 })
  }
} 