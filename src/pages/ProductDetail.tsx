import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Loader2,
    ShoppingCart,
    Heart,
    Share2,
    Star,
    TrendingUp,
    Zap,
    Package,
    Truck,
} from "lucide-react";
import { toast } from "sonner";
import { apiService } from "@/services/api.service";
import { useCart } from "@/contexts/CartContext";
import { formatINR } from "@/lib/currency";

interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    stock: number;
    category: string;
    image_url?: string;
    totalSales?: number;
}

interface Review {
    id: string;
    user_name: string;
    rating: number;
    comment: string;
    created_at: string;
}

const ProductDetail = () => {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const { addToCart } = useCart();

    const [product, setProduct] = useState<Product | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const [isFavorite, setIsFavorite] = useState(false);
    const [isAddingToCart, setIsAddingToCart] = useState(false);
    const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                if (!productId) {
                    navigate("/shop");
                    return;
                }

                // Fetch product details
                const productRes = await apiService.getProduct(productId);
                setProduct(productRes.data || productRes);

                // Fetch related products (same category, different product)
                try {
                    const relatedRes = await apiService.getProducts(productRes.category || undefined);
                    setRelatedProducts(
                        relatedRes.data?.filter((p: Product) => p.id !== productId).slice(0, 3) || []
                    );
                } catch (err) {
                    console.log("Related products not available");
                }
            } catch (error: any) {
                console.error("Failed to load product:", error);
                toast.error("Product not found");
                navigate("/shop");
            } finally {
                setLoading(false);
            }
        };

        fetchProduct();
    }, [productId, navigate]);

    const handleAddToCart = async () => {
        try {
            if (!apiService.isAuthenticated()) {
                toast.error("Please sign in to add items to cart");
                navigate("/auth");
                return;
            }

            setIsAddingToCart(true);
            await addToCart(product!.id, quantity);
            toast.success(`${quantity} × ${product!.name} added to cart!`);
        } catch (error: any) {
            console.error("Add to cart error:", error);
            toast.error("Failed to add to cart");
        } finally {
            setIsAddingToCart(false);
        }
    };

    const handleToggleFavorite = () => {
        setIsFavorite(!isFavorite);
        toast.success(isFavorite ? "Removed from favorites" : "Added to favorites");
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: product?.name,
                text: product?.description,
                url: window.location.href,
            });
        } else {
            navigator.clipboard.writeText(window.location.href);
            toast.success("Product link copied!");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!product) {
        return null;
    }

    const avgRating =
        reviews.length > 0
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
            : 0;
    const inStock = product.stock > 0;

    return (
        <div className="min-h-screen pt-20 pb-16">
            <div className="container mx-auto px-4">
                {/* Breadcrumb */}
                <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
                    <button
                        onClick={() => navigate("/shop")}
                        className="hover:text-primary transition-colors"
                    >
                        Shop
                    </button>
                    <span>/</span>
                    <span>{product.category}</span>
                    <span>/</span>
                    <span className="text-primary font-medium">{product.name}</span>
                </div>

                <div className="grid lg:grid-cols-2 gap-12 mb-16">
                    {/* Product Image */}
                    <motion.div
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <Card className="overflow-hidden">
                            <div className="aspect-square bg-muted flex items-center justify-center">
                                {product.image_url ? (
                                    <img
                                        src={product.image_url}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <Package className="w-24 h-24 text-muted-foreground" />
                                )}
                            </div>
                        </Card>

                        {/* Product Specs (optional) */}
                        <div className="mt-8 grid grid-cols-3 gap-4">
                            <Card className="p-4 text-center">
                                <Zap className="w-6 h-6 mx-auto mb-2 text-primary" />
                                <p className="text-sm font-medium">High Performance</p>
                            </Card>
                            <Card className="p-4 text-center">
                                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-primary" />
                                <p className="text-sm font-medium">
                                    {product.totalSales || 0} Sold
                                </p>
                            </Card>
                            <Card className="p-4 text-center">
                                <Truck className="w-6 h-6 mx-auto mb-2 text-primary" />
                                <p className="text-sm font-medium">Fast Delivery</p>
                            </Card>
                        </div>
                    </motion.div>

                    {/* Product Details */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex flex-col"
                    >
                        {/* Title & Badge */}
                        <div className="mb-4">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h1 className="font-display text-4xl mb-2">{product.name}</h1>
                                    <Badge variant="outline" className="text-xs">
                                        {product.category.replace("3d", "3D ")}
                                    </Badge>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={handleToggleFavorite}
                                    >
                                        <Heart
                                            className={`w-5 h-5 ${
                                                isFavorite ? "fill-red-500 text-red-500" : ""
                                            }`}
                                        />
                                    </Button>
                                    <Button variant="outline" size="icon" onClick={handleShare}>
                                        <Share2 className="w-5 h-5" />
                                    </Button>
                                </div>
                            </div>

                            {/* Rating */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex items-center gap-1">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            className={`w-4 h-4 ${
                                                i < Math.floor(Number(avgRating))
                                                    ? "fill-yellow-400 text-yellow-400"
                                                    : "text-muted-foreground"
                                            }`}
                                        />
                                    ))}
                                </div>
                                <span className="text-sm font-medium">{avgRating}</span>
                                <span className="text-sm text-muted-foreground">
                  ({reviews.length} reviews)
                </span>
                            </div>
                        </div>

                        <Separator className="mb-6" />

                        {/* Price & Stock */}
                        <div className="mb-6">
                            <p className="text-5xl font-bold mb-3 text-primary">
                                {formatINR(product.price)}
                            </p>
                            <div className="flex items-center gap-3">
                                <Badge
                                    variant={inStock ? "outline" : "destructive"}
                                    className={
                                        inStock
                                            ? "bg-green-50 text-green-700 border-green-200"
                                            : "bg-red-50 text-red-700 border-red-200"
                                    }
                                >
                                    {inStock ? `${product.stock} in stock` : "Out of stock"}
                                </Badge>
                                {product.totalSales && (
                                    <span className="text-sm text-muted-foreground">
                    {product.totalSales} units sold
                  </span>
                                )}
                            </div>
                        </div>

                        {/* Description */}
                        <div className="mb-8">
                            <h3 className="font-semibold mb-2">Description</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                {product.description}
                            </p>
                        </div>

                        {/* Add to Cart */}
                        <Card className="p-6 mb-6">
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="quantity">Quantity</Label>
                                    <div className="flex items-center gap-3 mt-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                            disabled={quantity === 1 || !inStock}
                                        >
                                            −
                                        </Button>
                                        <Input
                                            id="quantity"
                                            type="number"
                                            min="1"
                                            max={product.stock}
                                            value={quantity}
                                            onChange={(e) =>
                                                setQuantity(Math.min(product.stock, Math.max(1, parseInt(e.target.value) || 1)))
                                            }
                                            className="w-16 text-center"
                                            disabled={!inStock}
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setQuantity(Math.min(product.stock, quantity + 1))
                                            }
                                            disabled={quantity >= product.stock || !inStock}
                                        >
                                            +
                                        </Button>
                                    </div>
                                </div>

                                <Button
                                    onClick={handleAddToCart}
                                    disabled={!inStock || isAddingToCart}
                                    size="lg"
                                    className="w-full"
                                >
                                    {isAddingToCart ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        <>
                                            <ShoppingCart className="w-5 h-5 mr-2" />
                                            Add to Cart
                                        </>
                                    )}
                                </Button>
                            </div>
                        </Card>

                        {/* Trust Badges */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                                <Truck className="w-5 h-5 text-primary" />
                                <span>Free shipping on orders over ₹5000</span>
                            </div>
                            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                                <Zap className="w-5 h-5 text-primary" />
                                <span>30-day return policy</span>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Reviews Section */}
                {reviews.length > 0 && (
                    <div className="mb-16">
                        <h2 className="font-display text-3xl mb-6">Customer Reviews</h2>
                        <div className="space-y-4">
                            {reviews.map((review) => (
                                <Card key={review.id}>
                                    <CardContent className="pt-6">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="font-semibold">{review.user_name}</p>
                                                <div className="flex items-center gap-1 mt-1">
                                                    {[...Array(5)].map((_, i) => (
                                                        <Star
                                                            key={i}
                                                            className={`w-4 h-4 ${
                                                                i < review.rating
                                                                    ? "fill-yellow-400 text-yellow-400"
                                                                    : "text-muted-foreground"
                                                            }`}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <span className="text-sm text-muted-foreground">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                                        </div>
                                        <p className="text-muted-foreground">{review.comment}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {/* Related Products */}
                {relatedProducts.length > 0 && (
                    <div>
                        <h2 className="font-display text-3xl mb-6">Related Products</h2>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {relatedProducts.map((relatedProduct, index) => (
                                <motion.div
                                    key={relatedProduct.id}
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: index * 0.1 }}
                                >
                                    <Card
                                        className="overflow-hidden hover:shadow-glow transition-shadow cursor-pointer h-full flex flex-col"
                                        onClick={() => navigate(`/product/${relatedProduct.id}`)}
                                    >
                                        <div className="aspect-square overflow-hidden bg-muted flex items-center justify-center">
                                            {relatedProduct.image_url ? (
                                                <img
                                                    src={relatedProduct.image_url}
                                                    alt={relatedProduct.name}
                                                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                                                />
                                            ) : (
                                                <Package className="w-12 h-12 text-muted-foreground" />
                                            )}
                                        </div>
                                        <CardHeader className="flex-1">
                                            <CardTitle>{relatedProduct.name}</CardTitle>
                                            <CardDescription>{relatedProduct.description}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="flex-1 flex flex-col">
                                            <p className="font-bold text-xl mb-2 text-primary">
                                                {formatINR(relatedProduct.price)}
                                            </p>
                                            <Button variant="outline" className="w-full mt-auto">
                                                View Details
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductDetail;