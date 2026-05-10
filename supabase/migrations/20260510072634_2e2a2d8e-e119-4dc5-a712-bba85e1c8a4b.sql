
create table public.threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New symptom check',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  parts jsonb not null,
  created_at timestamptz not null default now()
);

create index on public.threads(user_id, updated_at desc);
create index on public.messages(thread_id, created_at);

alter table public.threads enable row level security;
alter table public.messages enable row level security;

create policy "own threads select" on public.threads for select using (auth.uid() = user_id);
create policy "own threads insert" on public.threads for insert with check (auth.uid() = user_id);
create policy "own threads update" on public.threads for update using (auth.uid() = user_id);
create policy "own threads delete" on public.threads for delete using (auth.uid() = user_id);

create policy "own messages select" on public.messages for select using (auth.uid() = user_id);
create policy "own messages insert" on public.messages for insert with check (auth.uid() = user_id);
create policy "own messages delete" on public.messages for delete using (auth.uid() = user_id);
