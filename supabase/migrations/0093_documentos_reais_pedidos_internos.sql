-- =====================================================================
-- Documentos reais de pedidos internos.
-- Bucket privado, acesso autenticado e escrita compatível com a matriz
-- técnica. Os metadados continuam auditados em pedidos_internos_anexos.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('pedidos-internos-anexos', 'pedidos-internos-anexos', false)
on conflict (id) do nothing;

drop policy if exists pedidos_internos_anexos_read on storage.objects;
drop policy if exists pedidos_internos_anexos_insert on storage.objects;
drop policy if exists pedidos_internos_anexos_delete on storage.objects;

create policy pedidos_internos_anexos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'pedidos-internos-anexos');

create policy pedidos_internos_anexos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pedidos-internos-anexos'
    and public.papel_minimo('tecnico')
  );

create policy pedidos_internos_anexos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pedidos-internos-anexos'
    and public.papel_minimo('tecnico')
  );
