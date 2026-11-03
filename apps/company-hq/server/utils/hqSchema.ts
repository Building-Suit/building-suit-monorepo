/** Dedicated HQ storage. Never opened against another product's database. */
export const schema = `
create table if not exists hq_workspace (
  id integer primary key check (id = 1),
  document text not null check(json_valid(document)),
  revision integer not null default 0
);
create table if not exists hq_sessions (
  token_hash text primary key,
  expires_at integer not null
);
create index if not exists hq_sessions_expiry on hq_sessions(expires_at);
create table if not exists hq_login_limits (
  address_hash text primary key,
  failures integer not null,
  window_end integer not null
);
pragma user_version = 1;
`
