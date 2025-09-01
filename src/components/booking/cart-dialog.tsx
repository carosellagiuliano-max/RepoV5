import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Minus, Plus, Trash2, Gift } from 'lucide-react';
import { useCart } from '@/contexts/cart-context';

interface CartDialogProps {
  children: React.ReactNode;
}

const CartDialog = ({ children }: CartDialogProps) => {
  const { cartItems, updateQuantity, removeFromCart, toggleGiftWrap, totalPrice, clearCart, isGiftWrapped, giftWrapGender, setGiftWrapGender } = useCart();

  const handleOrder = () => {
    if (cartItems.length === 0) return;
    
    const orderText = cartItems.map(item => 
      `${item.quantity}x ${item.name} - ${item.price}`
    ).join('\n');
    
    const total = `\nGesamtbetrag: CHF ${totalPrice.toFixed(2)}`;
    const message = `Hallo! Ich möchte folgende Produkte bestellen:\n\n${orderText}${total}`;
    
    const whatsappUrl = `https://wa.me/41718019265?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading text-foreground flex items-center gap-2">
            <ShoppingCart className="h-6 w-6" />
            Einkaufswagen
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Ihre ausgewählten Produkte
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-6">
          {cartItems.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Ihr Einkaufswagen ist leer</p>
            </div>
          ) : (
            <>
              {cartItems.map((item) => (
                <Card key={item.id} className="border-border">
                  <CardContent className="p-4">
                    <div className="flex gap-4 mb-3">
                      <div className="flex-shrink-0">
                        <img 
                          src={item.image} 
                          alt={item.name}
                          className="w-16 h-16 object-contain bg-muted/10 rounded-md border border-border p-1"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <CardTitle className="text-base font-medium text-foreground">
                              {item.name}
                            </CardTitle>
                            <CardDescription className="text-muted-foreground text-sm">
                              {item.category}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{item.price}</Badge>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFromCart(item.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          <div className="text-sm font-medium text-foreground">
                            Total: CHF {(parseFloat(item.price.replace('CHF ', '')) * item.quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <div className="border-t border-border pt-4 space-y-4">
                <div className="p-3 bg-muted/30 rounded-lg space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isGiftWrapped}
                      onCheckedChange={toggleGiftWrap}
                      id="global-gift-wrap"
                    />
                    <label htmlFor="global-gift-wrap" className="text-sm cursor-pointer flex items-center gap-2 flex-1">
                      <Gift className="h-4 w-4" />
                      Gesamte Bestellung als Geschenk verpacken (+CHF 5.00)
                    </label>
                  </div>
                  
                  {isGiftWrapped && (
                    <div className="ml-6 space-y-2">
                      <label className="text-xs text-muted-foreground">Geschenkverpackung für:</label>
                      <Select value={giftWrapGender} onValueChange={(value: 'men' | 'women') => setGiftWrapGender(value)}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="women">Frauen</SelectItem>
                          <SelectItem value="men">Männer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>Gesamtbetrag:</span>
                  <span>CHF {totalPrice.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={clearCart}
                  className="flex-1"
                >
                  Warenkorb leeren
                </Button>
                <Button
                  onClick={handleOrder}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Jetzt bestellen
                </Button>
              </div>
              
              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground text-center">
                  Die Bestellung wird per WhatsApp an uns gesendet. Sie können die Produkte im Salon abholen.
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CartDialog;