import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Wallet, Banknote, CreditCard } from 'lucide-react';
import { formatINR } from '@/lib/currency';

interface PaymentGateway {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    methods: string[];
}

const PAYMENT_GATEWAYS: PaymentGateway[] = [
    {
        id: 'phonepe',
        name: 'PhonePe',
        description: 'UPI, Cards, Net Banking',
        // Fallback to CreditCard icon if image fails to load or isn't present
        icon: <CreditCard className="w-6 h-6 text-purple-600" />,
        methods: ['UPI', 'Credit/Debit Card', 'Net Banking'],}
    // },
    // {
    //     id: 'cod',
    //     name: 'Cash on Delivery',
    //     description: 'Pay when your order arrives',
    //     icon: <Banknote className="w-6 h-6 text-green-600" />,
    //     methods: ['Cash', 'UPI on Delivery'],
    // },
];

interface PaymentGatewaySelectorProps {
    amount: number;
    onSelect: (gatewayId: string) => void;
    selected?: string;
}

export const PaymentGatewaySelector = ({
                                           amount,
                                           onSelect,
                                           selected,
                                       }: PaymentGatewaySelectorProps) => {
    // Default to phonepe if nothing selected
    const [selectedGateway, setSelectedGateway] = useState(selected || 'phonepe');

    // Notify parent of default selection on mount
    useEffect(() => {
        if (!selected) {
            onSelect('phonepe');
        }
    }, []);

    const handleSelect = (gatewayId: string) => {
        setSelectedGateway(gatewayId);
        onSelect(gatewayId);
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h3 className="text-2xl font-bold">Select Payment Method</h3>
                <p className="text-muted-foreground mt-2">
                    Total Amount:{' '}
                    <span className="text-2xl font-bold text-primary">
                        {formatINR(amount)}
                    </span>
                </p>
            </div>

            <RadioGroup value={selectedGateway} onValueChange={handleSelect}>
                <div className="grid gap-4">
                    {PAYMENT_GATEWAYS.map((gateway) => (
                        <Card
                            key={gateway.id}
                            className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                                selectedGateway === gateway.id
                                    ? 'border-primary border-2 shadow-glow bg-primary/5'
                                    : 'border-border hover:bg-slate-50'
                            }`}
                            onClick={() => handleSelect(gateway.id)}
                        >
                            <div className="flex items-start gap-4">
                                <RadioGroupItem
                                    value={gateway.id}
                                    id={gateway.id}
                                    className="mt-1"
                                />
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="text-primary">{gateway.icon}</div>
                                        <Label
                                            htmlFor={gateway.id}
                                            className="text-lg font-semibold cursor-pointer"
                                        >
                                            {gateway.name}
                                        </Label>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-2">
                                        {gateway.description}
                                    </p>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </RadioGroup>
        </div>
    );
};