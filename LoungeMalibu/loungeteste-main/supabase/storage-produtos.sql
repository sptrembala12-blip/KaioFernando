-- Rode no SQL Editor uma vez (fotos dos produtos).

insert into storage.buckets (id, name, public)
values ('produtos', 'produtos', true)
on conflict (id) do nothing;

create policy "Leitura pública fotos produtos"
on storage.objects for select
using (bucket_id = 'produtos');

create policy "Admin envia fotos produtos"
on storage.objects for insert to authenticated
with check (bucket_id = 'produtos' and public.has_role(auth.uid(), 'admin'));

create policy "Admin atualiza fotos produtos"
on storage.objects for update to authenticated
using (bucket_id = 'produtos' and public.has_role(auth.uid(), 'admin'));

create policy "Admin remove fotos produtos"
on storage.objects for delete to authenticated
using (bucket_id = 'produtos' and public.has_role(auth.uid(), 'admin'));
