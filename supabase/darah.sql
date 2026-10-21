-- Laporan makmal pesakit. Jalankan sekali selepas supabase/portal.sql.
-- Tidak memadam rekod darah atau sesi yang sedia ada.

create table if not exists public.health_documents (
  id text primary key,
  patient_id text not null references public.patients (id) on delete cascade,
  report_date date,
  uploaded_at timestamptz not null default now(),
  file_name text not null,
  mime text not null,
  byte_size integer not null,
  sha256 text not null,
  storage_path text,
  content_base64 text,
  processing_status text not null,
  extraction_status text not null,
  review_status text not null,
  note text not null default '',
  diagnostic jsonb
);

alter table public.health_documents add column if not exists diagnostic jsonb;

create table if not exists public.lab_observations (
  id text primary key,
  patient_id text not null references public.patients (id) on delete cascade,
  document_id text references public.health_documents (id) on delete set null,
  taken_on date,
  original_name text not null,
  standard_key text,
  value_numeric double precision,
  unit text,
  ref_text text,
  abnormal_flag text,
  specimen text,
  uncertain boolean not null default false,
  snippet text not null default '',
  status text not null,
  source text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lab_observation_audits (
  id text primary key,
  observation_id text not null,
  patient_id text not null references public.patients (id) on delete cascade,
  previous_value text,
  previous_unit text,
  next_value text,
  next_unit text,
  changed_at timestamptz not null default now()
);

create table if not exists public.lab_analyses (
  id text primary key,
  patient_id text not null references public.patients (id) on delete cascade,
  document_id text,
  created_at timestamptz not null default now(),
  version text not null,
  summary text not null,
  safety jsonb not null default '[]'::jsonb,
  parameter_keys jsonb not null default '[]'::jsonb,
  body jsonb not null
);

alter table public.health_documents enable row level security;
alter table public.lab_observations enable row level security;
alter table public.lab_observation_audits enable row level security;
alter table public.lab_analyses enable row level security;

grant select, insert, update, delete on public.health_documents to authenticated;
grant select, insert, update, delete on public.lab_observations to authenticated;
grant select, insert on public.lab_observation_audits to authenticated;
grant select, insert on public.lab_analyses to authenticated;

drop policy if exists "dokumen sendiri" on public.health_documents;
create policy "dokumen sendiri" on public.health_documents
  for all to authenticated
  using (patient_id = public.my_patient_id())
  with check (patient_id = public.my_patient_id());

drop policy if exists "pemerhatian sendiri" on public.lab_observations;
create policy "pemerhatian sendiri" on public.lab_observations
  for all to authenticated
  using (patient_id = public.my_patient_id())
  with check (patient_id = public.my_patient_id());

drop policy if exists "audit sendiri baca" on public.lab_observation_audits;
create policy "audit sendiri baca" on public.lab_observation_audits
  for select to authenticated
  using (patient_id = public.my_patient_id());

drop policy if exists "audit sendiri tambah" on public.lab_observation_audits;
create policy "audit sendiri tambah" on public.lab_observation_audits
  for insert to authenticated
  with check (patient_id = public.my_patient_id());

drop policy if exists "analisis sendiri baca" on public.lab_analyses;
create policy "analisis sendiri baca" on public.lab_analyses
  for select to authenticated
  using (patient_id = public.my_patient_id());

drop policy if exists "analisis sendiri tambah" on public.lab_analyses;
create policy "analisis sendiri tambah" on public.lab_analyses
  for insert to authenticated
  with check (patient_id = public.my_patient_id());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lab-reports', 'lab-reports', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 20971520, allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

drop policy if exists "laporan baca sendiri" on storage.objects;
create policy "laporan baca sendiri" on storage.objects
  for select to authenticated
  using (bucket_id = 'lab-reports' and (storage.foldername(name))[1] = public.my_patient_id());

drop policy if exists "laporan tambah sendiri" on storage.objects;
create policy "laporan tambah sendiri" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'lab-reports' and (storage.foldername(name))[1] = public.my_patient_id());
