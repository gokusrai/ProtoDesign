-- 009_add_payment_status.sql
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';

-- Optional: Update existing orders to have a status
UPDATE orders SET payment_status = 'pending' WHERE payment_status IS NULL;