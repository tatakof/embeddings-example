import React from "react"
import { cn } from "@/lib/utils"

export interface SourceChunk {
  text: string
  score: number
  collection: string
  provider: string
  dimension: number
  rank: number
}

export interface ChatBubbleProps {
  role: "user" | "assistant"
  content: string
  sources?: {
    count: number
    chunks: SourceChunk[]
  }
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ role, content, sources }) => {
  const isUser = role === "user"
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "rounded-lg px-4 py-2 max-w-[80%] whitespace-pre-wrap text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {content}
        {sources && sources.count > 0 && (
          <div className="mt-2 text-[0.65rem] text-muted-foreground">
            {sources.count} fuente{sources.count === 1 ? "" : "s"} · haz clic para ver
          </div>
        )}
      </div>
    </div>
  )
} 