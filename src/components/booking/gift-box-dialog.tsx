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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Gift, Plus } from 'lucide-react';
import { productCategories, Product } from '@/data/products';
import { useCart } from '@/contexts/cart-context';
import { toast } from '@/hooks/use-toast';

interface GiftBoxDialogProps {
  children: React.ReactNode;
}

const GiftBoxDialog = ({ children }: GiftBoxDialogProps) => {
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const { addToCart } = useCart();

  const allProducts = Object.values(productCategories)
    .flat()
    .filter(product => product.id !== 'gift-box');

  const handleProductToggle = (product: Product, checked: boolean) => {
    if (checked) {
      setSelectedProducts(prev => [...prev, product]);
    } else {
      setSelectedProducts(prev => prev.filter(p => p.id !== product.id));
    }
  };

  const handleCreateGiftBox = () => {
    if (selectedProducts.length === 0) {
      toast({
        title: 'Keine Produkte ausgewählt',
        description: 'Bitte wählen Sie mindestens ein Produkt für die Geschenkbox aus.',
        variant: 'destructive'
      });
      return;
    }

    // Add gift box to cart
    addToCart({
      id: 'custom-gift-box-' + Date.now(),
      name: `Geschenkbox (${selectedProducts.length} Produkte)`,
      price: 'CHF 25.00',
      image: '/lovable-uploads/d05cfe2e-fc33-4e09-baa7-937af2a344d5.png',
      category: 'Gutscheine & Geschenkboxen'
    });

    // Add selected products to cart
    selectedProducts.forEach(product => {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        category: 'Geschenkbox Inhalt'
      });
    });

    toast({
      title: 'Geschenkbox erstellt',
      description: `Geschenkbox mit ${selectedProducts.length} Produkten wurde zum Warenkorb hinzugefügt.`
    });

    setSelectedProducts([]);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading text-foreground flex items-center gap-2">
            <Gift className="h-6 w-6" />
            Geschenkbox zusammenstellen
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Wählen Sie die Produkte aus, die in Ihrer Geschenkbox enthalten sein sollen
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted/30 p-4 rounded-lg">
            <h3 className="font-medium text-foreground mb-2">Ausgewählte Produkte: {selectedProducts.length}</h3>
            {selectedProducts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedProducts.map(product => (
                  <Badge key={product.id} variant="secondary">
                    {product.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-4">
            {allProducts.map(product => (
              <Card key={product.id} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedProducts.some(p => p.id === product.id)}
                      onCheckedChange={(checked) => handleProductToggle(product, checked as boolean)}
                    />
                    <div className="flex-shrink-0">
                      <img 
                        src={product.image} 
                        alt={product.name}
                        className="w-16 h-16 object-contain bg-muted/10 rounded-md border border-border p-1"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base font-medium text-foreground">
                          {product.name}
                        </CardTitle>
                        <Badge variant="secondary" className="text-sm ml-2 flex-shrink-0">
                          {product.price}
                        </Badge>
                      </div>
                      <CardDescription className="text-muted-foreground text-sm mt-1">
                        {product.detailedDescription}
                      </CardDescription>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setSelectedProducts([])}>
              Auswahl zurücksetzen
            </Button>
            <Button onClick={handleCreateGiftBox} disabled={selectedProducts.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              Geschenkbox erstellen (CHF 25.00)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GiftBoxDialog;