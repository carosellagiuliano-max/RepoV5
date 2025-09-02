import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Search, 
  Plus, 
  Calendar, 
  Euro, 
  UserPlus,
  SortAsc,
  SortDesc,
  Phone,
  Mail,
  User,
  Users,
  Trash2,
  RotateCcw,
  Eye,
  Download,
  AlertTriangle
} from 'lucide-react';
import { CustomerDetailModal } from './CustomerDetailModal';
import { AddCustomerModal } from './AddCustomerModal';

// Types for customer data
interface Customer {
  id: string;
  customer_number: string;
  profile_id: string;
  date_of_birth?: string;
  address_street?: string;
  address_city?: string;
  address_postal_code?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  gdpr_consent_given: boolean;
  gdpr_consent_date?: string;
  is_deleted: boolean;
  deleted_at?: string;
  deleted_by?: string;
  deletion_reason?: string;
  created_at: string;
  updated_at: string;
  profiles: {
    id: string;
    email: string;
    full_name: string;
    phone?: string;
    role: string;
    created_at: string;
    updated_at: string;
  };
  stats?: {
    total_appointments: number;
    upcoming_appointments: number;
    completed_appointments: number;
    cancelled_appointments: number;
    total_spent: number;
    last_appointment_date?: string;
  };
}

const customerStatusConfig = {
  active: { 
    label: 'Aktiv', 
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: UserPlus,
    requirement: 'Aktiver Kunde'
  },
  inactive: { 
    label: 'Inaktiv', 
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: User,
    requirement: 'Inaktiver Kunde'
  },
  deleted: { 
    label: 'Gelöscht', 
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: Trash2,
    requirement: 'Gelöschter Kunde'
  }
};

export function CustomerManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [gdprFilter, setGdprFilter] = useState('all');
  const [deletedFilter, setDeletedFilter] = useState('active'); // 'active', 'deleted', 'all'
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'profiles.full_name'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  // Fetch customers with filters
  const { customers, pagination, loading, error, refetch } = useCustomers({
    page: currentPage,
    limit: 20,
    search: searchTerm,
    sortBy,
    sortOrder,
    isDeleted: deletedFilter === 'deleted' ? true : deletedFilter === 'active' ? false : undefined,
    hasGdprConsent: gdprFilter === 'consent' ? true : gdprFilter === 'no-consent' ? false : undefined,
  });

  const { 
    createCustomer, 
    updateCustomer, 
    softDeleteCustomer, 
    restoreCustomer, 
    exportCustomerData, 
    getCustomerAuditLog 
  } = useCustomerActions();

  const handleDeleteCustomer = async (customer: Customer) => {
    if (window.confirm(`Sind Sie sicher, dass Sie den Kunden "${customer.profiles.full_name}" löschen möchten?`)) {
      const reason = window.prompt('Grund für die Löschung (optional):');
      const success = await softDeleteCustomer(customer.id, reason || undefined);
      if (success) {
        refetch();
      }
    }
  };

  const handleRestoreCustomer = async (customer: Customer) => {
    if (window.confirm(`Möchten Sie den Kunden "${customer.profiles.full_name}" wiederherstellen?`)) {
      const success = await restoreCustomer(customer.id);
      if (success) {
        refetch();
      }
    }
  };

  const handleExportCustomer = async (customer: Customer) => {
    await exportCustomerData(customer.id);
  };

  const getCustomerStatus = (customer: Customer): keyof typeof customerStatusConfig => {
    if (customer.is_deleted) return 'deleted';
    return 'active';
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const renderStatusBadge = (status: keyof typeof customerStatusConfig) => {
    const config = customerStatusConfig[status];
    const Icon = config.icon;
    
    return (
      <Badge className={`${config.color} gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  if (loading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Kundendaten werden geladen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
          <p className="mt-2 text-red-600">Fehler beim Laden der Kundendaten</p>
          <Button variant="outline" onClick={refetch} className="mt-2">
            Erneut versuchen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nach Name, E-Mail, Telefon, Kundennummer suchen..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* GDPR Consent Filter */}
          <Select value={gdprFilter} onValueChange={setGdprFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="GDPR Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle GDPR Status</SelectItem>
              <SelectItem value="consent">Mit Einverständnis</SelectItem>
              <SelectItem value="no-consent">Ohne Einverständnis</SelectItem>
            </SelectContent>
          </Select>

          {/* Deletion Status Filter */}
          <Select value={deletedFilter} onValueChange={setDeletedFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktive Kunden</SelectItem>
              <SelectItem value="deleted">Gelöschte Kunden</SelectItem>
              <SelectItem value="all">Alle Kunden</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Options */}
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'created_at' | 'updated_at' | 'profiles.full_name')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sortieren" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="profiles.full_name">Name</SelectItem>
              <SelectItem value="created_at">Erstellt</SelectItem>
              <SelectItem value="updated_at">Aktualisiert</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="gap-2"
          >
            {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
          </Button>

          <Button className="gap-2" onClick={() => setShowAddCustomer(true)}>
            <Plus className="w-4 h-4" />
            Neuer Kunde
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Gesamt</p>
                <p className="text-2xl font-bold">{pagination?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Aktiv</p>
                <p className="text-2xl font-bold">{customers.filter(c => !c.is_deleted).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium">GDPR Einverständnis</p>
                <p className="text-2xl font-bold">{customers.filter(c => c.gdpr_consent_given).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm font-medium">Gelöscht</p>
                <p className="text-2xl font-bold">{customers.filter(c => c.is_deleted).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Table */}
      <Card>
        <CardHeader>
          <CardTitle>Kundenstamm ({customers.length} von {pagination?.total || 0} Kunden)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kunde</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>GDPR</TableHead>
                <TableHead>Termine</TableHead>
                <TableHead>Umsatz</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                 <TableRow key={customer.id} className={customer.is_deleted ? 'opacity-60' : ''}>
                   <TableCell>
                     <div className="flex items-center gap-3">
                       <Avatar>
                         <AvatarFallback>{getInitials(customer.profiles.full_name || 'NN')}</AvatarFallback>
                       </Avatar>
                       <div>
                         <div className="font-medium">{customer.profiles.full_name || 'Unbekannt'}</div>
                         <div className="text-sm text-muted-foreground">
                           Nr: {customer.customer_number}
                         </div>
                       </div>
                     </div>
                   </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {customer.profiles.email}
                      </div>
                      {customer.profiles.phone && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          {customer.profiles.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {renderStatusBadge(getCustomerStatus(customer))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.gdpr_consent_given ? "default" : "secondary"} className="gap-1">
                      <Eye className="w-3 h-3" />
                      {customer.gdpr_consent_given ? 'Ja' : 'Nein'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {customer.stats?.total_appointments || 0}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 font-semibold">
                      <Euro className="w-4 h-4 text-green-600" />
                      CHF {(customer.stats?.total_spent || 0).toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {new Date(customer.created_at).toLocaleDateString('de-CH')}
                    </div>
                  </TableCell>
                   <TableCell>
                     <div className="flex gap-2">
                       <Button size="sm" variant="outline" onClick={() => setSelectedCustomer(customer)}>
                         Details
                       </Button>
                       {customer.is_deleted ? (
                         <Button 
                           size="sm" 
                           variant="outline" 
                           onClick={() => handleRestoreCustomer(customer)}
                           className="gap-1"
                         >
                           <RotateCcw className="w-3 h-3" />
                           Wiederherstellen
                         </Button>
                       ) : (
                         <>
                           <Button 
                             size="sm" 
                             variant="outline" 
                             onClick={() => handleExportCustomer(customer)}
                             className="gap-1"
                           >
                             <Download className="w-3 h-3" />
                             Export
                           </Button>
                           <Button 
                             size="sm" 
                             variant="outline" 
                             onClick={() => handleDeleteCustomer(customer)}
                             className="gap-1 text-red-600 hover:text-red-700"
                           >
                             <Trash2 className="w-3 h-3" />
                             Löschen
                           </Button>
                         </>
                       )}
                     </div>
                   </TableCell>
                </TableRow>
              ))}
              {customers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {loading ? 'Lade Kunden...' : 'Keine Kunden gefunden'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          
          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="text-sm text-muted-foreground">
                Seite {pagination.page} von {pagination.totalPages} 
                ({pagination.total} Kunden gesamt)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage <= 1}
                >
                  Zurück
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
                  disabled={currentPage >= pagination.totalPages}
                >
                  Weiter
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Modals */}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          onUpdate={refetch}
        />
      )}
      
      {showAddCustomer && (
        <AddCustomerModal
          onClose={() => setShowAddCustomer(false)}
          onSave={async (customerData) => {
            const newCustomer = await createCustomer(customerData);
            if (newCustomer) {
              refetch();
              setShowAddCustomer(false);
            }
          }}
        />
      )}
    </div>
  );
}