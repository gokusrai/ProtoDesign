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
import { Loader2, Truck, CheckCircle2 } from 'lucide-react';
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

    // Default to Online Payment
    const [selectedGateway, setSelectedGateway] = useState('phonepe');

    // Address State
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
    const hasPrinter = items.some(item => item.product.category === '3d_printer');
    
    // COD is ONLY allowed if there are NO printers AND the subtotal is strictly less than ₹999
    const isEligibleForCOD = !hasPrinter && subtotal < 999;

    /**
     * Strategic Pricing Calculation:
     * 1. Printers always get FREE shipping (Incentivizes high-ticket sales)
     * 2. Standard Items: Online payment = ₹199 | COD = ₹300 (Covers extra courier fees)
     */
    const getShippingCharge = () => {
        if (hasPrinter) return 0;
        return selectedGateway === 'cod' ? 300 : 199;
    };

    const shipping = getShippingCharge();
    const gst = subtotal * 0.18;
    const finalTotal = subtotal + gst + shipping;

    // Failsafe: If they somehow had COD selected but their cart crosses 999, force it back to PhonePe
    useEffect(() => {
        if (!isEligibleForCOD && selectedGateway === 'cod') {
            setSelectedGateway('phonepe');
        }
    }, [isEligibleForCOD, selectedGateway]);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const user = await apiService.getCurrentUser();
                if (!user) {
                    toast.error('Please log in to place an order');
                    navigate('/auth');
                }
            } catch (e) {
                navigate('/auth');
            }
        };
        checkAuth();

        if (items.length === 0) {
            navigate('/cart');
        }

        loadAddresses();
    }, [items.length, navigate]);

    const loadAddresses = async () => {
        try {
            const addrs = await apiService.getAddresses();
            setSavedAddresses(addrs);
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const validateForm = () => {
        const required = ['fullName', 'email', 'phone', 'address', 'pincode', 'city', 'state'];
        for (const field of required) {
            if (!formData[field as keyof typeof formData]) {
                toast.error(`Please fill in your ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
                return false;
            }
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            toast.error('Please enter a valid email');
            return false;
        }

        const phoneRegex = /^[6-9]\d{9}$/;
        if (!phoneRegex.test(formData.phone)) {
            toast.error('Enter a valid 10-digit Indian phone number');
            return false;
        }

        return true;
    };

    const handlePlaceOrder = async () => {
        if (!validateForm()) return;
        setLoading(true);

        try {
            const orderItems = items.map((item) => ({
                product_id: item.product.id,
                quantity: item.quantity,
            }));

            const response = await apiService.createOrder(
                orderItems,
                finalTotal,
                formData,
                selectedGateway,
                shipping 
            );

            if (response && response.redirectUrl) {
                toast.loading('Redirecting to Payment Gateway...');
                await clearCart();
                window.location.href = response.redirectUrl;
                return;
            }

            toast.success('Order placed successfully!');
            await clearCart();
            setTimeout(() => navigate('/orders'), 2000);

        } catch (error: any) {
            console.error('Order error:', error);
            toast.error(error.message || 'Failed to place order');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen pt-24 pb-16 bg-slate-50/50">
            <div className="container mx-auto px-4">
                <h1 className="text-4xl font-bold mb-8 font-display">Checkout</h1>

                <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Shipping Address Section */}
                        <Card className="p-6 shadow-sm">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                                <h2 className="text-2xl font-semibold flex items-center gap-2">
                                    <Truck className="w-6 h-6 text-primary" /> Shipping Details
                                </h2>
                                {savedAddresses.length > 0 && (
                                    <div className="w-full sm:w-[240px]">
                                        <Select value={selectedAddressId} onValueChange={handleAddressSelect}>
                                            <SelectTrigger className="bg-white">
                                                <SelectValue placeholder="Use Saved Address" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="new">Add New Address</SelectItem>
                                                {savedAddresses.map(addr => (
                                                    <SelectItem key={addr.id} value={addr.id}>
                                                        {addr.label || 'Home'} - {addr.full_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="fullName">Receiver's Full Name *</Label>
                                    <Input id="fullName" name="fullName" value={formData.fullName} onChange={handleInputChange} placeholder="E.g. Rahul Sharma" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address *</Label>
                                    <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="rahul@example.com" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Contact Number *</Label>
                                    <div className="flex">
                                        <span className="flex items-center px-3 rounded-l-md border border-r-0 bg-muted text-sm font-medium">+91</span>
                                        <Input id="phone" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="9876543210" className="rounded-l-none" maxLength={10} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="pincode">Pincode *</Label>
                                    <Input id="pincode" name="pincode" value={formData.pincode} onChange={handleInputChange} placeholder="110001" maxLength={6} />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <Label htmlFor="address">Detailed Address *</Label>
                                    <Textarea id="address" name="address" value={formData.address} onChange={handleInputChange} rows={3} placeholder="Flat/House No, Building Name, Street" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="city">City *</Label>
                                    <Input id="city" name="city" value={formData.city} onChange={handleInputChange} placeholder="New Delhi" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="state">State *</Label>
                                    <Select onValueChange={(val) => setFormData(p => ({...p, state: val}))} value={formData.state}>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Select State" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {INDIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </Card>

                        {/* Payment Gateway Section */}
                        <Card className="p-6 shadow-sm border-t-4 border-t-primary">
                            <PaymentGatewaySelector
                                amount={finalTotal}
                                onSelect={setSelectedGateway}
                                selected={selectedGateway}
                                showCOD={isEligibleForCOD} // ✅ Dynamically blocked for items >= 999
                            />
                        </Card>
                    </div>

                    {/* Order Summary Sidebar */}
                    <div className="lg:col-span-1">
                        <Card className="p-6 sticky top-24 shadow-lg border-2 border-slate-100">
                            <h2 className="text-2xl font-bold mb-4">Order Summary</h2>
                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 mb-4">
                                {items.map((item) => (
                                    <div key={item.product_id} className="flex justify-between text-sm gap-4">
                                        <span className="text-muted-foreground line-clamp-1 flex-1">
                                            {item.product.name} <span className="text-primary font-bold">×{item.quantity}</span>
                                        </span>
                                        <span className="font-medium">{formatINR(item.product.price * item.quantity)}</span>
                                    </div>
                                ))}
                            </div>

                            <Separator className="my-4" />

                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span>Subtotal</span>
                                    <span className="font-medium">{formatINR(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-sm items-center">
                                    <span className="flex items-center gap-1.5">
                                        Shipping {hasPrinter && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                                    </span>
                                    <span className={shipping === 0 ? "text-green-600 font-bold" : "font-medium"}>
                                        {shipping === 0 ? "FREE" : formatINR(shipping)}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>GST (18%)</span>
                                    <span className="font-medium">{formatINR(gst)}</span>
                                </div>
                                <Separator className="my-2" />
                                <div className="flex justify-between text-xl font-bold text-slate-900 pt-2">
                                    <span>Total Payable</span>
                                    <span className="text-primary">{formatINR(finalTotal)}</span>
                                </div>
                            </div>

                            <Button
                                onClick={handlePlaceOrder}
                                disabled={loading}
                                className="w-full mt-8 h-12 text-lg shadow-xl hover:shadow-primary/20 transition-all"
                                size="lg"
                            >
                                {loading ? (
                                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Finalizing...</>
                                ) : (
                                    `Complete Payment`
                                )}
                            </Button>

                            <div className="mt-6 p-4 bg-slate-50 rounded-lg text-[11px] text-muted-foreground space-y-2">
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">•</span>
                                    {/* ✅ Dynamic informative text based on eligibility */}
                                    {hasPrinter 
                                        ? "Orders containing 3D Printers are ineligible for Cash on Delivery." 
                                        : "Cash on Delivery is only available for orders below ₹999."}
                                </p>
                                <p className="flex items-start gap-2">
                                    <span className="text-primary font-bold">•</span>
                                    Safe and secure payments powered by PhonePe.
                                </p>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Checkout;
