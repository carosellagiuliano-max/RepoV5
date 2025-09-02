import { useState, useEffect } from 'react';
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
  EyeOff,
  Mail,
  TestTube
} from 'lucide-react';
import { useBusinessSettings, useEmailSettings, useUpdateBusinessSettings, useUpdateEmailSettings, useSmtpTest } from '@/hooks/use-settings';
import { BusinessSettings, EmailSettings, DayHours } from '@/lib/types/database';
import { toast } from 'sonner';

const dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const servicesList = [
  { id: 1, name: 'Schnitt + Föhnen', price: 65, duration: 60, category: 'Standard', active: true },
  { id: 2, name: 'Komplett Service', price: 85, duration: 90, category: 'Premium', active: true },
  { id: 3, name: 'Färben + Schnitt', price: 140, duration: 120, category: 'Premium', active: true },
  { id: 4, name: 'Waschen + Föhnen', price: 45, duration: 45, category: 'Basic', active: true },
  { id: 5, name: 'Bart + Styling', price: 35, duration: 30, category: 'Herren', active: true },
  { id: 6, name: 'Kinderschnitt', price: 25, duration: 30, category: 'Kinder', active: true }
];

export function AdminSettings() {
  // Load real settings data
  const { settings: businessSettings, isLoading: businessLoading } = useBusinessSettings()
  const { settings: emailSettings, isLoading: emailLoading } = useEmailSettings()
  
  // Mutations for updating settings
  const updateBusinessSettings = useUpdateBusinessSettings()
  const updateEmailSettings = useUpdateEmailSettings()
  const smtpTest = useSmtpTest()

  // Local state for form data
  const [localBusinessSettings, setLocalBusinessSettings] = useState<Partial<BusinessSettings>>({})
  const [localEmailSettings, setLocalEmailSettings] = useState<Partial<EmailSettings>>({})
  const [smtpTestEmail, setSmtpTestEmail] = useState('')

  // Initialize local state when settings load
  useEffect(() => {
    if (businessSettings) {
      setLocalBusinessSettings(businessSettings)
    }
  }, [businessSettings])

  useEffect(() => {
    if (emailSettings) {
      setLocalEmailSettings(emailSettings)
    }
  }, [emailSettings])
  const [services, setServices] = useState(servicesList);
  const [newService, setNewService] = useState({ name: '', price: '', duration: '', category: 'Standard' });
  const [showPassword, setShowPassword] = useState(false);

  // Handle saving business settings
  const handleSaveBusinessSettings = () => {
    if (!localBusinessSettings) return
    updateBusinessSettings.mutate(localBusinessSettings)
  };

  // Handle saving email settings
  const handleSaveEmailSettings = () => {
    if (!localEmailSettings) return
    updateEmailSettings.mutate(localEmailSettings)
  };

  // Handle SMTP test
  const handleSmtpTest = () => {
    if (!smtpTestEmail) {
      toast.error('Please enter an email address for testing')
      return
    }
    smtpTest.mutate({ 
      to_email: smtpTestEmail,
      subject: 'SMTP Test from Schnittwerk',
      message: 'This is a test email to verify your SMTP configuration is working correctly.'
    })
  };

  // Handle opening hours updates
  const updateOpeningHours = (day: number, hours: DayHours) => {
    if (!localBusinessSettings.opening_hours) return
    
    const updatedHours = {
      ...localBusinessSettings.opening_hours,
      [day.toString()]: hours
    }
    
    setLocalBusinessSettings({
      ...localBusinessSettings,
      opening_hours: updatedHours
    })
  };

  const handleSaveHours = () => {
    handleSaveBusinessSettings()
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

      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="business" className="gap-2">
            <Building className="w-4 h-4" />
            Geschäft
          </TabsTrigger>
          <TabsTrigger value="hours" className="gap-2">
            <Clock className="w-4 h-4" />
            Öffnungszeiten
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="w-4 h-4" />
            E-Mail
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
              {businessLoading ? (
                <div className="text-center py-4">Lädt Geschäftseinstellungen...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="businessName">Geschäftsname</Label>
                      <Input
                        id="businessName"
                        value={localBusinessSettings.business_name || ''}
                        onChange={(e) => setLocalBusinessSettings({
                          ...localBusinessSettings,
                          business_name: e.target.value
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="businessPhone">Telefonnummer</Label>
                      <Input
                        id="businessPhone"
                        value={localBusinessSettings.business_phone || ''}
                        onChange={(e) => setLocalBusinessSettings({
                          ...localBusinessSettings,
                          business_phone: e.target.value
                        })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessEmail">E-Mail Adresse</Label>
                    <Input
                      id="businessEmail"
                      type="email"
                      value={localBusinessSettings.business_email || ''}
                      onChange={(e) => setLocalBusinessSettings({
                        ...localBusinessSettings,
                        business_email: e.target.value
                      })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessAddress">Adresse</Label>
                    <Input
                      id="businessAddress"
                      value={localBusinessSettings.business_address || ''}
                      onChange={(e) => setLocalBusinessSettings({
                        ...localBusinessSettings,
                        business_address: e.target.value
                      })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="maxAdvanceBooking">Maximale Vorlaufzeit (Tage)</Label>
                      <Input
                        id="maxAdvanceBooking"
                        type="number"
                        min="1"
                        max="365"
                        value={localBusinessSettings.max_advance_booking_days || 30}
                        onChange={(e) => setLocalBusinessSettings({
                          ...localBusinessSettings,
                          max_advance_booking_days: parseInt(e.target.value) || 30
                        })}
                      />
                      <p className="text-sm text-muted-foreground">
                        Wie viele Tage im Voraus können Kunden Termine buchen?
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bufferTime">Pufferzeit (Minuten)</Label>
                      <Input
                        id="bufferTime"
                        type="number"
                        min="0"
                        max="120"
                        value={localBusinessSettings.buffer_time_minutes || 15}
                        onChange={(e) => setLocalBusinessSettings({
                          ...localBusinessSettings,
                          buffer_time_minutes: parseInt(e.target.value) || 15
                        })}
                      />
                      <p className="text-sm text-muted-foreground">
                        Pufferzeit zwischen Terminen für Vorbereitung und Reinigung
                      </p>
                    </div>
                  </div>

                  <Button 
                    onClick={handleSaveBusinessSettings} 
                    className="gap-2"
                    disabled={updateBusinessSettings.isPending}
                  >
                    <Save className="w-4 h-4" />
                    {updateBusinessSettings.isPending ? 'Speichert...' : 'Einstellungen speichern'}
                  </Button>
                </>
              )}
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
              {businessLoading ? (
                <div className="text-center py-4">Lädt Öffnungszeiten...</div>
              ) : (
                <>
                  {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                    const dayData = localBusinessSettings.opening_hours?.[dayIndex.toString()]
                    const dayName = dayNames[dayIndex]
                    
                    return (
                      <div key={dayIndex} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="w-20 font-medium">{dayName}</div>
                          <Switch
                            checked={dayData?.is_open || false}
                            onCheckedChange={(checked) => {
                              const newHours = {
                                is_open: checked,
                                start_time: dayData?.start_time || '09:00',
                                end_time: dayData?.end_time || '18:00'
                              }
                              updateOpeningHours(dayIndex, newHours)
                            }}
                          />
                        </div>
                        
                        {dayData?.is_open && (
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Label>Von:</Label>
                              <Input
                                type="time"
                                value={dayData.start_time}
                                onChange={(e) => {
                                  const newHours = {
                                    ...dayData,
                                    start_time: e.target.value
                                  }
                                  updateOpeningHours(dayIndex, newHours)
                                }}
                                className="w-32"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label>Bis:</Label>
                              <Input
                                type="time"
                                value={dayData.end_time}
                                onChange={(e) => {
                                  const newHours = {
                                    ...dayData,
                                    end_time: e.target.value
                                  }
                                  updateOpeningHours(dayIndex, newHours)
                                }}
                                className="w-32"
                              />
                            </div>
                          </div>
                        )}
                        
                        {!dayData?.is_open && (
                          <Badge variant="secondary">Geschlossen</Badge>
                        )}
                      </div>
                    )
                  })}
                  
                  <Button 
                    onClick={handleSaveHours} 
                    className="gap-2"
                    disabled={updateBusinessSettings.isPending}
                  >
                    <Save className="w-4 h-4" />
                    {updateBusinessSettings.isPending ? 'Speichert...' : 'Öffnungszeiten speichern'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                E-Mail Konfiguration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {emailLoading ? (
                <div className="text-center py-4">Lädt E-Mail Einstellungen...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtpHost">SMTP Server</Label>
                      <Input
                        id="smtpHost"
                        placeholder="smtp.gmail.com"
                        value={localEmailSettings.smtp_host || ''}
                        onChange={(e) => setLocalEmailSettings({
                          ...localEmailSettings,
                          smtp_host: e.target.value
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpPort">SMTP Port</Label>
                      <Input
                        id="smtpPort"
                        type="number"
                        placeholder="587"
                        value={localEmailSettings.smtp_port || ''}
                        onChange={(e) => setLocalEmailSettings({
                          ...localEmailSettings,
                          smtp_port: parseInt(e.target.value) || 587
                        })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtpUsername">Benutzername</Label>
                      <Input
                        id="smtpUsername"
                        type="email"
                        value={localEmailSettings.smtp_username || ''}
                        onChange={(e) => setLocalEmailSettings({
                          ...localEmailSettings,
                          smtp_username: e.target.value
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpPassword">Passwort</Label>
                      <div className="relative">
                        <Input
                          id="smtpPassword"
                          type={showPassword ? "text" : "password"}
                          value={localEmailSettings.smtp_password || ''}
                          onChange={(e) => setLocalEmailSettings({
                            ...localEmailSettings,
                            smtp_password: e.target.value
                          })}
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
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtpFromEmail">Absender E-Mail</Label>
                      <Input
                        id="smtpFromEmail"
                        type="email"
                        value={localEmailSettings.smtp_from_email || ''}
                        onChange={(e) => setLocalEmailSettings({
                          ...localEmailSettings,
                          smtp_from_email: e.target.value
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpFromName">Absender Name</Label>
                      <Input
                        id="smtpFromName"
                        value={localEmailSettings.smtp_from_name || ''}
                        onChange={(e) => setLocalEmailSettings({
                          ...localEmailSettings,
                          smtp_from_name: e.target.value
                        })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="smtpUseTls">TLS Verschlüsselung verwenden</Label>
                      <p className="text-sm text-muted-foreground">Empfohlen für die meisten SMTP-Server</p>
                    </div>
                    <Switch
                      id="smtpUseTls"
                      checked={localEmailSettings.smtp_use_tls || true}
                      onCheckedChange={(checked) => setLocalEmailSettings({
                        ...localEmailSettings,
                        smtp_use_tls: checked
                      })}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="font-semibold">SMTP Test</h3>
                    <p className="text-sm text-muted-foreground">
                      Senden Sie eine Test-E-Mail, um Ihre SMTP-Konfiguration zu überprüfen.
                    </p>
                    <div className="flex gap-4">
                      <Input
                        placeholder="test@example.com"
                        type="email"
                        value={smtpTestEmail}
                        onChange={(e) => setSmtpTestEmail(e.target.value)}
                        className="flex-1"
                      />
                      <Button 
                        onClick={handleSmtpTest}
                        disabled={smtpTest.isPending || !smtpTestEmail}
                        className="gap-2"
                      >
                        <TestTube className="w-4 h-4" />
                        {smtpTest.isPending ? 'Sendet...' : 'Test senden'}
                      </Button>
                    </div>
                  </div>

                  <Button 
                    onClick={handleSaveEmailSettings} 
                    className="gap-2"
                    disabled={updateEmailSettings.isPending}
                  >
                    <Save className="w-4 h-4" />
                    {updateEmailSettings.isPending ? 'Speichert...' : 'E-Mail Einstellungen speichern'}
                  </Button>
                </>
              )}
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
