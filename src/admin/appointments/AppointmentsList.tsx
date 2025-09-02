/**
 * Appointments List View
 * Professional table view with sorting, pagination and inline actions
 */

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { 
  MoreVertical, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  Edit, 
  Trash2, 
  Phone, 
  Mail, 
  Clock,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User
} from 'lucide-react'
import { AppointmentFilters } from './CalendarPro'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'

interface AppointmentsListProps {
  appointments: any[]
  loading: boolean
  onReschedule: (appointmentId: string, newStartTime: string, newEndTime: string) => Promise<boolean>
  onCancel: (appointmentId: string, reason?: string) => Promise<void>
  onStatusUpdate: (data: { appointmentId: string; status: string; notes?: string }) => Promise<void>
  filters: AppointmentFilters
  onFilterChange: (filters: Partial<AppointmentFilters>) => void
}

interface CancelDialogState {
  isOpen: boolean
  appointment: any | null
  reason: string
}

export function AppointmentsList({
  appointments,
  loading,
  onReschedule,
  onCancel,
  onStatusUpdate,
  filters,
  onFilterChange
}: AppointmentsListProps) {
  const [sortConfig, setSortConfig] = useState<{
    key: string
    direction: 'asc' | 'desc'
  }>({
    key: 'start_time',
    direction: 'asc'
  })
  
  const [cancelDialog, setCancelDialog] = useState<CancelDialogState>({
    isOpen: false,
    appointment: null,
    reason: ''
  })

  // Sort appointments
  const sortedAppointments = useMemo(() => {
    if (!appointments) return []
    
    return [...appointments].sort((a, b) => {
      let aValue: any = a[sortConfig.key]
      let bValue: any = b[sortConfig.key]
      
      // Handle nested properties
      if (sortConfig.key.includes('_')) {
        const [table, field] = sortConfig.key.split('_', 2)
        if (table === 'customer') {
          aValue = a.customer_name
          bValue = b.customer_name
        } else if (table === 'staff') {
          aValue = a.staff_name
          bValue = b.staff_name
        } else if (table === 'service') {
          aValue = a.service_name
          bValue = b.service_name
        }
      }
      
      // Handle different data types
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortConfig.direction === 'asc' 
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime()
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue, 'de')
          : bValue.localeCompare(aValue, 'de')
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
      }
      
      return 0
    })
  }, [appointments, sortConfig])

  // Pagination
  const currentPage = filters.page || 1
  const itemsPerPage = filters.limit || 20
  const totalPages = Math.ceil(sortedAppointments.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedAppointments = sortedAppointments.slice(startIndex, endIndex)

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const handlePageChange = (page: number) => {
    onFilterChange({ page })
  }

  const handleStatusChange = async (appointment: any, newStatus: string) => {
    await onStatusUpdate({
      appointmentId: appointment.id,
      status: newStatus
    })
  }

  const handleCancelClick = (appointment: any) => {
    setCancelDialog({
      isOpen: true,
      appointment,
      reason: ''
    })
  }

  const handleCancelConfirm = async () => {
    if (cancelDialog.appointment) {
      await onCancel(cancelDialog.appointment.id, cancelDialog.reason)
      setCancelDialog({ isOpen: false, appointment: null, reason: '' })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'no_show':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Bestätigt'
      case 'pending': return 'Ausstehend'
      case 'completed': return 'Abgeschlossen'
      case 'cancelled': return 'Storniert'
      case 'no_show': return 'Nicht erschienen'
      default: return status
    }
  }

  const SortIcon = ({ column }: { column: string }) => {
    if (sortConfig.key !== column) {
      return <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-4 h-4" />
      : <ArrowDown className="w-4 h-4" />
  }

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF'
    }).format(cents / 100)
  }

  return (
    <div className="space-y-4">
      {/* List Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {sortedAppointments.length} Termine gefunden
              </div>
              
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => onFilterChange({ limit: parseInt(value), page: 1 })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 pro Seite</SelectItem>
                  <SelectItem value="20">20 pro Seite</SelectItem>
                  <SelectItem value="50">50 pro Seite</SelectItem>
                  <SelectItem value="100">100 pro Seite</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = i + 1
                    if (totalPages > 5) {
                      if (currentPage > 3) {
                        pageNum = currentPage - 2 + i
                      }
                      if (pageNum > totalPages) {
                        pageNum = totalPages - 4 + i
                      }
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="w-8 h-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Appointments Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('start_time')}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Datum & Zeit
                    <SortIcon column="start_time" />
                  </div>
                </TableHead>
                
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('customer_name')}
                >
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Kunde
                    <SortIcon column="customer_name" />
                  </div>
                </TableHead>
                
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('service_name')}
                >
                  <div className="flex items-center gap-2">
                    Service
                    <SortIcon column="service_name" />
                  </div>
                </TableHead>
                
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('staff_name')}
                >
                  <div className="flex items-center gap-2">
                    Mitarbeiter
                    <SortIcon column="staff_name" />
                  </div>
                </TableHead>
                
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-2">
                    Status
                    <SortIcon column="status" />
                  </div>
                </TableHead>
                
                <TableHead>Preis</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <p className="mt-2 text-muted-foreground">Termine werden geladen...</p>
                  </TableCell>
                </TableRow>
              ) : paginatedAppointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <p className="text-muted-foreground">Keine Termine gefunden</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedAppointments.map((appointment) => (
                  <TableRow key={appointment.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {format(new Date(appointment.start_time), 'dd.MM.yyyy', { locale: de })}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(appointment.start_time), 'HH:mm')} - 
                          {format(new Date(appointment.end_time), 'HH:mm')}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{appointment.customer_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {appointment.customer_email}
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{appointment.service_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {appointment.service_duration_minutes} Min.
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="font-medium">{appointment.staff_name}</div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge className={getStatusColor(appointment.status)}>
                        {getStatusLabel(appointment.status)}
                      </Badge>
                    </TableCell>
                    
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(appointment.service_price_cents || 0)}
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {appointment.customer_phone && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`tel:${appointment.customer_phone}`)}
                            className="h-8 w-8 p-0"
                          >
                            <Phone className="w-3 h-3" />
                          </Button>
                        )}
                        
                        {appointment.customer_email && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`mailto:${appointment.customer_email}`)}
                            className="h-8 w-8 p-0"
                          >
                            <Mail className="w-3 h-3" />
                          </Button>
                        )}
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {appointment.status === 'pending' && (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(appointment, 'confirmed')}
                              >
                                Bestätigen
                              </DropdownMenuItem>
                            )}
                            
                            {appointment.status === 'confirmed' && (
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(appointment, 'completed')}
                              >
                                Als abgeschlossen markieren
                              </DropdownMenuItem>
                            )}
                            
                            {['pending', 'confirmed'].includes(appointment.status) && (
                              <DropdownMenuItem
                                onClick={() => handleCancelClick(appointment)}
                                className="text-red-600"
                              >
                                Stornieren
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialog.isOpen} onOpenChange={(open) => 
        setCancelDialog(prev => ({ ...prev, isOpen: open }))
      }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Termin stornieren</DialogTitle>
            <DialogDescription>
              Möchten Sie den Termin für {cancelDialog.appointment?.customer_name} wirklich stornieren?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="cancel-reason">Grund der Stornierung (optional)</Label>
              <Textarea
                id="cancel-reason"
                placeholder="Grund für die Stornierung eingeben..."
                value={cancelDialog.reason}
                onChange={(e) => setCancelDialog(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialog({ isOpen: false, appointment: null, reason: '' })}
            >
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleCancelConfirm}>
              Termin stornieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}