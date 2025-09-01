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
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Search, Plus, Minus } from 'lucide-react';
import { productCategories, Product } from '@/data/products';
import { useCart } from '@/contexts/cart-context';
import ProductDetailDialog from './product-detail-dialog';
import CustomVoucherDialog from './custom-voucher-dialog';
import { toast } from '@/hooks/use-toast';

interface CategoryShopDialogProps {
  children: React.ReactNode;
  initialCategory?: string;
}

const CategoryShopDialog = ({ children, initialCategory }: CategoryShopDialogProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory || 'Frauen Produkte');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [quantities, setQuantities] = useState<{[key: string]: number}>({});
  const { addToCart } = useCart();

  const openProductDetail = (product: Product, category: string) => {
    setSelectedProduct(product);
    setSelectedCategory(category);
    setIsDetailOpen(true);
  };

  const categoryTabs = Object.keys(productCategories);

  const getFilteredProducts = () => {
    if (!activeCategory) return [];
    const categoryProducts = productCategories[activeCategory as keyof typeof productCategories];
    return categoryProducts.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.detailedDescription.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const handleQuantityChange = (productId: string, change: number) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(0, (prev[productId] || 0) + change)
    }));
  };

  const handleAddToCart = (product: Product) => {
    const quantity = quantities[product.id] || 1;
    for (let i = 0; i < quantity; i++) {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        category: activeCategory
      });
    }
    toast({
      title: 'Zum Warenkorb hinzugefügt',
      description: `${quantity}x ${product.name} wurde hinzugefügt.`
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading text-foreground flex items-center gap-2">
            <ShoppingBag className="h-6 w-6" />
            Shop - Produkte kaufen
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Wählen Sie Ihre Lieblingsprodukte und fügen Sie sie zum Warenkorb hinzu
          </DialogDescription>
        </DialogHeader>
        
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-4">
          {categoryTabs.map((category) => (
            <Button
              key={category}
              variant={activeCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(category)}
              className="text-sm"
            >
              {category}
            </Button>
          ))}
        </div>
        
        {/* Search Field */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Produkte suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Products Grid */}
        <div className="grid gap-4 mt-6">
          {getFilteredProducts().map((product, productIndex) => (
            <Card key={productIndex} className="border-border hover:shadow-soft transition-elegant">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 cursor-pointer" onClick={() => openProductDetail(product, activeCategory)}>
                     <img 
                       src={product.image} 
                       alt={product.name}
                       className="w-20 h-20 object-contain bg-muted/10 rounded-md border border-border hover:scale-105 transition-transform p-1"
                     />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex justify-between items-start">
                      <CardTitle 
                        className="text-base font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                        onClick={() => openProductDetail(product, activeCategory)}
                      >
                        {product.name}
                      </CardTitle>
                      <Badge variant="secondary" className="text-sm ml-2 flex-shrink-0">
                        {product.price}
                      </Badge>
                    </div>
                    <CardDescription className="text-muted-foreground text-sm">
                      {product.detailedDescription}
                    </CardDescription>
                    
                    {/* Add to Cart Controls */}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuantityChange(product.id, -1)}
                          disabled={!quantities[product.id] || quantities[product.id] <= 0}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm">
                          {quantities[product.id] || 0}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleQuantityChange(product.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      {product.id === 'voucher-custom' ? (
                        <CustomVoucherDialog>
                          <Button size="sm">
                            Betrag wählen
                          </Button>
                        </CustomVoucherDialog>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleAddToCart(product)}
                          disabled={!quantities[product.id] || quantities[product.id] <= 0}
                        >
                          In den Warenkorb
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {getFilteredProducts().length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Keine Produkte gefunden.</p>
            </div>
          )}
        </div>
        
        <ProductDetailDialog
          product={selectedProduct}
          category={selectedCategory}
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          showAddToCart={true}
        />
        
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            Alle Produkte werden im Salon abgeholt oder können per Versand geliefert werden.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryShopDialog;