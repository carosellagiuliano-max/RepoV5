/**
 * MediaUploadDialog Component
 * Dialog for uploading new media files
 */

import { useState, useCallback } from 'react'
// Note: react-dropzone would be ideal but using basic file input for now
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Upload, 
  X, 
  Image,
  Video,
  File,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { useMediaUpload } from '@/hooks/use-media'
import { formatFileSize } from '@/lib/utils'

const CATEGORIES = [
  { value: 'before_after', label: 'Vorher/Nachher' },
  { value: 'team', label: 'Team' },
  { value: 'salon', label: 'Salon' },
  { value: 'products', label: 'Produkte' },
  { value: 'gallery', label: 'Galerie' },
  { value: 'other', label: 'Sonstiges' }
]

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime'
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

interface FileWithMetadata extends File {
  id: string
  preview?: string
  error?: string
  progress?: number
  uploaded?: boolean
}

interface MediaUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MediaUploadDialog({ open, onOpenChange }: MediaUploadDialogProps) {
  const [files, setFiles] = useState<FileWithMetadata[]>([])
  const [metadata, setMetadata] = useState({
    title: '',
    description: '',
    category: '',
    tags: '',
    is_public: false
  })
  const [isUploading, setIsUploading] = useState(false)

  const { uploadFile, uploadProgress } = useMediaUpload()

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return Image
    if (file.type.startsWith('video/')) return Video
    return File
  }

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Dateityp ${file.type} ist nicht erlaubt`
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Datei ist zu groß (max. ${formatFileSize(MAX_FILE_SIZE)})`
    }
    return null
  }

  const onFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || [])
    const newFiles: FileWithMetadata[] = selectedFiles.map(file => {
      const error = validateFile(file)
      const fileWithMetadata: FileWithMetadata = {
        ...file,
        id: `${Date.now()}-${file.name}`,
        error: error || undefined,
        progress: 0,
        uploaded: false
      }

      // Create preview for images
      if (file.type.startsWith('image/') && !error) {
        fileWithMetadata.preview = URL.createObjectURL(file)
      }

      return fileWithMetadata
    })

    setFiles(prev => [...prev, ...newFiles])
    // Reset input
    event.target.value = ''
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    const newFiles: FileWithMetadata[] = droppedFiles.map(file => {
      const error = validateFile(file)
      const fileWithMetadata: FileWithMetadata = {
        ...file,
        id: `${Date.now()}-${file.name}`,
        error: error || undefined,
        progress: 0,
        uploaded: false
      }

      // Create preview for images
      if (file.type.startsWith('image/') && !error) {
        fileWithMetadata.preview = URL.createObjectURL(file)
      }

      return fileWithMetadata
    })

    setFiles(prev => [...prev, ...newFiles])
  }

  const [isDragging, setIsDragging] = useState(false)

  const removeFile = (fileId: string) => {
    setFiles(prev => {
      const updatedFiles = prev.filter(f => f.id !== fileId)
      // Revoke preview URLs to prevent memory leaks
      prev.forEach(f => {
        if (f.id === fileId && f.preview) {
          URL.revokeObjectURL(f.preview)
        }
      })
      return updatedFiles
    })
  }

  const handleUpload = async () => {
    const validFiles = files.filter(f => !f.error && !f.uploaded)
    if (validFiles.length === 0) return

    setIsUploading(true)

    try {
      for (const file of validFiles) {
        // Update progress
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, progress: 0 } : f
        ))

        const tags = metadata.tags
          .split(',')
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0)

        await uploadFile(file, {
          title: metadata.title || file.name,
          description: metadata.description || undefined,
          category: metadata.category || undefined,
          tags: tags.length > 0 ? tags : undefined,
          is_public: metadata.is_public
        })

        // Mark as uploaded
        setFiles(prev => prev.map(f => 
          f.id === file.id ? { ...f, progress: 100, uploaded: true } : f
        ))
      }

      // Close dialog after successful upload
      setTimeout(() => {
        handleClose()
      }, 1000)

    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleClose = () => {
    // Revoke all preview URLs
    files.forEach(f => {
      if (f.preview) {
        URL.revokeObjectURL(f.preview)
      }
    })
    
    setFiles([])
    setMetadata({
      title: '',
      description: '',
      category: '',
      tags: '',
      is_public: false
    })
    setIsUploading(false)
    onOpenChange(false)
  }

  const validFiles = files.filter(f => !f.error)
  const invalidFiles = files.filter(f => f.error)
  const uploadedFiles = files.filter(f => f.uploaded)
  const canUpload = validFiles.length > 0 && !isUploading

  return (
    <Dialog open={open} onOpenChange={!isUploading ? onOpenChange : undefined}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Neue Medien hochladen</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Upload Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              handleDrop(e)
            }}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input 
              id="file-input"
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={onFileSelect}
              className="hidden"
            />
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            {isDragging ? (
              <p className="text-lg">Dateien hier ablegen...</p>
            ) : (
              <div>
                <p className="text-lg mb-2">
                  Dateien hierhin ziehen oder klicken zum Auswählen
                </p>
                <p className="text-sm text-muted-foreground">
                  Unterstützt: JPG, PNG, WebP, GIF, MP4, WebM, MOV (max. {formatFileSize(MAX_FILE_SIZE)})
                </p>
              </div>
            )}
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium">Ausgewählte Dateien ({files.length})</h3>
              
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {files.map((file) => {
                  const IconComponent = getFileIcon(file)
                  const progress = uploadProgress[file.id] || file.progress || 0
                  
                  return (
                    <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      {/* Preview or Icon */}
                      <div className="w-12 h-12 rounded flex items-center justify-center overflow-hidden bg-muted">
                        {file.preview ? (
                          <img src={file.preview} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <IconComponent className="w-6 h-6 text-muted-foreground" />
                        )}
                      </div>

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{file.name}</p>
                          {file.uploaded && <CheckCircle className="w-4 h-4 text-green-600" />}
                          {file.error && <AlertCircle className="w-4 h-4 text-destructive" />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                        
                        {file.error && (
                          <p className="text-sm text-destructive">{file.error}</p>
                        )}
                        
                        {(isUploading || file.uploaded) && !file.error && (
                          <Progress value={progress} className="w-full mt-1" />
                        )}
                      </div>

                      {/* Remove Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        disabled={isUploading}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )
                })}
              </div>

              {invalidFiles.length > 0 && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive font-medium">
                    {invalidFiles.length} Datei(en) konnten nicht verarbeitet werden
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Metadata Form */}
          {validFiles.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium">Metadaten (für alle Dateien)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titel (optional)</Label>
                  <Input
                    id="title"
                    value={metadata.title}
                    onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Standard: Dateiname"
                    disabled={isUploading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Kategorie</Label>
                  <Select 
                    value={metadata.category} 
                    onValueChange={(value) => setMetadata(prev => ({ ...prev, category: value }))}
                    disabled={isUploading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kategorie wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung (optional)</Label>
                <Textarea
                  id="description"
                  value={metadata.description}
                  onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Beschreibung der Medien..."
                  rows={3}
                  disabled={isUploading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags (optional)</Label>
                <Input
                  id="tags"
                  value={metadata.tags}
                  onChange={(e) => setMetadata(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="Tag1, Tag2, Tag3"
                  disabled={isUploading}
                />
                <p className="text-xs text-muted-foreground">
                  Mehrere Tags durch Komma getrennt
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_public"
                  checked={metadata.is_public}
                  onCheckedChange={(checked) => setMetadata(prev => ({ ...prev, is_public: !!checked }))}
                  disabled={isUploading}
                />
                <Label htmlFor="is_public" className="text-sm">
                  Öffentlich zugänglich (ohne Anmeldung sichtbar)
                </Label>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={handleClose}
              disabled={isUploading}
            >
              Abbrechen
            </Button>
            <Button 
              onClick={handleUpload}
              disabled={!canUpload}
            >
              {isUploading ? 'Hochladen...' : `${validFiles.length} Datei(en) hochladen`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}