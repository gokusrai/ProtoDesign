import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatINR } from '@/lib/currency';
import { Loader2, Package, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api.service';

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
    created_at: string;
    total_amount: number;
    status: string;
    total_quantity: number;
    items: OrderItem[];
}

const STATUS_COLORS: Record<string, string> = {
    pending_payment: 'bg-yellow-500',
    processing: 'bg-blue-500',
    shipped: 'bg-purple-500',
    delivered: 'bg-green-500',
    cancelled: 'bg-red-500',
};

const STATUS_LABELS: Record<string, string> = {
    pending_payment: 'Pending Payment',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
};

const Orders = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            if (!apiService.isAuthenticated()) {
                toast.error('Please log in to view orders');
                navigate('/auth');
                return;
            }

            await apiService.getCurrentUser();

            const ordersData = await apiService.getOrders();
            const rawOrders: Order[] = ordersData.data ?? ordersData;

            setOrders(rawOrders);
        } catch (error: any) {
            console.error('Error fetching orders:', error);

            if (error.message.includes('401') || error.message.includes('Session')) {
                toast.error('Session expired. Please sign in again.');
                navigate('/auth');
            } else {
                toast.error('Failed to load orders');
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="min-h-screen pt-24 pb-16">
                <div className="container mx-auto px-4">
                    <div className="max-w-2xl mx-auto text-center space-y-6">
                        <Package className="w-24 h-24 mx-auto text-muted-foreground" />
                        <h1 className="text-3xl font-bold">No Orders Yet</h1>
                        <p className="text-muted-foreground">
                            You haven't placed any orders. Start shopping to see your orders here.
                        </p>
                        <Button onClick={() => navigate('/shop')} size="lg">
                            Start Shopping
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-24 pb-16">
            <div className="container mx-auto px-4">
                <h1 className="text-4xl font-bold mb-8">My Orders</h1>

                <div className="max-w-4xl space-y-4">
                    {orders.map((order) => (
                        <Card key={order.id} className="p-6 hover:shadow-lg transition-shadow">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-4 mb-3">
                                        <h3 className="text-lg font-semibold">
                                            Order #{order.id.slice(0, 8)}
                                        </h3>
                                        <Badge
                                            className={`${
                                                STATUS_COLORS[order.status] || 'bg-gray-500'
                                            } text-white`}
                                        >
                                            {STATUS_LABELS[order.status] || order.status}
                                        </Badge>
                                    </div>

                                    <div className="grid sm:grid-cols-3 gap-4 text-sm">
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
                                            <p className="font-medium">
                                                {order.total_quantity} item(s)
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Total</p>
                                            <p className="font-bold text-primary">
                                                {formatINR(order.total_amount)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                        setExpandedOrderId(
                                            expandedOrderId === order.id ? null : order.id
                                        )
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
                                    {order.items?.map((item, index) => {
                                        const name = item.product?.name || 'Unknown product';
                                        const price = item.product?.price ?? 0;
                                        const lineTotal =
                                            item.line_total ?? price * (item.quantity || 0);

                                        return (
                                            <div
                                                key={item.product_id ?? index}
                                                className="flex justify-between items-center"
                                            >
                                                <div>
                                                    <p className="font-medium">{name}</p>
                                                    <p className="text-muted-foreground text-xs">
                                                        Qty: {item.quantity} × {formatINR(price)}
                                                    </p>
                                                </div>
                                                <p className="font-semibold">
                                                    {formatINR(lineTotal)}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Orders;
