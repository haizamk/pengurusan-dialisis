-- Pengurusan Pesakit Dialisis
-- Jalankan skrip ini dalam SQL Editor Supabase.
--
-- Log masuk Supabase Auth wajib. Kunci publishable tanpa sesi tidak boleh membaca rekod.
-- Staf hanya melihat centre yang dihubungkan. Pentadbir melihat semua centre.

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

create table if not exists public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null default 'staf' check (role in ('pentadbir', 'staf'))
);

create table if not exists public.staff_centres (
  user_id uuid not null references public.staff (user_id) on delete cascade,
  centre_id text not null references public.centres (id) on delete cascade,
  primary key (user_id, centre_id)
);

create index if not exists patients_centre_idx on public.patients (centre_id);
create index if not exists sessions_patient_date_idx on public.dialysis_sessions (patient_id, session_date);
create index if not exists labs_patient_date_idx on public.blood_records (patient_id, taken_on);

alter table public.centres enable row level security;
alter table public.patients enable row level security;
alter table public.dialysis_sessions enable row level security;
alter table public.blood_records enable row level security;
alter table public.staff enable row level security;
alter table public.staff_centres enable row level security;

create or replace function public.is_pentadbir()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff
    where user_id = auth.uid() and role = 'pentadbir'
  );
$$;

create or replace function public.my_centre_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select centre_id from public.staff_centres where user_id = auth.uid();
$$;

create or replace function public.patient_centre(pid text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select centre_id from public.patients where id = pid;
$$;

revoke all on function public.is_pentadbir() from public, anon;
revoke all on function public.my_centre_ids() from public, anon;
revoke all on function public.patient_centre(text) from public, anon;
grant execute on function public.is_pentadbir() to authenticated;
grant execute on function public.my_centre_ids() to authenticated;
grant execute on function public.patient_centre(text) to authenticated;

drop policy if exists "demo centres" on public.centres;
drop policy if exists "demo patients" on public.patients;
drop policy if exists "demo sessions" on public.dialysis_sessions;
drop policy if exists "demo labs" on public.blood_records;
drop policy if exists "centre baca" on public.centres;
drop policy if exists "centre tambah" on public.centres;
drop policy if exists "centre kemaskini" on public.centres;
drop policy if exists "centre padam" on public.centres;
drop policy if exists "pesakit baca" on public.patients;
drop policy if exists "pesakit tambah" on public.patients;
drop policy if exists "pesakit kemaskini" on public.patients;
drop policy if exists "pesakit padam" on public.patients;
drop policy if exists "sesi baca" on public.dialysis_sessions;
drop policy if exists "sesi tambah" on public.dialysis_sessions;
drop policy if exists "sesi kemaskini" on public.dialysis_sessions;
drop policy if exists "sesi padam" on public.dialysis_sessions;
drop policy if exists "darah baca" on public.blood_records;
drop policy if exists "darah tambah" on public.blood_records;
drop policy if exists "darah kemaskini" on public.blood_records;
drop policy if exists "darah padam" on public.blood_records;
drop policy if exists "staf baca" on public.staff;
drop policy if exists "staf tambah" on public.staff;
drop policy if exists "staf kemaskini" on public.staff;
drop policy if exists "staf padam" on public.staff;
drop policy if exists "tugasan baca" on public.staff_centres;
drop policy if exists "tugasan tambah" on public.staff_centres;
drop policy if exists "tugasan padam" on public.staff_centres;

create policy "centre baca" on public.centres
  for select to authenticated
  using (public.is_pentadbir() or id in (select public.my_centre_ids()));
create policy "centre tambah" on public.centres
  for insert to authenticated with check (public.is_pentadbir());
create policy "centre kemaskini" on public.centres
  for update to authenticated
  using (public.is_pentadbir()) with check (public.is_pentadbir());
create policy "centre padam" on public.centres
  for delete to authenticated using (public.is_pentadbir());

create policy "pesakit baca" on public.patients
  for select to authenticated
  using (public.is_pentadbir() or centre_id in (select public.my_centre_ids()));
create policy "pesakit tambah" on public.patients
  for insert to authenticated
  with check (public.is_pentadbir() or centre_id in (select public.my_centre_ids()));
create policy "pesakit kemaskini" on public.patients
  for update to authenticated
  using (public.is_pentadbir() or centre_id in (select public.my_centre_ids()))
  with check (public.is_pentadbir() or centre_id in (select public.my_centre_ids()));
create policy "pesakit padam" on public.patients
  for delete to authenticated
  using (public.is_pentadbir() or centre_id in (select public.my_centre_ids()));

create policy "sesi baca" on public.dialysis_sessions
  for select to authenticated
  using (public.is_pentadbir() or centre_id in (select public.my_centre_ids()));
create policy "sesi tambah" on public.dialysis_sessions
  for insert to authenticated
  with check (public.is_pentadbir() or centre_id in (select public.my_centre_ids()));
create policy "sesi kemaskini" on public.dialysis_sessions
  for update to authenticated
  using (public.is_pentadbir() or centre_id in (select public.my_centre_ids()))
  with check (public.is_pentadbir() or centre_id in (select public.my_centre_ids()));
create policy "sesi padam" on public.dialysis_sessions
  for delete to authenticated
  using (public.is_pentadbir() or centre_id in (select public.my_centre_ids()));

create policy "darah baca" on public.blood_records
  for select to authenticated
  using (
    public.is_pentadbir()
    or public.patient_centre(patient_id) in (select public.my_centre_ids())
  );
create policy "darah tambah" on public.blood_records
  for insert to authenticated
  with check (
    public.is_pentadbir()
    or public.patient_centre(patient_id) in (select public.my_centre_ids())
  );
create policy "darah kemaskini" on public.blood_records
  for update to authenticated
  using (
    public.is_pentadbir()
    or public.patient_centre(patient_id) in (select public.my_centre_ids())
  )
  with check (
    public.is_pentadbir()
    or public.patient_centre(patient_id) in (select public.my_centre_ids())
  );
create policy "darah padam" on public.blood_records
  for delete to authenticated
  using (
    public.is_pentadbir()
    or public.patient_centre(patient_id) in (select public.my_centre_ids())
  );

create policy "staf baca" on public.staff
  for select to authenticated
  using (user_id = auth.uid() or public.is_pentadbir());
create policy "staf tambah" on public.staff
  for insert to authenticated with check (public.is_pentadbir());
create policy "staf kemaskini" on public.staff
  for update to authenticated
  using (public.is_pentadbir()) with check (public.is_pentadbir());
create policy "staf padam" on public.staff
  for delete to authenticated using (public.is_pentadbir());

create policy "tugasan baca" on public.staff_centres
  for select to authenticated
  using (user_id = auth.uid() or public.is_pentadbir());
create policy "tugasan tambah" on public.staff_centres
  for insert to authenticated with check (public.is_pentadbir());
create policy "tugasan padam" on public.staff_centres
  for delete to authenticated using (public.is_pentadbir());

revoke all on public.centres from anon;
revoke all on public.patients from anon;
revoke all on public.dialysis_sessions from anon;
revoke all on public.blood_records from anon;
revoke all on public.staff from anon;
revoke all on public.staff_centres from anon;

grant select, insert, update, delete on public.centres to authenticated;
grant select, insert, update, delete on public.patients to authenticated;
grant select, insert, update, delete on public.dialysis_sessions to authenticated;
grant select, insert, update, delete on public.blood_records to authenticated;
grant select, insert, update, delete on public.staff to authenticated;
grant select, insert, delete on public.staff_centres to authenticated;
