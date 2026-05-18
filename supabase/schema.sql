-- TV Bellenberg backend schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  materials text,
  start_date timestamptz,
  end_date timestamptz,
  duration_estimate text,
  max_participants integer,
  status text not null default 'open',
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_not_empty check (char_length(trim(title)) > 0),
  constraint tasks_description_not_empty check (char_length(trim(description)) > 0),
  constraint tasks_max_participants_positive check (
    max_participants is null or max_participants > 0
  ),
  constraint tasks_status_valid check (status in ('open', 'done')),
  constraint tasks_date_order check (
    start_date is null or end_date is null or start_date <= end_date
  )
);

create trigger trg_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

create table if not exists public.self_registered_participants (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  created_at timestamptz not null default now(),
  constraint self_registered_participants_first_name_not_empty check (char_length(trim(first_name)) > 0),
  constraint self_registered_participants_last_name_not_empty check (char_length(trim(last_name)) > 0)
);

create unique index if not exists self_registered_participants_task_name_ci_unique
on public.self_registered_participants (task_id, lower(first_name), lower(last_name));

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now(),
  constraint images_url_not_empty check (char_length(trim(url)) > 0)
);

create table if not exists public.email_list (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  constraint email_list_email_unique unique (email),
  constraint email_list_email_valid check (
    email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  )
);

alter table public.tasks enable row level security;
alter table public.self_registered_participants enable row level security;
alter table public.images enable row level security;
alter table public.email_list enable row level security;

-- Public users can only read visible tasks directly.
drop policy if exists tasks_select_visible on public.tasks;
create policy tasks_select_visible
on public.tasks
for select
to anon, authenticated
using (is_hidden = false);

-- Self-registered participants, images, and email list are served via server routes using service role.
-- Keep direct anon/authenticated access blocked by not creating additional policies.

insert into storage.buckets (id, name, public)
values ('task-images', 'task-images', true)
on conflict (id) do nothing;

drop policy if exists storage_public_read_task_images on storage.objects;
create policy storage_public_read_task_images
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'task-images');

drop policy if exists storage_service_manage_task_images on storage.objects;
create policy storage_service_manage_task_images
on storage.objects
for all
to service_role
using (bucket_id = 'task-images')
with check (bucket_id = 'task-images');
