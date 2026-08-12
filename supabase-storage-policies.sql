-- Permite que qualquer conta autenticada do VIVA leia os materiais semanais.
-- Os endereços continuam privados e temporários; esta política não torna o bucket público.
drop policy if exists "viva_weekly_content_read" on storage.objects;

create policy "viva_weekly_content_read"
on storage.objects
for select
to authenticated
using (bucket_id = 'weekly-content');
