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
import { ShoppingBag, Search } from 'lucide-react';
import { productCategories, Product } from '@/data/products';
import ProductDetailDialog from './product-detail-dialog';

interface ProductsDialogProps {
  children: React.ReactNode;
}

const ProductsDialog = ({ children }: ProductsDialogProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Frauen Produkte');
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const openProductDetail = (product: Product, category: string) => {
    setSelectedProduct(product);
    setSelectedCategory(category);
    setIsDetailOpen(true);
  };

  const categoryTabs = Object.keys(productCategories);

  // Filter products based on search term and active category
  const getFilteredProducts = () => {
    if (!activeCategory) return [];
    const categoryProducts = productCategories[activeCategory as keyof typeof productCategories];
    return categoryProducts.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.detailedDescription.toLowerCase().includes(searchTerm.toLowerCase())
    );
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
            Unsere Produkte
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Hochwertige Produkte für die perfekte Haar- und Körperpflege
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
            <Card key={productIndex} className="border-border hover:shadow-soft transition-elegant cursor-pointer" onClick={() => openProductDetail(product, activeCategory)}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                     <img 
                       src={product.image} 
                       alt={product.name}
                       className="w-20 h-20 object-contain bg-muted/10 rounded-md border border-border hover:scale-105 transition-transform p-1"
                     />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base font-medium text-foreground hover:text-primary transition-colors">
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
          showAddToCart={false}
        />
        
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            Alle Produkte können direkt im Salon erworben werden. 
            Gerne beraten wir Sie persönlich über die passenden Produkte für Ihr Haar.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductsDialog;