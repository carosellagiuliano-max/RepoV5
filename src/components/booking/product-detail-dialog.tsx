import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { useCart } from '@/contexts/cart-context';
import { toast } from 'sonner';
import { Product } from '@/data/products';

interface ProductDetailDialogProps {
  product: Product | null;
  category: string;
  isOpen: boolean;
  onClose: () => void;
  showAddToCart?: boolean;
}

const ProductDetailDialog = ({ 
  product, 
  category, 
  isOpen, 
  onClose, 
  showAddToCart = false 
}: ProductDetailDialogProps) => {
  const { addToCart } = useCart();

  if (!product) return null;

  const handleAddToCart = () => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: category
    });
    toast.success(`${product.name} wurde zum Warenkorb hinzugefügt`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-50 p-2 rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Product Image */}
        <div className="relative h-64 md:h-80 overflow-hidden bg-muted/20 flex items-center justify-center">
          <img 
            src={product.image} 
            alt={product.name}
            className="w-full h-full object-contain p-4"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/30 to-transparent pointer-events-none"></div>
        </div>

        {/* Product Details */}
        <div className="p-6 space-y-6">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="text-2xl font-heading text-foreground">
                {product.name}
              </DialogTitle>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {product.price}
              </Badge>
            </div>
          </DialogHeader>

          {/* Category Badge */}
          <div>
            <Badge variant="outline" className="text-sm">
              {category}
            </Badge>
          </div>

          {/* Description */}
          <div className="space-y-4">
            <div>
              <h3 className="font-heading font-semibold text-foreground mb-2">
                Produktbeschreibung
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {product.detailedDescription}
              </p>
            </div>

            {/* Usage Instructions */}
            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="font-heading font-semibold text-foreground mb-2">
                Anwendung
              </h4>
              <p className="text-muted-foreground text-sm">
                {product.usage}
              </p>
            </div>
          </div>

          {/* Add to Cart Button */}
          {showAddToCart && (
            <div className="pt-4 border-t border-border">
              <Button
                onClick={handleAddToCart}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                size="lg"
              >
                <Plus className="h-5 w-5 mr-2" />
                In den Warenkorb - {product.price}
              </Button>
            </div>
          )}

          {/* Additional Info */}
          <div className="pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground text-center">
              Verfügbar im Salon oder per WhatsApp bestellbar.
              <br />
              Gerne beraten wir Sie persönlich über dieses Produkt.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetailDialog;