import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, User, Phone, Mail, Calendar, Euro, Package, Scissors, Edit3 } from 'lucide-react';

interface CustomerDetailModalProps {
  customer: {
    id: number;
    name: string;
    email: string;
    phone: string;
    appointments: number;
    totalRevenue: number;
    status: string;
    lastVisit: string;
    nextAppointment: string;
  };
  onClose: () => void;
}

const mockAppointmentHistory = [
  { date: '2024-01-10', service: 'Schnitt + Föhnen', price: 65, status: 'abgeschlossen' },
  { date: '2023-12-15', service: 'Färben + Schnitt', price: 140, status: 'abgeschlossen' },
  { date: '2023-11-20', service: 'Komplett Service', price: 85, status: 'abgeschlossen' },
];

const mockProductPurchases = [
  { date: '2024-01-10', product: 'Hydrating Shampoo', price: 25, quantity: 1 },
  { date: '2023-12-15', product: 'Hair Oil', price: 35, quantity: 1 },
  { date: '2023-11-20', product: 'Heat Protection Spray', price: 20, quantity: 2 },
];

export function CustomerDetailModal({ customer, onClose }: CustomerDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    status: customer.status,
    notes: 'Bevorzugt Termine am Vormittag. Allergisch gegen bestimmte Haarprodukte.'
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'vip': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'gold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'bronze': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{customer.name}</h2>
              <Badge className={getStatusColor(customer.status)}>{customer.status}</Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              className="gap-2"
            >
              <Edit3 className="w-4 h-4" />
              {isEditing ? 'Speichern' : 'Bearbeiten'}
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="p-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Übersicht</TabsTrigger>
                <TabsTrigger value="appointments">Termine</TabsTrigger>
                <TabsTrigger value="products">Produkte</TabsTrigger>
                <TabsTrigger value="settings">Einstellungen</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Termine</p>
                          <p className="text-2xl font-bold">{customer.appointments}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <Euro className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Gesamtumsatz</p>
                          <p className="text-2xl font-bold">CHF {customer.totalRevenue}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-purple-500" />
                        <div>
                          <p className="text-sm text-muted-foreground">Letzter Besuch</p>
                          <p className="text-2xl font-bold">{customer.lastVisit}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Contact Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>Kontaktdaten</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isEditing ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Name</label>
                          <Input
                            value={editData.name}
                            onChange={(e) => setEditData({...editData, name: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Status</label>
                          <Select value={editData.status} onValueChange={(value) => setEditData({...editData, status: value})}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="neu">Neu</SelectItem>
                              <SelectItem value="bronze">Bronze</SelectItem>
                              <SelectItem value="gold">Gold</SelectItem>
                              <SelectItem value="vip">VIP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">E-Mail</label>
                          <Input
                            type="email"
                            value={editData.email}
                            onChange={(e) => setEditData({...editData, email: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">Telefon</label>
                          <Input
                            value={editData.phone}
                            onChange={(e) => setEditData({...editData, phone: e.target.value})}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium mb-2">Notizen</label>
                          <textarea
                            className="w-full p-2 border border-input rounded-md bg-background text-sm resize-none"
                            rows={3}
                            value={editData.notes}
                            onChange={(e) => setEditData({...editData, notes: e.target.value})}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span>{customer.email}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span>{customer.phone}</span>
                        </div>
                        <div className="md:col-span-2">
                          <p className="text-sm text-muted-foreground">Notizen:</p>
                          <p className="mt-1">{editData.notes}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="appointments" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Terminhistorie</h3>
                  <Button size="sm" className="gap-2">
                    <Calendar className="w-4 h-4" />
                    Neuer Termin
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {mockAppointmentHistory.map((appointment, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <Scissors className="w-5 h-5 text-primary" />
                            <div>
                              <p className="font-medium">{appointment.service}</p>
                              <p className="text-sm text-muted-foreground">{appointment.date}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">CHF {appointment.price}</p>
                            <Badge variant="secondary">{appointment.status}</Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="products" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Gekaufte Produkte</h3>
                  <Button size="sm" className="gap-2">
                    <Package className="w-4 h-4" />
                    Produkt hinzufügen
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {mockProductPurchases.map((purchase, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <Package className="w-5 h-5 text-green-500" />
                            <div>
                              <p className="font-medium">{purchase.product}</p>
                              <p className="text-sm text-muted-foreground">{purchase.date} • Menge: {purchase.quantity}</p>
                            </div>
                          </div>
                          <p className="font-medium">CHF {purchase.price}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Kundeneinstellungen</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Bevorzugte Termine</label>
                      <Select defaultValue="morning">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="morning">Vormittag</SelectItem>
                          <SelectItem value="afternoon">Nachmittag</SelectItem>
                          <SelectItem value="evening">Abend</SelectItem>
                          <SelectItem value="no-preference">Keine Präferenz</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">Kommunikation</label>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" defaultChecked className="rounded" />
                          <span className="text-sm">E-Mail Erinnerungen</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" defaultChecked className="rounded" />
                          <span className="text-sm">SMS Erinnerungen</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input type="checkbox" className="rounded" />
                          <span className="text-sm">Marketing E-Mails</span>
                        </label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}