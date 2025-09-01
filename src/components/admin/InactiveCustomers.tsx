import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Mail,
  MessageSquare,
  Clock,
  AlertTriangle,
  Send,
  Users,
  DollarSign,
  Filter
} from 'lucide-react';

// Mock data for inactive customers
const inactiveCustomers = [
  {
    id: 1,
    name: 'Anna Schneider',
    email: 'anna.schneider@email.com',
    phone: '+41 79 123 45 67',
    lastVisit: '2023-08-15',
    daysSinceLastVisit: 157,
    totalSpent: 485,
    preferredService: 'Schnitt + Färben',
    communicationPreference: 'email'
  },
  {
    id: 2,
    name: 'Marco Weber',
    email: 'marco.weber@email.com',
    phone: '+41 78 987 65 43',
    lastVisit: '2023-07-22',
    daysSinceLastVisit: 181,
    totalSpent: 320,
    preferredService: 'Herrenschnitt',
    communicationPreference: 'sms'
  },
  {
    id: 3,
    name: 'Petra Zimmermann',
    email: 'petra.zimmermann@email.com',
    phone: '+41 76 555 12 34',
    lastVisit: '2023-09-03',
    daysSinceLastVisit: 138,
    totalSpent: 675,
    preferredService: 'Komplett Service',
    communicationPreference: 'email'
  },
  {
    id: 4,
    name: 'Thomas Müller',
    email: 'thomas.mueller@email.com',
    phone: '+41 77 333 99 88',
    lastVisit: '2023-06-10',
    daysSinceLastVisit: 223,
    totalSpent: 280,
    preferredService: 'Bart + Styling',
    communicationPreference: 'both'
  },
  {
    id: 5,
    name: 'Julia Meier',
    email: 'julia.meier@email.com',
    phone: '+41 79 777 55 44',
    lastVisit: '2023-05-28',
    daysSinceLastVisit: 236,
    totalSpent: 590,
    preferredService: 'Färben + Schnitt',
    communicationPreference: 'email'
  },
  {
    id: 6,
    name: 'Stefan Keller',
    email: 'stefan.keller@email.com',
    phone: '+41 78 444 77 22',
    lastVisit: '2023-04-12',
    daysSinceLastVisit: 282,
    totalSpent: 195,
    preferredService: 'Herrenschnitt',
    communicationPreference: 'sms'
  },
  {
    id: 7,
    name: 'Claudia Fischer',
    email: 'claudia.fischer@email.com',
    phone: '+41 79 666 33 11',
    lastVisit: '2023-07-08',
    daysSinceLastVisit: 195,
    totalSpent: 750,
    preferredService: 'Komplett Service',
    communicationPreference: 'both'
  },
  {
    id: 8,
    name: 'Michael Roth',
    email: 'michael.roth@email.com',
    phone: '+41 76 222 88 55',
    lastVisit: '2023-06-25',
    daysSinceLastVisit: 208,
    totalSpent: 340,
    preferredService: 'Bart + Styling',
    communicationPreference: 'email'
  }
];

export function InactiveCustomers() {
  const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [reminderType, setReminderType] = useState<'email' | 'sms'>('email');
  const [customMessage, setCustomMessage] = useState('');
  const [filterDays, setFilterDays] = useState<'all' | '120' | '180' | '240'>('all');

  const handleSelectCustomer = (customerId: number) => {
    setSelectedCustomers(prev => 
      prev.includes(customerId) 
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredCustomers.map(customer => customer.id));
    }
    setSelectAll(!selectAll);
  };

  const handleSendReminders = () => {
    if (selectedCustomers.length === 0) {
      alert('Bitte wählen Sie mindestens einen Kunden aus.');
      return;
    }
    
    const selectedCustomerData = filteredCustomers.filter(customer => 
      selectedCustomers.includes(customer.id)
    );
    
    // Simulate sending reminders
    alert(`${reminderType === 'email' ? 'E-Mail' : 'SMS'} Erinnerungen erfolgreich gesendet an ${selectedCustomerData.length} Kunden.`);
    
    // Reset selections
    setSelectedCustomers([]);
    setSelectAll(false);
    setCustomMessage('');
  };

  const getInactivityBadge = (days: number) => {
    if (days > 240) return <Badge variant="destructive">Sehr lange inaktiv ({days} Tage)</Badge>;
    if (days > 180) return <Badge variant="destructive" className="bg-red-100 text-red-800">Sehr inaktiv ({days} Tage)</Badge>;
    if (days > 150) return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Inaktiv ({days} Tage)</Badge>;
    return <Badge variant="outline">Wenig aktiv ({days} Tage)</Badge>;
  };

  // Filter customers based on selected filter
  const filteredCustomers = inactiveCustomers.filter(customer => {
    switch (filterDays) {
      case '120': return customer.daysSinceLastVisit >= 120;
      case '180': return customer.daysSinceLastVisit >= 180;
      case '240': return customer.daysSinceLastVisit >= 240;
      default: return true;
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Inaktive Kunden</h2>
          <p className="text-muted-foreground">Kunden-Reaktivierung und Erinnerungsservice</p>
        </div>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inaktive Kunden</p>
                <p className="text-2xl font-bold">{filteredCustomers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ø Tage seit Besuch</p>
                <p className="text-2xl font-bold">
                  {filteredCustomers.length > 0 ? Math.round(filteredCustomers.reduce((sum, c) => sum + c.daysSinceLastVisit, 0) / filteredCustomers.length) : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Potenzieller Umsatz</p>
                <p className="text-2xl font-bold">
                  CHF {filteredCustomers.reduce((sum, c) => sum + c.totalSpent, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ausgewählt</p>
                <p className="text-2xl font-bold">{selectedCustomers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Reminder Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Erinnerungen senden
          </CardTitle>
          <CardDescription>
            Wählen Sie Kunden aus und senden Sie personalisierte Erinnerungen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="select-all"
                checked={selectAll}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all" className="font-medium">
                Alle auswählen ({selectedCustomers.length} von {filteredCustomers.length})
              </Label>
            </div>
            
            <Select value={filterDays} onValueChange={(value: 'all' | '120' | '180' | '240') => setFilterDays(value)}>
              <SelectTrigger className="w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kunden</SelectItem>
                <SelectItem value="120">Über 120 Tage</SelectItem>
                <SelectItem value="180">Über 180 Tage</SelectItem>
                <SelectItem value="240">Über 240 Tage</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={reminderType} onValueChange={(value: 'email' | 'sms') => setReminderType(value)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    E-Mail Erinnerung
                  </div>
                </SelectItem>
                <SelectItem value="sms">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    SMS Erinnerung
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              onClick={handleSendReminders}
              disabled={selectedCustomers.length === 0}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              Erinnerungen senden ({selectedCustomers.length})
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="custom-message">Persönliche Nachricht (optional)</Label>
            <Textarea
              id="custom-message"
              placeholder="Liebe/r [Name], wir vermissen Sie! Buchen Sie noch heute Ihren nächsten Termin bei Schnittwerk..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Inactive Customers List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Kundenliste ({filteredCustomers.length} Kunden)
          </CardTitle>
          <CardDescription>
            Wählen Sie die Kunden aus, die eine Erinnerung erhalten sollen
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredCustomers.map((customer) => (
              <div key={customer.id} className="border rounded-lg p-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedCustomers.includes(customer.id)}
                      onCheckedChange={() => handleSelectCustomer(customer.id)}
                    />
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{customer.name}</h4>
                        {getInactivityBadge(customer.daysSinceLastVisit)}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>📧 {customer.email} | 📱 {customer.phone}</p>
                        <p>Letzter Besuch: {customer.lastVisit} | Bevorzugter Service: {customer.preferredService}</p>
                        <p>Gesamtausgaben: CHF {customer.totalSpent} | Kommunikation: {
                          customer.communicationPreference === 'email' ? '📧 E-Mail bevorzugt' :
                          customer.communicationPreference === 'sms' ? '📱 SMS bevorzugt' : '📧📱 Beide Kanäle'
                        }</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1">
                      <Mail className="w-3 h-3" />
                      E-Mail
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1">
                      <MessageSquare className="w-3 h-3" />
                      SMS
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            
            {filteredCustomers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Keine Kunden entsprechen den gewählten Filterkriterien.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}