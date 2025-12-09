import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { apiService } from '@/services/api.service';

export interface CartItem {
    id: string;
    product_id: string;
    quantity: number;
    product: {
        id: string;
        name: string;
        price: number;
        image_url?: string;
        category: string;
        stock: number;
    };
}

// interface CartContextType {
//     items: CartItem[];
//     loading: boolean;
//     addToCart: (productId: {
//         name: string;
//         price: number;
//         quantity: number;
//         material: "PLA" | "ABS" | "PETG" | "TPU" | "Nylon" | "Wood Fill" | "Carbon Fiber" | "Resin";
//         dimensions: { length: number; width: number; height: number };
//         isCustom: boolean
//     }, quantity?: number) => Promise<void>;
//     removeFromCart: (productId: string) => Promise<void>;
//     updateQuantity: (productId: string, quantity: number) => Promise<void>;
//     clearCart: () => Promise<void>;
//     total: number;
//     itemCount: number;
//     isAuthenticated: boolean;
// }

interface CartContextType {
    items: CartItem[];
    loading: boolean;
    addToCart: (productId: string, quantity?: number) => Promise<void>;
    removeFromCart: (productId: string) => Promise<void>;
    updateQuantity: (productId: string, quantity: number) => Promise<void>;
    clearCart: () => Promise<void>;
    total: number;
    itemCount: number;
    isAuthenticated: boolean;
    loadCart: () => Promise<void>;  // ✅ ADD THIS LINE
}



const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [items, setItems] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Load cart from backend when authenticated
    const loadCart = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiService.getCart();
            setItems(response.data?.items || []);
            setIsAuthenticated(true);
        } catch (error: any) {
            console.error('Failed to load cart:', error);
            setItems([]);
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    }, []);

    // Watch for authentication changes
    // Watch for authentication changes
    useEffect(() => {
        const isAuth = apiService.isAuthenticated();
        console.log('Auth check:', isAuth); // ✅ Debug
        setIsAuthenticated(isAuth);

        if (isAuth) {
            console.log('Loading cart...'); // ✅ Debug
            loadCart();
        } else {
            console.log('Clearing cart'); // ✅ Debug
            setItems([]);
        }
    }, []); // ✅ Empty - runs once on mount


    // Periodic auth check (optional - every 5 minutes)
    useEffect(() => {
        const interval = setInterval(() => {
            const isAuth = apiService.isAuthenticated();
            if (!isAuth && items.length > 0) {
                setItems([]);
                setIsAuthenticated(false);
            }
        }, 0); // 5 minutes

        return () => clearInterval(interval);
    }, [items.length]);

    const addToCart = async (productId: string, quantity: number = 1) => {
        try {
            await apiService.addToCart(productId, quantity);
            await loadCart();
            toast.success('Added to cart!');
        } catch (error: any) {
            toast.error(error.message || 'Failed to add to cart');
        }
    };

    const updateQuantity = async (productId: string, quantity: number) => {
        if (quantity < 1) {
            await removeFromCart(productId);
            return;
        }
        try {
            await apiService.updateCartItem(productId, quantity);
            await loadCart();
        } catch (error: any) {
            toast.error('Failed to update cart');
        }
    };

    const removeFromCart = async (productId: string) => {
        try {
            await apiService.removeFromCart(productId);
            await loadCart();
            toast.success('Removed from cart');
        } catch (error: any) {
            toast.error('Failed to remove from cart');
        }
    };

    const clearCart = async () => {
        try {
            await apiService.clearCart();
            setItems([]);
            toast.success('Cart cleared');
        } catch (error: any) {
            toast.error('Failed to clear cart');
        }
    };

    const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <CartContext.Provider
            value={{
                items,
                loading,
                addToCart,
                removeFromCart,
                updateQuantity,
                clearCart,
                total,
                itemCount,
                isAuthenticated,
                loadCart,
            }}
        >
            {children}
        </CartContext.Provider>
    );
};

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within CartProvider');
    }
    return context;
};
