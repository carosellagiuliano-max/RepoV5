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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShoppingBag, Gift, Users, Sparkles, Scissors } from 'lucide-react';
import { productCategories } from '@/data/products';
import CategoryShopDialog from './category-shop-dialog';
import GiftBoxDialog from './gift-box-dialog';

interface CategoryNavDialogProps {
  children: React.ReactNode;
  title: string;
  description: string;
}

const CategoryNavDialog = ({ children, title, description }: CategoryNavDialogProps) => {
  const categories = [
    {
      name: 'Frauen Produkte',
      icon: Users,
      description: 'Haarpflege und Styling für Damen',
      color: 'bg-pink-100 text-pink-600'
    },
    {
      name: 'Männer Produkte', 
      icon: Scissors,
      description: 'Haarpflege und Styling für Herren',
      color: 'bg-blue-100 text-blue-600'
    },
    {
      name: 'Beauty & Zubehör',
      icon: Sparkles,
      description: 'Beauty-Produkte und Zubehör',
      color: 'bg-purple-100 text-purple-600'
    },
    {
      name: 'Gutscheine & Geschenkboxen',
      icon: Gift,
      description: 'Gutscheine und individuell zusammenstellbare Geschenkboxen',
      color: 'bg-green-100 text-green-600',
      special: true
    }
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading text-foreground flex items-center gap-2">
            <ShoppingBag className="h-6 w-6" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {categories.map((category) => {
            const CategoryIcon = category.icon;
            
            if (category.special) {
              return (
                <div key={category.name} className="space-y-4">
                  <Card className="border-border hover:shadow-soft transition-elegant cursor-pointer group">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-lg ${category.color}`}>
                          <CategoryIcon className="h-8 w-8" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-heading group-hover:text-primary transition-colors">
                            Gutscheine
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <CategoryShopDialog initialCategory="Gutscheine & Geschenkboxen">
                        <Button className="w-full">
                          Gutscheine kaufen
                        </Button>
                      </CategoryShopDialog>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-border hover:shadow-soft transition-elegant cursor-pointer group">
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-lg ${category.color}`}>
                          <Gift className="h-8 w-8" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-heading group-hover:text-primary transition-colors">
                            Geschenkboxen
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <GiftBoxDialog>
                        <Button className="w-full">
                          Geschenkbox zusammenstellen
                        </Button>
                      </GiftBoxDialog>
                    </CardContent>
                  </Card>
                </div>
              );
            }

            return (
              <CategoryShopDialog key={category.name} initialCategory={category.name}>
                <Card className="border-border hover:shadow-soft transition-elegant cursor-pointer group">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${category.color}`}>
                        <CategoryIcon className="h-8 w-8" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-heading group-hover:text-primary transition-colors">
                          {category.name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {category.description}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      {productCategories[category.name as keyof typeof productCategories]?.length || 0} Produkte verfügbar
                    </div>
                  </CardContent>
                </Card>
              </CategoryShopDialog>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryNavDialog;