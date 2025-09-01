import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, Plus, Minus, Star, Filter, Search, ShoppingBag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ShopDialog from '@/components/booking/shop-dialog';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image: string;
  rating: number;
  description: string;
  inStock: boolean;
}

interface CartItem extends Product {
  quantity: number;
}

const ProductShop = () => {
  const { toast } = useToast();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCart, setShowCart] = useState(false);

  const products: Product[] = [
    {
      id: '1',
      name: 'Hydrating Shampoo',
      price: 24.99,
      category: 'shampoo',
      image: '/src/assets/products/hydrating-shampoo.jpg',
      rating: 4.8,
      description: 'Feuchtigkeitsspendendes Shampoo für trockenes Haar',
      inStock: true
    },
    {
      id: '2',
      name: 'Hair Oil Premium',
      price: 32.99,
      category: 'pflege',
      image: '/src/assets/products/hair-oil.jpg',
      rating: 4.9,
      description: 'Luxuriöses Haaröl für Glanz und Geschmeidigkeit',
      inStock: true
    },
    {
      id: '3',
      name: 'Volume Shampoo',
      price: 26.99,
      category: 'shampoo',
      image: '/src/assets/products/volume-shampoo.jpg',
      rating: 4.6,
      description: 'Volumen-Shampoo für mehr Fülle und Kraft',
      inStock: true
    },
    {
      id: '4',
      name: 'Moisturizing Conditioner',
      price: 28.99,
      category: 'conditioner',
      image: '/src/assets/products/moisturizing-conditioner.jpg',
      rating: 4.7,
      description: 'Reichhaltige Spülung für gepflegtes Haar',
      inStock: false
    },
    {
      id: '5',
      name: 'Heat Protection Spray',
      price: 19.99,
      category: 'styling',
      image: '/src/assets/products/heat-protection-spray.jpg',
      rating: 4.5,
      description: 'Schutz vor Hitze beim Styling',
      inStock: true
    },
    {
      id: '6',
      name: 'Texturizing Spray',
      price: 22.99,
      category: 'styling',
      image: '/src/assets/products/texturizing-spray.jpg',
      rating: 4.4,
      description: 'Für natürliche Textur und Volumen',
      inStock: true
    }
  ];

  const categories = [
    { value: 'all', label: 'Alle Kategorien' },
    { value: 'shampoo', label: 'Shampoo' },
    { value: 'conditioner', label: 'Conditioner' },
    { value: 'styling', label: 'Styling' },
    { value: 'pflege', label: 'Pflege' }
  ];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existingItem = prev.find(item => item.id === product.id);
      if (existingItem) {
        return prev.map(item =>
          item.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });

    toast({
      title: "Zum Warenkorb hinzugefügt",
      description: `${product.name} wurde hinzugefügt`,
    });
  };

  const updateQuantity = (productId: string, change: number) => {
    setCart(prev =>
      prev.map(item => {
        if (item.id === productId) {
          const newQuantity = Math.max(0, item.quantity + change);
          return newQuantity === 0 ? null : { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(Boolean) as CartItem[]
    );
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const handleCheckout = () => {
    toast({
      title: "Bestellung aufgegeben",
      description: `${getTotalItems()} Artikel für €${getTotalPrice().toFixed(2)} bestellt`,
    });
    setCart([]);
    setShowCart(false);
  };

  if (showCart) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-heading text-primary">Warenkorb</h3>
          <Button variant="outline" onClick={() => setShowCart(false)}>
            Zurück zum Shop
          </Button>
        </div>

        {cart.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Ihr Warenkorb ist leer</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {cart.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-4">
                      <img 
                        src={item.image} 
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <h4 className="font-semibold">{item.name}</h4>
                        <p className="text-sm text-muted-foreground">€{item.price}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">€{(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold">Gesamtsumme:</span>
                  <span className="text-2xl font-bold text-primary">€{getTotalPrice().toFixed(2)}</span>
                </div>
                <Button 
                  className="w-full bg-gradient-to-r from-primary to-primary/80"
                  onClick={handleCheckout}
                >
                  Jetzt bestellen ({getTotalItems()} Artikel)
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-heading text-primary">Produktshop</h3>
        <div className="flex gap-3">
          <ShopDialog>
            <Button variant="outline">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Alle Produkte
            </Button>
          </ShopDialog>
          <Button 
            className="bg-primary hover:bg-primary/90 relative"
            onClick={() => setShowCart(true)}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Warenkorb
            {getTotalItems() > 0 && (
              <Badge className="absolute -top-2 -right-2 bg-red-500 text-white min-w-[20px] h-5 flex items-center justify-center p-0 text-xs">
                {getTotalItems()}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Filter und Suche */}
      <div className="flex space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Produkte suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Produktgrid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((product) => (
          <Card key={product.id} className="hover-scale overflow-hidden">
            <div className="aspect-square overflow-hidden">
              <img 
                src={product.image} 
                alt={product.name}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-lg">{product.name}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description}
                  </p>
                </div>

                <div className="flex items-center space-x-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${
                        i < Math.floor(product.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="text-sm text-muted-foreground ml-2">
                    ({product.rating})
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-primary">
                    €{product.price}
                  </span>
                  {product.inStock ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Verfügbar
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-red-100 text-red-800">
                      Ausverkauft
                    </Badge>
                  )}
                </div>

                <Button 
                  className="w-full"
                  onClick={() => addToCart(product)}
                  disabled={!product.inStock}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  In den Warenkorb
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Keine Produkte gefunden</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProductShop;