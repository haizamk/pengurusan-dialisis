-- Tambahan portal pesakit. Tidak memadam rekod sedia ada.
-- Jalankan selepas supabase/access.sql.

alter table public.dialysis_sessions add column if not exists session_time text;
alter table public.dialysis_sessions add column if not exists prescribed_duration_min integer;
alter table public.dialysis_sessions add column if not exists machine_uf_ml numeric;
alter table public.dialysis_sessions add column if not exists uf_target_l numeric;
alter table public.dialysis_sessions add column if not exists symptoms text not null default '';
alter table public.dialysis_sessions add column if not exists updated_at timestamptz;

create table if not exists public.admin_audits (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  action text not null,
  target_user uuid,
  created_at timestamptz not null default now()
);

alter table public.admin_audits enable row level security;
drop policy if exists "audit admin" on public.admin_audits;
create policy "audit admin" on public.admin_audits
  for select to authenticated
  using (actor_id = auth.uid());
grant select on public.admin_audits to authenticated;

create or replace function public.approve_registration(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  acc public.accounts%rowtype;
  new_id text;
begin
  if not public.is_super_admin() then
    raise exception 'Hanya super admin boleh meluluskan';
  end if;
  select * into acc from public.accounts where user_id = p_user and role = 'pesakit';
  if not found then
    raise exception 'Permohonan tidak dijumpai';
  end if;
  if acc.status = 'lulus' and acc.patient_id is not null then
    return acc.patient_id;
  end if;
  new_id := coalesce(acc.patient_id, gen_random_uuid()::text);
  if acc.patient_id is null then
    insert into public.patients (
      id, full_name, mrn, sex, date_of_birth, phone, centre_id, dry_weight_kg,
      access_type, access_site, schedule, diagnosis, notes, active
    ) values (
      new_id,
      acc.full_name,
      'PPD-' || left(new_id, 8),
      acc.sex,
      acc.date_of_birth,
      coalesce(acc.phone, ''),
      acc.centre_id,
      acc.dry_weight_kg,
      acc.access_type,
      coalesce(acc.access_site, ''),
      coalesce(acc.schedule, ''),
      coalesce(acc.diagnosis, ''),
      'Didaftarkan sendiri dan diluluskan super admin.',
      true
    );
  end if;
  update public.accounts set status = 'lulus', patient_id = new_id where user_id = p_user;
  insert into public.admin_audits (actor_id, action, target_user) values (auth.uid(), 'lulus', p_user);
  return new_id;
end;
$$;

revoke all on function public.approve_registration(uuid) from public, anon;
grant execute on function public.approve_registration(uuid) to authenticated;

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

create policy "pesakit baca" on public.patients
  for select to authenticated using (id = public.my_patient_id());
create policy "pesakit kemaskini" on public.patients
  for update to authenticated
  using (id = public.my_patient_id())
  with check (id = public.my_patient_id());

create policy "sesi baca" on public.dialysis_sessions
  for select to authenticated using (patient_id = public.my_patient_id());
create policy "sesi tambah" on public.dialysis_sessions
  for insert to authenticated with check (patient_id = public.my_patient_id());
create policy "sesi kemaskini" on public.dialysis_sessions
  for update to authenticated
  using (patient_id = public.my_patient_id())
  with check (patient_id = public.my_patient_id());
create policy "sesi padam" on public.dialysis_sessions
  for delete to authenticated using (patient_id = public.my_patient_id());

create policy "darah baca" on public.blood_records
  for select to authenticated using (patient_id = public.my_patient_id());
create policy "darah tambah" on public.blood_records
  for insert to authenticated with check (patient_id = public.my_patient_id());
create policy "darah kemaskini" on public.blood_records
  for update to authenticated
  using (patient_id = public.my_patient_id())
  with check (patient_id = public.my_patient_id());
create policy "darah padam" on public.blood_records
  for delete to authenticated using (patient_id = public.my_patient_id());
