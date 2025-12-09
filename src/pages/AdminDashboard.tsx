import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    Loader2,
    Package,
    ShoppingCart,
    DollarSign,
    TrendingUp,
    Plus,
    AlertTriangle,
    Edit3,
    Save,
    X,
    ChevronRight,
    Upload,
} from 'lucide-react';
import { formatINR } from '@/lib/currency';
import { apiService } from '@/services/api.service';
import ProductPreviewCarousel from '@/components/ProductPreviewCarousel';


interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    stock: number;
    image_url: string | null;
    category: string;
    totalSales?: number;
    product_images?: Array<{
        id: string;
        image_url?: string;
        image_data?: string;
        display_order: number;
    }>;
}

interface OrderItem {
    product_id: string | null;
    quantity: number;
    linetotal: number;
    product?: {
        id: string;
        name: string;
        price: number;
        image_url?: string | null;
    };
}

interface Order {
    id: string;
    total_amount: number;
    status: string;
    created_at: string;
    totalquantity: number;
    userid: string;
    items: OrderItem[];
}

const STATUSOPTIONS = [
    { value: 'pendingpayment', label: 'Pending Payment' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' },
];

const STATUSCOLORS: Record<string, string> = {
    pendingpayment: 'bg-yellow-500',
    processing: 'bg-blue-500',
    shipped: 'bg-purple-500',
    delivered: 'bg-green-500',
    cancelled: 'bg-red-500',
};

const STATUSLABELS: Record<string, string> = {
    pendingpayment: 'Pending Payment',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
};

// Form state types
interface NewProductFormState {
    name: string;
    description: string;
    price: string;
    stock: string;
    category: string;
    imageFiles: File[];
}

interface EditProductFormState {
    name: string;
    description: string;
    price: string;
    stock: string;
    category: string;
    imageFiles: File[];
}

// ✅ NEW STATE - Track which images to DELETE
interface EditingProductImageState {
    id: string;
    url: string;
    isNew: boolean; // true = uploaded this session, false = from database
}



export default function AdminDashboard() {
    const navigate = useNavigate();

    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [products, setProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [showAddProduct, setShowAddProduct] = useState(false);
    const [editingProductImages, setEditingProductImages] = useState<EditingProductImageState[]>([]);

    // New product form state
    const [newProduct, setNewProduct] = useState<NewProductFormState>({
        name: '',
        description: '',
        price: '',
        stock: '',
        category: '3d_printer',
        imageFiles: [],
    });
    const [newProductImagePreviews, setNewProductImagePreviews] = useState<string[]>([]);

    // Edit product form state
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [editingProductData, setEditingProductData] = useState<EditProductFormState>({
        name: '',
        description: '',
        price: '',
        stock: '',
        category: '3d_printer',
        imageFiles: [],
    });
    const [editingProductImagePreviews, setEditingProductImagePreviews] = useState<string[]>([]);

    // Order states
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
    const [updatingOrder, setUpdatingOrder] = useState(false);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    // Check admin access and load data
    useEffect(() => {
        checkAdminAccess();
    }, []);

    // Cleanup object URLs
    useEffect(() => {
        return () => {
            newProductImagePreviews.forEach(url => URL.revokeObjectURL(url));
            editingProductImagePreviews.forEach(url => URL.revokeObjectURL(url));
        };
    }, []);

    const checkAdminAccess = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                toast.error('Please sign in as admin.');
                navigate('/auth');
                return;
            }

            const res = await apiService.getCurrentUser();
            const role = res.role || res.user?.role;

            if (role !== 'admin') {
                toast.error('Access denied. Admin privileges required.');
                navigate('/');
                return;
            }

            setIsAdmin(true);
            await fetchDashboardData();
        } catch (error: any) {
            console.error('Admin access check failed:', error);
            toast.error('Session expired. Please sign in again.');
            navigate('/auth');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDashboardData = async () => {
        try {
            const productsRes = await apiService.getProducts();
            const rawProducts: any = productsRes.data ?? productsRes;

            const ordersRes = await apiService.getAdminOrders();
            const rawOrders: any = ordersRes.data ?? ordersRes;

            const productsWithSales: Product[] = rawProducts.map(
                (p: any) => ({
                    ...p,
                    totalSales: (p.totalSales as number) ?? 0,
                })
            );

            setProducts(productsWithSales);
            setOrders(rawOrders as Order[]);
        } catch (error: any) {
            console.error('Dashboard fetch error:', error);
            toast.error('Failed to load dashboard data');
        }
    };

    // ============ ADD PRODUCT HANDLERS ============

    const handleNewProductImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const totalImages = newProduct.imageFiles.length + files.length;

        if (totalImages > 7) {
            toast.error(`Maximum 7 images allowed. Current: ${newProduct.imageFiles.length}`);
            return;
        }

        // Create previews
        const previews: string[] = [];
        files.forEach(file => {
            const url = URL.createObjectURL(file);
            previews.push(url);
        });

        setNewProductImagePreviews(prev => [...prev, ...previews]);
        setNewProduct(prev => ({
            ...prev,
            imageFiles: [...prev.imageFiles, ...files],
        }));
    };

    const removeNewProductImage = (index: number) => {
        const url = newProductImagePreviews[index];
        if (url) URL.revokeObjectURL(url);

        setNewProductImagePreviews(prev => prev.filter((_, i) => i !== index));
        setNewProduct(prev => ({
            ...prev,
            imageFiles: prev.imageFiles.filter((_, i) => i !== index),
        }));
    };

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const price = parseFloat(newProduct.price);
            const stock = parseInt(newProduct.stock || '0', 10);

            if (Number.isNaN(price) || Number.isNaN(stock)) {
                toast.error('Price and stock must be valid numbers.');
                return;
            }

            // Create FormData
            const formData = new FormData();
            formData.append('name', newProduct.name);
            formData.append('description', newProduct.description || '');
            formData.append('price', String(price));
            formData.append('stock', String(stock));
            formData.append('category', newProduct.category);

            // Append ALL images with the key "images"
            newProduct.imageFiles.forEach(file => {
                formData.append('images', file);
            });

            await apiService.createProduct(formData);
            toast.success('Product added successfully!');

            setShowAddProduct(false);
            setNewProduct({
                name: '',
                description: '',
                price: '',
                stock: '',
                category: '3d_printer',
                imageFiles: [],
            });
            setNewProductImagePreviews([]);
            await fetchDashboardData();
        } catch (error: any) {
            console.error('Add product error:', error);
            toast.error(error.message || 'Failed to add product');
        }
    };

    // ============ EDIT PRODUCT HANDLERS (FIXED) ============

    const startEditProduct = (product: Product) => {
        setEditingProductId(product.id);
        setEditingProductData({
            name: product.name,
            description: product.description || '',
            price: product.price.toString(),
            stock: product.stock.toString(),
            category: product.category,
            imageFiles: [],
        });

        // ✅ NEW: Store images WITH IDs for deletion tracking
        const existingImages = (product.product_images || [])
            .sort((a, b) => a.display_order - b.display_order)
            .map(img => ({
                id: img.id,
                url: img.image_url || img.image_data || '',
                isNew: false,
            }))
            .filter(img => img.url);

        setEditingProductImages(existingImages);
    };


    const cancelEditProduct = () => {
        // ✅ Clean up blob URLs
        editingProductImages.forEach(img => {
            if (img.url.startsWith('blob:')) URL.revokeObjectURL(img.url);
        });

        setEditingProductId(null);
        setEditingProductData({
            name: '',
            description: '',
            price: '',
            stock: '',
            category: '3d_printer',
            imageFiles: [],
        });
        setEditingProductImages([]);
    };


    const handleEditProductImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const totalImages = editingProductImages.length + files.length;

        if (totalImages > 7) {
            toast.error(`Maximum 7 images. Current: ${editingProductImages.length}`);
            return;
        }

        // Create previews for NEW files
        const newImages: EditingProductImageState[] = files.map(file => ({
            id: `new-${Date.now()}-${Math.random()}`, // Temp ID
            url: URL.createObjectURL(file),
            isNew: true,
        }));

        setEditingProductImages(prev => [...prev, ...newImages]);
        setEditingProductData(prev => ({
            ...prev,
            imageFiles: [...prev.imageFiles, ...files],
        }));
    };


    const removeEditProductImage = (index: number) => {
        const image = editingProductImages[index];

        // ✅ Only revoke blob URLs
        if (image.url.startsWith('blob:')) {
            URL.revokeObjectURL(image.url);
        }

        // ✅ Remove from state
        setEditingProductImages(prev => prev.filter((_, i) => i !== index));

        // ✅ If it's a NEW file, also remove from imageFiles
        if (image.isNew) {
            // Find and remove corresponding file
            const newFileIndex = editingProductImages
                .slice(0, index)
                .filter(img => img.isNew).length;

            setEditingProductData(prev => ({
                ...prev,
                imageFiles: prev.imageFiles.filter((_, i) => i !== newFileIndex),
            }));
        }
    };

    const saveEditedProduct = async () => {
        try {
            if (!editingProductId) return;

            const price = parseFloat(editingProductData.price);
            const stock = parseInt(editingProductData.stock || '0', 10);

            if (Number.isNaN(price) || Number.isNaN(stock)) {
                toast.error('Price and stock must be valid numbers.');
                return;
            }

            const formData = new FormData();
            formData.append('name', editingProductData.name);
            formData.append('description', editingProductData.description || '');
            formData.append('price', String(price));
            formData.append('stock', String(stock));
            formData.append('category', editingProductData.category);

            // ✅ NEW: Send image IDs to DELETE
            const imagesToDelete = products
                .find(p => p.id === editingProductId)
                ?.product_images?.filter(
                    img => !editingProductImages.some(ei => ei.id === img.id)
                )
                .map(img => img.id) || [];

            if (imagesToDelete.length > 0) {
                formData.append('imagesToDelete', JSON.stringify(imagesToDelete));
            }

            // Append ONLY NEW files
            editingProductData.imageFiles.forEach(file => {
                formData.append('images', file);
            });

            await apiService.updateProduct(editingProductId, formData);
            toast.success('Product updated successfully!');

            cancelEditProduct();
            await fetchDashboardData();
        } catch (error: any) {
            console.error('Update product error:', error);
            toast.error(error.message || 'Failed to update product');
        }
    };


    // ============ ORDER HANDLERS ============

    const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
        try {
            setUpdatingOrder(true);
            await apiService.updateOrderStatus(orderId, newStatus);

            setOrders(prev =>
                prev.map(order =>
                    order.id === orderId ? { ...order, status: newStatus } : order
                )
            );

            const label = STATUSOPTIONS.find(s => s.value === newStatus)?.label;
            toast.success(`Order status updated to ${label || newStatus}`);
        } catch (error: any) {
            console.error('Update order status error:', error);
            toast.error(error.message || 'Failed to update order status');
        } finally {
            setUpdatingOrder(false);
            setEditingOrderId(null);
        }
    };

    // ============ CALCULATIONS ============

    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
    const totalOrders = orders.length;
    const totalProducts = products.length;
    const lowStockProducts = products.filter(p => p.stock > 0 && p.stock < 5);
    const outOfStockProducts = products.filter(p => p.stock === 0);
    const bestSellingProduct =
        products.length > 0
            ? products.reduce((prev, current) =>
                (current.totalSales ?? 0) > (prev.totalSales ?? 0) ? current : prev
            )
            : undefined;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center pt-20">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!isAdmin) {
        return null;
    }

    return (
        <div className="min-h-screen pt-20 pb-10">
            <div className="container mx-auto px-4">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="font-display text-4xl mb-2">Admin Dashboard</h1>
                    <p className="text-muted-foreground">Monitor sales and manage products</p>
                </div>

                {/* Inventory Alerts */}
                {lowStockProducts.length > 0 || outOfStockProducts.length > 0 ? (
                    <div className="mb-6">
                        <Card className="border-orange-500">
                            <CardHeader>
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                                    <CardTitle className="text-orange-500">Inventory Alerts</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {outOfStockProducts.length > 0 && (
                                        <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                                            <p className="font-semibold text-red-700 dark:text-red-400">
                                                Out of Stock ({outOfStockProducts.length})
                                            </p>
                                            <div className="mt-2 space-y-1">
                                                {outOfStockProducts.map(p => (
                                                    <p key={p.id} className="text-sm text-red-600 dark:text-red-400">
                                                        {p.name}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {lowStockProducts.length > 0 && (
                                        <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                                            <p className="font-semibold text-orange-700 dark:text-orange-400">
                                                Low Stock ({lowStockProducts.length})
                                            </p>
                                            <div className="mt-2 space-y-1">
                                                {lowStockProducts.map(p => (
                                                    <p key={p.id} className="text-sm text-orange-600 dark:text-orange-400">
                                                        {p.name} - {p.stock} units left
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                ) : null}

                {/* Stats Cards */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalRevenue.toFixed(2)}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalOrders}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Products</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{totalProducts}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatINR(avgOrderValue)}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* KPI Cards */}
                <div className="grid md:grid-cols-3 gap-4 mb-8">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Best Selling Product</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-1">
                                <p className="font-semibold text-lg">{bestSellingProduct?.name || "N/A"}</p>
                                <p className="text-sm text-muted-foreground">{(bestSellingProduct?.totalSales || 0) + " "}units sold</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Stock Status</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-sm">In Stock</span>
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">{products.filter((p) => p.stock > 5).length}</Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm">Low Stock</span>
                                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">{lowStockProducts.length}</Badge>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm">Out of Stock</span>
                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{outOfStockProducts.length}</Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Restock Recommendations</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {lowStockProducts.length > 0 || outOfStockProducts.length > 0 ? (
                                <div className="space-y-1">
                                    <p className="text-sm text-orange-600 dark:text-orange-400">⚠️ {lowStockProducts.length + outOfStockProducts.length} product(s) need attention</p>
                                    <p className="text-xs text-muted-foreground">Prioritize restocking high-demand items</p>
                                </div>
                            ) : (
                                <p className="text-sm text-green-600">✓ All products well stocked</p>
                            )}
                        </CardContent>
                    </Card>
                </div>


                {/* Products Section */}
                <Card className="mb-8">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Products ({totalProducts})</CardTitle>
                                <CardDescription>Manage your 3D printer inventory</CardDescription>
                            </div>
                            <Button
                                onClick={() => setShowAddProduct(!showAddProduct)}
                                size="sm"
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Product
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent>
                        {/* ADD PRODUCT FORM */}
                        {showAddProduct && (
                            <form onSubmit={handleAddProduct} className="mb-6 p-4 border rounded-lg space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="name">Product Name</Label>
                                        <Input
                                            id="name"
                                            value={newProduct.name}
                                            onChange={e =>
                                                setNewProduct(prev => ({ ...prev, name: e.target.value }))
                                            }
                                            required
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="price">Price</Label>
                                        <Input
                                            id="price"
                                            type="number"
                                            step="0.01"
                                            value={newProduct.price}
                                            onChange={e =>
                                                setNewProduct(prev => ({ ...prev, price: e.target.value }))
                                            }
                                            required
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="stock">Stock</Label>
                                        <Input
                                            id="stock"
                                            type="number"
                                            value={newProduct.stock}
                                            onChange={e =>
                                                setNewProduct(prev => ({ ...prev, stock: e.target.value }))
                                            }
                                            required
                                        />
                                    </div>

                                    <div>
                                        <Label htmlFor="category">Category</Label>
                                        <Select
                                            value={newProduct.category}
                                            onValueChange={value =>
                                                setNewProduct(prev => ({ ...prev, category: value }))
                                            }
                                        >
                                            <SelectTrigger id="category">
                                                <SelectValue placeholder="Select category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="3d_printer">3D Printer</SelectItem>
                                                <SelectItem value="3d_model">3D Model</SelectItem>
                                                <SelectItem value="accessory">Accessory</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea
                                        id="description"
                                        value={newProduct.description}
                                        onChange={e =>
                                            setNewProduct(prev => ({ ...prev, description: e.target.value }))
                                        }
                                    />
                                </div>

                                {/* MULTI-IMAGE UPLOAD */}
                                <div>
                                    <Label htmlFor="images">
                                        Product Images (Max 7) - {newProduct.imageFiles.length}/7 selected
                                    </Label>
                                    <div className="mt-2 border-2 border-dashed border-muted rounded-lg p-8 text-center hover:border-primary transition-colors">
                                        <input
                                            id="images"
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            onChange={handleNewProductImagesUpload}
                                            disabled={newProduct.imageFiles.length >= 7}
                                            className="hidden"
                                        />
                                        <label htmlFor="images" className="cursor-pointer block">
                                            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                                            <p className="font-medium mb-1">Click to upload images</p>
                                            <p className="text-sm text-muted-foreground">
                                                {newProduct.imageFiles.length}/7 images
                                            </p>
                                        </label>
                                    </div>

                                    {/* IMAGE PREVIEWS */}
                                    {newProductImagePreviews.length > 0 && (
                                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {newProductImagePreviews.map((url, index) => (
                                                <div key={index} className="relative group">
                                                    <img
                                                        src={url}
                                                        alt={`Preview ${index + 1}`}
                                                        className="w-full h-24 object-cover rounded-lg border"
                                                    />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition">
                                                        <Button
                                                            type="button"
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => removeNewProductImage(index)}
                                                        >
                                                            Remove
                                                        </Button>
                                                    </div>
                                                    <Badge className="absolute top-1 left-1 bg-primary">
                                                        #{index + 1}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <Button type="submit" className="flex-1">
                                        Create Product
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowAddProduct(false)}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        )}

                        {/* PRODUCTS LIST */}
                        <div className="space-y-4">
                            {products.map(product => (
                                <div
                                    key={product.id}
                                    className="p-4 border rounded-lg"
                                >
                                    {editingProductId === product.id ? (
                                        // EDIT MODE
                                        <div className="space-y-4">
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div>
                                                    <Label>Name</Label>
                                                    <Input
                                                        value={editingProductData.name}
                                                        onChange={e =>
                                                            setEditingProductData(prev => ({
                                                                ...prev,
                                                                name: e.target.value,
                                                            }))
                                                        }
                                                    />
                                                </div>

                                                <div>
                                                    <Label>Price</Label>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={editingProductData.price}
                                                        onChange={e =>
                                                            setEditingProductData(prev => ({
                                                                ...prev,
                                                                price: e.target.value,
                                                            }))
                                                        }
                                                    />
                                                </div>

                                                <div>
                                                    <Label>Stock</Label>
                                                    <Input
                                                        type="number"
                                                        value={editingProductData.stock}
                                                        onChange={e =>
                                                            setEditingProductData(prev => ({
                                                                ...prev,
                                                                stock: e.target.value,
                                                            }))
                                                        }
                                                    />
                                                </div>

                                                <div>
                                                    <Label>Category</Label>
                                                    <Select
                                                        value={editingProductData.category}
                                                        onValueChange={value =>
                                                            setEditingProductData(prev => ({
                                                                ...prev,
                                                                category: value,
                                                            }))
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="3d_printer">3D Printer</SelectItem>
                                                            <SelectItem value="3d_model">3D Model</SelectItem>
                                                            <SelectItem value="accessory">Accessory</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div>
                                                <Label>Description</Label>
                                                <Textarea
                                                    value={editingProductData.description}
                                                    onChange={e =>
                                                        setEditingProductData(prev => ({
                                                            ...prev,
                                                            description: e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>

                                            {/* EDIT IMAGES */}
                                            <div>
                                                <Label>
                                                    Product Images ({editingProductImagePreviews.length}/7)
                                                </Label>
                                                <div className="mt-2 border-2 border-dashed border-muted rounded-lg p-8 text-center">
                                                    <input
                                                        type="file"
                                                        multiple
                                                        accept="image/*"
                                                        onChange={handleEditProductImagesUpload}
                                                        disabled={
                                                            editingProductData.imageFiles.length +
                                                            editingProductImagePreviews.length >=
                                                            7
                                                        }
                                                        className="hidden"
                                                        id={`edit-images-${product.id}`}
                                                    />
                                                    <label htmlFor={`edit-images-${product.id}`} className="cursor-pointer block">
                                                        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                                                        <p className="text-sm">Click to add more images</p>
                                                    </label>
                                                </div>

                                                {editingProductImages.length > 0 && (
                                                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                        {editingProductImages.map((image, index) => (
                                                            <div key={image.id} className="relative group">
                                                                <img
                                                                    src={image.url}
                                                                    alt={`Preview ${index + 1}`}
                                                                    className="w-full h-24 object-cover rounded-lg border"
                                                                />
                                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition">
                                                                    <Button
                                                                        type="button"
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        onClick={() => removeEditProductImage(index)}
                                                                    >
                                                                        Remove
                                                                    </Button>
                                                                </div>
                                                                <Badge className={`absolute top-1 left-1 ${image.isNew ? 'bg-green-500' : 'bg-primary'}`}>
                                                                    #{index + 1}
                                                                </Badge>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                            </div>

                                            <div className="flex gap-2">
                                                <Button onClick={saveEditedProduct}>
                                                    <Save className="w-4 h-4 mr-2" />
                                                    Save Changes
                                                </Button>
                                                <Button variant="outline" onClick={cancelEditProduct}>
                                                    <X className="w-4 h-4 mr-2" />
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        // VIEW MODE
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold">{product.name}</h3>
                                                    <Badge variant="outline" className="text-xs">
                                                        {product.category.replace(/_/g, ' ')}
                                                    </Badge>
                                                    {product.stock === 0 && (
                                                        <Badge variant="destructive" className="text-xs">
                                                            Out of Stock
                                                        </Badge>
                                                    )}
                                                    {product.stock > 0 && product.stock < 5 && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs bg-orange-50 text-orange-700 border-orange-200"
                                                        >
                                                            Low Stock
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">{product.description}</p>
                                                {product.totalSales !== undefined && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Total Sales: {product.totalSales} units
                                                    </p>
                                                )}
                                            </div>

                                            <div className="text-right ml-4">
                                                <p className="font-bold">{formatINR(product.price)}</p>
                                                <p
                                                    className={`text-sm mb-2 ${
                                                        product.stock === 0
                                                            ? 'text-red-600'
                                                            : product.stock < 5
                                                                ? 'text-orange-600'
                                                                : 'text-muted-foreground'
                                                    }`}
                                                >
                                                    Stock: {product.stock}
                                                </p>
                                                {/* ✅ CAROUSEL INSTEAD OF SINGLE IMAGE */}
                                                <ProductPreviewCarousel
                                                    images={product.product_images || []}
                                                    productName={product.name}
                                                    thumbnail={product.image_url || undefined}
                                                />
                                            </div>

                                            <div className="flex gap-2 ml-8">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => startEditProduct(product)}
                                                >
                                                    <Edit3 className="w-4 h-4 mr-1" />
                                                    Edit
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Orders */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Orders</CardTitle>
                        <CardDescription>Latest orders with status tracking</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {orders.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No orders yet</p>
                        ) : (
                            <div className="space-y-4">
                                {orders.map(order => (
                                    <Card key={order.id} className="p-6">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-4 mb-3">
                                                    <h3 className="text-lg font-semibold">
                                                        Order {order.id.slice(0, 8)}
                                                    </h3>
                                                    <Badge
                                                        className={`${STATUSCOLORS[order.status] || 'bg-gray-500'} text-white`}
                                                    >
                                                        {STATUSLABELS[order.status] || order.status}
                                                    </Badge>
                                                </div>

                                                <div className="grid sm:grid-cols-5 gap-4 text-sm mb-4">
                                                    <div>
                                                        <p className="text-muted-foreground">Order ID</p>
                                                        <p className="font-medium">{order.id.slice(0, 8)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Date</p>
                                                        <p className="font-medium">
                                                            {new Date(order.created_at).toLocaleDateString('en-IN', {
                                                                year: 'numeric',
                                                                month: 'short',
                                                                day: 'numeric',
                                                            })}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Items</p>
                                                        <p className="font-medium">{order.totalquantity} items</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Total</p>
                                                        <p className="font-bold text-primary">
                                                            {formatINR(order.total_amount)}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Update Status</p>
                                                        <select
                                                            value={order.status}
                                                            onChange={e =>
                                                                handleUpdateOrderStatus(order.id, e.target.value)
                                                            }
                                                            disabled={updatingOrder}
                                                            className="border rounded px-2 py-1 text-sm bg-background text-foreground w-full disabled:opacity-50"
                                                        >
                                                            <option value="pending">Pending</option>
                                                            <option value="pendingpayment">Pending Payment</option>
                                                            <option value="processing">Processing</option>
                                                            <option value="shipped">Shipped</option>
                                                            <option value="delivered">Delivered</option>
                                                            <option value="cancelled">Cancelled</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    setExpandedOrderId(expandedOrderId === order.id ? null : order.id)
                                                }
                                                aria-label="Toggle order details"
                                            >
                                                <ChevronRight
                                                    className={`w-5 h-5 transition-transform ${
                                                        expandedOrderId === order.id ? 'rotate-90' : ''
                                                    }`}
                                                />
                                            </Button>
                                        </div>

                                        {expandedOrderId === order.id && (
                                            <div className="mt-4 border-t pt-4 space-y-3 text-sm">
                                                <h4 className="font-semibold mb-3">Order Items</h4>
                                                {order.items?.map((item, index) => {
                                                    const name = item.product?.name || 'Unknown product';
                                                    const price = item.product?.price ?? 0;
                                                    const lineTotal = item.linetotal ?? (price * item.quantity || 0);

                                                    return (
                                                        <div
                                                            key={item.product_id ?? index}
                                                            className="flex justify-between items-center p-3 bg-muted rounded"
                                                        >
                                                            <div className="flex-1">
                                                                <p className="font-medium">{name}</p>
                                                                <p className="text-muted-foreground text-xs">
                                                                    Product ID: {item.product_id}
                                                                </p>
                                                                <p className="text-muted-foreground text-xs">
                                                                    Qty: {item.quantity} x {formatINR(price)}
                                                                </p>
                                                            </div>
                                                            <p className="font-semibold">{formatINR(lineTotal)}</p>
                                                        </div>
                                                    );
                                                })}

                                                <div className="border-t pt-3 mt-3 flex justify-between font-bold">
                                                    <span>Total for this order</span>
                                                    <span className="text-primary">
                            {formatINR(order.total_amount)}
                          </span>
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}