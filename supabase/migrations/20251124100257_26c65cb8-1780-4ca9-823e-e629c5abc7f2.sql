-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  category TEXT DEFAULT '3d_printer',
  stock INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Public can view products
CREATE POLICY "Anyone can view products"
  ON public.products FOR SELECT
  USING (true);

-- Only admins can manage products
CREATE POLICY "Admins can insert products"
  ON public.products FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update products"
  ON public.products FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete products"
  ON public.products FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  total_amount DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all orders
CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Users can create orders
CREATE POLICY "Users can create orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can update orders
CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- Create reference_images table for uploaded photos
CREATE TABLE public.reference_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.reference_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own images"
  ON public.reference_images FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upload images"
  ON public.reference_images FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create storage bucket for reference images
INSERT INTO storage.buckets (id, name, public)
VALUES ('reference-images', 'reference-images', true)
ON CONFLICT DO NOTHING;

-- Storage policies for reference images
CREATE POLICY "Users can upload their own reference images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'reference-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view reference images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reference-images');

-- Function to update product updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();