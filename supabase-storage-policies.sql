-- Permite que contas Firebase autenticadas no projeto VIVA leiam os materiais semanais.
-- A integração Firebase chega ao Supabase pelo papel anon; a identidade é validada no JWT.
drop policy if exists "viva_weekly_content_read" on storage.objects;

create policy "viva_weekly_content_read"
on storage.objects
for select
to anon
using (
  bucket_id = 'weekly-content'
  and auth.jwt()->>'iss' = 'https://securetoken.google.com/viva-iasd'
  and auth.jwt()->>'aud' = 'viva-iasd'
  and auth.jwt()->>'sub' is not null
);
