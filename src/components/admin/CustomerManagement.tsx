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
  neu: { 
    label: 'Neu', 
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: UserPlus,
    requirement: 'Neukunde'
  },
  bronze: { 
    label: 'Bronze', 
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: Award,
    requirement: 'CHF 250+ Umsatz'
  },
  silber: { 
    label: 'Silber', 
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: Star,
    requirement: 'CHF 500+ Umsatz'
  },
  gold: { 
    label: 'Gold', 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: Crown,
    requirement: 'CHF 1200+ Umsatz'
  },
  diamant: { 
    label: 'Diamant', 
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: Gem,
    requirement: 'CHF 1800+ Umsatz'
  }
};

const mockCustomers = [
  {
    id: 1,
    name: 'Maria Schmidt',
    gender: 'female',
    ageGroup: 'adult',
    email: 'maria.schmidt@email.com',
    phone: '+41 79 123 45 67',
    appointments: 12,
    totalRevenue: 1240,
    status: 'gold' as keyof typeof customerStatusConfig,
    lastVisit: '2024-01-10',
    nextAppointment: '2024-01-20',
    hasAppointmentThisWeek: true
  },
  {
    id: 2,
    name: 'Hans Müller',
    gender: 'male',
    ageGroup: 'adult',
    email: 'hans.mueller@email.com',
    phone: '+41 79 234 56 78',
    appointments: 8,
    totalRevenue: 620,
    status: 'silber' as keyof typeof customerStatusConfig,
    lastVisit: '2024-01-08',
    nextAppointment: null,
    hasAppointmentThisWeek: false
  },
  {
    id: 3,
    name: 'Sarah Weber',
    gender: 'female',
    ageGroup: 'adult',
    email: 'sarah.weber@email.com',
    phone: '+41 79 345 67 89',
    appointments: 25,
    totalRevenue: 2150,
    status: 'diamant' as keyof typeof customerStatusConfig,
    lastVisit: '2024-01-12',
    nextAppointment: '2024-01-25',
    hasAppointmentThisWeek: false
  },
  {
    id: 4,
    name: 'Emma Keller',
    gender: 'child',
    ageGroup: 'child',
    email: 'lisa.keller@email.com',
    phone: '+41 79 456 78 90',
    appointments: 3,
    totalRevenue: 180,
    status: 'neu' as keyof typeof customerStatusConfig,
    lastVisit: '2024-01-05',
    nextAppointment: null,
    hasAppointmentThisWeek: false
  },
  {
    id: 5,
    name: 'Thomas Zimmermann',
    gender: 'male',
    ageGroup: 'adult',
    email: 'thomas.zimmermann@email.com',
    phone: '+41 79 567 89 01',
    appointments: 6,
    totalRevenue: 390,
    status: 'bronze' as keyof typeof customerStatusConfig,
    lastVisit: '2024-01-09',
    nextAppointment: '2024-01-18',
    hasAppointmentThisWeek: true
  },
  {
    id: 6,
    name: 'Luca Meyer',
    gender: 'child',
    ageGroup: 'child',
    email: 'meyer.family@email.com',
    phone: '+41 79 678 90 12',
    appointments: 4,
    totalRevenue: 120,
    status: 'neu' as keyof typeof customerStatusConfig,
    lastVisit: '2024-01-11',
    nextAppointment: null,
    hasAppointmentThisWeek: false
  }
];

export function CustomerManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<typeof mockCustomers[0] | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [genderFilter, setGenderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [appointmentFilter, setAppointmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'revenue' | 'appointments' | 'lastVisit'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredCustomers = mockCustomers
    .filter(customer => {
      const matchesSearch = 
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone.includes(searchTerm);
      
      const matchesGender = genderFilter === 'all' || customer.gender === genderFilter;
      const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
      const matchesAppointment = 
        appointmentFilter === 'all' ||
        (appointmentFilter === 'hasNext' && customer.nextAppointment) ||
        (appointmentFilter === 'noNext' && !customer.nextAppointment) ||
        (appointmentFilter === 'thisWeek' && customer.hasAppointmentThisWeek);
      
      return matchesSearch && matchesGender && matchesStatus && matchesAppointment;
    })
    .sort((a, b) => {
      let aValue: string | number | Date, bValue: string | number | Date;
      
      switch (sortBy) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'revenue':
          aValue = a.totalRevenue;
          bValue = b.totalRevenue;
          break;
        case 'appointments':
          aValue = a.appointments;
          bValue = b.appointments;
          break;
        case 'lastVisit':
          aValue = new Date(a.lastVisit);
          bValue = new Date(b.lastVisit);
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  const getGenderStats = () => {
    const female = mockCustomers.filter(c => c.gender === 'female').length;
    const male = mockCustomers.filter(c => c.gender === 'male').length;
    const children = mockCustomers.filter(c => c.gender === 'child').length;
    return { female, male, children };
  };

  const genderStats = getGenderStats();

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

  const getGenderIcon = (gender: string) => {
    switch (gender) {
      case 'female': return User;
      case 'male': return Users;
      case 'child': return Baby;
      default: return User;
    }
  };

  const getGenderColor = (gender: string) => {
    switch (gender) {
      case 'female': return 'text-pink-600';
      case 'male': return 'text-blue-600'; 
      case 'child': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nach Name, E-Mail, Telefon suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Gender Filter */}
          <Select value={genderFilter} onValueChange={setGenderFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Geschlecht" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="female">Frauen ({genderStats.female})</SelectItem>
              <SelectItem value="male">Männer ({genderStats.male})</SelectItem>
              <SelectItem value="child">Kinder ({genderStats.children})</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {Object.entries(customerStatusConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Appointment Filter */}
          <Select value={appointmentFilter} onValueChange={setAppointmentFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Termine" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Termine</SelectItem>
              <SelectItem value="hasNext">Hat nächsten Termin</SelectItem>
              <SelectItem value="noNext">Kein nächster Termin</SelectItem>
              <SelectItem value="thisWeek">Diese Woche</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Options */}
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'name' | 'lastVisit' | 'totalSpent' | 'nextAppointment')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sortieren" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="revenue">Umsatz</SelectItem>
              <SelectItem value="appointments">Termine</SelectItem>
              <SelectItem value="lastVisit">Letzter Besuch</SelectItem>
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

      {/* Enhanced Statistics with Gender Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {/* Gender Stats */}
        <Card className="border-l-4 border-l-pink-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-pink-600" />
              <div>
                <p className="text-sm font-medium">Frauen</p>
                <p className="text-2xl font-bold">{genderStats.female}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Männer</p>
                <p className="text-2xl font-bold">{genderStats.male}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Baby className="w-5 h-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Kinder</p>
                <p className="text-2xl font-bold">{genderStats.children}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Stats */}
        {Object.entries(customerStatusConfig).map(([key, config]) => {
          const Icon = config.icon;
          const count = mockCustomers.filter(c => c.status === key).length;
          
          return (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded ${config.color.split(' ')[0]}/20`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">{config.label}</p>
                    <p className="text-lg font-bold">{count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Customer Table */}
      <Card>
        <CardHeader>
          <CardTitle>Kundenstamm ({filteredCustomers.length} Kunden)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kunde</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Termine</TableHead>
                <TableHead>Umsatz</TableHead>
                <TableHead>Letzter Besuch</TableHead>
                <TableHead>Nächster Termin</TableHead>
                <TableHead>Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                 <TableRow key={customer.id}>
                   <TableCell>
                     <div className="flex items-center gap-3">
                       <div className="relative">
                         <Avatar>
                           <AvatarFallback>{getInitials(customer.name)}</AvatarFallback>
                         </Avatar>
                         <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                           customer.gender === 'female' ? 'bg-pink-500' : 
                           customer.gender === 'male' ? 'bg-blue-500' : 'bg-purple-500'
                         }`} />
                       </div>
                       <div>
                         <div className="font-medium flex items-center gap-2">
                           {customer.name}
                           {customer.gender === 'child' && <Baby className="w-4 h-4 text-purple-600" />}
                         </div>
                         <div className="text-sm text-muted-foreground">
                           ID: {customer.id} • {customer.gender === 'female' ? 'Frau' : customer.gender === 'male' ? 'Mann' : 'Kind'}
                         </div>
                       </div>
                     </div>
                   </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{customer.email}</div>
                      <div className="text-muted-foreground">{customer.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {renderStatusBadge(customer.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      {customer.appointments}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 font-semibold">
                      <Euro className="w-4 h-4 text-green-600" />
                      CHF {customer.totalRevenue.toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {new Date(customer.lastVisit).toLocaleDateString('de-CH')}
                    </div>
                  </TableCell>
                  <TableCell>
                    {customer.nextAppointment ? (
                      <div className="text-sm">
                        {new Date(customer.nextAppointment).toLocaleDateString('de-CH')}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Kein Termin</span>
                    )}
                  </TableCell>
                   <TableCell>
                     <div className="flex gap-2">
                       <Button size="sm" variant="outline" onClick={() => setSelectedCustomer(customer)}>
                         Termin
                       </Button>
                       <Button size="sm" variant="outline" onClick={() => setSelectedCustomer(customer)}>
                         Details
                       </Button>
                     </div>
                   </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Modals */}
      {selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
      
      {showAddCustomer && (
        <AddCustomerModal
          onClose={() => setShowAddCustomer(false)}
          onSave={(customerData) => {
            console.log('New customer:', customerData);
            // Here you would normally save to database
          }}
        />
      )}
    </div>
  );
}