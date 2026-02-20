import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import heroImage from "@/assets/hero-3d-printing.jpg";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

// ✅ SILICON VALLEY INJECTION
import { BlurText } from "./animations/BlurText"; 

gsap.registerPlugin(ScrollTrigger);

export const Hero = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!heroRef.current || !imageRef.current || !contentRef.current) return;

    gsap.to(imageRef.current, {
      y: 100,
      ease: "none",
      scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: 1 },
    });

    gsap.to(contentRef.current, {
      y: 50,
      opacity: 0.5,
      ease: "none",
      scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: 1 },
    });
  }, []);

  return (
    <div ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden">
      <div ref={imageRef} className="absolute inset-0 w-full h-[120%] -top-[10%]">
        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent z-10" />
        <img
          src={heroImage}
          alt="Premium 3D Printing"
          className="w-full h-full object-cover"
          loading="eager"
          fetchPriority="high"
          width="1920" 
          height="1080"
        />
      </div>

      <div ref={contentRef} className="container mx-auto px-4 relative z-20 pt-20">
        <div className="max-w-3xl">
          
          {/* ✅ DYNAMIC TYPOGRAPHY */}
          <div className="font-display text-6xl md:text-7xl lg:text-8xl mb-6 leading-tight">
            <BlurText text="High-Fidelity" />
            <BlurText text="in Every Shade" />
          </div>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-2xl"
          >
            Premium 3D printing services with cutting-edge technology.
            Shop high-end printers or get instant quotes for custom prints.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="flex flex-col sm:flex-row gap-4"
          >
            {/* ✅ MAGNETIC BUTTON PHYSICS */}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link to="/custom">
                <Button variant="hero" size="lg" className="group w-full sm:w-auto">
                  Get Custom Quote
                  <ArrowRight className="transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </motion.div>

            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link to="/shop">
                <Button variant="outline" size="lg" className="shadow-soft w-full sm:w-auto">
                  Shop Printers
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10" />
    </div>
  );
};