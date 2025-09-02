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
import { ShoppingBag, Plus, Search } from 'lucide-react';
import { useCart } from '@/contexts/cart-context';
import { toast } from 'sonner';
import { products, Product } from '@/data/products';
import ProductDetailDialog from './product-detail-dialog';

interface ShopDialogProps {
  children: React.ReactNode;
}

const ShopDialog = ({ children }: ShopDialogProps) => {
  const { addToCart } = useCart();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const openProductDetail = (product: Product, category: string) => {
    setSelectedProduct(product);
    setSelectedCategory(category);
    setIsDetailOpen(true);
  };

  const handleAddToCart = (product: unknown, category: string) => {
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: category
    });
    toast.success(`${product.name} wurde zum Warenkorb hinzugefügt`);
  };

  // Filter products based on search term
  const filteredProducts = products.map(category => ({
    ...category,
    items: category.items.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.detailedDescription.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.items.length > 0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading text-foreground flex items-center gap-2">
            <ShoppingBag className="h-6 w-6" />
            Shop - Unsere Produkte
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Hochwertige Trinity Haircare Produkte für die perfekte Haarpflege zu Hause
          </DialogDescription>
        </DialogHeader>
        
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
        
        <div className="space-y-8 mt-6">
          {/* Trinity Haircare Produkte */}
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground mb-2">Trinity Haircare Premium Produkte</h2>
              <p className="text-muted-foreground text-sm">Professionelle Haarpflege für optimale Ergebnisse</p>
            </div>
            {filteredProducts.filter(category => category.category.includes('Trinity')).map((category, categoryIndex) => (
              <div key={categoryIndex}>
                <h3 className="text-lg font-semibold text-foreground mb-4 border-b border-border pb-2">
                  {category.category}
                </h3>
                <div className="grid gap-4">
                  {category.items.map((product, productIndex) => (
                    <Card key={productIndex} className="border-border hover:shadow-soft transition-elegant">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <div className="flex-shrink-0 cursor-pointer" onClick={() => openProductDetail(product, category.category)}>
                            <img 
                              src={product.image} 
                              alt={product.name}
                              className="w-24 h-24 object-contain bg-muted/10 rounded-md border border-border hover:scale-105 transition-transform p-1"
                            />
                          </div>
                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex justify-between items-start">
                              <CardTitle 
                                className="text-base font-medium text-foreground cursor-pointer hover:text-primary transition-colors"
                                onClick={() => openProductDetail(product, category.category)}
                              >
                                {product.name}
                              </CardTitle>
                              <Badge variant="secondary" className="text-sm ml-2 flex-shrink-0">
                                {product.price}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <CardDescription className="text-muted-foreground text-sm">
                                {product.detailedDescription}
                              </CardDescription>
                              <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                                <strong>Anwendung:</strong> {product.usage}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => openProductDetail(product, category.category)}
                                variant="outline"
                                className="flex-1"
                                size="sm"
                              >
                                Details ansehen
                              </Button>
                              <Button
                                onClick={() => handleAddToCart(product, category.category)}
                                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                                size="sm"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                In den Warenkorb
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* TAILOR's Grooming Produkte */}
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground mb-2">TAILOR's Grooming Produkte</h2>
              <p className="text-muted-foreground text-sm">Moderne Herrenpflege für den anspruchsvollen Mann</p>
            </div>
            {filteredProducts.filter(category => category.category.includes('TAILOR')).map((category, categoryIndex) => (
              <div key={categoryIndex}>
                <h3 className="text-lg font-semibold text-foreground mb-4 border-b border-border pb-2">
                  {category.category}
                </h3>
                <div className="grid gap-4">
                  {category.items.map((product, productIndex) => (
                    <Card key={productIndex} className="border-border hover:shadow-soft transition-elegant">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <div className="flex-shrink-0 cursor-pointer" onClick={() => openProductDetail(product, category.category)}>
                           <img 
                             src={product.image} 
                             alt={product.name}
                             className="w-24 h-24 object-contain bg-muted/10 rounded-md border border-border hover:scale-105 transition-transform p-1"
                           />
                          </div>
                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex justify-between items-start">
                              <CardTitle 
                                className="text-base font-medium text-foreground cursor-pointer hover:text-primary transition-colors"
                                onClick={() => openProductDetail(product, category.category)}
                              >
                                {product.name}
                              </CardTitle>
                              <Badge variant="secondary" className="text-sm ml-2 flex-shrink-0">
                                {product.price}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <CardDescription className="text-muted-foreground text-sm">
                                {product.detailedDescription}
                              </CardDescription>
                              <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                                <strong>Anwendung:</strong> {product.usage}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() => openProductDetail(product, category.category)}
                                variant="outline"
                                className="flex-1"
                                size="sm"
                              >
                                Details ansehen
                              </Button>
                              <Button
                                onClick={() => handleAddToCart(product, category.category)}
                                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                                size="sm"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                In den Warenkorb
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Styling Produkte */}
          {filteredProducts.filter(category => category.category === 'Styling Produkte').map((category, categoryIndex) => (
            <div key={categoryIndex} className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-foreground mb-2">{category.category}</h2>
                <p className="text-muted-foreground text-sm">Professionelle Styling-Produkte für perfekte Frisuren</p>
              </div>
              <div className="grid gap-4">
                {category.items.map((product, productIndex) => (
                  <Card key={productIndex} className="border-border hover:shadow-soft transition-elegant">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        <div className="flex-shrink-0 cursor-pointer" onClick={() => openProductDetail(product, category.category)}>
                           <img 
                             src={product.image} 
                             alt={product.name}
                             className="w-24 h-24 object-contain bg-muted/10 rounded-md border border-border hover:scale-105 transition-transform p-1"
                           />
                        </div>
                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="flex justify-between items-start">
                            <CardTitle 
                              className="text-base font-medium text-foreground cursor-pointer hover:text-primary transition-colors"
                              onClick={() => openProductDetail(product, category.category)}
                            >
                              {product.name}
                            </CardTitle>
                            <Badge variant="secondary" className="text-sm ml-2 flex-shrink-0">
                              {product.price}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <CardDescription className="text-muted-foreground text-sm">
                              {product.detailedDescription}
                            </CardDescription>
                            <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                              <strong>Anwendung:</strong> {product.usage}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => openProductDetail(product, category.category)}
                              variant="outline"
                              className="flex-1"
                              size="sm"
                            >
                              Details ansehen
                            </Button>
                            <Button
                              onClick={() => handleAddToCart(product, category.category)}
                              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                              size="sm"
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              In den Warenkorb
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
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
            Alle Produkte können direkt im Salon erworben oder per WhatsApp bestellt werden.
            Gerne beraten wir Sie persönlich über die passenden Produkte für Ihr Haar.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShopDialog;