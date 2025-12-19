import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { STLViewer } from "@/components/STLViewer";
import { useDropzone } from "react-dropzone";
import { Upload, Check, Loader2, FileBox, Trash2, Info, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { apiService } from "@/services/api.service";
import { formatINR } from "@/lib/currency";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// --- CONSTANTS ---
const PRINTER_QUALITIES = [
    { id: "0.2-std", name: "0.2 mm Standard (Good Value)", multiplier: 1.0 },
    { id: "0.1-high", name: "0.1 mm High Detail (Smooth)", multiplier: 1.6 },
    { id: "0.05-ultra", name: "0.05 mm Ultra Detail", multiplier: 2.5 },
];

const MATERIALS = [
    { id: "pla", name: "PLA (Standard)", desc: "Easy to print, good for visuals", colors: ["White", "Black", "Grey", "Blue", "Red", "Green", "Yellow", "Orange"] },
    { id: "abs", name: "ABS (Durable)", desc: "Heat resistant, strong", colors: ["White", "Black", "Grey"] },
    { id: "petg", name: "PETG (Tough)", desc: "Flexible, water resistant", colors: ["Translucent", "Black", "White"] },
    { id: "nylon", name: "Nylon (Industrial)", desc: "High wear resistance", colors: ["Natural"] },
];

const INFILLS = [
    { val: 20, label: "20% (Standard)" },
    { val: 50, label: "50% (Strong)" },
    { val: 100, label: "100% (Solid)" },
];

export default function CustomPrinting() {
    // --- STATE ---
    const [file, setFile] = useState<File | null>(null);
    const [unit, setUnit] = useState<"mm" | "inch">("mm");

    // Stats
    const [modelStats, setModelStats] = useState({
        volume: 0,
        dimensions: { x: 0, y: 0, z: 0 },
        triangles: 0
    });

    // Configuration
    const [quality, setQuality] = useState(PRINTER_QUALITIES[0]);
    const [material, setMaterial] = useState(MATERIALS[0]);
    const [color, setColor] = useState(MATERIALS[0].colors[0]);
    const [infill, setInfill] = useState(20);
    const [scalePercent, setScalePercent] = useState(100);

    // Rotation State
    const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });

    // Form
    const [contact, setContact] = useState({ email: "", phone: "", notes: "" });
    const [isSending, setIsSending] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // --- CALCULATIONS ---
    const getFinalDimensions = () => {
        const factor = (unit === "inch" ? 25.4 : 1) * (scalePercent / 100);
        return {
            x: (modelStats.dimensions.x * factor).toFixed(1),
            y: (modelStats.dimensions.y * factor).toFixed(1),
            z: (modelStats.dimensions.z * factor).toFixed(1),
        };
    };

    const calculatePrice = () => {
        if (!modelStats.volume) return 0;
        const scaleFactor = scalePercent / 100;

        // Volume calc adjustment
        const vol = modelStats.volume * Math.pow(scaleFactor, 3) * (unit === "inch" ? 16.387 : 1);

        const baseRate = 12; // INR per cm3
        const cost = Math.round(vol * baseRate * quality.multiplier * (1 + infill/200));
        return Math.max(cost, 199); // Minimum order price
    };

    // --- HANDLERS ---
    const onDrop = useCallback((files: File[]) => {
        if(files.length) {
            setFile(files[0]);
            setRotation({ x: 0, y: 0, z: 0 }); // Reset rotation on new file
            setScalePercent(100);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {'model/stl':['.stl'], 'model/obj':['.obj']},
        maxFiles: 1,
        disabled: !!file
    });

    const handleSendQuote = async () => {
        if (!contact.email || !contact.phone) {
            toast.error("Please provide contact details.");
            return;
        }
        setIsSending(true);

        const formData = new FormData();
        if (file) formData.append("file", file);
        formData.append("email", contact.email);
        formData.append("phone", contact.phone);
        formData.append("notes", contact.notes);

        // Prepare specs with Polygon Count included
        const specs = JSON.stringify({
            quality: quality.name,
            material: `${material.name} - ${color}`,
            infill: `${infill}%`,
            originalStats: modelStats,
            polygonCount: modelStats.triangles, // <--- Sent to Backend Here
            printDimensions: getFinalDimensions(),
            scale: `${scalePercent}%`,
            rotation: `X:${rotation.x} Y:${rotation.y} Z:${rotation.z}`,
            estimatedPrice: calculatePrice(),
        });
        formData.append("specifications", specs);

        try {
            await apiService.sendQuoteRequest(formData);
            toast.success("Quote request sent successfully!");
            setIsSuccess(true);
        } catch (error) {
            console.error(error);
            toast.error("Failed to send quote. Please try again.");
        } finally {
            setIsSending(false);
        }
    };

    if (isSuccess) return (
        <div className="min-h-screen pt-24 pb-12 bg-gray-50 flex items-center justify-center">
            <Card className="max-w-md w-full text-center p-8">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Quote Requested!</h2>
                <p className="text-muted-foreground mb-6">We have received your file. An engineer will verify the printability and email you the payment link at <b>{contact.email}</b>.</p>
                <Button onClick={() => window.location.reload()} className="w-full">Upload Another File</Button>
            </Card>
        </div>
    );

    const dims = getFinalDimensions();

    return (
        <div className="min-h-screen pt-24 pb-12 bg-gray-50/50">
            <div className="container mx-auto px-4 max-w-7xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">3D Printing Service</h1>
                    <p className="text-muted-foreground mt-1">Instant quotes for FDM & SLA printing.</p>
                </div>

                <div className="grid lg:grid-cols-12 gap-8">

                    {/* --- LEFT COLUMN: VIEWER & STATS --- */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* VIEWER CARD */}
                        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                            <div className="h-[500px] w-full relative bg-gray-100">
                                <STLViewer
                                    file={file}
                                    scale={scalePercent / 100}
                                    rotation={rotation}
                                    onStatsCalculated={setModelStats}
                                />

                                {/* Upload Overlay if no file */}
                                {!file && (
                                    <div {...getRootProps()} className={`absolute inset-0 z-10 flex flex-col items-center justify-center transition-colors ${isDragActive ? 'bg-blue-50/90' : 'bg-white/80'}`}>
                                        <input {...getInputProps()} />
                                        <div className="w-64 h-48 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center bg-white shadow-sm cursor-pointer hover:border-primary hover:bg-blue-50/30 transition-all">
                                            <Upload className="w-10 h-10 text-primary mb-4" />
                                            <p className="font-semibold text-gray-900">Upload 3D Model</p>
                                            <p className="text-xs text-muted-foreground mt-1">STL, OBJ (Max 50MB)</p>
                                        </div>
                                    </div>
                                )}

                                {/* File Info Overlay */}
                                {file && (
                                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur shadow-sm p-3 rounded-lg border flex items-center gap-3 z-10">
                                        <div className="p-2 bg-blue-100 rounded text-blue-600">
                                            <FileBox className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold max-w-[150px] truncate">{file.name}</p>
                                            <p className="text-xs text-muted-foreground">{(file.size / (1024*1024)).toFixed(2)} MB</p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 ml-2" onClick={() => setFile(null)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* STATS TABLE */}
                        {file && (
                            <Card>
                                <CardHeader className="py-4 border-b bg-gray-50/50">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Info className="w-4 h-4" /> Model Analysis
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <table className="w-full text-sm text-left">
                                        <tbody>
                                        <tr className="border-b">
                                            <td className="p-3 font-medium text-muted-foreground w-1/3">Dimensions (L x W x H)</td>
                                            <td className="p-3 font-mono">{dims.x} x {dims.y} x {dims.z} {unit === 'inch' ? 'in' : 'cm'}</td>
                                        </tr>
                                        <tr className="border-b">
                                            <td className="p-3 font-medium text-muted-foreground">Material Volume</td>
                                            <td className="p-3 font-mono">{modelStats.volume.toFixed(2)} cm³</td>
                                        </tr>
                                        <tr className="border-b">
                                            <td className="p-3 font-medium text-muted-foreground">Triangle Count</td>
                                            <td className="p-3 font-mono">{modelStats.triangles.toLocaleString()} polygons</td>
                                        </tr>
                                        </tbody>
                                    </table>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* --- RIGHT COLUMN: CONFIGURATION --- */}
                    <div className="lg:col-span-4 space-y-4">
                        <Card className="h-full border-t-4 border-t-primary">
                            <CardHeader>
                                <CardTitle>Configuration</CardTitle>
                                <CardDescription>Customize your print settings</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">

                                {/* 1. Unit & Scale & Rotation */}
                                <div className="space-y-3">
                                    <Label>File Units</Label>
                                    <Tabs value={unit} onValueChange={(v) => setUnit(v as any)} className="w-full">
                                        <TabsList className="grid w-full grid-cols-2">
                                            <TabsTrigger value="mm">Millimeters (mm)</TabsTrigger>
                                            <TabsTrigger value="inch">Inches</TabsTrigger>
                                        </TabsList>
                                    </Tabs>

                                    <div className="pt-2">
                                        <div className="flex justify-between mb-2">
                                            <Label>Scale Model</Label>
                                            <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{scalePercent}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="10"
                                            max="200"
                                            value={scalePercent}
                                            onChange={(e) => setScalePercent(Number(e.target.value))}
                                            className="w-full accent-primary h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>

                                    {/* ROTATION INPUTS */}
                                    {file && (
                                        <div className="pt-2 border-t mt-2">
                                            <div className="flex items-center gap-2 mb-2">
                                                <RotateCw className="w-4 h-4 text-muted-foreground" />
                                                <Label>Orientation (Degrees)</Label>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="space-y-1">
                                                    <span className="text-xs text-muted-foreground text-center block">X</span>
                                                    <Input
                                                        type="number"
                                                        className="h-8 text-center px-1"
                                                        value={rotation.x}
                                                        onChange={(e) => setRotation({...rotation, x: Number(e.target.value)})}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-xs text-muted-foreground text-center block">Y</span>
                                                    <Input
                                                        type="number"
                                                        className="h-8 text-center px-1"
                                                        value={rotation.y}
                                                        onChange={(e) => setRotation({...rotation, y: Number(e.target.value)})}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-xs text-muted-foreground text-center block">Z</span>
                                                    <Input
                                                        type="number"
                                                        className="h-8 text-center px-1"
                                                        value={rotation.z}
                                                        onChange={(e) => setRotation({...rotation, z: Number(e.target.value)})}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 2. Material & Color */}
                                <div className="space-y-3">
                                    <Label>Material</Label>
                                    <select
                                        className="w-full p-2 border rounded-md text-sm bg-background"
                                        onChange={(e) => {
                                            const m = MATERIALS.find(x => x.id === e.target.value);
                                            if(m) { setMaterial(m); setColor(m.colors[0]); }
                                        }}
                                    >
                                        {MATERIALS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                    <p className="text-xs text-muted-foreground">{material.desc}</p>
                                </div>

                                <div className="space-y-3">
                                    <Label>Color</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {material.colors.map(c => (
                                            <button
                                                key={c}
                                                onClick={() => setColor(c)}
                                                className={`w-8 h-8 rounded-full border-2 shadow-sm transition-all ${color === c ? 'border-primary scale-110 ring-2 ring-primary/20' : 'border-transparent hover:scale-105'}`}
                                                style={{ backgroundColor: c.toLowerCase().replace(' ', '') }}
                                                title={c}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-xs text-muted-foreground block text-right">{color}</span>
                                </div>

                                {/* 3. Quality & Infill */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Quality</Label>
                                        <select
                                            className="w-full p-2 border rounded-md text-sm bg-background"
                                            onChange={(e) => setQuality(PRINTER_QUALITIES.find(q => q.id === e.target.value) || quality)}
                                        >
                                            {PRINTER_QUALITIES.map(q => <option key={q.id} value={q.id}>{q.id.split('-')[0]} mm</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Infill</Label>
                                        <select
                                            className="w-full p-2 border rounded-md text-sm bg-background"
                                            value={infill}
                                            onChange={(e) => setInfill(Number(e.target.value))}
                                        >
                                            {INFILLS.map(i => <option key={i.val} value={i.val}>{i.label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* 4. Quote & Action */}
                                <div className="pt-4 border-t space-y-4">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-sm font-medium text-muted-foreground">Estimated Cost</span>
                                        <span className="text-3xl font-bold text-primary">{formatINR(calculatePrice())}</span>
                                    </div>

                                    {!file ? (
                                        <Button disabled className="w-full" size="lg">Upload File to Quote</Button>
                                    ) : (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
                                            <Input placeholder="Email Address *" value={contact.email} onChange={e => setContact({...contact, email: e.target.value})} />
                                            <Input placeholder="Phone Number *" value={contact.phone} onChange={e => setContact({...contact, phone: e.target.value})} />
                                            <Button className="w-full" size="lg" onClick={handleSendQuote} disabled={isSending}>
                                                {isSending ? <Loader2 className="animate-spin mr-2"/> : null}
                                                Request Official Quote
                                            </Button>
                                        </div>
                                    )}
                                </div>

                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}