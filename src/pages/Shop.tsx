// src/pages/Shop.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Heart } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, ShoppingCart, Search } from 'lucide-react';
import { formatINR } from '@/lib/currency';
import { apiService } from '@/services/api.service';
import { useCart } from '@/contexts/CartContext';
import ProductImageCarousel from '@/components/ProductImageCarousel';

interface ProductImage {
    id: string;
    image_url: string;
    image_data?: string;
    display_order: number;
}

interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    stock: number
    likes_count: number;           // 🔥 NEW: Like count from database
    image_url: string | null;
    category: string;
    product_images?: ProductImage[];
    images?: ProductImage[];
}

const Shop = () => {
    const navigate = useNavigate();
    const { addToCart } = useCart();
    const [products, setProducts] = useState<Product[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLiked, setIsLiked] = useState<Record<string, boolean>>({});
    const [likesCounts, setLikesCounts] = useState<Record<string, number>>({});
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loadingLikes, setLoadingLikes] = useState(false);


    useEffect(() => {
        const initLikes = async () => {
            try {
                // Check auth
                await apiService.getCurrentUser();
                setIsAuthenticated(true);

                // Load likes for visible products (first 9 for performance)
                const firstProducts = products.slice(0, 9);
                const likesData = await Promise.allSettled(
                    firstProducts.map(product => apiService.isProductLiked(product.id))
                );

                const likesState: Record<string, boolean> = {};
                const countsState: Record<string, number> = {};

                firstProducts.forEach((product, index) => {
                    const result = likesData[index];
                    if (result.status === 'fulfilled') {
                        likesState[product.id] = result.value.isLiked;
                        countsState[product.id] = result.value.likesCount;
                    } else {
                        likesState[product.id] = false;
                        countsState[product.id] = product.likes_count || 0;
                    }
                });

                setIsLiked(likesState);
                setLikesCounts(countsState);
            } catch {
                setIsAuthenticated(false);
            }
        };

        if (products.length > 0) {
            initLikes();
        }
    }, [products]);

    const handleLikeToggle = async (productId: string) => {
        if (!isAuthenticated) {
            toast.error('Please sign in to like products');
            navigate('/auth');
            return;
        }

        setLoadingLikes(true);
        try {
            if (isLiked[productId]) {
                // Unlike
                await apiService.unlikeProduct(productId);
                setIsLiked(prev => ({ ...prev, [productId]: false }));
                setLikesCounts(prev => ({
                    ...prev,
                    [productId]: Math.max((prev[productId] || 0) - 1, 0)
                }));
                toast.success('Unliked!');
            } else {
                // Like
                await apiService.likeProduct(productId);
                setIsLiked(prev => ({ ...prev, [productId]: true }));
                setLikesCounts(prev => ({
                    ...prev,
                    [productId]: (prev[productId] || 0) + 1
                }));
                toast.success('Liked!');
            }
        } catch (error: any) {
            toast.error('Failed to update like');
        } finally {
            setLoadingLikes(false);
        }
    };


    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const response = await apiService.getProducts();
            setProducts(response.data || []);
            setFilteredProducts(response.data || []);
        } catch (error: any) {
            console.error('Fetch products error:', error);
            toast.error('Failed to load products');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let filtered = products;

        if (category !== 'all') {
            filtered = filtered.filter((p) => p.category === category);
        }

        if (searchTerm) {
            filtered = filtered.filter(
                (p) =>
                    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    p.description.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        setFilteredProducts(filtered);
    }, [category, searchTerm, products]);

    const handleAddToCart = async (product: Product) => {
        try {
            if (!apiService.isAuthenticated()) {
                toast.error('Please sign in to add items to cart');
                navigate('/auth');
                return;
            }

            await addToCart(product.id, 1);
            toast.success(`${product.name} added to cart!`);
        } catch (error: any) {
            toast.error('Failed to add to cart');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center pt-20">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-20 pb-10">
            <div className="container mx-auto px-4">
                {/* Hero Section */}
                <section className="py-16 gradient-subtle mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center max-w-3xl mx-auto"
                    >
                        <h1 className="font-display text-5xl md:text-6xl mb-6">Premium 3D Printers</h1>
                        <p className="text-xl text-muted-foreground">
                            High-end printers designed for exceptional precision and quality.
                        </p>
                    </motion.div>
                </section>

                {/* Filters */}
                <section className="py-8 border-b mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search products..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Categories</SelectItem>
                                <SelectItem value="3d_printer">3D Printer</SelectItem>
                                <SelectItem value="3d_model">3D Model</SelectItem>
                                <SelectItem value="accessory">Accessory</SelectItem>
                            </SelectContent>
                        </Select>

                        <Button variant="outline" onClick={fetchProducts}>
                            Reset Filters
                        </Button>
                    </div>
                </section>

                {/* Products Grid */}
                <section className="py-8">
                    {filteredProducts.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-muted-foreground">No products found</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                            {filteredProducts.map((product, index) => {
                                const images = (product.product_images || product.images || [])
                                    .sort((a, b) => a.display_order - b.display_order);

                                return (
                                    <motion.div
                                        key={product.id}
                                        initial={{ opacity: 0, y: 30 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.6, delay: index * 0.1 }}
                                    >
                                        <Card className="flex flex-col overflow-hidden hover:shadow-glow transition-all h-full group cursor-pointer">
                                            {/* Image Carousel */}
                                            <div className="relative p-4 bg-muted/50">
                                                <ProductImageCarousel
                                                    images={images.length > 0 ? images : [{ id: '0', image_url: product.image_url || '', display_order: 0 }]}
                                                    productName={product.name}
                                                />
                                            </div>

                                            {/* Product Info */}
                                            <CardHeader>
                                                <div className="flex items-start justify-between mb-2">
                                                    <CardTitle className="text-lg">{product.name}</CardTitle>
                                                    <Badge variant="outline" className="text-xs">
                                                        {product.category.replace('_', ' ')}
                                                    </Badge>
                                                </div>
                                                <CardDescription className="line-clamp-2">
                                                    {product.description}
                                                </CardDescription>
                                            </CardHeader>

                                            <CardContent className="flex-1 flex flex-col">
                                                <div className="mb-4 flex-1">
                                                    <p className="text-2xl font-bold text-primary">{(product.price)}</p>

                                                </div>

                                                {/* 🔥 LIKE BUTTON WITH COUNT */}
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation(); // Prevent card click
                                                                handleLikeToggle(product.id);
                                                            }}
                                                            disabled={!isAuthenticated || loadingLikes}
                                                            className={`p-2 rounded-full flex items-center gap-1 transition-all duration-200 ${
                                                                isLiked[product.id]
                                                                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-md'
                                                                    : 'bg-muted hover:bg-muted-foreground/50 text-muted-foreground hover:text-foreground'
                                                            } ${!isAuthenticated ? 'cursor-not-allowed opacity-50' : ''}`}
                                                        >
                                                            <Heart
                                                                className={`h-4 w-4 transition-all ${isLiked[product.id] ? 'fill-current' : ''}`}
                                                            />
                                                            <span className="text-xs font-semibold">
            {likesCounts[product.id] || product.likes_count || 0}
          </span>
                                                        </button>
                                                    </div>

                                                    <p className={`text-sm ${product.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                                                    </p>
                                                </div>
                                                <Button
                                                    onClick={() => handleAddToCart(product)}
                                                    disabled={product.stock === 0}
                                                    className="w-full"
                                                >
                                                    <ShoppingCart className="mr-2 h-4 w-4" />
                                                    Add to Cart
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Shop;
