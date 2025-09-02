/**
 * MediaPreviewDialog Component
 * Dialog for previewing media files
 */

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Download, ExternalLink, Copy } from 'lucide-react'
import { Media } from '@/lib/types/database'
import { formatFileSize, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

const CATEGORIES = [
  { value: 'before_after', label: 'Vorher/Nachher' },
  { value: 'team', label: 'Team' },
  { value: 'salon', label: 'Salon' },
  { value: 'products', label: 'Produkte' },
  { value: 'gallery', label: 'Galerie' },
  { value: 'other', label: 'Sonstiges' }
]

interface MediaPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  media: Media & { signedUrl?: string }
}

export function MediaPreviewDialog({ open, onOpenChange, media }: MediaPreviewDialogProps) {
  const handleDownload = () => {
    if (media.signedUrl) {
      const link = document.createElement('a')
      link.href = media.signedUrl
      link.download = media.original_filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleCopyUrl = async () => {
    if (media.signedUrl) {
      try {
        await navigator.clipboard.writeText(media.signedUrl)
        toast.success('URL in die Zwischenablage kopiert')
      } catch (error) {
        console.error('Failed to copy URL:', error)
        toast.error('Fehler beim Kopieren der URL')
      }
    }
  }

  const handleOpenInNewTab = () => {
    if (media.signedUrl) {
      window.open(media.signedUrl, '_blank')
    }
  }

  const isImage = media.mime_type.startsWith('image/')
  const isVideo = media.mime_type.startsWith('video/')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{media.title || media.filename}</span>
            <div className="flex gap-2">
              {media.signedUrl && (
                <>
                  <Button variant="outline" size="sm" onClick={handleCopyUrl}>
                    <Copy className="w-4 h-4 mr-2" />
                    URL kopieren
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Öffnen
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Media Preview */}
          <div className="flex justify-center bg-muted rounded-lg overflow-hidden">
            {media.signedUrl ? (
              <div className="w-full max-w-3xl">
                {isImage && (
                  <img
                    src={media.signedUrl}
                    alt={media.title || media.filename}
                    className="w-full h-auto max-h-[60vh] object-contain"
                  />
                )}
                {isVideo && (
                  <video
                    controls
                    className="w-full h-auto max-h-[60vh]"
                    preload="metadata"
                  >
                    <source src={media.signedUrl} type={media.mime_type} />
                    Ihr Browser unterstützt dieses Videoformat nicht.
                  </video>
                )}
                {!isImage && !isVideo && (
                  <div className="p-12 text-center">
                    <p className="text-muted-foreground">
                      Vorschau für diesen Dateityp nicht verfügbar
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="text-muted-foreground">
                  Laden der Vorschau...
                </p>
              </div>
            )}
          </div>

          {/* Media Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-semibold">Dateiinformationen</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Dateiname:</span>
                  <span className="ml-2">{media.original_filename}</span>
                </div>
                <div>
                  <span className="font-medium">Größe:</span>
                  <span className="ml-2">{formatFileSize(media.file_size)}</span>
                </div>
                <div>
                  <span className="font-medium">Typ:</span>
                  <span className="ml-2">{media.mime_type}</span>
                </div>
                <div>
                  <span className="font-medium">Erstellt:</span>
                  <span className="ml-2">{formatDate(media.created_at)}</span>
                </div>
                {media.uploaded_at && (
                  <div>
                    <span className="font-medium">Hochgeladen:</span>
                    <span className="ml-2">{formatDate(media.uploaded_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Metadata */}
            <div className="space-y-4">
              <h3 className="font-semibold">Metadaten</h3>
              <div className="space-y-2 text-sm">
                {media.title && (
                  <div>
                    <span className="font-medium">Titel:</span>
                    <span className="ml-2">{media.title}</span>
                  </div>
                )}
                {media.description && (
                  <div>
                    <span className="font-medium">Beschreibung:</span>
                    <p className="mt-1 text-muted-foreground">{media.description}</p>
                  </div>
                )}
                {media.category && (
                  <div>
                    <span className="font-medium">Kategorie:</span>
                    <span className="ml-2">
                      {CATEGORIES.find(c => c.value === media.category)?.label || media.category}
                    </span>
                  </div>
                )}
                {media.tags && media.tags.length > 0 && (
                  <div>
                    <span className="font-medium">Tags:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {media.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <h3 className="font-semibold">Status</h3>
            <div className="flex gap-2">
              {media.is_public ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Öffentlich
                </Badge>
              ) : (
                <Badge variant="outline">
                  Privat
                </Badge>
              )}
              {media.is_active ? (
                <Badge variant="default">
                  Aktiv
                </Badge>
              ) : (
                <Badge variant="destructive">
                  Inaktiv
                </Badge>
              )}
            </div>
          </div>

          {/* Technical Details */}
          <details className="space-y-2">
            <summary className="font-semibold cursor-pointer">Technische Details</summary>
            <div className="text-sm text-muted-foreground space-y-1 pl-4">
              <div>
                <span className="font-medium">ID:</span>
                <span className="ml-2 font-mono">{media.id}</span>
              </div>
              <div>
                <span className="font-medium">Pfad:</span>
                <span className="ml-2 font-mono">{media.file_path}</span>
              </div>
              <div>
                <span className="font-medium">Bucket:</span>
                <span className="ml-2 font-mono">{media.storage_bucket}</span>
              </div>
              {media.uploaded_by && (
                <div>
                  <span className="font-medium">Hochgeladen von:</span>
                  <span className="ml-2 font-mono">{media.uploaded_by}</span>
                </div>
              )}
            </div>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  )
}