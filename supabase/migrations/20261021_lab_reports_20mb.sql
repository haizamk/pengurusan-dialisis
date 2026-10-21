-- Jalankan sekali di Supabase SQL Editor selepas deploy.
-- Naikkan had bucket sedia ada tanpa memadam fail atau rekod.
update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'],
    public = false
where id = 'lab-reports';

-- Pastikan bucket tersedia jika pemasangan awal belum dibuat.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lab-reports', 'lab-reports', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
set public = false,
    file_size_limit = 20971520,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];
