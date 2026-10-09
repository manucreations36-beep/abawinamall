ALTER POLICY "products public read" ON public.products TO authenticated;
CREATE POLICY "products anonymous published read" ON public.products FOR SELECT TO anon USING (is_published);
ALTER POLICY "campaigns public read live" ON public.campaigns TO authenticated;
CREATE POLICY "campaigns anonymous live read" ON public.campaigns FOR SELECT TO anon USING (status = 'live' AND now() >= starts_at AND now() <= ends_at);