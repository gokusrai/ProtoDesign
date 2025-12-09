import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

interface STLViewerProps {
    file: File | null;
}

// Inner component that only renders 3D content
const STLModel = ({ file }: { file: File | null }) => {
    const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

    useEffect(() => {
        if (!file) {
            setGeometry(null);
            return;
        }

        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const arrayBuffer = event.target?.result as ArrayBuffer;
                const name = file.name.toLowerCase();

                if (name.endsWith(".stl")) {
                    const loader = new STLLoader();
                    const geo = loader.parse(arrayBuffer);
                    geo.computeVertexNormals()
                    geo.rotateX(-Math.PI/2); // ✅ stand it up
                    setGeometry(geo);

                } else if (name.endsWith(".obj")) {
                    const text = new TextDecoder().decode(arrayBuffer);
                    const loader = new OBJLoader();
                    const obj = loader.parse(text);

                    let mesh: THREE.Mesh | null = null;
                    obj.traverse((child) => {
                        if ((child as THREE.Mesh).isMesh && !mesh) {
                            mesh = child as THREE.Mesh;
                        }
                    });

                    if (mesh && mesh.geometry) {
                        const geo = mesh.geometry;
                        geo.computeVertexNormals();
                        geo.center();
                        setGeometry(geo);
                    } else {
                        console.error("No mesh found in OBJ file");
                        setGeometry(null);
                    }
                } else {
                    console.error("Unsupported file type");
                    setGeometry(null);
                }
            } catch (err) {
                console.error("Model loading error:", err);
                setGeometry(null);
            }
        };

        reader.readAsArrayBuffer(file);

        return () => {
            if (geometry) {
                geometry.dispose();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [file]);

    if (!geometry) return null;

    return (
        <mesh geometry={geometry}>
            <meshStandardMaterial color="#3b82f6" metalness={0.3} roughness={0.6} />
        </mesh>
    );
};

export const STLViewer = ({ file }: STLViewerProps) => {
    // All HTML UI stays OUTSIDE Canvas
    return (
        <div className="w-full h-full rounded-lg overflow-hidden shadow-soft bg-muted/50 relative">
            {!file && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <p className="text-muted-foreground text-sm">
                        Upload a 3D model to preview
                    </p>
                </div>
            )}

            <Canvas>
                <PerspectiveCamera makeDefault position={[0, 0, 120]} />
                <OrbitControls
                    makeDefault
                    enableZoom
                    enablePan
                />
                <ambientLight intensity={0.7} />
                <directionalLight position={[10, 10, 5]} intensity={1.2} />
                <directionalLight position={[-10, -10, -5]} intensity={0.4} />
                <gridHelper args={[200, 20, "#d97556", "#e8c4b4"]} />

                {file && <STLModel file={file} />}
            </Canvas>
        </div>
    );
};
