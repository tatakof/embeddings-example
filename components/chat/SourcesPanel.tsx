import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { SourceChunk } from "./ChatBubble"

interface SourcesPanelProps {
  sources: SourceChunk[]
  onClose: () => void
}

export const SourcesPanel: React.FC<SourcesPanelProps> = ({ sources, onClose }) => {
  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-background border-l shadow-lg z-50 animate-in slide-in-from-right-10">
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row justify-between items-center p-4 border-b">
          <CardTitle>Fuentes ({sources.length})</CardTitle>
          <button className="text-sm underline" onClick={onClose}>
            Cerrar
          </button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full p-4">
            {sources.map((src, idx) => (
              <div key={idx} className="mb-4">
                <div className="text-xs text-muted-foreground mb-1">
                  {src.provider} · {src.dimension}D · score {src.score.toFixed(2)}
                </div>
                <p className="text-sm whitespace-pre-wrap">{src.text}</p>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
} 