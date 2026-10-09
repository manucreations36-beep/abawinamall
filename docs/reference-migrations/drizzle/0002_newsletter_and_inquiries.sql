CREATE TABLE public.newsletter_subscribers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE, source text, created_at timestamptz NOT NULL DEFAULT now());
GRANT INSERT ON public.newsletter_subscribers TO anon, authenticated;
GRANT SELECT, DELETE ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "newsletter insert" ON public.newsletter_subscribers FOR INSERT TO anon, authenticated WITH CHECK (length(email) BETWEEN 5 AND 255 AND email LIKE '%@%');
CREATE POLICY "newsletter admin read" ON public.newsletter_subscribers FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "newsletter admin delete" ON public.newsletter_subscribers FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.inquiries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, phone text NOT NULL, email text, subject text, message text NOT NULL, status text NOT NULL DEFAULT 'new', created_at timestamptz NOT NULL DEFAULT now());
GRANT INSERT ON public.inquiries TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.inquiries TO authenticated;
GRANT ALL ON public.inquiries TO service_role;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inquiries insert" ON public.inquiries FOR INSERT TO anon, authenticated WITH CHECK (status = 'new' AND length(message) BETWEEN 2 AND 2000 AND length(name) BETWEEN 1 AND 100);
CREATE POLICY "inquiries admin read" ON public.inquiries FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "inquiries admin update" ON public.inquiries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "inquiries admin delete" ON public.inquiries FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));