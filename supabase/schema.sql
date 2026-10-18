-- Pengurusan Pesakit Dialisis
-- Jalankan skrip ini dalam SQL Editor Supabase.
--
-- AMARAN: polisi di bawah membenarkan kunci anon membaca dan menulis SEMUA rekod.
-- Jangan simpan data pesakit sebenar dengan polisi ini.
-- Untuk produksi, gantikan dengan log masuk dan sekatan mengikut centre.

create table if not exists public.centres (
  id text primary key,
  name text not null,
  city text not null,
  state text not null,
  phone text not null default ''
);

create table if not exists public.patients (
  id text primary key,
  full_name text not null,
  mrn text not null unique,
  sex text not null check (sex in ('lelaki', 'perempuan')),
  date_of_birth date not null,
  phone text not null default '',
  centre_id text not null references public.centres (id),
  dry_weight_kg numeric not null check (dry_weight_kg > 0),
  access_type text not null check (access_type in ('fistula', 'graft', 'kateter')),
  access_site text not null default '',
  schedule text not null default '',
  diagnosis text not null default '',
  notes text not null default '',
  active boolean not null default true
);

create table if not exists public.dialysis_sessions (
  id text primary key,
  patient_id text not null references public.patients (id) on delete cascade,
  centre_id text not null references public.centres (id),
  session_date date not null,
  arrival_weight_kg numeric not null check (arrival_weight_kg > 0),
  post_weight_kg numeric check (post_weight_kg is null or post_weight_kg > 0),
  dry_weight_kg numeric not null check (dry_weight_kg > 0),
  duration_min integer not null check (duration_min > 0),
  systolic_pre integer,
  diastolic_pre integer,
  systolic_post integer,
  diastolic_post integer,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (patient_id, session_date)
);

create table if not exists public.blood_records (
  id text primary key,
  patient_id text not null references public.patients (id) on delete cascade,
  taken_on date not null,
  hemoglobin numeric,
  urea_pre numeric,
  urea_post numeric,
  creatinine numeric,
  potassium numeric,
  phosphate numeric,
  calcium numeric,
  sodium numeric,
  albumin numeric,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists patients_centre_idx on public.patients (centre_id);
create index if not exists sessions_patient_date_idx on public.dialysis_sessions (patient_id, session_date);
create index if not exists labs_patient_date_idx on public.blood_records (patient_id, taken_on);

alter table public.centres enable row level security;
alter table public.patients enable row level security;
alter table public.dialysis_sessions enable row level security;
alter table public.blood_records enable row level security;

drop policy if exists "demo centres" on public.centres;
drop policy if exists "demo patients" on public.patients;
drop policy if exists "demo sessions" on public.dialysis_sessions;
drop policy if exists "demo labs" on public.blood_records;

create policy "demo centres" on public.centres for all using (true) with check (true);
create policy "demo patients" on public.patients for all using (true) with check (true);
create policy "demo sessions" on public.dialysis_sessions for all using (true) with check (true);
create policy "demo labs" on public.blood_records for all using (true) with check (true);

grant select, insert, update, delete on public.centres to anon, authenticated;
grant select, insert, update, delete on public.patients to anon, authenticated;
grant select, insert, update, delete on public.dialysis_sessions to anon, authenticated;
grant select, insert, update, delete on public.blood_records to anon, authenticated;

-- Contoh sekatan produksi (belum diaktifkan):
-- create table public.staff (
--   user_id uuid primary key references auth.users (id),
--   centre_id text not null references public.centres (id)
-- );
-- create policy "pesakit centre sendiri" on public.patients
--   for select using (
--     centre_id in (select centre_id from public.staff where user_id = auth.uid())
--   );
