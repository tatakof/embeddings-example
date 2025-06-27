"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface CostComparisonProps {
  vectorCount: number
}

export function CostComparison({ vectorCount }: CostComparisonProps) {
  const dimensions = [
    { size: 1536, label: "OpenAI text-embedding-3-large", color: "destructive", provider: "openai" },
    { size: 768, label: "Surus Standard", color: "default", provider: "surus" },
    { size: 512, label: "Surus Balanced", color: "secondary", provider: "surus" },
    { size: 256, label: "Surus Efficient", color: "outline", provider: "surus" },
    { size: 128, label: "Surus Ultra-compact", color: "outline", provider: "surus" },
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
        <CardTitle>Storage Cost Comparison</CardTitle>
        <CardDescription>Monthly storage costs for {vectorCount.toLocaleString()} vectors in Qdrant</CardDescription>
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
                  <div className="font-medium">${cost.toFixed(4)}/month</div>
                  {savings > 0 && <div className="text-sm text-green-600">{savings.toFixed(0)}% savings</div>}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Matryoshka embeddings</strong> allow you to use smaller dimensions without retraining,
            maintaining {">"}90% performance while reducing storage costs by up to 92%.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
