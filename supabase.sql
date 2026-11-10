
-- =========================================
-- BUTİK ŞENAY - VERİTABANI
-- =========================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. MÜŞTERİ VE YÖNETİCİ PROFİLLERİ

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'customer'
      CHECK (role IN ('customer', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Yalnızca bir admin hesabı olabilir.
CREATE UNIQUE INDEX IF NOT EXISTS one_store_admin
ON public.profiles (role)
WHERE role = 'admin';


-- Yeni üyelere otomatik müşteri profili aç.
CREATE OR REPLACE FUNCTION public.create_customer_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, role)
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


-- 2. ADMIN KONTROLÜ

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


-- 3. ÜRÜNLER

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT DEFAULT '',
    image TEXT DEFAULT '',
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 4. SİPARİŞLER

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Yeni',
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 5. SİPARİŞ ÜRÜNLERİ

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);


-- 6. MÜŞTERİ MESAJLARI

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    contact TEXT DEFAULT '',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 7. YORUMLAR

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NOT NULL,
    approved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 8. GÜVENLİK POLİTİKALARI

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;


-- PROFİLLER

CREATE POLICY "Profile owner or admin reads"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid() OR public.is_admin());


-- ÜRÜNLER

CREATE POLICY "Everyone sees active products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (active = TRUE OR public.is_admin());

CREATE POLICY "Only admin manages products"
ON public.products
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- SİPARİŞLER

CREATE POLICY "Admin sees orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admin updates orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- SİPARİŞ ÜRÜNLERİ

CREATE POLICY "Admin reads order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (public.is_admin());


-- MESAJLAR

CREATE POLICY "Admin reads messages"
ON public.messages
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admin deletes messages"
ON public.messages
FOR DELETE
TO authenticated
USING (public.is_admin());


-- YORUMLAR

CREATE POLICY "Everyone sees approved reviews"
ON public.reviews
FOR SELECT
TO anon, authenticated
USING (approved = TRUE OR public.is_admin());

CREATE POLICY "Admin manages reviews"
ON public.reviews
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());


-- =========================================
-- KURULUM SONU
-- =========================================

-- Kendi hesabını oluşturduktan sonra
-- Supabase Authentication > Users bölümünden
-- kendi UUID numaranı bul.
--
-- Aşağıdaki komutu yalnızca kendi hesabın için çalıştır:
--
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE id = 'KENDI-UUID-NUMARAN';
--
-- İkinci bir admin oluşturulamaz.
