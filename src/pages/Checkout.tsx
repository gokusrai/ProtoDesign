import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from "@/hooks/use-cart";
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { PaymentGatewaySelector } from '@/components/PaymentGatewaySelector';
import { formatINR } from '@/lib/currency';
import { toast } from 'sonner';
import { Loader2, MapPin } from 'lucide-react';
import { apiService } from '@/services/api.service';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

const INDIAN_STATES = [
    "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam",
    "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli", "Daman and Diu",
    "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir",
    "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh",
    "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
    "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const Checkout = () => {
    const navigate = useNavigate();
    const { items, total, clearCart } = useCart();
    const [loading, setLoading] = useState(false);
    const [selectedGateway, setSelectedGateway] = useState('razorpay');

    // 🔥 NEW: Address State
    const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
    const [selectedAddressId, setSelectedAddressId] = useState('new');

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
    const shipping = 50;
    const finalTotal = subtotal + gst + shipping;

    useEffect(() => {
        if (!apiService.isAuthenticated()) {
            toast.error('Please log in to place an order');
            navigate('/auth');
            return;
        }
        if (items.length === 0) {
            navigate('/cart');
        }

        // 🔥 NEW: Fetch Addresses
        loadAddresses();
    }, [items.length, navigate]);

    const loadAddresses = async () => {
        try {
            const addrs = await apiService.getAddresses();
            setSavedAddresses(addrs);
            // Optional: Auto-select default
            const def = addrs.find((a: any) => a.is_default);
            if(def) handleAddressSelect(def.id, addrs);
        } catch (e) { console.error("Failed to load addresses", e); }
    };

    const handleAddressSelect = (id: string, list = savedAddresses) => {
        setSelectedAddressId(id);
        if(id === 'new') {
            setFormData(prev => ({...prev, fullName:'', phone:'', address:'', city:'', state:'', pincode:''}));
        } else {
            const addr = list.find(a => a.id === id);
            if(addr) {
                setFormData(prev => ({
                    ...prev,
                    fullName: addr.full_name,
                    phone: addr.phone,
                    address: addr.address_line1,
                    city: addr.city,
                    state: addr.state,
                    pincode: addr.pincode
                }));
            }
        }
    }

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleStateChange = (value: string) => {
        setFormData((prev) => ({ ...prev, state: value }));
    };

    const validateForm = () => {
        if (!formData.fullName || !formData.email || !formData.phone || !formData.address || !formData.pincode || !formData.city || !formData.state) {
            toast.error('Please fill in all required fields');
            return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            toast.error('Please enter a valid email address');
            return false;
        }
        const phoneRegex = /^[6-9]\d{9}$/;
        if (!phoneRegex.test(formData.phone)) {
            toast.error('Please enter a valid 10-digit Indian phone number');
            return false;
        }
        const pincodeRegex = /^[1-9][0-9]{5}$/;
        if (!pincodeRegex.test(formData.pincode)) {
            toast.error('Please enter a valid 6-digit Pincode');
            return false;
        }
        return true;
    };

    const handlePlaceOrder = async () => {
        if (!validateForm()) return;
        setLoading(true);

        try {
            await apiService.getCurrentUser();

            const orderItems = items.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
            }));

            await apiService.createOrder(
                orderItems,
                finalTotal,
                formData,
                selectedGateway,
                shipping
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
                        <Card className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-2xl font-semibold">Shipping Details</h2>

                                {/* 🔥 NEW: Saved Address Selector (Subtle) */}
                                {savedAddresses.length > 0 && (
                                    <div className="w-[200px]">
                                        <Select value={selectedAddressId} onValueChange={(val) => handleAddressSelect(val)}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Load Saved Address" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="new">Use New Address</SelectItem>
                                                {savedAddresses.map(addr => (
                                                    <SelectItem key={addr.id} value={addr.id}>{addr.label} - {addr.full_name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

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
                                        placeholder="john@example.com"
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="phone">Phone Number *</Label>
                                    <div className="flex">
                                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                                            +91
                                        </span>
                                        <Input
                                            id="phone"
                                            name="phone"
                                            type="tel"
                                            value={formData.phone}
                                            onChange={handleInputChange}
                                            placeholder="9876543210"
                                            className="rounded-l-none"
                                            required
                                            maxLength={10}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="pincode">Pincode *</Label>
                                    <Input
                                        id="pincode"
                                        name="pincode"
                                        value={formData.pincode}
                                        onChange={handleInputChange}
                                        placeholder="110001"
                                        maxLength={6}
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
                                        placeholder="House No, Street, Landmark"
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
                                    <Select onValueChange={handleStateChange} value={formData.state}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select State" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {INDIAN_STATES.map((state) => (
                                                <SelectItem key={state} value={state}>
                                                    {state}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="md:col-span-2">
                                    <Label htmlFor="notes">Order Notes (Optional)</Label>
                                    <Textarea
                                        id="notes"
                                        name="notes"
                                        value={formData.notes}
                                        onChange={handleInputChange}
                                        rows={2}
                                    />
                                </div>
                            </div>
                        </Card>

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
                                        <span>{item.product.name} × {item.quantity}</span>
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
                                    <span>Shipping (Standard)</span>
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