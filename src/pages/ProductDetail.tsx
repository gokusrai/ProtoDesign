import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Loader2,
    ShoppingCart,
    Heart,
    Star,
    Truck,
    ShieldCheck,
    Minus,
    Plus,
    Check,
    ChevronRight,
    Share2,
    PenLine,
    ArrowRight,
    Headset,
    MapPin,
    Play
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { apiService } from "@/services/api.service";
import { useCart } from "@/hooks/use-cart";
import { formatINR } from "@/lib/currency";
import { motion, AnimatePresence } from "framer-motion";

// --- INTERFACES ---
interface ProductImage {
    id: string;
    image_url?: string;
    image_data?: string;
    display_order: number;
}

interface Product {
    id: string;
    name: string;
    description: string;
    short_description?: string;
    price: number;
    stock: number;
    category: string;
    sub_category?: string;
    image_url?: string;
    product_images?: ProductImage[];
    totalSales?: number;
    likes_count?: number;
    average_rating?: number;
    review_count?: number;
    specifications?: Record<string, string>;
    video_url?: string | null;
}

interface Review {
    id: string;
    user: string;
    rating: number;
    comment: string;
    created_at: string;
}

// --- HELPER: Category Mapping for Explore Button ---
const CATEGORY_ROUTES: Record<string, string> = {
    '3d_printer': '/printers',
    '3dprintables': '/printables',
    'filament': '/filaments',
    'resin': '/resins',
    'accessory': '/accessories',
    'spare_part': '/spare-parts'
};

// --- HELPER COMPONENTS ---

const StarRating = ({ rating, interactive = false, onRate, size = 16 }: { rating: number, interactive?: boolean, onRate?: (r: number) => void, size?: number }) => {
    const [hover, setHover] = useState(0);
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    size={size}
                    className={`transition-colors duration-200 ${interactive ? 'cursor-pointer' : ''} 
            ${star <= (hover || rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                    onClick={() => interactive && onRate && onRate(star)}
                    onMouseEnter={() => interactive && setHover(star)}
                    onMouseLeave={() => interactive && setHover(0)}
                />
            ))}
        </div>
    );
};

// Fixed Image Magnifier
const ImageMagnifier = ({ src }: { src: string }) => {
    const [showZoom, setShowZoom] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const imgRef = useRef<HTMLImageElement>(null);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!imgRef.current) return;
        const { left, top, width, height } = imgRef.current.getBoundingClientRect();
        const x = ((e.clientX - left) / width) * 100;
        const y = ((e.clientY - top) / height) * 100;
        setPosition({ x, y });
    };

    return (
        <div
            className="relative w-full h-full overflow-hidden bg-white rounded-2xl border border-border/50 cursor-crosshair flex items-center justify-center group"
            onMouseEnter={() => setShowZoom(true)}
            onMouseLeave={() => setShowZoom(false)}
            onMouseMove={handleMouseMove}
        >
            <img
                ref={imgRef}
                src={src}
                alt="Product"
                className={`w-full h-full object-contain p-4 transition-opacity duration-200 ${showZoom ? 'opacity-0' : 'opacity-100'}`}
            />
            {showZoom && (
                <div className="absolute inset-0 overflow-hidden bg-white pointer-events-none">
                    <img
                        src={src}
                        alt="Zoomed"
                        className="absolute max-w-none"
                        style={{
                            width: '250%',
                            height: '250%',
                            left: `${-position.x * 1.5}%`,
                            top: `${-position.y * 1.5}%`,
                            objectFit: 'contain'
                        }}
                    />
                </div>
            )}
        </div>
    );
};

// --- MAIN PAGE ---
const ProductDetail = () => {
    const { productId } = useParams<{ productId: string }>();
    const navigate = useNavigate();
    const { addToCart } = useCart();

    // Data State
    const [product, setProduct] = useState<Product | null>(null);
    const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
    const [reviews, setReviews] = useState<Review[]>([]);

    // UI State
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const [activeImage, setActiveImage] = useState<string>("");

    // Review Logic
    const [isReviewFormOpen, setIsReviewFormOpen] = useState(false);
    const [newReview, setNewReview] = useState({ rating: 0, comment: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Review Filters & Pagination
    const [reviewFilter, setReviewFilter] = useState("recent");
    const [reviewPage, setReviewPage] = useState(1);
    const REVIEWS_PER_PAGE = 6;

    const [isAddingToCart, setIsAddingToCart] = useState(false);

    // --- INITIAL DATA FETCH ---
    useEffect(() => {
        const loadData = async () => {
            try {
                if (!productId) { navigate("/shop"); return; }
                setLoading(true);

                // 1. Get Product
                const productRes = await apiService.getProduct(productId);
                // Handle both raw object and { data: object } format
                const fetchedProduct = productRes.data || productRes;
                setProduct(fetchedProduct);

                // Set active image immediately
                const firstImg = fetchedProduct.product_images?.[0]?.image_url
                    || fetchedProduct.product_images?.[0]?.image_data
                    || fetchedProduct.image_url
                    || "/placeholder.svg";
                setActiveImage(firstImg);

                // 2. Get Reviews
                try {
                    const reviewRes = await apiService.getProductReviews(productId);
                    // ✅ FIXED: Correctly handle array response
                    const reviewsData = Array.isArray(reviewRes) ? reviewRes : (reviewRes.data || []);
                    setReviews(reviewsData);
                } catch (e) { console.error("Failed to load reviews"); }

                // 3. Get Related Products (Alternating Logic)
                if (fetchedProduct.category) {
                    const categoryRes = await apiService.getProducts(fetchedProduct.category);
                    const catProducts = (categoryRes.data || []).filter((p: Product) => p.id !== fetchedProduct.id);

                    // Simulate "Keyword Match"
                    const keywordRes = await apiService.getProducts(null, null, );
                    const keywordProducts = (keywordRes.data || []).filter((p: Product) => p.id !== fetchedProduct.id);

                    // Interleave: [Cat1, Key1, Cat2, Key2...]
                    const combined: Product[] = [];
                    const maxLen = Math.max(catProducts.length, keywordProducts.length);
                    const addedIds = new Set();

                    for (let i = 0; i < maxLen; i++) {
                        if (i < catProducts.length && !addedIds.has(catProducts[i].id)) {
                            combined.push(catProducts[i]);
                            addedIds.add(catProducts[i].id);
                        }
                        if (i < keywordProducts.length && !addedIds.has(keywordProducts[i].id)) {
                            combined.push(keywordProducts[i]);
                            addedIds.add(keywordProducts[i].id);
                        }
                        if (combined.length >= 10) break;
                    }
                    setRelatedProducts(combined.slice(0, 10));
                }

                window.scrollTo(0, 0);

            } catch (error) {
                console.error("Error loading product", error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [productId, navigate]);

    // --- HANDLERS ---

    const getProductImages = (): string[] => {
        if (!product) return [];
        const images: string[] = [];
        
        // Add Video first (if exists)
        if (product.video_url) images.push(product.video_url);

        if (product.product_images?.length) {
            product.product_images.forEach(img => {
                const url = img.image_url || img.image_data;
                if (url) images.push(url);
            });
        }
        // Fallback to old image_url if no gallery
        if (images.length === 0 && product.image_url) images.push(product.image_url);
        
        return images;
    };

    const isVideo = (url: string) => url.includes('.mp4') || url.includes('.webm') || url.includes('video');

    const handleAddToCart = async () => {
        if (!product) return;
        try {
            if (!apiService.isAuthenticated()) {
                toast.error("Please sign in to add items");
                navigate("/auth");
                return;
            }
            setIsAddingToCart(true);
            await addToCart(product.id, quantity);
            toast.success("Added to cart!");
            navigate("/cart");
        } catch { toast.error("Failed to add to cart"); }
        finally { setIsAddingToCart(false); }
    };

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!product) return;
        if (!apiService.isAuthenticated()) { toast.error("Please sign in to review"); navigate("/auth"); return; }
        if (newReview.rating === 0) return toast.error("Please select a star rating");

        setIsSubmitting(true);
        try {
            await apiService.addProductReview(product.id, newReview.rating, newReview.comment);
            toast.success("Review posted!");
            
            // Reload reviews
            const reviewRes = await apiService.getProductReviews(product.id);
            // ✅ FIXED: Correctly handle array response here too
            const reviewsData = Array.isArray(reviewRes) ? reviewRes : (reviewRes.data || []);
            setReviews(reviewsData);
            
            setNewReview({ rating: 0, comment: '' });
            setIsReviewFormOpen(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to post review");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleExploreCategory = () => {
        if (!product) return;
        const route = CATEGORY_ROUTES[product.category] || `/shop?category=${product.category}`;
        navigate(route);
    };

    // --- FILTER & PAGINATION LOGIC ---
    const getFilteredReviews = () => {
        let sorted = [...reviews];
        switch (reviewFilter) {
            case "high": sorted.sort((a, b) => b.rating - a.rating); break;
            case "low": sorted.sort((a, b) => a.rating - b.rating); break;
            case "recent":
            default: sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        return sorted;
    };

    const filteredReviews = getFilteredReviews();
    const totalPages = Math.ceil(filteredReviews.length / REVIEWS_PER_PAGE);
    const currentReviews = filteredReviews.slice((reviewPage - 1) * REVIEWS_PER_PAGE, reviewPage * REVIEWS_PER_PAGE);

    if (loading) return <div className="min-h-screen pt-32 flex justify-center"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;
    if (!product) return null;

    const productImages = getProductImages();
    const inStock = product.stock > 0;
    const averageRating = product.average_rating ? Number(product.average_rating) : 0;

    return (
        <div className="min-h-screen bg-background pt-24 pb-16 font-sans">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">

                {/* 1. BREADCRUMBS */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
                    <Link to="/" className="hover:text-primary transition-colors">Home</Link>
                    <ChevronRight size={14} />
                    <Link to="/shop" className="hover:text-primary transition-colors">Shop</Link>
                    <ChevronRight size={14} />
                    <span className="font-medium text-foreground truncate">{product.name}</span>
                </div>

                {/* 2. MAIN PRODUCT GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 mb-24">

                    {/* LEFT: GALLERY */}
                    <div className="space-y-6 top-24 h-fit">
                        <div className="w-[85%] mx-auto aspect-[4/5] bg-white rounded-2xl shadow-sm border border-border/50 relative z-10 flex items-center justify-center overflow-hidden">
                            {activeImage && isVideo(activeImage) ? (
                                <video
                                    src={activeImage}
                                    controls
                                    autoPlay
                                    muted
                                    loop
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <ImageMagnifier src={activeImage || productImages[0]} />
                            )}
                        </div>

                        {/* Thumbnails */}
                        {productImages.length > 1 && (
                            <div className="flex gap-3 justify-center flex-wrap">
                                {productImages.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setActiveImage(img)}
                                        className={`w-16 h-16 rounded-lg border-2 overflow-hidden relative bg-white
                            ${activeImage === img ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'}`}
                                    >
                                        {isVideo(img) ? (
                                            <div className="w-full h-full flex items-center justify-center bg-black/10">
                                                <Play size={20} className="text-gray-800" />
                                            </div>
                                        ) : (
                                            <img src={img} className="w-full h-full object-contain" alt="Thumbnail" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* RIGHT: INFO */}
                    <div className="flex flex-col pt-4">
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                {(product.category || 'Uncategorized').replace(/_/g, ' ')}
                            </span>
                            {product.sub_category && (
                                <span className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                                    {product.sub_category}
                                </span>
                            )}
                        </div>

                        <h1 className="text-4xl font-extrabold text-foreground mb-4 leading-tight">{product.name}</h1>

                        {/* Rating Row */}
                        <div className="flex items-center gap-4 mb-8 pb-8 border-b">
                            <div className="flex items-center gap-2">
                                <StarRating rating={averageRating} size={20} />
                                <span className="text-base font-bold text-foreground">{averageRating.toFixed(1)}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">{reviews.length} Reviews</span>
                            {product.likes_count ? (
                                <>
                                    <div className="h-4 w-px bg-border"></div>
                                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Heart className="w-4 h-4 fill-red-500 text-red-500"/> {product.likes_count} Likes
                                    </span>
                                </>
                            ) : null}
                        </div>

                        {/* Price & Stock */}
                        <div className="mb-8">
                            <p className="text-5xl font-bold text-foreground">{formatINR(product.price)}</p>
                            <p className={`mt-3 text-sm font-medium flex items-center gap-2 ${inStock ? 'text-green-600' : 'text-red-600'}`}>
                                {inStock ? <Check className="w-4 h-4"/> : null}
                                {inStock ? `${product.stock} In Stock & Ready to Ship` : 'Out of Stock'}
                            </p>
                        </div>

                        {/* SPECIFICATIONS */}
                        {product.specifications && Object.keys(product.specifications).length > 0 && (
                            <div className="mb-8">
                                <h3 className="font-semibold mb-3">Key Specs</h3>
                                <div className="rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <tbody>
                                        {Object.entries(product.specifications).map(([key, value], index) => (
                                            <tr key={key} className="border-b last:border-0 border-border/50">
                                                <td className="p-3 font-medium text-muted-foreground w-1/3">{key}</td>
                                                <td className="p-3 font-medium text-foreground">{value}</td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Cart Actions */}
                        <div className="flex flex-col sm:flex-row gap-4 mb-8 mt-auto">
                            <div className="flex items-center border rounded-lg h-12 w-32 bg-background shadow-sm">
                                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-3 h-full hover:bg-accent rounded-l-lg"><Minus size={16}/></button>
                                <span className="flex-1 text-center font-bold">{quantity}</span>
                                <button onClick={() => setQuantity(q => Math.min(product.stock, q + 1))} className="px-3 h-full hover:bg-accent rounded-r-lg"><Plus size={16}/></button>
                            </div>
                            <Button onClick={handleAddToCart} disabled={!inStock || isAddingToCart} className="flex-1 h-12 text-lg shadow-lg hover:-translate-y-0.5 transition-transform">
                                {isAddingToCart ? <Loader2 className="animate-spin mr-2"/> : <ShoppingCart className="mr-2"/>}
                                {isAddingToCart ? 'Adding...' : 'Add to Cart'}
                            </Button>
                            <Button variant="outline" className="h-12 w-12 p-0"><Share2 className="w-5 h-5"/></Button>
                        </div>

                        {/* Badges */}
                        <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground p-4 bg-secondary/10 rounded-xl border border-border/50">
                            <div className="flex items-center gap-2"><Truck className="w-5 h-5 text-primary"/> Free Shipping</div>
                            <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary"/> 1 Year Warranty</div>
                            <div className="flex items-center gap-2"><Headset className="w-5 h-5 text-primary"/> 24/7 Support</div>
                            <div className="flex items-center gap-2"><MapPin className="w-5 h-5 text-primary"/> Live Tracking</div>
                        </div>
                    </div>
                </div>

                {/* 3. SPLIT SECTION: REVIEWS (Left) & DESCRIPTION (Right) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 mb-24 items-start">

                    {/* LEFT COLUMN: REVIEWS */}
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold font-display">Customer Reviews</h2>
                            <Select value={reviewFilter} onValueChange={setReviewFilter}>
                                <SelectTrigger className="w-[140px] h-9">
                                    <SelectValue placeholder="Sort" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="recent">Newest</SelectItem>
                                    <SelectItem value="high">Highest Rated</SelectItem>
                                    <SelectItem value="low">Lowest Rated</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="mb-8">
                            {!isReviewFormOpen ? (
                                <button onClick={() => setIsReviewFormOpen(true)} className="flex items-center gap-2 text-primary font-medium hover:underline group">
                                    <PenLine size={18} /> Write a product review
                                </button>
                            ) : (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="bg-card border rounded-xl p-6 shadow-sm">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold">Write a Review</h3>
                                        <button onClick={() => setIsReviewFormOpen(false)} className="text-muted-foreground hover:text-foreground text-sm">Cancel</button>
                                    </div>
                                    <form onSubmit={handleSubmitReview} className="space-y-4">
                                        <div><label className="block text-sm font-medium mb-1">Rating</label><StarRating rating={newReview.rating} interactive onRate={r => setNewReview({...newReview, rating: r})} size={24} /></div>
                                        <div><label className="block text-sm font-medium mb-1">Comment</label><textarea className="w-full p-3 rounded-md border bg-background focus:ring-1 focus:ring-primary outline-none min-h-[100px]" placeholder="What did you like or dislike?" value={newReview.comment} onChange={e => setNewReview({...newReview, comment: e.target.value})} required /></div>
                                        <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Submitting...' : 'Submit Review'}</Button>
                                    </form>
                                </motion.div>
                            )}
                        </div>

                        <div className="space-y-6">
                            {currentReviews.length === 0 ? (
                                <div className="text-center py-10 bg-muted/20 rounded-xl border border-dashed"><p className="text-muted-foreground">No reviews yet. Be the first!</p></div>
                            ) : (
                                currentReviews.map(r => (
                                    <div key={r.id} className="border-b pb-6 last:border-0 last:pb-0">
                                        <div className="flex justify-between items-start mb-2">
                                            {/* ✅ Shows User Name correctly */}
                                            <div><span className="font-bold text-sm block">{r.user}</span><span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span></div>
                                            <StarRating rating={r.rating} size={14} />
                                        </div>
                                        <p className="text-muted-foreground text-sm leading-relaxed">{r.comment}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex justify-center gap-2 mt-8">
                                <Button variant="outline" size="sm" onClick={() => setReviewPage(p => Math.max(1, p - 1))} disabled={reviewPage === 1}>Previous</Button>
                                <span className="text-sm flex items-center px-2">Page {reviewPage} of {totalPages}</span>
                                <Button variant="outline" size="sm" onClick={() => setReviewPage(p => Math.min(totalPages, p + 1))} disabled={reviewPage === totalPages}>Next</Button>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: DESCRIPTION */}
                    <div className="h-fit">
                        <h2 className="text-2xl font-bold font-display mb-6">Product Description</h2>
                        <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed">
                            <ul className="space-y-3 list-none pl-0 ">
                                {product.description.split('\n').filter(line => line.trim() !== '').map((line, i) => (
                                    <li key={i} className="flex gap-3 items-start">
                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0 block" />
                                        <span>{line}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* 4. RELATED PRODUCTS */}
                {relatedProducts.length > 0 && (
                    <div className="border-t pt-16">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-3xl font-display font-bold">Related Products</h2>
                            <Button variant="ghost" className="text-primary hover:text-primary/80" onClick={handleExploreCategory}>
                                Explore Category <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </div>

                        <div className="flex overflow-x-auto gap-6 pb-8 snap-x snap-mandatory scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                            {relatedProducts.map((related) => {
                                const rating = related.average_rating ? Number(related.average_rating) : 0;
                                return (
                                    <motion.div
                                        key={related.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        className="min-w-[280px] w-[280px] snap-start"
                                    >
                                        <Card
                                            onClick={() => navigate(`/product/${related.id}`)}
                                            className="cursor-pointer hover:shadow-xl transition-all h-full flex flex-col group border-border/60 overflow-hidden rounded-xl"
                                        >
                                            {/* 🔥 Square Image Container (Letterboxed) */}
                                            <div className="aspect-square bg-black flex items-center justify-center relative overflow-hidden">
                                                <img
                                                    src={related.image_url || '/placeholder.svg'}
                                                    alt={related.name}
                                                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                                                />
                                            </div>

                                            <CardContent className="p-4 flex-1 flex flex-col">
                                                <div className="flex justify-between items-start mb-2 gap-2">
                                                    <h3 className="font-bold text-sm line-clamp-1 flex-1 leading-snug" title={related.name}>{related.name}</h3>
                                                    {rating > 0 && (
                                                        <div className="flex items-center gap-1 bg-yellow-50 px-1.5 py-0.5 rounded text-[10px] font-bold text-yellow-700 shrink-0">
                                                            <Star size={10} className="fill-current" /> {rating.toFixed(1)}
                                                        </div>
                                                    )}
                                                </div>

                                                <p className="text-xs text-muted-foreground mb-4 line-clamp-2 min-h-[2.5em]">
                                                    {related.short_description || related.description}
                                                </p>

                                                <div className="mt-auto flex items-center justify-between">
                                                    <span className="font-bold text-lg text-primary">{formatINR(related.price)}</span>
                                                    <Button size="icon" variant="secondary" className="h-8 w-8 rounded-full shadow-sm">
                                                        <ShoppingCart size={14} />
                                                    </Button>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductDetail;
