import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { STLViewer } from "@/components/STLViewer";
import { AuthModal } from "@/components/AuthModal";
import { MaterialSelector } from "@/components/MaterialSelector";
import { useDropzone } from "react-dropzone";
import {
    Upload,
    Loader2,
    Sparkles,
    Camera,
    Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { MaterialType, MATERIAL_PRICES, formatINR } from "@/lib/currency";

const CustomPrinting = () => {
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [dimensions, setDimensions] = useState({
        length: "",
        width: "",
        height: "",
    });
    const [selectedMaterial, setSelectedMaterial] =
        useState<MaterialType>("PLA");
    const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
    const [estimatedWeight, setEstimatedWeight] = useState<number>(0);
    const [isEstimating, setIsEstimating] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [referenceImages, setReferenceImages] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const cameraInputRef = useRef<HTMLInputElement | null>(null);
    const { addToCart } = useCart();

    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (!acceptedFiles.length) return;
        const file = acceptedFiles[0];
        setUploadedFile(file);
        setEstimatedCost(null);
        setEstimatedWeight(0);
        toast.success("Model uploaded successfully!");
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            "model/stl": [".stl"],
            "model/obj": [".obj"],
        },
        maxFiles: 1,
    });

    const handleEstimate = () => {
        if (!uploadedFile) {
            toast.error("Please upload a 3D model first");
            return;
        }

        if (!dimensions.length || !dimensions.width || !dimensions.height) {
            toast.error("Please enter all dimensions");
            return;
        }

        setIsEstimating(true);

        setTimeout(() => {
            const volume =
                parseFloat(dimensions.length) *
                parseFloat(dimensions.width) *
                parseFloat(dimensions.height);

            const weight = Math.round((volume / 1000) * 1.2);
            setEstimatedWeight(weight);

            const materialCost = weight * MATERIAL_PRICES[selectedMaterial];
            const baseCost = 100;
            const complexityFactor = 1.3;

            const estimated = Math.round(
                (baseCost + materialCost) * complexityFactor
            );
            setEstimatedCost(estimated);

            setIsEstimating(false);
            toast.success("Cost estimated successfully!");
        }, 2000);
    };

    const handleAddToCart = () => {
        if (!isAuthenticated) {
            setShowAuthModal(true);
            return;
        }

        if (!estimatedCost) {
            toast.error("Please get a cost estimate first");
            return;
        }

        addToCart({
            name: uploadedFile?.name || "Custom 3D Print",
            price: estimatedCost,
            quantity: 1,
            material: selectedMaterial,
            dimensions: {
                length: parseFloat(dimensions.length),
                width: parseFloat(dimensions.width),
                height: parseFloat(dimensions.height),
            },
            isCustom: true,
        });

        toast.success(
            "Added to cart! Final quote will be confirmed at checkout."
        );
    };

    // For now just store reference images locally; you can wire this to Postgres API later
    const handleImageUpload = async (file: File) => {
        if (!file.type.startsWith("image/")) {
            toast.error("Please upload an image file");
            return;
        }

        setIsUploading(true);
        try {
            const url = URL.createObjectURL(file);
            setReferenceImages((prev) => [...prev, url]);
            toast.success("Reference image added (local preview only)");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileSelect = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0];
        if (file) {
            handleImageUpload(file);
        }
    };

    return (
        <div className="min-h-screen pt-20">
            {/* Hero Section */}
            <section className="py-16 gradient-subtle">
                <div className="container mx-auto px-4">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center max-w-3xl mx-auto"
                    >
                        <h1 className="font-display text-5xl md:text-6xl mb-6">
                            Custom 3D Printing Service
                        </h1>
                        <p className="text-xl text-muted-foreground">
                            Upload your model, specify dimensions, and get an instant
                            AI-powered cost estimate.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Main Content */}
            <section className="py-16">
                <div className="container mx-auto px-4">
                    <div className="grid lg:grid-cols-2 gap-8">
                        {/* Left Column - 3D Model Preview */}
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <Card>
                                <CardHeader>
                                    <CardTitle className="font-display">
                                        3D Model Preview
                                    </CardTitle>
                                    <CardDescription>
                                        {uploadedFile
                                            ? `Loaded: ${uploadedFile.name}`
                                            : "Upload a .STL or .OBJ file to preview"}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="w-full h-[500px]">
                                        <STLViewer file={uploadedFile} />
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>

                        {/* Right Column - Upload & Details */}
                        <motion.div
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6 }}
                            className="space-y-6"
                        >
                            {/* Upload Section */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="font-display">
                                        Upload Model
                                    </CardTitle>
                                    <CardDescription>
                                        Support for .STL and .OBJ files
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div
                                        {...getRootProps()}
                                        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-smooth ${
                                            isDragActive
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:border-primary/50"
                                        }`}
                                    >
                                        <input {...getInputProps()} />
                                        <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                                        {uploadedFile ? (
                                            <div>
                                                <p className="font-semibold text-primary">
                                                    {uploadedFile.name}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Click to change
                                                </p>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-foreground mb-2">
                                                    Drop your 3D model here, or click to browse
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Supports .STL and .OBJ files
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Reference Photos Upload */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="font-display">
                                        Reference Photos
                                    </CardTitle>
                                    <CardDescription>
                                        Upload or capture photos for reference
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => cameraInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="flex-1"
                                        >
                                            {isUploading ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Camera className="mr-2 h-4 w-4" />
                                            )}
                                            Camera
                                        </Button>
                                        <Button
                                            variant="outline"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="flex-1"
                                        >
                                            <ImageIcon className="mr-2 h-4 w-4" />
                                            Upload Photo
                                        </Button>
                                    </div>
                                    <input
                                        ref={cameraInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />

                                    {referenceImages.length > 0 && (
                                        <div className="grid grid-cols-3 gap-2">
                                            {referenceImages.map((url, idx) => (
                                                <img
                                                    key={idx}
                                                    src={url}
                                                    alt={`Reference ${idx + 1}`}
                                                    className="w-full h-24 object-cover rounded border"
                                                />
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Dimensions & Material */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="font-display">
                                        Dimensions (mm)
                                    </CardTitle>
                                    <CardDescription>
                                        Enter the final desired dimensions for your print
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <MaterialSelector
                                        selected={selectedMaterial}
                                        onSelect={setSelectedMaterial}
                                        estimatedWeight={estimatedWeight}
                                    />

                                    <div>
                                        <Label className="text-lg font-semibold mb-3 block">
                                            Dimensions
                                        </Label>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="length">Length</Label>
                                                <Input
                                                    id="length"
                                                    type="number"
                                                    placeholder="100"
                                                    value={dimensions.length}
                                                    onChange={(e) =>
                                                        setDimensions((d) => ({
                                                            ...d,
                                                            length: e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="width">Width</Label>
                                                <Input
                                                    id="width"
                                                    type="number"
                                                    placeholder="100"
                                                    value={dimensions.width}
                                                    onChange={(e) =>
                                                        setDimensions((d) => ({
                                                            ...d,
                                                            width: e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="height">Height</Label>
                                                <Input
                                                    id="height"
                                                    type="number"
                                                    placeholder="100"
                                                    value={dimensions.height}
                                                    onChange={(e) =>
                                                        setDimensions((d) => ({
                                                            ...d,
                                                            height: e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={handleEstimate}
                                        disabled={isEstimating}
                                        variant="premium"
                                        className="w-full"
                                    >
                                        {isEstimating ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                AI is thinking...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="mr-2 h-4 w-4" />
                                                Get AI Cost Estimate
                                            </>
                                        )}
                                    </Button>

                                    {estimatedCost && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-6 rounded-lg gradient-warm text-primary-foreground text-center"
                                        >
                                            <p className="text-sm mb-2">Estimated Cost</p>
                                            <p className="font-display text-4xl">
                                                {formatINR(estimatedCost)}
                                            </p>
                                            <p className="text-sm mt-2 opacity-90">
                                                Material: {selectedMaterial} • Weight:{" "}
                                                {estimatedWeight}g
                                            </p>
                                            <p className="text-xs mt-1 opacity-75">
                                                Final price will be confirmed at checkout
                                            </p>
                                        </motion.div>
                                    )}

                                    {estimatedCost && (
                                        <Button
                                            onClick={handleAddToCart}
                                            variant="hero"
                                            className="w-full"
                                        >
                                            Add to Cart
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </section>

            <section>
                <AuthModal
                    isOpen={showAuthModal}
                    onClose={() => setShowAuthModal(false)}
                    onSuccess={() => {
                        setIsAuthenticated(true);
                        toast.success(
                            "Your quote request has been submitted! Check your email for the final price."
                        );
                    }}
                />
            </section>
        </div>
    );
};

export default CustomPrinting;
