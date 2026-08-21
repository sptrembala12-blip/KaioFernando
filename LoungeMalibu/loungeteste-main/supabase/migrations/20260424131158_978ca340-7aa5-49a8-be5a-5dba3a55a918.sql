
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP POLICY "Pedidos: criação pública" ON public.pedidos;
CREATE POLICY "Pedidos: criação para mesa ativa" ON public.pedidos
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.mesas WHERE id = mesa_id AND ativa = true)
    AND valor_total_centavos > 0
    AND jsonb_array_length(itens) > 0
  );
