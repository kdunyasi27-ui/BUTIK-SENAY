
-- =========================================
-- BUTİK ŞENAY - GÜVENLİ VERİTABANI
-- =========================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================
-- 1. YÖNETİCİ KONTROLÜ
-- =========================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'customer'
    CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_store_admin
ON public.profiles(role)
WHERE role = 'admin';

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.create_customer_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles(id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_profile_trigger ON auth.users;

CREATE TRIGGER customer_profile_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_customer_profile();

-- =========================================
-- 2. ÜRÜNLER
-- =========================================

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  image TEXT DEFAULT '',
  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================
-- 3. SİPARİŞLER
-- =========================================

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Yeni',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);

-- =========================================
-- 4. MESAJLAR
-- =========================================

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  contact TEXT DEFAULT '',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================
-- 5. ÜRÜN YORUMLARI
-- =========================================

CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  approved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================
-- 6. ROW LEVEL SECURITY
-- =========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- PROFİLLER

DROP POLICY IF EXISTS "Profile owner or admin reads"
ON public.profiles;

CREATE POLICY "Profile owner or admin reads"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_admin());

-- ÜRÜNLER

DROP POLICY IF EXISTS "Everyone sees active products"
ON public.products;

CREATE POLICY "Everyone sees active products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (active = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Only admin manages products"
ON public.products;

CREATE POLICY "Only admin manages products"
ON public.products
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- SİPARİŞLER

DROP POLICY IF EXISTS "Admin sees orders"
ON public.orders;

CREATE POLICY "Admin sees orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admin updates orders"
ON public.orders;

CREATE POLICY "Admin updates orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- SİPARİŞ ÜRÜNLERİ

DROP POLICY IF EXISTS "Admin reads order items"
ON public.order_items;

CREATE POLICY "Admin reads order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (public.is_admin());

-- MESAJLAR

DROP POLICY IF EXISTS "Admin reads messages"
ON public.messages;

CREATE POLICY "Admin reads messages"
ON public.messages
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Anyone can send messages"
ON public.messages;

CREATE POLICY "Anyone can send messages"
ON public.messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(name)) BETWEEN 1 AND 100
  AND length(trim(message)) BETWEEN 1 AND 3000
  AND length(contact) <= 200
);

DROP POLICY IF EXISTS "Admin deletes messages"
ON public.messages;

CREATE POLICY "Admin deletes messages"
ON public.messages
FOR DELETE
TO authenticated
USING (public.is_admin());

-- YORUMLAR

DROP POLICY IF EXISTS "Everyone sees approved reviews"
ON public.reviews;

CREATE POLICY "Everyone sees approved reviews"
ON public.reviews
FOR SELECT
TO anon, authenticated
USING (approved = TRUE OR public.is_admin());

DROP POLICY IF EXISTS "Customers submit reviews"
ON public.reviews;

CREATE POLICY "Customers submit reviews"
ON public.reviews
FOR INSERT
TO anon, authenticated
WITH CHECK (
  approved = FALSE
  AND length(trim(customer_name)) BETWEEN 1 AND 100
  AND length(trim(comment)) BETWEEN 1 AND 2000
  AND rating BETWEEN 1 AND 5
);

DROP POLICY IF EXISTS "Admin manages reviews"
ON public.reviews;

CREATE POLICY "Admin manages reviews"
ON public.reviews
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =========================================
-- 7. GÜVENLİ SİPARİŞ FONKSİYONU
-- =========================================

CREATE OR REPLACE FUNCTION public.place_order(
  p_name TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id UUID;
  v_total NUMERIC(10,2) := 0;
  v_item JSONB;
  v_product public.products%ROWTYPE;
  v_quantity INTEGER;
BEGIN
  IF length(trim(p_name)) NOT BETWEEN 2 AND 100
     OR length(trim(p_phone)) NOT BETWEEN 5 AND 30
     OR length(trim(p_address)) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'Sipariş bilgileri geçersiz.';
  END IF;

  IF jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0
     OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Sepet bilgileri geçersiz.';
  END IF;

  -- Ürünleri kilitle ve stok/fiyatı sunucuda doğrula.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::INTEGER;

    IF v_quantity <= 0 OR v_quantity > 100 THEN
      RAISE EXCEPTION 'Ürün adedi geçersiz.';
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::UUID
      AND active = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ürün bulunamadı veya satışta değil.';
    END IF;

    IF v_product.stock < v_quantity THEN
      RAISE EXCEPTION 'Yetersiz stok: %', v_product.name;
    END IF;

    v_total := v_total + (v_product.price * v_quantity);
  END LOOP;

  INSERT INTO public.orders(
    user_id, customer_name, phone, address, total
  )
  VALUES (
    auth.uid(), trim(p_name), trim(p_phone),
    trim(p_address), v_total
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::INTEGER;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::UUID
    FOR UPDATE;

    INSERT INTO public.order_items(
      order_id, product_id, product_name,
      unit_price, quantity
    )
    VALUES (
      v_order_id, v_product.id, v_product.name,
      v_product.price, v_quantity
    );

    UPDATE public.products
    SET stock = stock - v_quantity
    WHERE id = v_product.id;
  END LOOP;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.place_order(TEXT,TEXT,TEXT,JSONB)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.place_order(TEXT,TEXT,TEXT,JSONB)
TO anon, authenticated;

-- =========================================
-- 8. FOTOĞRAF DEPOSU
-- =========================================

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  TRUE,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

DROP POLICY IF EXISTS "Public reads product images"
ON storage.objects;

CREATE POLICY "Public reads product images"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admin uploads product images"
ON storage.objects;

CREATE POLICY "Admin uploads product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_admin()
);

DROP POLICY IF EXISTS "Admin updates product images"
ON storage.objects;

CREATE POLICY "Admin updates product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_admin()
)
WITH CHECK (
  bucket_id = 'product-images'
  AND public.is_admin()
);

DROP POLICY IF EXISTS "Admin deletes product images"
ON storage.objects;

CREATE POLICY "Admin deletes product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.is_admin()
);

-- =========================================
-- 9. TABLO İZİNLERİ
-- =========================================

GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;

GRANT SELECT ON public.profiles TO authenticated;

GRANT SELECT, UPDATE ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.messages TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO anon, authenticated;

-- =========================================
-- KURULUM SONU
-- =========================================
