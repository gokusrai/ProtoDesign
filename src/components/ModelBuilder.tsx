import { useRef, useState, useCallback } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { ShapeToolbar } from "./ShapeToolbar";
import { Button } from "./ui/button";
import { Move, RotateCw, Maximize2 } from "lucide-react";

interface Shape {
  id: string;
  type: 'cube' | 'sphere' | 'cylinder';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
}

type TransformMode = "translate" | "rotate" | "scale";

interface InteractiveShapeProps {
  shape: Shape;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onTransform: (id: string, position: [number, number, number], rotation: [number, number, number], scale: [number, number, number]) => void;
  transformMode: TransformMode;
}

const InteractiveShape = ({ shape, isSelected, onSelect, onTransform, transformMode }: InteractiveShapeProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(shape.id);
  };

  const hoverScale = !isSelected && hovered ? 1.05 : 1;

  return (
    <group>
      <mesh
        ref={meshRef}
        position={shape.position}
        rotation={shape.rotation}
        scale={[shape.scale[0] * hoverScale, shape.scale[1] * hoverScale, shape.scale[2] * hoverScale]}
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {shape.type === 'cube' && <boxGeometry args={[1, 1, 1]} />}
        {shape.type === 'sphere' && <sphereGeometry args={[0.6, 32, 32]} />}
        {shape.type === 'cylinder' && <cylinderGeometry args={[0.5, 0.5, 1, 32]} />}
        <meshStandardMaterial
          color={isSelected ? "#8b5cf6" : shape.color}
          metalness={0.3}
          roughness={0.4}
          emissive={isSelected ? "#8b5cf6" : "#000000"}
          emissiveIntensity={isSelected ? 0.2 : 0}
        />
      </mesh>
      {isSelected && meshRef.current && (
        <TransformControls
          object={meshRef.current}
          mode={transformMode}
          onObjectChange={() => {
            if (meshRef.current) {
              const pos = meshRef.current.position.toArray() as [number, number, number];
              const rot = [
                meshRef.current.rotation.x,
                meshRef.current.rotation.y,
                meshRef.current.rotation.z
              ] as [number, number, number];
              const scl = meshRef.current.scale.toArray() as [number, number, number];
              onTransform(shape.id, pos, rot, scl);
            }
          }}
        />
      )}
    </group>
  );
};

export const ModelBuilder = () => {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<TransformMode>("translate");

  const getRandomPosition = (): [number, number, number] => {
    return [
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.5) * 4,
    ];
  };

  const handleAddShape = useCallback((type: 'cube' | 'sphere' | 'cylinder') => {
    const newShape: Shape = {
      id: `${type}-${Date.now()}`,
      type,
      position: getRandomPosition(),
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: "#d97556",
    };
    setShapes(prev => [...prev, newShape]);
    setSelectedShapeId(newShape.id);
  }, []);

  const handleDeleteSelected = useCallback(() => {
    if (selectedShapeId) {
      setShapes(prev => prev.filter(s => s.id !== selectedShapeId));
      setSelectedShapeId(null);
    }
  }, [selectedShapeId]);

  const handleClear = useCallback(() => {
    setShapes([]);
    setSelectedShapeId(null);
  }, []);

  const handleCanvasClick = () => {
    setSelectedShapeId(null);
  };

  const handleTransform = useCallback((
    id: string,
    position: [number, number, number],
    rotation: [number, number, number],
    scale: [number, number, number]
  ) => {
    setShapes(prev => prev.map(s =>
      s.id === id ? { ...s, position, rotation, scale } : s
    ));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        <ShapeToolbar
          onAddShape={handleAddShape}
          onDeleteSelected={handleDeleteSelected}
          onClear={handleClear}
          selectedShape={selectedShapeId}
        />
        
        {selectedShapeId && (
          <div className="flex gap-2 p-2 bg-card rounded-lg shadow-soft border border-border">
            <Button
              variant={transformMode === "translate" ? "default" : "outline"}
              size="sm"
              onClick={() => setTransformMode("translate")}
            >
              <Move className="w-4 h-4 mr-2" />
              Move
            </Button>
            <Button
              variant={transformMode === "rotate" ? "default" : "outline"}
              size="sm"
              onClick={() => setTransformMode("rotate")}
            >
              <RotateCw className="w-4 h-4 mr-2" />
              Rotate
            </Button>
            <Button
              variant={transformMode === "scale" ? "default" : "outline"}
              size="sm"
              onClick={() => setTransformMode("scale")}
            >
              <Maximize2 className="w-4 h-4 mr-2" />
              Scale
            </Button>
          </div>
        )}
      </div>
      
      <div className="w-full h-[500px] rounded-lg overflow-hidden shadow-soft bg-muted/50">
        <Canvas onClick={handleCanvasClick}>
          <PerspectiveCamera makeDefault position={[5, 5, 5]} />
          <OrbitControls enableZoom={true} enablePan={true} makeDefault />
          
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />
          <directionalLight position={[-10, -10, -5]} intensity={0.3} />
          
          {shapes.map((shape) => (
            <InteractiveShape
              key={shape.id}
              shape={shape}
              isSelected={shape.id === selectedShapeId}
              onSelect={setSelectedShapeId}
              onTransform={handleTransform}
              transformMode={transformMode}
            />
          ))}
          
          <gridHelper args={[10, 10, "#d97556", "#e8c4b4"]} />
        </Canvas>
      </div>
    </div>
  );
};
