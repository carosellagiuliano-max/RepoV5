import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Gift, Users } from 'lucide-react';
import { useCart } from '@/contexts/cart-context';
import { toast } from 'sonner';
import voucherWomen from '@/assets/voucher-women.jpg';
import voucherMen from '@/assets/voucher-men.jpg';

interface CustomVoucherDialogProps {
  children: React.ReactNode;
}

const CustomVoucherDialog = ({ children }: CustomVoucherDialogProps) => {
  const [amount, setAmount] = useState('');
  const [gender, setGender] = useState<'women' | 'men'>('women');
  const { addToCart } = useCart();

  const handleAddToCart = () => {
    const voucherAmount = parseFloat(amount);
    if (!amount || voucherAmount <= 0) {
      toast.error('Bitte geben Sie einen gültigen Betrag ein');
      return;
    }

    const voucher = {
      id: `voucher-custom-${gender}-${Date.now()}`,
      name: `Gutschein ${gender === 'women' ? 'Frauen' : 'Männer'} CHF ${voucherAmount}`,
      description: `Geschenkgutschein für ${gender === 'women' ? 'Damen' : 'Herren'} im Wert von CHF ${voucherAmount}`,
      price: `CHF ${voucherAmount}`,
      category: 'Gutscheine & Geschenkboxen',
      image: gender === 'women' ? voucherWomen : voucherMen
    };

    addToCart(voucher);
    toast.success('Gutschein wurde zum Warenkorb hinzugefügt!');
    setAmount('');
  };

  const predefinedAmounts = [20, 50, 100, 150, 200, 250, 300];

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading text-foreground flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Gutschein Wunschbetrag
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Wählen Sie den Betrag und das Design für Ihren Gutschein
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 mt-6">
          <div className="space-y-3">
            <Label htmlFor="gender">Design auswählen</Label>
            <Select value={gender} onValueChange={(value: 'women' | 'men') => setGender(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="women">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Frauen Design
                  </div>
                </SelectItem>
                <SelectItem value="men">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Männer Design
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Schnellauswahl</Label>
            <div className="grid grid-cols-3 gap-2">
              {predefinedAmounts.map((preAmount) => (
                <Button
                  key={preAmount}
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(preAmount.toString())}
                  className="text-xs"
                >
                  CHF {preAmount}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="amount">Oder eigenen Betrag eingeben</Label>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                placeholder="z.B. 75"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                step="1"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                CHF
              </span>
            </div>
          </div>

          {amount && parseFloat(amount) > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <img 
                    src={gender === 'women' ? voucherWomen : voucherMen} 
                    alt="Gutschein Vorschau"
                    className="w-12 h-12 object-contain rounded border"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      Gutschein {gender === 'women' ? 'Frauen' : 'Männer'}
                    </p>
                    <Badge variant="secondary">CHF {parseFloat(amount).toFixed(0)}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Button 
            onClick={handleAddToCart}
            className="w-full"
            disabled={!amount || parseFloat(amount) <= 0}
          >
            In den Warenkorb
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomVoucherDialog;