import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { PaymentGatewaySelector } from '@/components/PaymentGatewaySelector';
import { formatINR } from '@/lib/currency';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { apiService } from '@/services/api.service';

const Checkout = () => {
    const navigate = useNavigate();
    const { items, total, clearCart } = useCart();
    const [loading, setLoading] = useState(false);
    const [selectedGateway, setSelectedGateway] = useState('razorpay');

    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        notes: '',
    });

    const subtotal = total;
    const gst = total * 0.18;
    const shipping = 500; // Fixed shipping for now
    const finalTotal = subtotal + gst + shipping;

    // ✅ redirect logic in effect (avoids setState during render warning)
    useEffect(() => {
        if (!apiService.isAuthenticated()) {
            toast.error('Please log in to place an order');
            navigate('/auth');
            return;
        }
        if (items.length === 0) {
            navigate('/cart');
        }
    }, [items.length, navigate]);

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handlePlaceOrder = async () => {
        if (!formData.fullName || !formData.email || !formData.phone || !formData.address) {
            toast.error('Please fill in all required fields');
            return;
        }

        setLoading(true);

        try {
            // still verify session
            await apiService.getCurrentUser();

            if (!apiService.isAuthenticated()) {
                toast.error('Please log in to place an order');
                navigate('/auth');
                return;
            }

            const orderItems = items.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
            }));

            await apiService.createOrder(
                orderItems,
                finalTotal,
                formData,
                selectedGateway
            );

            toast.success('Order placed successfully! Redirecting...');

            await clearCart();
            setTimeout(() => {
                navigate('/orders');
            }, 2000);
        } catch (error: any) {
            console.error('Order error:', error);
            toast.error(error.message || 'Failed to place order');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-24 pb-16 bg-gradient-subtle">
            <div className="container mx-auto px-4">
                <h1 className="text-4xl font-bold mb-8">Checkout</h1>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Checkout Form */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Shipping Details */}
                        <Card className="p-6">
                            <h2 className="text-2xl font-semibold mb-4">Shipping Details</h2>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="fullName">Full Name *</Label>
                                    <Input
                                        id="fullName"
                                        name="fullName"
                                        value={formData.fullName}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="email">Email *</Label>
                                    <Input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="phone">Phone Number *</Label>
                                    <Input
                                        id="phone"
                                        name="phone"
                                        type="tel"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="pincode">Pincode *</Label>
                                    <Input
                                        id="pincode"
                                        name="pincode"
                                        value={formData.pincode}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <Label htmlFor="address">Address *</Label>
                                    <Textarea
                                        id="address"
                                        name="address"
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        rows={3}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="city">City *</Label>
                                    <Input
                                        id="city"
                                        name="city"
                                        value={formData.city}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="state">State *</Label>
                                    <Input
                                        id="state"
                                        name="state"
                                        value={formData.state}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <Label htmlFor="notes">Order Notes (Optional)</Label>
                                    <Textarea
                                        id="notes"
                                        name="notes"
                                        value={formData.notes}
                                        onChange={handleInputChange}
                                        rows={2}
                                        placeholder="Any special instructions for your order"
                                    />
                                </div>
                            </div>
                        </Card>

                        {/* Payment Method */}
                        <Card className="p-6">
                            <PaymentGatewaySelector
                                amount={finalTotal}
                                onSelect={setSelectedGateway}
                                selected={selectedGateway}
                            />
                        </Card>
                    </div>

                    {/* Order Summary */}
                    <div className="lg:col-span-1">
                        <Card className="p-6 sticky top-24">
                            <h2 className="text-2xl font-semibold mb-4">Order Summary</h2>
                            <Separator className="my-4" />

                            <div className="space-y-3 mb-4">
                                {items.map((item) => (
                                    <div key={item.product_id} className="flex justify-between text-sm">
                    <span>
                      {item.product.name} × {item.quantity}
                    </span>
                                        <span>{formatINR(item.product.price * item.quantity)}</span>
                                    </div>
                                ))}
                            </div>

                            <Separator className="my-4" />

                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span>Subtotal</span>
                                    <span>{formatINR(subtotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Shipping</span>
                                    <span>{formatINR(shipping)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>GST (18%)</span>
                                    <span>{formatINR(gst)}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between text-xl font-bold">
                                    <span>Total</span>
                                    <span className="text-primary">{formatINR(finalTotal)}</span>
                                </div>
                            </div>

                            <Button
                                onClick={handlePlaceOrder}
                                disabled={loading}
                                className="w-full mt-6"
                                size="lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    `Pay ${formatINR(finalTotal)}`
                                )}
                            </Button>

                            <p className="text-xs text-muted-foreground text-center mt-4">
                                By placing this order, you agree to our Terms & Conditions
                            </p>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Checkout;
