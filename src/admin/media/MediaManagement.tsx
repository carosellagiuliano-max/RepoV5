/**
 * MediaManagement Component
 * Main admin interface for managing media files
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Search, 
  Upload, 
  Image,
  Video,
  File,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Download,
  Grid,
  List,
  Filter
} from 'lucide-react'
import { useMedia, useMediaMutations, useSignedUrls } from '@/hooks/use-media'
import { Media, MediaFilters } from '@/lib/types/database'
import { MediaUploadDialog } from './MediaUploadDialog'
import { MediaEditDialog } from './MediaEditDialog'
import { MediaPreviewDialog } from './MediaPreviewDialog'
import { formatFileSize, formatDate } from '@/lib/utils'

const MIME_TYPE_ICONS = {
  'image/jpeg': Image,
  'image/png': Image,
  'image/webp': Image,
  'image/gif': Image,
  'video/mp4': Video,
  'video/webm': Video,
  'video/quicktime': Video,
  default: File
}

const CATEGORIES = [
  { value: 'before_after', label: 'Vorher/Nachher' },
  { value: 'team', label: 'Team' },
  { value: 'salon', label: 'Salon' },
  { value: 'products', label: 'Produkte' },
  { value: 'gallery', label: 'Galerie' },
  { value: 'other', label: 'Sonstiges' }
]

export function MediaManagement() {
  const [filters, setFilters] = useState<MediaFilters>({
    page: 1,
    limit: 20,
    sortBy: 'created_at',
    sortOrder: 'desc',
    isActive: true
  })
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // Dialog states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null)

  // Hooks
  const { data: mediaResponse, isLoading, error } = useMedia(filters)
  const { deleteMedia, isDeleting } = useMediaMutations()
  const { getSignedUrl } = useSignedUrls()

  const media = mediaResponse?.data?.media || []
  const pagination = mediaResponse?.data?.pagination

  // Handlers
  const handleSearch = (value: string) => {
    setSearch(value)
    setFilters(prev => ({ ...prev, search: value || undefined, page: 1 }))
  }

  const handleFilterChange = (key: keyof MediaFilters, value: string | boolean | number | undefined) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }))
  }

  const handleEdit = (mediaItem: Media) => {
    setSelectedMedia(mediaItem)
    setEditDialogOpen(true)
  }

  const handlePreview = async (mediaItem: Media) => {
    try {
      // Get signed URL for preview
      const signedUrlData = await getSignedUrl(mediaItem.id, 3600) // 1 hour
      setSelectedMedia({
        ...mediaItem,
        signedUrl: signedUrlData.signedUrl
      } as Media & { signedUrl: string })
      setPreviewDialogOpen(true)
    } catch (error) {
      console.error('Failed to get preview URL:', error)
    }
  }

  const handleDelete = (mediaId: string) => {
    if (confirm('Sind Sie sicher, dass Sie diese Datei löschen möchten?')) {
      deleteMedia(mediaId)
    }
  }

  const handleDownload = async (mediaItem: Media) => {
    try {
      const signedUrlData = await getSignedUrl(mediaItem.id, 300) // 5 minutes
      const link = document.createElement('a')
      link.href = signedUrlData.signedUrl
      link.download = mediaItem.original_filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Failed to download file:', error)
    }
  }

  const getFileIcon = (mimeType: string) => {
    const IconComponent = MIME_TYPE_ICONS[mimeType as keyof typeof MIME_TYPE_ICONS] || MIME_TYPE_ICONS.default
    return IconComponent
  }

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {media.map((item) => {
        const IconComponent = getFileIcon(item.mime_type)
        
        return (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              {/* File preview */}
              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center mb-3 overflow-hidden">
                {item.mime_type.startsWith('image/') ? (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                    <IconComponent className="w-8 h-8 text-primary" />
                  </div>
                ) : (
                  <IconComponent className="w-8 h-8 text-muted-foreground" />
                )}
              </div>

              {/* File info */}
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-medium text-sm truncate" title={item.title || item.filename}>
                    {item.title || item.filename}
                  </h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handlePreview(item)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Vorschau
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(item)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Bearbeiten
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload(item)}>
                        <Download className="w-4 h-4 mr-2" />
                        Herunterladen
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(item.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatFileSize(item.file_size)}</span>
                  <span>•</span>
                  <span>{formatDate(item.created_at)}</span>
                </div>

                {item.category && (
                  <Badge variant="secondary" className="text-xs">
                    {CATEGORIES.find(c => c.value === item.category)?.label || item.category}
                  </Badge>
                )}

                {item.is_public && (
                  <Badge variant="outline" className="text-xs">
                    Öffentlich
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )

  const renderListView = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Datei</TableHead>
          <TableHead>Typ</TableHead>
          <TableHead>Größe</TableHead>
          <TableHead>Kategorie</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Erstellt</TableHead>
          <TableHead className="w-[100px]">Aktionen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {media.map((item) => {
          const IconComponent = getFileIcon(item.mime_type)
          
          return (
            <TableRow key={item.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <IconComponent className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{item.title || item.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.original_filename}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {item.mime_type.split('/')[1].toUpperCase()}
                </Badge>
              </TableCell>
              <TableCell>{formatFileSize(item.file_size)}</TableCell>
              <TableCell>
                {item.category ? (
                  <Badge variant="secondary" className="text-xs">
                    {CATEGORIES.find(c => c.value === item.category)?.label || item.category}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {item.is_public && (
                    <Badge variant="outline" className="text-xs">
                      Öffentlich
                    </Badge>
                  )}
                  {!item.is_active && (
                    <Badge variant="destructive" className="text-xs">
                      Inaktiv
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>{formatDate(item.created_at)}</TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handlePreview(item)}>
                      <Eye className="w-4 h-4 mr-2" />
                      Vorschau
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleEdit(item)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Bearbeiten
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDownload(item)}>
                      <Download className="w-4 h-4 mr-2" />
                      Herunterladen
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(item.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-destructive">Fehler beim Laden der Medien</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-bold">Medienverwaltung</h2>
          <p className="text-muted-foreground">
            Verwalten Sie alle Medieninhalte Ihres Salons
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)} className="gap-2">
          <Upload className="w-4 h-4" />
          Datei hochladen
        </Button>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Suchen nach Titel, Dateiname..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category Filter */}
            <Select 
              value={filters.category || 'all'} 
              onValueChange={(value) => handleFilterChange('category', value === 'all' ? undefined : value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select 
              value={filters.mimeType || 'all'} 
              onValueChange={(value) => handleFilterChange('mimeType', value === 'all' ? undefined : value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Typ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                <SelectItem value="image/">Bilder</SelectItem>
                <SelectItem value="video/">Videos</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <div className="flex gap-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Media Content */}
      {isLoading ? (
        <div className="text-center py-8">
          <p>Laden...</p>
        </div>
      ) : media.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Keine Medien gefunden</p>
            <p className="text-muted-foreground mb-4">
              Laden Sie Ihre ersten Dateien hoch, um zu beginnen.
            </p>
            <Button onClick={() => setUploadDialogOpen(true)}>
              Erste Datei hochladen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            {viewMode === 'grid' ? renderGridView() : renderListView()}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleFilterChange('page', Math.max(1, filters.page! - 1))}
            disabled={filters.page === 1}
          >
            Vorherige
          </Button>
          <span className="px-4 py-2 text-sm">
            Seite {filters.page} von {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => handleFilterChange('page', Math.min(pagination.totalPages, filters.page! + 1))}
            disabled={filters.page === pagination.totalPages}
          >
            Nächste
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <MediaUploadDialog 
        open={uploadDialogOpen} 
        onOpenChange={setUploadDialogOpen} 
      />
      
      {selectedMedia && (
        <>
          <MediaEditDialog 
            open={editDialogOpen} 
            onOpenChange={setEditDialogOpen}
            media={selectedMedia}
          />
          <MediaPreviewDialog 
            open={previewDialogOpen} 
            onOpenChange={setPreviewDialogOpen}
            media={selectedMedia as Media & { signedUrl: string }}
          />
        </>
      )}
    </div>
  )
}