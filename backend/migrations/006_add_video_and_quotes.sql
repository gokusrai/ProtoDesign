-- 1. Add video_url to products table
ALTER TABLE products ADD COLUMN video_url TEXT;

-- 2. Create Quotes table for the Quote Manager
CREATE TABLE quotes (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Can be null for guest quotes

    -- Contact Info
                        email VARCHAR(255) NOT NULL,
                        phone VARCHAR(50),

    -- File Info (Stored in Backblaze)
                        file_url TEXT NOT NULL,
                        file_name TEXT NOT NULL,

    -- Tech Specs (JSON)
    -- Contains: material, quality, infill, stats (volume, dims), color, etc.
                        specifications JSONB NOT NULL,

    -- Status Tracking
                        status VARCHAR(50) DEFAULT 'pending', -- pending, reviewed, paid, rejected
                        estimated_price DECIMAL(10,2),
                        admin_notes TEXT,

                        created_at TIMESTAMP DEFAULT now(),
                        updated_at TIMESTAMP DEFAULT now()
);

-- ---------------------------------------------------------
-- ✅ CORRECT PERMISSIONS FOR 'protodesign_user'
-- ---------------------------------------------------------

-- 1. Grant Full Access to the 'quotes' table
GRANT ALL PRIVILEGES ON TABLE quotes TO protodesign_user;

-- 2. Grant Access to the sequence (required for the ID to auto-generate)
-- Note: UUIDs usually don't use sequences, but if any future serial ID is added, this prevents errors.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO protodesign_user;

-- Index for faster admin lookup
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_email ON quotes(email);
