import { motion } from "framer-motion";
import { Palette, Zap, Shield, Users } from "lucide-react";

const features = [
  {
    icon: Palette,
    title: "Skin-Tone Precision",
    description: "Advanced color matching technology for accurate representation of all skin tones.",
  },
  {
    icon: Zap,
    title: "Instant AI Quotes",
    description: "Get accurate cost estimates in seconds using our AI-powered pricing engine.",
  },
  {
    icon: Shield,
    title: "Premium Quality",
    description: "High-end printers and materials ensuring exceptional detail and durability.",
  },
  {
    icon: Users,
    title: "Inclusive Design",
    description: "Committed to representing diversity through our specialized printing services.",
  },
];

export const Features = () => {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-display text-4xl md:text-5xl mb-4">
            Why Choose ProtoDesign?
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            We combine cutting-edge technology with an inclusive approach to 3D printing.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="bg-card p-6 rounded-lg shadow-soft hover:shadow-glow transition-smooth"
            >
              <feature.icon className="w-8 h-8 text-primary mb-4" />
              <h3 className="font-display text-xl mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
