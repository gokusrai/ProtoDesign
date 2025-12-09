-- Enable uuid-ossp extension for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing objects if they exist (for fresh setup)
DROP TABLE IF EXISTS product_likes CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS reference_images CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS carts CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS app_role;

-- Create enum for user roles
CREATE TYPE app_role AS ENUM ('admin', 'user');

-- Create users table
CREATE TABLE users (
                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                       email VARCHAR(255) UNIQUE NOT NULL,
                       password_hash VARCHAR(255) NOT NULL,
                       full_name VARCHAR(255),
                       created_at TIMESTAMP DEFAULT now(),
                       updated_at TIMESTAMP DEFAULT now()
);

-- Create user_roles table
CREATE TABLE user_roles (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            role app_role NOT NULL DEFAULT 'user',
                            created_at TIMESTAMP DEFAULT now(),
                            UNIQUE(user_id, role)
);

-- Create products table WITH LIKES_COUNT ✅
CREATE TABLE products (
                          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                          name TEXT NOT NULL,
                          description TEXT,
                          price DECIMAL(10,2) NOT NULL,
                          image_url TEXT,
                          image_data BYTEA,
                          category TEXT DEFAULT '3d_printer',
                          stock INTEGER DEFAULT 0,
                          likes_count INTEGER DEFAULT 0,  -- ✅ NEW: Likes counter
                          created_at TIMESTAMP DEFAULT now(),
                          updated_at TIMESTAMP DEFAULT now()
);

-- Create product_images table (for multi-images)
CREATE TABLE product_images (
                                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                                image_url TEXT,
                                image_data BYTEA,
                                display_order INTEGER DEFAULT 0,
                                created_at TIMESTAMP DEFAULT now(),
                                updated_at TIMESTAMP DEFAULT now()
);

-- Create product_likes table (for likes feature) ✅
CREATE TABLE product_likes (
                               id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                               user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                               product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                               created_at TIMESTAMP DEFAULT now(),
                               UNIQUE(user_id, product_id)
);

-- Create carts table
CREATE TABLE carts (
                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                       user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                       created_at TIMESTAMP DEFAULT now(),
                       updated_at TIMESTAMP DEFAULT now(),
                       UNIQUE(user_id)
);

-- Create cart_items table
CREATE TABLE cart_items (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
                            product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
                            quantity INTEGER NOT NULL DEFAULT 1,
                            created_at TIMESTAMP DEFAULT now(),
                            updated_at TIMESTAMP DEFAULT now(),
                            UNIQUE(cart_id, product_id)
);

-- Create orders table
CREATE TABLE orders (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
                        quantity INTEGER NOT NULL DEFAULT 1,
                        total_amount DECIMAL(10,2) NOT NULL,
                        status TEXT DEFAULT 'pending',
                        shipping_address JSONB,
                        payment_gateway TEXT,
                        created_at TIMESTAMP DEFAULT now(),
                        updated_at TIMESTAMP DEFAULT now()
);

-- Create reference_images table
CREATE TABLE reference_images (
                                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                                  file_name TEXT NOT NULL,
                                  file_url TEXT NOT NULL,
                                  created_at TIMESTAMP DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_likes ON products(likes_count);  -- ✅ NEW
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_product_images_product ON product_images(product_id);  -- ✅ NEW
CREATE INDEX idx_product_likes_user_product ON product_likes(user_id, product_id);  -- ✅ NEW
CREATE INDEX idx_reference_images_user_id ON reference_images(user_id);
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);

-- Create trigger function to update 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers to ALL tables with updated_at
CREATE TRIGGER trigger_update_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_products_updated_at
    BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_product_images_updated_at
    BEFORE UPDATE ON product_images FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_product_likes_updated_at
    BEFORE UPDATE ON product_likes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_orders_updated_at
    BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_carts_updated_at
    BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_cart_items_updated_at
    BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 🔥 RLS DISABLED BY DEFAULT (no permission errors!)
-- Add these later for production if needed:
-- ALTER TABLE product_likes ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY ... (policies from earlier)
