import { useEffect, useState } from 'react';
import { apiService } from '@/services/api.service.ts';
import { toast } from 'sonner';

interface CartItem {
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

export const useCart = () => {
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);

    const loadCart = async () => {
        try {
            setLoading(true);
            const response = await apiService.getCart();
            setCart(response.data?.items || []);
        } catch (error: any) {
            toast.error('Failed to load cart');
            console.error('Load cart error:', error);
        } finally {
            setLoading(false);
        }
    };

    const addItem = async (productId: string, quantity: number = 1) => {
        try {
            await apiService.addToCart(productId, quantity);
            await loadCart(); // Reload full cart
            toast.success('Added to cart');
        } catch (error: any) {
            toast.error(error.message || 'Failed to add to cart');
        }
    };

    const updateItem = async (productId: string, quantity: number) => {
        try {
            await apiService.updateCartItem(productId, quantity);
            await loadCart();
        } catch (error: any) {
            toast.error('Failed to update cart');
        }
    };

    const removeItem = async (productId: string) => {
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
            setCart([]);
            toast.success('Cart cleared');
        } catch (error: any) {
            toast.error('Failed to clear cart');
        }
    };

    useEffect(() => {
        loadCart();
    }, []);

    return {
        cart,
        loading,
        addItem,
        updateItem,
        removeItem,
        clearCart,
        getTotalItems: () => cart.reduce((sum, item) => sum + item.quantity, 0),
        getTotalPrice: () => cart.reduce((sum, item) => sum + (item.quantity * item.product.price), 0)
    };
};
