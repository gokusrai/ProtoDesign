import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Box, Circle, Cylinder, Trash2, Download } from "lucide-react";
import { toast } from "sonner";

interface ShapeToolbarProps {
  onAddShape: (type: 'cube' | 'sphere' | 'cylinder') => void;
  onDeleteSelected: () => void;
  onClear: () => void;
  selectedShape: string | null;
}

export const ShapeToolbar = ({ onAddShape, onDeleteSelected, onClear, selectedShape }: ShapeToolbarProps) => {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-2 border-r border-border pr-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddShape('cube')}
            className="gap-2"
          >
            <Box className="w-4 h-4" />
            Cube
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddShape('sphere')}
            className="gap-2"
          >
            <Circle className="w-4 h-4" />
            Sphere
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddShape('cylinder')}
            className="gap-2"
          >
            <Cylinder className="w-4 h-4" />
            Cylinder
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDeleteSelected}
            disabled={!selectedShape}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClear}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-3">
        Click shapes to add them. Click and drag to rotate view. Scroll to zoom.
      </p>
    </Card>
  );
};
