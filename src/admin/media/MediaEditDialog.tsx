/**
 * MediaEditDialog Component
 * Dialog for editing media metadata
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useMediaMutations } from '@/hooks/use-media'
import { Media, MediaUpdate } from '@/lib/types/database'
import { formatFileSize, formatDate } from '@/lib/utils'

const CATEGORIES = [
  { value: 'before_after', label: 'Vorher/Nachher' },
  { value: 'team', label: 'Team' },
  { value: 'salon', label: 'Salon' },
  { value: 'products', label: 'Produkte' },
  { value: 'gallery', label: 'Galerie' },
  { value: 'other', label: 'Sonstiges' }
]

interface MediaEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  media: Media
}

export function MediaEditDialog({ open, onOpenChange, media }: MediaEditDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    tags: '',
    is_public: false,
    is_active: true
  })

  const { updateMedia, isUpdating } = useMediaMutations()

  // Initialize form with media data
  useEffect(() => {
    if (media) {
      setFormData({
        title: media.title || '',
        description: media.description || '',
        category: media.category || '',
        tags: media.tags ? media.tags.join(', ') : '',
        is_public: media.is_public,
        is_active: media.is_active
      })
    }
  }, [media])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const tags = formData.tags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)

    const updateData: MediaUpdate = {
      title: formData.title || undefined,
      description: formData.description || undefined,
      category: formData.category || undefined,
      tags: tags.length > 0 ? tags : undefined,
      is_public: formData.is_public,
      is_active: formData.is_active
    }

    updateMedia({ id: media.id, data: updateData })
    onOpenChange(false)
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Medium bearbeiten</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Info (Read-only) */}
          <div className="space-y-2">
            <Label>Dateiinformationen</Label>
            <div className="p-3 bg-muted rounded-lg space-y-1">
              <div className="font-medium">{media.original_filename}</div>
              <div className="text-sm text-muted-foreground">
                {formatFileSize(media.file_size)} • {media.mime_type}
              </div>
              <div className="text-sm text-muted-foreground">
                Erstellt: {formatDate(media.created_at)}
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder={media.filename}
                disabled={isUpdating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Kategorie</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                disabled={isUpdating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Keine Kategorie</SelectItem>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Beschreibung des Mediums..."
                rows={3}
                disabled={isUpdating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="Tag1, Tag2, Tag3"
                disabled={isUpdating}
              />
              <p className="text-xs text-muted-foreground">
                Mehrere Tags durch Komma getrennt
              </p>
            </div>

            {/* Status Checkboxes */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_public"
                  checked={formData.is_public}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_public: !!checked }))}
                  disabled={isUpdating}
                />
                <Label htmlFor="is_public" className="text-sm">
                  Öffentlich zugänglich
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: !!checked }))}
                  disabled={isUpdating}
                />
                <Label htmlFor="is_active" className="text-sm">
                  Aktiv
                </Label>
              </div>
            </div>

            {/* Current Status */}
            <div className="space-y-2">
              <Label>Aktueller Status</Label>
              <div className="flex gap-2">
                {media.is_public && (
                  <Badge variant="outline">Öffentlich</Badge>
                )}
                {media.is_active ? (
                  <Badge variant="default">Aktiv</Badge>
                ) : (
                  <Badge variant="destructive">Inaktiv</Badge>
                )}
                {media.category && (
                  <Badge variant="secondary">
                    {CATEGORIES.find(c => c.value === media.category)?.label || media.category}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isUpdating}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? 'Speichern...' : 'Speichern'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}