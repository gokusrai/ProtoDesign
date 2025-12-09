// src/components/ProductImageCarousel.tsx
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductImage {
    id: string;
    image_url?: string;
    image_data?: string;
    display_order: number;
}

interface ProductImageCarouselProps {
    images: ProductImage[];
    productName: string;
    baseWidth?: number;
}

const ProductImageCarousel: React.FC<ProductImageCarouselProps> = ({
                                                                       images,
                                                                       productName,
                                                                       baseWidth = 300,
                                                                   }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Fallback image if no images
    const validImages = images.filter(img =>
        img.image_url || img.image_data
    );

    if (validImages.length === 0) {
        return (
            <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground">No images</span>
            </div>
        );
    }

    // Get image URL (handle both image_url and image_data)
    const getImageUrl = (img: ProductImage): string => {
        if (img.image_url) return img.image_url;
        if (img.image_data) return img.image_data;
        return '/placeholder-image.jpg';
    };

    const nextSlide = () => {
        setCurrentIndex((prev) => (prev + 1) % validImages.length);
    };

    const prevSlide = () => {
        setCurrentIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
    };

    // Auto-advance every 3 seconds
    useEffect(() => {
        const interval = setInterval(nextSlide, 3000);
        return () => clearInterval(interval);
    }, [validImages.length]);

    return (
        <div className="relative w-full h-64 group">
            {/* Main Image */}
            <img
                src={getImageUrl(validImages[currentIndex])}
                alt={`${productName} - Image ${currentIndex + 1}`}
                className="w-full h-full object-cover rounded-lg shadow-md"
                onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-image.jpg';
                }}
            />

            {/* Navigation Arrows */}
            <button
                onClick={prevSlide}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
                aria-label="Previous image"
            >
                <ChevronLeft className="h-5 w-5" />
            </button>
            <button
                onClick={nextSlide}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-2 rounded-full transition-all opacity-0 group-hover:opacity-100"
                aria-label="Next image"
            >
                <ChevronRight className="h-5 w-5" />
            </button>

            {/* Image Counter */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                {currentIndex + 1} / {validImages.length}
            </div>

            {/* Thumbnail Dots */}
            {validImages.length > 1 && (
                <div className="absolute bottom-3 left-3 flex gap-2">
                    {validImages.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`w-2 h-2 rounded-full transition-all ${
                                index === currentIndex ? 'bg-white w-3' : 'bg-white/50 hover:bg-white/75'
                            }`}
                            aria-label={`Go to image ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProductImageCarousel;
