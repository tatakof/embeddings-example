export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4)
}

export function buildPrompt({
  systemPrompt,
  memory,
  context,
  userMessage,
  maxMemoryTokens = 1000,
}: {
  systemPrompt: string
  memory: ChatMessage[]
  context: string
  userMessage: string
  maxMemoryTokens?: number
}): ChatMessage[] {
  const trimmedMemory: ChatMessage[] = []
  let tokenSum = 0

  for (let i = memory.length - 1; i >= 0; i--) {
    const msg = memory[i]
    const tokens = estimateTokens(msg.content)
    if (tokenSum + tokens > maxMemoryTokens) break
    trimmedMemory.unshift(msg)
    tokenSum += tokens
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...trimmedMemory,
    { role: "system", content: `Context:\n${context}` },
    { role: "user", content: userMessage },
  ]

  return messages
} 