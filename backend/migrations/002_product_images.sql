-- Create product_images table
CREATE TABLE product_images (
                                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                                image_url TEXT,
                                image_data BYTEA,
                                display_order INTEGER NOT NULL DEFAULT 0,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_product_images_order ON product_images(product_id, display_order);

-- Migrate existing product images
INSERT INTO product_images (product_id, image_url, image_data, display_order)
SELECT id, image_url, image_data, 0 FROM products WHERE image_url IS NOT NULL OR image_data IS NOT NULL;
