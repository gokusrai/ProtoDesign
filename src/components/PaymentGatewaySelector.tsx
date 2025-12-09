import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CreditCard, Smartphone, Wallet, Bitcoin } from 'lucide-react';
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
    id: 'razorpay',
    name: 'Razorpay',
    description: 'UPI, Cards, Net Banking, Wallets',
    icon: <Smartphone className="w-6 h-6" />,
    methods: ['UPI', 'Credit/Debit Card', 'Net Banking', 'Wallets'],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'International Cards',
    icon: <CreditCard className="w-6 h-6" />,
    methods: ['Credit Card', 'Debit Card'],
  },
  {
    id: 'paypal',
    name: 'PayPal',
    description: 'PayPal Account',
    icon: <Wallet className="w-6 h-6" />,
    methods: ['PayPal Balance', 'Linked Cards'],
  },
  {
    id: 'crypto',
    name: 'Cryptocurrency',
    description: 'Bitcoin, Ethereum, USDT',
    icon: <Bitcoin className="w-6 h-6" />,
    methods: ['BTC', 'ETH', 'USDT'],
  },
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
  const [selectedGateway, setSelectedGateway] = useState(selected || 'razorpay');

  const handleSelect = (gatewayId: string) => {
    setSelectedGateway(gatewayId);
    onSelect(gatewayId);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold">Select Payment Method</h3>
        <p className="text-muted-foreground mt-2">
          Total Amount: <span className="text-2xl font-bold text-primary">{formatINR(amount)}</span>
        </p>
      </div>

      <RadioGroup value={selectedGateway} onValueChange={handleSelect}>
        <div className="grid gap-4">
          {PAYMENT_GATEWAYS.map((gateway) => (
            <Card
              key={gateway.id}
              className={`p-4 cursor-pointer transition-all hover:shadow-lg ${
                selectedGateway === gateway.id
                  ? 'border-primary border-2 shadow-glow'
                  : 'border-border'
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
                  <p className="text-sm text-muted-foreground mb-2">{gateway.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {gateway.methods.map((method) => (
                      <span
                        key={method}
                        className="text-xs px-2 py-1 bg-muted rounded-full"
                      >
                        {method}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </RadioGroup>

      <div className="bg-muted/50 p-4 rounded-lg border border-border">
        <p className="text-sm text-muted-foreground">
          🔒 <strong>Secure Payment:</strong> All transactions are encrypted and secure. Your payment
          information is never stored on our servers.
        </p>
      </div>
    </div>
  );
};
