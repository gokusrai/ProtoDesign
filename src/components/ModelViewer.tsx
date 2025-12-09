import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

interface ModelViewerProps {
  modelData?: any;
}

const RotatingBox = ({ color = "#d97556" }: { color?: string }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <mesh
      ref={meshRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      scale={hovered ? 1.1 : 1}
    >
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
    </mesh>
  );
};

export const ModelViewer = ({ modelData }: ModelViewerProps) => {
  return (
    <div className="w-full h-[500px] rounded-lg overflow-hidden shadow-soft bg-muted/50">
      <Canvas>
        <PerspectiveCamera makeDefault position={[5, 5, 5]} />
        <OrbitControls enableZoom={true} enablePan={true} />
        
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <directionalLight position={[-10, -10, -5]} intensity={0.3} />
        
        {modelData ? (
          <primitive object={modelData} />
        ) : (
          <RotatingBox />
        )}
        
        <gridHelper args={[10, 10, "#d97556", "#e8c4b4"]} />
      </Canvas>
    </div>
  );
};
