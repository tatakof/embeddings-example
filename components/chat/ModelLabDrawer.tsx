import React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { CostComparison } from "@/components/cost-comparison"

interface Props {
  provider: "surus" | "openai"
  dimension: number
  setProvider: (p: "surus" | "openai") => void
  setDimension: (d: number) => void
  vectorCount: number
}

export const ModelLabDrawer: React.FC<Props> = ({ provider, dimension, setProvider, setDimension, vectorCount }) => {
  const dims = [768, 512, 256, 128]
  return (
    <Dialog>
      <DialogTrigger className="text-sm underline">⚙️ Modelo</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Laboratorio de Modelos</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div>
            <p className="font-medium mb-2">Proveedor de Embeddings</p>
            <RadioGroup value={provider} onValueChange={(v) => setProvider(v as any)} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="surus" id="r1" />
                <Label htmlFor="r1">Surus</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="openai" id="r2" />
                <Label htmlFor="r2">OpenAI</Label>
              </div>
            </RadioGroup>
          </div>

          {provider === "surus" && (
            <div>
              <p className="font-medium mb-2">Dimensión</p>
              <RadioGroup value={String(dimension)} onValueChange={(v) => setDimension(parseInt(v))} className="flex gap-4 flex-wrap">
                {dims.map((d) => (
                  <div key={d} className="flex items-center gap-2">
                    <RadioGroupItem value={String(d)} id={`dim-${d}`} />
                    <Label htmlFor={`dim-${d}`}>{d}D</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          <CostComparison vectorCount={vectorCount} />
        </div>
      </DialogContent>
    </Dialog>
  )
} 