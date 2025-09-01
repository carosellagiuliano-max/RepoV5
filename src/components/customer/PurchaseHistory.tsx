import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingBag, Calendar, Package, CreditCard } from 'lucide-react';

const mockPurchases = [
  {
    id: 1,
    date: '2024-01-15',
    items: [
      { name: 'Trinity Hydrating Shampoo', quantity: 1, price: 32 },
      { name: 'Trinity Repair Conditioner', quantity: 1, price: 35 }
    ],
    total: 67,
    status: 'Geliefert'
  },
  {
    id: 2,
    date: '2024-01-08',
    items: [
      { name: 'TAILOR\'s Grooming Hair Wax', quantity: 2, price: 28 }
    ],
    total: 56,
    status: 'Geliefert'
  },
  {
    id: 3,
    date: '2023-12-20',
    items: [
      { name: 'Trinity Heat Protection Spray', quantity: 1, price: 29 },
      { name: 'Volume Shampoo', quantity: 1, price: 32 },
      { name: 'Hair Oil', quantity: 1, price: 38 }
    ],
    total: 99,
    status: 'Geliefert'
  }
];

const PurchaseHistory = () => {
  const totalSpent = mockPurchases.reduce((sum, purchase) => sum + purchase.total, 0);
  const totalOrders = mockPurchases.length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Geliefert':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'Unterwegs':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'In Bearbeitung':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Purchase Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ShoppingBag className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gesamtbestellungen</p>
                <p className="text-2xl font-bold">{totalOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Produkte gekauft</p>
                <p className="text-2xl font-bold">{mockPurchases.reduce((sum, purchase) => sum + purchase.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Letzte Bestellung</p>
                <p className="text-sm font-medium">{mockPurchases[0].date}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Purchase History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            Bestellhistorie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockPurchases.map((purchase) => (
              <Card key={purchase.id} className="border-l-4 border-l-primary/30">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Calendar className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Bestellung #{purchase.id}</p>
                        <p className="text-sm text-muted-foreground">{purchase.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={getStatusColor(purchase.status)}>
                        {purchase.status}
                      </Badge>
                      <p className="text-lg font-bold mt-1">CHF {purchase.total}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {purchase.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center py-2 px-3 bg-muted/20 rounded">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm">{item.name}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.quantity}x CHF {item.price}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PurchaseHistory;