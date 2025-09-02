import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, User, Plus } from 'lucide-react';

import { ProfileInsert } from '@/lib/types/database';

interface AddCustomerModalProps {
  onClose: () => void;
  onSave: (customerData: Partial<ProfileInsert> & { name: string; phone: string }) => void;
}

export function AddCustomerModal({ onClose, onSave }: AddCustomerModalProps) {
  const [customerData, setCustomerData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    birthdate: '',
    status: 'neu',
    preferredTime: 'no-preference',
    notes: '',
    emailNotifications: true,
    smsNotifications: true,
    marketingEmails: false
  });

  const handleSave = () => {
    // Validate required fields
    if (!customerData.name || !customerData.email || !customerData.phone) {
      alert('Bitte füllen Sie alle Pflichtfelder aus.');
      return;
    }
    
    onSave(customerData);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-background rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Neuen Kunden hinzufügen</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] p-6">
          <div className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Grunddaten
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="Vor- und Nachname"
                      value={customerData.name}
                      onChange={(e) => setCustomerData({...customerData, name: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      E-Mail <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      placeholder="kunde@example.com"
                      value={customerData.email}
                      onChange={(e) => setCustomerData({...customerData, email: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Telefon <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="+41 76 123 45 67"
                      value={customerData.phone}
                      onChange={(e) => setCustomerData({...customerData, phone: e.target.value})}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Geburtsdatum</label>
                    <Input
                      type="date"
                      value={customerData.birthdate}
                      onChange={(e) => setCustomerData({...customerData, birthdate: e.target.value})}
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Adresse</label>
                    <Input
                      placeholder="Straße, PLZ Ort"
                      value={customerData.address}
                      onChange={(e) => setCustomerData({...customerData, address: e.target.value})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Customer Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Kundeneinstellungen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Kundenstatus</label>
                    <Select value={customerData.status} onValueChange={(value) => setCustomerData({...customerData, status: value})}>
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
                    <label className="block text-sm font-medium mb-2">Bevorzugte Termine</label>
                    <Select value={customerData.preferredTime} onValueChange={(value) => setCustomerData({...customerData, preferredTime: value})}>
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
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Notizen</label>
                  <textarea
                    className="w-full p-2 border border-input rounded-md bg-background text-sm resize-none"
                    rows={3}
                    placeholder="Besondere Wünsche, Allergien, etc..."
                    value={customerData.notes}
                    onChange={(e) => setCustomerData({...customerData, notes: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-3">Kommunikation</label>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={customerData.emailNotifications}
                        onChange={(e) => setCustomerData({...customerData, emailNotifications: e.target.checked})}
                        className="rounded" 
                      />
                      <span className="text-sm">E-Mail Erinnerungen</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={customerData.smsNotifications}
                        onChange={(e) => setCustomerData({...customerData, smsNotifications: e.target.checked})}
                        className="rounded" 
                      />
                      <span className="text-sm">SMS Erinnerungen</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={customerData.marketingEmails}
                        onChange={(e) => setCustomerData({...customerData, marketingEmails: e.target.checked})}
                        className="rounded" 
                      />
                      <span className="text-sm">Marketing E-Mails</span>
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t">
          <Button onClick={onClose} variant="outline" className="flex-1">
            Abbrechen
          </Button>
          <Button onClick={handleSave} className="flex-1">
            Kunde hinzufügen
          </Button>
        </div>
      </div>
    </div>
  );
}