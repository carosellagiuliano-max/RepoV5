import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  User, 
  Building, 
  Clock, 
  Scissors, 
  Euro, 
  Palette, 
  Bell, 
  Save,
  Plus,
  Trash2,
  Edit3,
  Upload,
  Eye,
  EyeOff
} from 'lucide-react';

const businessHours = [
  { day: 'Montag', open: '09:00', close: '18:00', isOpen: true },
  { day: 'Dienstag', open: '09:00', close: '18:00', isOpen: true },
  { day: 'Mittwoch', open: '09:00', close: '18:00', isOpen: true },
  { day: 'Donnerstag', open: '09:00', close: '19:00', isOpen: true },
  { day: 'Freitag', open: '09:00', close: '19:00', isOpen: true },
  { day: 'Samstag', open: '08:00', close: '16:00', isOpen: true },
  { day: 'Sonntag', open: '10:00', close: '14:00', isOpen: false }
];

const servicesList = [
  { id: 1, name: 'Schnitt + Föhnen', price: 65, duration: 60, category: 'Standard', active: true },
  { id: 2, name: 'Komplett Service', price: 85, duration: 90, category: 'Premium', active: true },
  { id: 3, name: 'Färben + Schnitt', price: 140, duration: 120, category: 'Premium', active: true },
  { id: 4, name: 'Waschen + Föhnen', price: 45, duration: 45, category: 'Basic', active: true },
  { id: 5, name: 'Bart + Styling', price: 35, duration: 30, category: 'Herren', active: true },
  { id: 6, name: 'Kinderschnitt', price: 25, duration: 30, category: 'Kinder', active: true }
];

export function AdminSettings() {
  const [adminData, setAdminData] = useState({
    name: 'Vanessa Coiffure',
    email: 'admin@vanessacoiffure.ch',
    phone: '+41 79 123 45 67',
    address: 'Musterstrasse 123, 8000 Zürich',
    businessName: 'Vanessa Coiffure Salon',
    website: 'www.vanessacoiffure.ch',
    description: 'Professioneller Coiffure-Salon mit 15 Jahren Erfahrung',
    avatar: null
  });

  const [businessSettings, setBusinessSettings] = useState({
    allowOnlineBooking: true,
    enableWaitingList: true,
    autoConfirmBookings: false,
    sendEmailNotifications: true,
    sendSmsNotifications: true,
    requireDeposit: false,
    cancellationDeadline: 24,
    maxAdvanceBooking: 60
  });

  const [hours, setHours] = useState(businessHours);
  const [services, setServices] = useState(servicesList);
  const [newService, setNewService] = useState({ name: '', price: '', duration: '', category: 'Standard' });
  const [showPassword, setShowPassword] = useState(false);

  const handleSaveAdminData = () => {
    console.log('Saving admin data:', adminData);
    // Here you would save to database
  };

  const handleSaveBusinessSettings = () => {
    console.log('Saving business settings:', businessSettings);
    // Here you would save to database
  };

  const handleSaveHours = () => {
    console.log('Saving hours:', hours);
    // Here you would save to database
  };

  const handleAddService = () => {
    if (newService.name && newService.price && newService.duration) {
      const service = {
        id: Date.now(),
        ...newService,
        price: parseFloat(newService.price),
        duration: parseInt(newService.duration),
        active: true
      };
      setServices([...services, service]);
      setNewService({ name: '', price: '', duration: '', category: 'Standard' });
    }
  };

  const handleDeleteService = (id: number) => {
    setServices(services.filter(s => s.id !== id));
  };

  const toggleServiceActive = (id: number) => {
    setServices(services.map(s => 
      s.id === id ? { ...s, active: !s.active } : s
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Administrationseinstellungen</h2>
          <p className="text-muted-foreground">Verwalten Sie alle Einstellungen Ihres Salons</p>
        </div>
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6" />
          <Badge variant="secondary">Admin Panel</Badge>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-2">
            <Building className="w-4 h-4" />
            Geschäft
          </TabsTrigger>
          <TabsTrigger value="hours" className="gap-2">
            <Clock className="w-4 h-4" />
            Öffnungszeiten
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-2">
            <Scissors className="w-4 h-4" />
            Services
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Settings className="w-4 h-4" />
            System
          </TabsTrigger>
        </TabsList>

        {/* Personal Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Persönliche Daten
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-primary" />
                  </div>
                  <Button size="sm" className="absolute -bottom-2 -right-2 rounded-full w-8 h-8 p-0">
                    <Upload className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">Profilbild</h3>
                  <p className="text-sm text-muted-foreground">Laden Sie ein Profilbild hoch (max. 2MB)</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adminName">Vollständiger Name</Label>
                  <Input
                    id="adminName"
                    value={adminData.name}
                    onChange={(e) => setAdminData({...adminData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">E-Mail Adresse</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={adminData.email}
                    onChange={(e) => setAdminData({...adminData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminPhone">Telefonnummer</Label>
                  <Input
                    id="adminPhone"
                    value={adminData.phone}
                    onChange={(e) => setAdminData({...adminData, phone: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminWebsite">Website</Label>
                  <Input
                    id="adminWebsite"
                    value={adminData.website}
                    onChange={(e) => setAdminData({...adminData, website: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminAddress">Adresse</Label>
                <Input
                  id="adminAddress"
                  value={adminData.address}
                  onChange={(e) => setAdminData({...adminData, address: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminDescription">Beschreibung</Label>
                <Textarea
                  id="adminDescription"
                  value={adminData.description}
                  onChange={(e) => setAdminData({...adminData, description: e.target.value})}
                  rows={3}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">Sicherheit</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Aktuelles Passwort eingeben"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Neues Passwort</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="Neues Passwort eingeben"
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveAdminData} className="gap-2">
                <Save className="w-4 h-4" />
                Profil speichern
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Settings */}
        <TabsContent value="business" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Geschäftseinstellungen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Geschäftsname</Label>
                  <Input
                    id="businessName"
                    value={adminData.businessName}
                    onChange={(e) => setAdminData({...adminData, businessName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cancellationDeadline">Stornierungsfrist (Stunden)</Label>
                  <Input
                    id="cancellationDeadline"
                    type="number"
                    value={businessSettings.cancellationDeadline}
                    onChange={(e) => setBusinessSettings({...businessSettings, cancellationDeadline: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Buchungseinstellungen</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="allowOnlineBooking">Online-Buchung aktivieren</Label>
                      <p className="text-sm text-muted-foreground">Kunden können online Termine buchen</p>
                    </div>
                    <Switch
                      id="allowOnlineBooking"
                      checked={businessSettings.allowOnlineBooking}
                      onCheckedChange={(checked) => setBusinessSettings({...businessSettings, allowOnlineBooking: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="enableWaitingList">Warteschlange aktivieren</Label>
                      <p className="text-sm text-muted-foreground">Kunden können sich in die Warteschlange eintragen</p>
                    </div>
                    <Switch
                      id="enableWaitingList"
                      checked={businessSettings.enableWaitingList}
                      onCheckedChange={(checked) => setBusinessSettings({...businessSettings, enableWaitingList: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="autoConfirmBookings">Termine automatisch bestätigen</Label>
                      <p className="text-sm text-muted-foreground">Neue Buchungen werden automatisch bestätigt</p>
                    </div>
                    <Switch
                      id="autoConfirmBookings"
                      checked={businessSettings.autoConfirmBookings}
                      onCheckedChange={(checked) => setBusinessSettings({...businessSettings, autoConfirmBookings: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="requireDeposit">Anzahlung erforderlich</Label>
                      <p className="text-sm text-muted-foreground">Kunden müssen eine Anzahlung leisten</p>
                    </div>
                    <Switch
                      id="requireDeposit"
                      checked={businessSettings.requireDeposit}
                      onCheckedChange={(checked) => setBusinessSettings({...businessSettings, requireDeposit: checked})}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Benachrichtigungen</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="sendEmailNotifications">E-Mail Benachrichtigungen</Label>
                      <p className="text-sm text-muted-foreground">Senden Sie E-Mails für Terminbestätigungen</p>
                    </div>
                    <Switch
                      id="sendEmailNotifications"
                      checked={businessSettings.sendEmailNotifications}
                      onCheckedChange={(checked) => setBusinessSettings({...businessSettings, sendEmailNotifications: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="sendSmsNotifications">SMS Benachrichtigungen</Label>
                      <p className="text-sm text-muted-foreground">Senden Sie SMS für Terminerinnerungen</p>
                    </div>
                    <Switch
                      id="sendSmsNotifications"
                      checked={businessSettings.sendSmsNotifications}
                      onCheckedChange={(checked) => setBusinessSettings({...businessSettings, sendSmsNotifications: checked})}
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveBusinessSettings} className="gap-2">
                <Save className="w-4 h-4" />
                Einstellungen speichern
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Opening Hours */}
        <TabsContent value="hours" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Öffnungszeiten verwalten
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hours.map((day, index) => (
                <div key={day.day} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-20 font-medium">{day.day}</div>
                    <Switch
                      checked={day.isOpen}
                      onCheckedChange={(checked) => {
                        const newHours = [...hours];
                        newHours[index] = { ...day, isOpen: checked };
                        setHours(newHours);
                      }}
                    />
                  </div>
                  
                  {day.isOpen && (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Label>Von:</Label>
                        <Input
                          type="time"
                          value={day.open}
                          onChange={(e) => {
                            const newHours = [...hours];
                            newHours[index] = { ...day, open: e.target.value };
                            setHours(newHours);
                          }}
                          className="w-32"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label>Bis:</Label>
                        <Input
                          type="time"
                          value={day.close}
                          onChange={(e) => {
                            const newHours = [...hours];
                            newHours[index] = { ...day, close: e.target.value };
                            setHours(newHours);
                          }}
                          className="w-32"
                        />
                      </div>
                    </div>
                  )}
                  
                  {!day.isOpen && (
                    <Badge variant="secondary">Geschlossen</Badge>
                  )}
                </div>
              ))}
              
              <Button onClick={handleSaveHours} className="gap-2">
                <Save className="w-4 h-4" />
                Öffnungszeiten speichern
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Management */}
        <TabsContent value="services" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scissors className="w-5 h-5" />
                Services & Preise verwalten
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add New Service */}
              <div className="p-4 border-2 border-dashed rounded-lg">
                <h3 className="font-semibold mb-4">Neuen Service hinzufügen</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Input
                    placeholder="Service Name"
                    value={newService.name}
                    onChange={(e) => setNewService({...newService, name: e.target.value})}
                  />
                  <Input
                    placeholder="Preis (CHF)"
                    type="number"
                    value={newService.price}
                    onChange={(e) => setNewService({...newService, price: e.target.value})}
                  />
                  <Input
                    placeholder="Dauer (Min)"
                    type="number"
                    value={newService.duration}
                    onChange={(e) => setNewService({...newService, duration: e.target.value})}
                  />
                  <Select value={newService.category} onValueChange={(value) => setNewService({...newService, category: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Kategorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Basic">Basic</SelectItem>
                      <SelectItem value="Standard">Standard</SelectItem>
                      <SelectItem value="Premium">Premium</SelectItem>
                      <SelectItem value="Herren">Herren</SelectItem>
                      <SelectItem value="Kinder">Kinder</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddService} className="gap-2 mt-4">
                  <Plus className="w-4 h-4" />
                  Service hinzufügen
                </Button>
              </div>

              {/* Existing Services */}
              <div className="space-y-3">
                {services.map((service) => (
                  <div key={service.id} className={`flex items-center justify-between p-4 border rounded-lg ${
                    service.active ? 'bg-background' : 'bg-muted/50'
                  }`}>
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={service.active}
                        onCheckedChange={() => toggleServiceActive(service.id)}
                      />
                      <div>
                        <h4 className="font-medium">{service.name}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>CHF {service.price}</span>
                          <span>{service.duration} Min</span>
                          <Badge variant="outline">{service.category}</Badge>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline">
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteService(service.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Systemeinstellungen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold">Darstellung</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Primäre Farbe</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" className="w-12 h-10 rounded border" defaultValue="#3b82f6" />
                      <Input placeholder="#3b82f6" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Sekundäre Farbe</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" className="w-12 h-10 rounded border" defaultValue="#10b981" />
                      <Input placeholder="#10b981" />
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">Datenmanagement</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" className="gap-2">
                    <Upload className="w-4 h-4" />
                    Daten exportieren
                  </Button>
                  <Button variant="outline" className="gap-2">
                    <Upload className="w-4 h-4" />
                    Backup erstellen
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold text-destructive">Gefährliche Aktionen</h3>
                <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                  <p className="text-sm text-muted-foreground mb-4">
                    Diese Aktionen sind irreversibel. Bitte seien Sie vorsichtig.
                  </p>
                  <div className="flex gap-4">
                    <Button variant="destructive" size="sm">
                      Alle Termine löschen
                    </Button>
                    <Button variant="destructive" size="sm">
                      Alle Kunden löschen
                    </Button>
                    <Button variant="destructive" size="sm">
                      System zurücksetzen
                    </Button>
                  </div>
                </div>
              </div>

              <Button className="gap-2">
                <Save className="w-4 h-4" />
                Systemeinstellungen speichern
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
