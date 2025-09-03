/**
 * Heatmap Chart Component
 * Shows peak booking times by day of week and hour
 */

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Clock, TrendingUp } from 'lucide-react'
import { HeatmapData } from '@/lib/types/analytics'

interface HeatmapChartProps {
  data: HeatmapData[]
  isLoading?: boolean
  title?: string
  onCellClick?: (dayOfWeek: number, hour: number, data: HeatmapData) => void
}

export function HeatmapChart({ 
  data, 
  isLoading = false, 
  title = "Spitzenzeiten Heatmap",
  onCellClick 
}: HeatmapChartProps) {
  const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
  const hours = Array.from({ length: 24 }, (_, i) => i)
  
  // Get data by day and hour
  const getDataForCell = (dayOfWeek: number, hour: number): HeatmapData | null => {
    return data.find(d => d.dayOfWeek === dayOfWeek && d.hour === hour) || null
  }

  // Get color intensity based on density (0-1)
  const getColorIntensity = (density: number): string => {
    if (density === 0) return 'bg-gray-100'
    if (density <= 0.2) return 'bg-blue-100'
    if (density <= 0.4) return 'bg-blue-200'
    if (density <= 0.6) return 'bg-blue-300'
    if (density <= 0.8) return 'bg-blue-400'
    return 'bg-blue-500'
  }

  // Get text color for better contrast
  const getTextColor = (density: number): string => {
    return density > 0.6 ? 'text-white' : 'text-gray-700'
  }

  // Find peak hours
  const peakData = data
    .filter(d => d.density > 0.7)
    .sort((a, b) => b.density - a.density)
    .slice(0, 3)

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-8 gap-2">
              {Array.from({ length: 8 * 12 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
            <div className="flex gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-24" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-4">
            {/* Legend */}
            <div className="flex items-center gap-2 text-sm">
              <span>Wenig</span>
              <div className="flex gap-1">
                {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((density, i) => (
                  <div
                    key={i}
                    className={`w-4 h-4 ${getColorIntensity(density)} border border-gray-200`}
                  />
                ))}
              </div>
              <span>Viel</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Peak Times Summary */}
          {peakData.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Spitzenzeiten
              </h4>
              <div className="flex flex-wrap gap-2">
                {peakData.map((peak, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {days[peak.dayOfWeek]} {peak.hour}:00 
                    ({peak.appointments} Termine)
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Heatmap Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Hour headers */}
              <div className="grid grid-cols-25 gap-1 mb-2">
                <div className="text-xs font-medium text-center py-1"></div>
                {hours.map(hour => (
                  <div key={hour} className="text-xs font-medium text-center py-1">
                    {hour}
                  </div>
                ))}
              </div>
              
              {/* Day rows */}
              {days.map((day, dayIndex) => (
                <div key={dayIndex} className="grid grid-cols-25 gap-1 mb-1">
                  {/* Day label */}
                  <div className="text-xs font-medium text-center py-2 pr-2">
                    {day}
                  </div>
                  
                  {/* Hour cells */}
                  {hours.map(hour => {
                    const cellData = getDataForCell(dayIndex, hour)
                    const density = cellData?.density || 0
                    const appointments = cellData?.appointments || 0
                    const revenue = cellData?.revenue || 0
                    
                    return (
                      <div
                        key={hour}
                        className={`
                          h-8 min-w-[30px] rounded border border-gray-200 flex items-center justify-center text-xs font-medium cursor-pointer transition-all hover:scale-105 hover:shadow-sm
                          ${getColorIntensity(density)}
                          ${getTextColor(density)}
                        `}
                        title={`${day} ${hour}:00\n${appointments} Termine\nCHF ${revenue.toFixed(2)}`}
                        onClick={() => onCellClick?.(dayIndex, hour, cellData!)}
                      >
                        {appointments > 0 ? appointments : ''}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-lg font-semibold">
                {data.reduce((sum, d) => sum + d.appointments, 0)}
              </div>
              <div className="text-xs text-muted-foreground">Termine Gesamt</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">
                CHF {data.reduce((sum, d) => sum + (d.revenue || 0), 0).toLocaleString('de-CH')}
              </div>
              <div className="text-xs text-muted-foreground">Umsatz Gesamt</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {peakData.length > 0 ? `${days[peakData[0].dayOfWeek]} ${peakData[0].hour}:00` : '-'}
              </div>
              <div className="text-xs text-muted-foreground">Beste Zeit</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {data.filter(d => d.appointments > 0).length}
              </div>
              <div className="text-xs text-muted-foreground">Aktive Stunden</div>
            </div>
          </div>

          {/* Business Hours Indicators */}
          <div className="text-xs text-muted-foreground">
            <p>💡 Tipp: Klicken Sie auf eine Zelle für Detail-Informationen</p>
            <p>Die Farben zeigen die relative Buchungsdichte - dunklere Farben bedeuten mehr Termine</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}