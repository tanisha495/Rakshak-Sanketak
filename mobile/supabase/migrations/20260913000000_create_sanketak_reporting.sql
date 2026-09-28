create extension if not exists pgcrypto;

do $$
begin
  create type public.report_type as enum ('voice', 'text', 'photo');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.report_status as enum (
    'submitted',
    'under_review',
    'action_assigned',
    'actioned',
    'verified'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.report_language as enum ('english', 'hindi', 'assamese', 'mixed');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  client_report_id text not null unique,
  tracking_id text not null unique,
  report_type public.report_type not null,
  original_text text,
  transcribed_text text,
  final_text text not null,
  report_language public.report_language not null default 'english',
  detected_language text,
  site text not null default 'Not provided',
  area_or_equipment text,
  photo_path text,
  audio_path text,
  status public.report_status not null default 'submitted',
  sync_status text not null default 'synced',
  anonymous boolean not null default true,
  submitted_at timestamptz not null default now(),
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_analysis (
  id uuid primary key default gen_random_uuid(),
  report_client_id text not null unique references public.reports(client_report_id) on delete cascade,
  activity text not null,
  hazard text not null,
  exposure text not null,
  barrier_failure text not null,
  potential_consequence text not null,
  life_saving_rules text[] not null default '{}',
  risk_level text not null default 'under_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_status_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  status public.report_status not null,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists reports_status_idx on public.reports(status);
create index if not exists reports_submitted_at_idx on public.reports(submitted_at desc);
create index if not exists reports_site_idx on public.reports(site);
create index if not exists report_analysis_report_client_id_idx on public.report_analysis(report_client_id);
create index if not exists report_status_events_report_id_idx on public.report_status_events(report_id);

drop trigger if exists set_reports_updated_at on public.reports;
create trigger set_reports_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

drop trigger if exists set_report_analysis_updated_at on public.report_analysis;
create trigger set_report_analysis_updated_at
before update on public.report_analysis
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public)
values
  ('report-audio', 'report-audio', false),
  ('report-photos', 'report-photos', false)
on conflict (id) do nothing;

alter table public.reports enable row level security;
alter table public.report_analysis enable row level security;
alter table public.report_status_events enable row level security;

grant usage on schema public to anon, authenticated;
grant insert, update on public.reports to anon;
grant select, insert, update on public.reports to authenticated;
grant select, insert, update on public.reports to service_role;
grant insert, update on public.report_analysis to anon;
grant select, insert, update on public.report_analysis to authenticated;
grant select, insert, update on public.report_analysis to service_role;
grant select, insert, update, delete on public.report_status_events to authenticated;
grant select, insert, update, delete on public.report_status_events to service_role;

drop policy if exists "Anonymous workers can submit reports" on public.reports;
create policy "Anonymous workers can submit reports"
on public.reports
for insert
to anon
with check (anonymous = true);

drop policy if exists "Anonymous workers can retry report sync" on public.reports;
create policy "Anonymous workers can retry report sync"
on public.reports
for update
to anon
using (anonymous = true)
with check (anonymous = true);

drop policy if exists "Authenticated dashboard can read reports" on public.reports;
create policy "Authenticated dashboard can read reports"
on public.reports
for select
to authenticated
using (true);

drop policy if exists "Authenticated dashboard can update report status" on public.reports;
create policy "Authenticated dashboard can update report status"
on public.reports
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Anonymous workers can submit analysis" on public.report_analysis;
create policy "Anonymous workers can submit analysis"
on public.report_analysis
for insert
to anon
with check (true);

drop policy if exists "Anonymous workers can retry analysis sync" on public.report_analysis;
create policy "Anonymous workers can retry analysis sync"
on public.report_analysis
for update
to anon
using (true)
with check (true);

drop policy if exists "Authenticated dashboard can read analysis" on public.report_analysis;
create policy "Authenticated dashboard can read analysis"
on public.report_analysis
for select
to authenticated
using (true);

drop policy if exists "Authenticated dashboard can manage status events" on public.report_status_events;
create policy "Authenticated dashboard can manage status events"
on public.report_status_events
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Anonymous workers can upload report media" on storage.objects;
create policy "Anonymous workers can upload report media"
on storage.objects
for insert
to anon
with check (
  bucket_id in ('report-audio', 'report-photos')
  and name like 'reports/%'
);

drop policy if exists "Anonymous workers can retry report media upload" on storage.objects;
create policy "Anonymous workers can retry report media upload"
on storage.objects
for update
to anon
using (
  bucket_id in ('report-audio', 'report-photos')
  and name like 'reports/%'
)
with check (
  bucket_id in ('report-audio', 'report-photos')
  and name like 'reports/%'
);

drop policy if exists "Authenticated dashboard can read report media" on storage.objects;
create policy "Authenticated dashboard can read report media"
on storage.objects
for select
to authenticated
using (bucket_id in ('report-audio', 'report-photos'));

create or replace view public.employer_report_dashboard as
select
  reports.id,
  reports.tracking_id,
  reports.report_type,
  reports.final_text,
  reports.transcribed_text,
  reports.site,
  reports.area_or_equipment,
  reports.photo_path,
  reports.audio_path,
  reports.status,
  reports.submitted_at,
  report_analysis.activity,
  report_analysis.hazard,
  report_analysis.barrier_failure,
  report_analysis.potential_consequence,
  report_analysis.life_saving_rules,
  report_analysis.risk_level
from public.reports
left join public.report_analysis
  on report_analysis.report_client_id = reports.client_report_id;

grant select on public.employer_report_dashboard to authenticated;
