"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface CostComparisonProps {
  vectorCount: number
}

export function CostComparison({ vectorCount }: CostComparisonProps) {
  const dimensions = [
    { size: 1536, label: "OpenAI text-embedding-3-large", color: "destructive", provider: "openai" },
    { size: 768, label: "Surus Estándar", color: "default", provider: "surus" },
    { size: 512, label: "Surus Balanceado", color: "secondary", provider: "surus" },
    { size: 256, label: "Surus Eficiente", color: "outline", provider: "surus" },
    { size: 128, label: "Surus Ultra-compacto", color: "outline", provider: "surus" },
  ]

  const calculateCost = (dimension: number) => {
    const bytesPerFloat = 4
    const bytesPerVector = dimension * bytesPerFloat
    const totalBytes = vectorCount * bytesPerVector
    const totalMB = totalBytes / (1024 * 1024)
    const costPerMBPerMonth = 0.001
    return totalMB * costPerMBPerMonth
  }

  const baseCost = calculateCost(1536) // OpenAI baseline

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparación de Costos de Almacenamiento</CardTitle>
        <CardDescription>Costos mensuales de almacenamiento para {vectorCount.toLocaleString()} vectores en Qdrant</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {dimensions.map((dim) => {
            const cost = calculateCost(dim.size)
            const savings = ((baseCost - cost) / baseCost) * 100
            const storageSize = (vectorCount * dim.size * 4) / (1024 * 1024)

            return (
              <div key={dim.size} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant={dim.color as any}>{dim.label}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {dim.size}D •{" "}
                    {storageSize > 1024 ? `${(storageSize / 1024).toFixed(1)}GB` : `${storageSize.toFixed(1)}MB`}
                  </span>
                </div>
                <div className="text-right">
                  <div className="font-medium">${cost.toFixed(4)}/mes</div>
                  {savings > 0 && <div className="text-sm text-green-600">{savings.toFixed(0)}% de ahorro</div>}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Los embeddings Matryoshka</strong> te permiten usar dimensiones más chicas sin reentrenar,
            manteniendo {">"}90% del rendimiento mientras reducís los costos de almacenamiento hasta un 92%.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
