import React, { createContext, useContext, useState, useEffect } from 'react';

interface CartItem {
  id: string;
  name: string;
  price: string;
  quantity: number;
  category: string;
  image: string;
  isGiftWrapped?: boolean;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity' | 'isGiftWrapped'>) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  toggleGiftWrap: () => void;
  setGiftWrapGender: (gender: 'men' | 'women') => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isGiftWrapped: boolean;
  giftWrapGender: 'men' | 'women';
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isGiftWrapped, setIsGiftWrapped] = useState(false);
  const [giftWrapGender, setGiftWrapGender] = useState<'men' | 'women'>('women');

  const addToCart = (item: Omit<CartItem, 'quantity' | 'isGiftWrapped'>) => {
    setCartItems(prev => {
      const existingItem = prev.find(cartItem => cartItem.id === item.id);
      if (existingItem) {
        return prev.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prev, { ...item, quantity: 1, isGiftWrapped: false }];
    });
  };

  const toggleGiftWrap = () => {
    setIsGiftWrapped(prev => !prev);
  };

  const removeFromCart = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCartItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, quantity } : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  
  const totalPrice = cartItems.reduce((sum, item) => {
    const price = parseFloat(item.price.replace('CHF ', ''));
    return sum + (price * item.quantity);
  }, 0) + (isGiftWrapped ? 5 : 0);

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      toggleGiftWrap,
      setGiftWrapGender,
      clearCart,
      totalItems,
      totalPrice,
      isGiftWrapped,
      giftWrapGender
    }}>
      {children}
    </CartContext.Provider>
  );
};