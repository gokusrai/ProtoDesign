import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
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
} from "lucide-react";
import { formatINR } from "@/lib/currency";
import { apiService } from "@/services/api.service";

interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    stock: number;
    image_url: string | null;
    category: string;
    totalSales?: number;
}

interface OrderItem {
    product_id: string | null;
    quantity: number;
    line_total: number;
    product?: {
        id: string;
        name: string;
        price: number;
        image_url?: string | null;
    } | null;
}

interface Order {
    id: string;
    total_amount: number;
    status: string;
    created_at: string;
    total_quantity: number;
    user_id: string;
    items: OrderItem[];
}

const STATUS_OPTIONS = [
    { value: "pending_payment", label: "Pending Payment" },
    { value: "processing", label: "Processing" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
];

const STATUS_COLORS: Record<string, string> = {
    pending_payment: "bg-yellow-500",
    processing: "bg-blue-500",
    shipped: "bg-purple-500",
    delivered: "bg-green-500",
    cancelled: "bg-red-500",
};

const STATUS_LABELS: Record<string, string> = {
    pending_payment: "Pending Payment",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
};

// New form state types to include File
type NewProductFormState = {
    name: string;
    description: string;
    price: string;
    stock: string;
    category: string;
    imageFile: File | null;
};

type EditProductFormState = {
    name: string;
    description: string;
    price: string;
    stock: string;
    category: string;
    imageFile: File | null;
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [products, setProducts] = useState<Product[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [showAddProduct, setShowAddProduct] = useState(false);

    const [newProduct, setNewProduct] = useState<NewProductFormState>({
        name: "",
        description: "",
        price: "",
        stock: "",
        category: "3d_printer",
        imageFile: null,
    });

    const [newProductPreview, setNewProductPreview] = useState<string | null>(null);

    // Product editing states
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [editingProductData, setEditingProductData] = useState<EditProductFormState>({
        name: "",
        description: "",
        price: "",
        stock: "",
        category: "3d_printer",
        imageFile: null,
    });
    const [editingProductPreview, setEditingProductPreview] = useState<string | null>(null);

    // Order status editing state
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
    const [updatingOrder, setUpdatingOrder] = useState(false);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    useEffect(() => {
        checkAdminAccess();
    }, []);

    const checkAdminAccess = async () => {
        try {
            const token = localStorage.getItem("auth_token");
            if (!token) {
                toast.error("Please sign in as admin.");
                navigate("/auth");
                return;
            }

            const res = await apiService.getCurrentUser();
            const role = res.role || res.user?.role;

            if (role !== "admin") {
                toast.error("Access denied. Admin privileges required.");
                navigate("/");
                return;
            }

            setIsAdmin(true);
            await fetchDashboardData();
        } catch (error: any) {
            console.error("Admin access check failed:", error);
            toast.error("Session expired. Please sign in again.");
            navigate("/auth");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDashboardData = async () => {
        try {
            const productsRes = await apiService.getProducts();
            const rawProducts: any[] = productsRes.data ?? productsRes;

            const ordersRes = await apiService.getAdminOrders();
            const rawOrders: any[] = ordersRes.data ?? ordersRes;

            const productsWithSales: Product[] = rawProducts.map((p) => ({
                ...p,
                totalSales: (p.totalSales as number) || 0,
            }));

            setProducts(productsWithSales);
            setOrders(rawOrders as Order[]);
        } catch (error: any) {
            console.error("Dashboard fetch error:", error);
            toast.error("Failed to load dashboard data");
        }
    };

    // Clean up object URLs when file changes/unmount
    useEffect(() => {
        return () => {
            if (newProductPreview) URL.revokeObjectURL(newProductPreview);
            if (editingProductPreview) URL.revokeObjectURL(editingProductPreview);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const price = parseFloat(newProduct.price);
            const stock = parseInt(newProduct.stock || "0", 10);

            if (Number.isNaN(price) || Number.isNaN(stock)) {
                toast.error("Price and stock must be valid numbers.");
                return;
            }

            const formData = new FormData();
            formData.append("name", newProduct.name);
            formData.append("description", newProduct.description || "");
            formData.append("price", String(price));
            formData.append("stock", String(stock));
            formData.append("category", newProduct.category);

            if (newProduct.imageFile) {
                formData.append("image", newProduct.imageFile);
            }

            await apiService.createProduct(formData);

            toast.success("Product added successfully!");
            setShowAddProduct(false);
            setNewProduct({
                name: "",
                description: "",
                price: "",
                stock: "",
                category: "3d_printer",
                imageFile: null,
            });
            if (newProductPreview) {
                URL.revokeObjectURL(newProductPreview);
                setNewProductPreview(null);
            }
            await fetchDashboardData();
        } catch (error: any) {
            console.error("Add product error:", error);
            toast.error(error.message || "Failed to add product");
        }
    };

    // Edit product handlers
    const startEditProduct = (product: Product) => {
        setEditingProductId(product.id);
        setEditingProductData({
            name: product.name,
            description: product.description,
            price: product.price.toString(),
            stock: product.stock.toString(),
            category: product.category,
            imageFile: null, // user can upload a new one to replace existing
        });

        // show current product image as preview if available
        setEditingProductPreview(product.image_url || null);
    };

    const cancelEditProduct = () => {
        setEditingProductId(null);
        setEditingProductData({
            name: "",
            description: "",
            price: "",
            stock: "",
            category: "3d_printer",
            imageFile: null,
        });
        if (editingProductPreview) {
            URL.revokeObjectURL(editingProductPreview);
            setEditingProductPreview(null);
        }
    };

    const handleEditChange = (
        field: keyof EditProductFormState,
        value: string | File | null
    ) => {
        setEditingProductData((prev) => ({
            ...prev,
            [field]: value as any,
        }));

        if (field === "imageFile") {
            if (editingProductPreview) {
                URL.revokeObjectURL(editingProductPreview);
            }
            if (value && value instanceof File) {
                const url = URL.createObjectURL(value);
                setEditingProductPreview(url);
            } else {
                setEditingProductPreview(null);
            }
        }
    };

    const saveEditedProduct = async () => {
        try {
            if (!editingProductId) return;

            const price = parseFloat(editingProductData.price);
            const stock = parseInt(editingProductData.stock || "0", 10);

            if (Number.isNaN(price) || Number.isNaN(stock)) {
                toast.error("Price and stock must be valid numbers.");
                return;
            }

            const formData = new FormData();
            formData.append("name", editingProductData.name);
            formData.append("description", editingProductData.description || "");
            formData.append("price", String(price));
            formData.append("stock", String(stock));
            formData.append("category", editingProductData.category);

            if (editingProductData.imageFile) {
                formData.append("image", editingProductData.imageFile);
            }

            await apiService.updateProduct(editingProductId, formData);

            toast.success("Product updated successfully!");
            cancelEditProduct();
            await fetchDashboardData();
        } catch (error: any) {
            console.error("Update product error:", error);
            toast.error(error.message || "Failed to update product");
        }
    };

    // Update order status function
    const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
        try {
            setUpdatingOrder(true);
            await apiService.updateOrderStatus(orderId, newStatus);

            setOrders((prev) =>
                prev.map((order) =>
                    order.id === orderId ? { ...order, status: newStatus } : order
                )
            );

            toast.success(
                `Order status updated to ${STATUS_OPTIONS.find((s) => s.value === newStatus)
                    ?.label}`
            );
        } catch (error: any) {
            console.error("Update order status error:", error);
            toast.error(error.message || "Failed to update order status");
        } finally {
            setUpdatingOrder(false);
            setEditingOrderId(null);
        }
    };

    const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_amount), 0);
    const totalOrders = orders.length;
    const totalProducts = products.length;
    const lowStockProducts = products.filter((p) => p.stock < 5 && p.stock > 0);
    const outOfStockProducts = products.filter((p) => p.stock === 0);
    const bestSellingProduct =
        products.length > 0
            ? products.reduce((prev, current) =>
                    (current.totalSales || 0) > (prev.totalSales || 0) ? current : prev,
                products[0]
            )
            : undefined;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    if (!isAdmin) return null;

    return (
        <div className="min-h-screen pt-20 pb-10">
            <div className="container mx-auto px-4">
                <div className="mb-8">
                    <h1 className="font-display text-4xl mb-2">Admin Dashboard</h1>
                    <p className="text-muted-foreground">Monitor sales and manage products</p>
                </div>

                {/* Inventory Alerts */}
                {(lowStockProducts.length > 0 || outOfStockProducts.length > 0) && (
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
                                            <p className="font-semibold text-red-700 dark:text-red-400">Out of Stock ({outOfStockProducts.length})</p>
                                            <div className="mt-2 space-y-1">
                                                {outOfStockProducts.map((p) => (
                                                    <p key={p.id} className="text-sm text-red-600 dark:text-red-400">• {p.name}</p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {lowStockProducts.length > 0 && (
                                        <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                                            <p className="font-semibold text-orange-700 dark:text-orange-400">Low Stock ({lowStockProducts.length})</p>
                                            <div className="mt-2 space-y-1">
                                                {lowStockProducts.map((p) => (
                                                    <p key={p.id} className="text-sm text-orange-600 dark:text-orange-400">• {p.name} - {p.stock} units left</p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">₹{totalRevenue.toFixed(2)}</div>
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

                {/* Recent Orders Section */}
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Recent Orders</CardTitle>
                        <CardDescription>Latest orders with status tracking</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {orders.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">No orders yet</p>
                        ) : (
                            <div className="space-y-4">
                                {orders.map((order) => (
                                    <Card key={order.id} className="p-6 hover:shadow-lg transition-shadow">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-4 mb-3">
                                                    <h3 className="text-lg font-semibold">Order #{order.id.slice(0, 8)}</h3>
                                                    <Badge className={`${STATUS_COLORS[order.status] || "bg-gray-500"} text-white`}>{STATUS_LABELS[order.status] || order.status}</Badge>
                                                </div>

                                                <div className="grid sm:grid-cols-5 gap-4 text-sm mb-4">
                                                    <div>
                                                        <p className="text-muted-foreground">Order ID</p>
                                                        <p className="font-medium">{order.id.slice(0, 8)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Date</p>
                                                        <p className="font-medium">{new Date(order.created_at).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Items</p>
                                                        <p className="font-medium">{order.total_quantity} item(s)</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Total</p>
                                                        <p className="font-bold text-primary">{formatINR(order.total_amount)}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Update Status</p>
                                                        <select
                                                            value={order.status}
                                                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                                            disabled={updatingOrder}
                                                            className="border rounded px-2 py-1 text-sm bg-background text-foreground w-full disabled:opacity-50"
                                                        >
                                                            <option value="pending">Pending</option>
                                                            <option value="pending_payment">Pending Payment</option>
                                                            <option value="processing">Processing</option>
                                                            <option value="shipped">Shipped</option>
                                                            <option value="delivered">Delivered</option>
                                                            <option value="completed">Completed</option>
                                                            <option value="cancelled">Cancelled</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                                                aria-label="Toggle order details"
                                            >
                                                <ChevronRight className={`w-5 h-5 transition-transform ${expandedOrderId === order.id ? "rotate-90" : ""}`} />
                                            </Button>
                                        </div>

                                        {/* Expandable Order Details */}
                                        {expandedOrderId === order.id && (
                                            <div className="mt-4 border-t pt-4 space-y-3 text-sm">
                                                <h4 className="font-semibold mb-3">Order Items</h4>
                                                {order.items?.map((item, index) => {
                                                    const name = item.product?.name || "Unknown product";
                                                    const price = item.product?.price ?? 0;
                                                    const lineTotal = item.line_total ?? price * (item.quantity || 0);

                                                    return (
                                                        <div key={item.product_id ?? index} className="flex justify-between items-center p-3 bg-muted rounded">
                                                            <div className="flex-1">
                                                                <p className="font-medium">{name}</p>
                                                                <p className="text-muted-foreground text-xs">Product ID: {item.product_id}</p>
                                                                <p className="text-muted-foreground text-xs">Qty: {item.quantity} × {formatINR(price)}</p>
                                                            </div>
                                                            <p className="font-semibold">{formatINR(lineTotal)}</p>
                                                        </div>
                                                    );
                                                })}
                                                <div className="border-t pt-3 mt-3 flex justify-between font-bold">
                                                    <span>Total for this order:</span>
                                                    <span className="text-primary">{formatINR(order.total_amount)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </Card>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Products Section */}
                <Card className="mb-8">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Products</CardTitle>
                                <CardDescription>Manage your 3D printer inventory</CardDescription>
                            </div>
                            <Button onClick={() => setShowAddProduct(!showAddProduct)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Product
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {showAddProduct && (
                            <form onSubmit={handleAddProduct} className="mb-6 p-4 border rounded-lg space-y-4">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <Label htmlFor="name">Product Name</Label>
                                        <Input id="name" value={newProduct.name} onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))} required />
                                    </div>
                                    <div>
                                        <Label htmlFor="price">Price</Label>
                                        <Input id="price" type="number" step="0.01" value={newProduct.price} onChange={(e) => setNewProduct((prev) => ({ ...prev, price: e.target.value }))} required />
                                    </div>
                                    <div>
                                        <Label htmlFor="stock">Stock</Label>
                                        <Input id="stock" type="number" value={newProduct.stock} onChange={(e) => setNewProduct((prev) => ({ ...prev, stock: e.target.value }))} required />
                                    </div>
                                    <div>
                                        <Label htmlFor="image">Product Image</Label>
                                        <Input id="image" type="file" accept="image/*" onChange={(e) => {
                                            const file = e.target.files?.[0] || null;
                                            setNewProduct((prev) => ({ ...prev, imageFile: file }));
                                            if (newProductPreview) {
                                                URL.revokeObjectURL(newProductPreview);
                                            }
                                            if (file) {
                                                const url = URL.createObjectURL(file);
                                                setNewProductPreview(url);
                                            } else {
                                                setNewProductPreview(null);
                                            }
                                        }} />
                                        {newProductPreview && (
                                            <img src={newProductPreview} alt="preview" className="mt-2 w-28 h-28 object-cover rounded" />
                                        )}
                                    </div>
                                    <div>
                                        <Label htmlFor="category">Category</Label>
                                        <Select value={newProduct.category} onValueChange={(value) => setNewProduct((prev) => ({ ...prev, category: value }))}>
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
                                    <Textarea id="description" value={newProduct.description} onChange={(e) => setNewProduct((prev) => ({ ...prev, description: e.target.value }))} />
                                </div>
                                <Button type="submit">Add Product</Button>
                            </form>
                        )}

                        <div className="space-y-4">
                            {products.map((product) => (
                                <div key={product.id} className="p-4 border rounded-lg">
                                    {editingProductId === product.id ? (
                                        // EDIT MODE
                                        <div className="space-y-4">
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div>
                                                    <Label>Name</Label>
                                                    <Input value={editingProductData.name} onChange={(e) => handleEditChange("name", e.target.value)} />
                                                </div>
                                                <div>
                                                    <Label>Price</Label>
                                                    <Input type="number" step="0.01" value={editingProductData.price} onChange={(e) => handleEditChange("price", e.target.value)} />
                                                </div>
                                                <div>
                                                    <Label>Stock</Label>
                                                    <Input type="number" value={editingProductData.stock} onChange={(e) => handleEditChange("stock", e.target.value)} />
                                                </div>
                                                <div>
                                                    <Label>Product Image (upload to replace)</Label>
                                                    <Input type="file" accept="image/*" onChange={(e) => {
                                                        const file = e.target.files?.[0] || null;
                                                        handleEditChange("imageFile", file);
                                                    }} />
                                                    {editingProductPreview && (
                                                        // when backend returns base64 data URL or when user selected file
                                                        <img src={editingProductPreview} alt="preview" className="mt-2 w-28 h-28 object-cover rounded" />
                                                    )}
                                                </div>
                                                <div>
                                                    <Label>Category</Label>
                                                    <Select value={editingProductData.category} onValueChange={(value) => handleEditChange("category", value)}>
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
                                                <Textarea value={editingProductData.description} onChange={(e) => handleEditChange("description", e.target.value)} />
                                            </div>
                                            <div className="flex gap-2">
                                                <Button onClick={saveEditedProduct} className="flex items-center gap-2">
                                                    <Save className="h-4 w-4" />
                                                    Save
                                                </Button>
                                                <Button variant="outline" onClick={cancelEditProduct} className="flex items-center gap-2">
                                                    <X className="h-4 w-4" />
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
                                                    <Badge variant="outline" className="text-xs">{product.category.replace("_", " ")}</Badge>
                                                    {product.stock === 0 && (
                                                        <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
                                                    )}
                                                    {product.stock > 0 && product.stock < 5 && (
                                                        <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">Low Stock</Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">{product.description}</p>
                                                {product.totalSales !== undefined && (
                                                    <p className="text-xs text-muted-foreground mt-1">Total Sales: {product.totalSales} units</p>
                                                )}
                                            </div>
                                            <div className="text-right ml-4">
                                                <p className="font-bold">{formatINR(product.price)}</p>
                                                <p className={`text-sm mb-2 ${product.stock === 0 ? "text-red-600" : product.stock < 5 ? "text-orange-600" : "text-muted-foreground"}`}>Stock: {product.stock}</p>
                                                {product.image_url && (
                                                    <img src={product.image_url} alt={product.name} className="mb-2 w-28 h-28 object-cover rounded" />
                                                )}
                                                <div className="flex gap-2 justify-end">
                                                    <Button size="sm" variant="outline" onClick={() => startEditProduct(product)} className="flex items-center gap-2">
                                                        <Edit3 className="h-4 w-4" />
                                                        Edit
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AdminDashboard;
