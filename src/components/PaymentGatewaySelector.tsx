import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Banknote, CreditCard } from 'lucide-react';
import { formatINR } from '@/lib/currency';

interface PaymentGateway {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
}

interface PaymentGatewaySelectorProps {
    amount: number;
    onSelect: (gatewayId: string) => void;
    selected?: string;
    showCOD?: boolean; // New logic control
}

export const PaymentGatewaySelector = ({
    amount,
    onSelect,
    selected,
    showCOD = true,
}: PaymentGatewaySelectorProps) => {
    const [selectedGateway, setSelectedGateway] = useState(selected || 'phonepe');

    useEffect(() => {
        if (!selected) onSelect('phonepe');
    }, []);

    const handleSelect = (gatewayId: string) => {
        setSelectedGateway(gatewayId);
        onSelect(gatewayId);
    };

    const gateways: PaymentGateway[] = [
        {
            id: 'phonepe',
            name: 'Online Payment',
            description: 'UPI, Cards, Net Banking (Save on shipping)',
            icon: <CreditCard className="w-6 h-6 text-purple-600" />,
        },
    ];

    if (showCOD) {
        gateways.push({
            id: 'cod',
            name: 'Cash on Delivery',
            description: 'Pay when your order arrives (+₹101 COD fee)',
            icon: <Banknote className="w-6 h-6 text-green-600" />,
        });
    }

    return (
        <div className="space-y-6">
            <div className="text-center">
                <h3 className="text-2xl font-bold">Select Payment Method</h3>
                <p className="text-muted-foreground mt-2">
                    Order Total:{' '}
                    <span className="text-2xl font-bold text-primary">
                        {formatINR(amount)}
                    </span>
                </p>
            </div>

            <RadioGroup value={selectedGateway} onValueChange={handleSelect}>
                <div className="grid gap-4">
                    {gateways.map((gateway) => (
                        <Card
                            key={gateway.id}
                            className={`p-4 cursor-pointer transition-all ${
                                selectedGateway === gateway.id
                                    ? 'border-primary border-2 bg-primary/5'
                                    : 'border-border hover:bg-slate-50'
                            }`}
                            onClick={() => handleSelect(gateway.id)}
                        >
                            <div className="flex items-start gap-4">
                                <RadioGroupItem value={gateway.id} id={gateway.id} className="mt-1" />
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="text-primary">{gateway.icon}</div>
                                        <Label htmlFor={gateway.id} className="text-lg font-semibold cursor-pointer">
                                            {gateway.name}
                                        </Label>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{gateway.description}</p>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </RadioGroup>
        </div>
    );
};
