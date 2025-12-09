import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MATERIAL_PRICES, MaterialType, formatINR } from '@/lib/currency';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const MATERIAL_INFO = {
  PLA: 'Best for beginners. Easy to print, biodegradable, good surface finish.',
  ABS: 'Strong and durable. Good for functional parts. Requires heated bed.',
  PETG: 'Chemical resistant, flexible. Great for outdoor use.',
  TPU: 'Flexible rubber-like material. Perfect for phone cases, seals.',
  Nylon: 'Very strong and durable. Great for mechanical parts.',
  'Wood Fill': 'PLA mixed with wood fibers. Natural wood-like finish.',
  'Carbon Fiber': 'Extremely strong and lightweight. Premium material.',
  Resin: 'Ultra-high detail. Perfect for miniatures and jewelry.',
} as const;

interface MaterialSelectorProps {
  selected: MaterialType;
  onSelect: (material: MaterialType) => void;
  estimatedWeight?: number;
}

export const MaterialSelector = ({
  selected,
  onSelect,
  estimatedWeight = 0,
}: MaterialSelectorProps) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label className="text-lg font-semibold">Select Material</Label>
        {estimatedWeight > 0 && (
          <span className="text-sm text-muted-foreground">
            Est. weight: {estimatedWeight}g
          </span>
        )}
      </div>

      <RadioGroup value={selected} onValueChange={(value) => onSelect(value as MaterialType)}>
        <div className="grid gap-3">
          {Object.entries(MATERIAL_PRICES).map(([material, pricePerGram]) => {
            const materialCost = estimatedWeight * pricePerGram;
            return (
              <Card
                key={material}
                className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                  selected === material
                    ? 'border-primary border-2 shadow-soft'
                    : 'border-border'
                }`}
                onClick={() => onSelect(material as MaterialType)}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={material} id={material} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={material} className="font-semibold cursor-pointer">
                        {material}
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="w-4 h-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{MATERIAL_INFO[material as MaterialType]}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm text-muted-foreground">
                        {formatINR(pricePerGram)}/gram
                      </span>
                      {estimatedWeight > 0 && (
                        <span className="text-sm font-semibold text-primary">
                          ≈ {formatINR(materialCost)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </RadioGroup>
    </div>
  );
};
