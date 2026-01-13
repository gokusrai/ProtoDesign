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

export interface CartContextType {
    items: CartItem[];
    loading: boolean;
    addToCart: (productId: string, quantity?: number) => Promise<void>;
    removeFromCart: (productId: string) => Promise<void>;
    updateQuantity: (productId: string, quantity: number) => Promise<void>;
    clearCart: () => Promise<void>;
    total: number;
    itemCount: number;
    isAuthenticated: boolean;
    loadCart: (silent?: boolean) => Promise<void>;
}