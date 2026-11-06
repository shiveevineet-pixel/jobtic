-- Applied remotely with the account_storage_and_private_ai migration.
create table public.interview_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (length(id) between 1 and 160),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'id' is not null and payload->>'id' = id and octet_length(payload::text) < 2000000),
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index interview_sessions_user_created on public.interview_sessions(user_id, created_at desc, id);
alter table public.interview_sessions enable row level security;
revoke all on public.interview_sessions from anon;
grant select, insert, update, delete on public.interview_sessions to authenticated;
create policy own_sessions_select on public.interview_sessions for select to authenticated using ((select auth.uid()) = user_id);
create policy own_sessions_insert on public.interview_sessions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy own_sessions_update on public.interview_sessions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy own_sessions_delete on public.interview_sessions for delete to authenticated using ((select auth.uid()) = user_id);

create schema if not exists private;
create table private.jobtic_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket timestamptz not null,
  kind text not null check (kind in ('minute', 'day')),
  requests integer not null default 0,
  primary key (user_id, kind, bucket)
);
alter table private.jobtic_ai_usage enable row level security;
grant usage on schema private, vault to service_role;
grant select, insert, update, delete on private.jobtic_ai_usage to service_role;
grant select on vault.decrypted_secrets to service_role;

create function public.jobtic_provider_keys(provider text) returns text
language sql security invoker set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'jobtic_' || provider || '_keys'
    and provider in ('gemini', 'groq', 'nvidia');
$$;
revoke all on function public.jobtic_provider_keys(text) from public, anon, authenticated;
grant execute on function public.jobtic_provider_keys(text) to service_role;

create function public.jobtic_claim_ai_request(owner uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare minute_count integer; day_count integer;
begin
  -- Serialize quota claims for this account to avoid concurrent bypasses.
  perform pg_advisory_xact_lock(hashtextextended(owner::text, 0));
  insert into private.jobtic_ai_usage(user_id, kind, bucket, requests)
    values(owner, 'minute', date_trunc('minute', now()), 1)
    on conflict(user_id, kind, bucket) do update set requests = private.jobtic_ai_usage.requests + 1
    returning requests into minute_count;
  insert into private.jobtic_ai_usage(user_id, kind, bucket, requests)
    values(owner, 'day', date_trunc('day', now()), 1)
    on conflict(user_id, kind, bucket) do update set requests = private.jobtic_ai_usage.requests + 1
    returning requests into day_count;
  delete from private.jobtic_ai_usage where user_id = owner and bucket < now() - interval '2 days';
  return minute_count <= 30 and day_count <= 150;
end;
$$;
revoke all on function public.jobtic_claim_ai_request(uuid) from public, anon, authenticated;
grant execute on function public.jobtic_claim_ai_request(uuid) to service_role;
