import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Download } from 'lucide-react'
import { format } from 'date-fns'
import { useToast } from '@/hooks/use-toast'

interface ExportButtonProps {
  dateRange: {
    from: Date
    to: Date
  }
  selectedStaff: string
  selectedService: string
}

export function ExportButton({ dateRange, selectedStaff, selectedService }: ExportButtonProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState<string | null>(null)

  const handleExport = async (type: 'appointments' | 'staff' | 'services' | 'revenue') => {
    try {
      setLoading(type)

      const params = new URLSearchParams({
        type,
        startDate: format(dateRange.from, 'yyyy-MM-dd'),
        endDate: format(dateRange.to, 'yyyy-MM-dd'),
        format: 'csv'
      })

      if (selectedStaff) {
        params.append('staffId', selectedStaff)
      }
      if (selectedService) {
        params.append('serviceId', selectedService)
      }

      const response = await fetch(`/netlify/functions/admin/analytics/export?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('content-disposition')
      let filename = `analytics_${type}_${format(new Date(), 'yyyy-MM-dd')}.csv`
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // Download the file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: 'Export erfolgreich',
        description: `${getExportTypeName(type)} wurde heruntergeladen.`,
      })

    } catch (error) {
      console.error('Export failed:', error)
      toast({
        title: 'Export fehlgeschlagen',
        description: 'Der Export konnte nicht erstellt werden.',
        variant: 'destructive'
      })
    } finally {
      setLoading(null)
    }
  }

  const getExportTypeName = (type: string) => {
    switch (type) {
      case 'appointments': return 'Termine'
      case 'staff': return 'Mitarbeiter'
      case 'services': return 'Services'
      case 'revenue': return 'Umsatz'
      default: return 'Daten'
    }
  }

  const exportOptions = [
    {
      type: 'appointments' as const,
      label: 'Termine exportieren',
      description: 'Alle Termine mit Details'
    },
    {
      type: 'staff' as const,
      label: 'Mitarbeiter exportieren',
      description: 'Performance-Daten der Mitarbeiter'
    },
    {
      type: 'services' as const,
      label: 'Services exportieren',
      description: 'Service-Popularität und Umsatz'
    },
    {
      type: 'revenue' as const,
      label: 'Umsatz exportieren',
      description: 'Tägliche Umsatzdaten'
    }
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {exportOptions.map((option) => (
          <DropdownMenuItem
            key={option.type}
            onClick={() => handleExport(option.type)}
            disabled={loading === option.type}
            className="flex flex-col items-start p-3"
          >
            <div className="font-medium">
              {loading === option.type ? 'Exportiere...' : option.label}
            </div>
            <div className="text-xs text-muted-foreground">
              {option.description}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}