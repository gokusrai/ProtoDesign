// src/components/ProductPreviewCarousel.tsx - FIXED VERSION
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ProductImage {
    id: string;
    image_url?: string;
    image_data?: string;
    display_order: number;
}

interface ProductPreviewCarouselProps {
    images: ProductImage[];
    productName: string;
    thumbnail?: string;
}

export default function ProductPreviewCarousel({
                                                   images,
                                                   productName,
                                                   thumbnail,
                                               }: ProductPreviewCarouselProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    // ✅ FIX: Smart deduplication - skip thumbnail if it's already first image
    const sortedImages = images.sort((a, b) => a.display_order - b.display_order);

    let allImages: ProductImage[] = sortedImages;

    // Only add thumbnail if it's NOT already the first image
    if (thumbnail && sortedImages.length === 0) {
        allImages = [{ id: 'thumb', image_url: thumbnail, image_data: undefined, display_order: 0 }];
    }

    // Filter valid images only
    allImages = allImages.filter((img) => img.image_url || img.image_data);

    if (allImages.length === 0) {
        return (
            <div className="w-28 h-28 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                No image
            </div>
        );
    }

    const currentImage = allImages[currentIndex];
    const displayUrl = currentImage.image_url || currentImage.image_data || '';

    const goNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % allImages.length);
    };

    const goPrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
    };

    return (
        <div className="relative w-28 h-28 group">
            {/* Main Image */}
            <img
                src={displayUrl}
                alt={`${productName} - Image ${currentIndex + 1}`}
                className="w-full h-full object-cover rounded border"
                onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-image.jpg';
                }}
            />

            {/* Counter Badge */}
            {allImages.length > 1 && (
                <Badge className="absolute top-1 left-1 bg-primary text-white text-xs">
                    {currentIndex + 1}/{allImages.length}
                </Badge>
            )}

            {/* Navigation Arrows (Show on Hover) */}
            {allImages.length > 1 && (
                <>
                    <button
                        onClick={goPrev}
                        className="absolute left-0 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-1 rounded-r opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Previous image"
                    >
                        <ChevronLeft className="h-3 w-3" />
                    </button>
                    <button
                        onClick={goNext}
                        className="absolute right-0 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-1 rounded-l opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Next image"
                    >
                        <ChevronRight className="h-3 w-3" />
                    </button>
                </>
            )}

            {/* Thumbnail Dots */}
            {allImages.length > 1 && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                    {allImages.slice(0, 7).map((_, idx) => (
                        <button
                            key={idx}
                            onClick={(e) => {
                                e.stopPropagation();
                                setCurrentIndex(idx);
                            }}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${
                                idx === currentIndex ? 'bg-white w-2' : 'bg-white/50 hover:bg-white/75'
                            }`}
                            aria-label={`Go to image ${idx + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
