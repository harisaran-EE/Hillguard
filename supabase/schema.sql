create table if not exists public.reports (
  id uuid primary key,
  author_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('landslide', 'roadblock')),
  location text not null check (char_length(location) between 1 and 70),
  description text not null check (char_length(description) between 1 and 240),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location_mode text not null check (location_mode in ('gps', 'sample')),
  photo_path text not null unique,
  ai_review jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reviewed_reports_have_reviewer
    check ((status = 'pending' and reviewer_id is null and reviewed_at is null)
      or (status <> 'pending' and reviewer_id is not null and reviewed_at is not null))
);

create index if not exists reports_public_feed_idx
  on public.reports (created_at desc)
  where status = 'approved';

create index if not exists reports_author_tier_idx
  on public.reports (author_id, created_at desc)
  where status = 'approved' and location_mode = 'gps';

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant all on public.reports to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hazard-evidence', 'hazard-evidence', false, 2097152, array['image/jpeg'])
on conflict (id) do update
set public = false,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg'];
