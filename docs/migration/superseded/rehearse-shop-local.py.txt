"""One-time schema recovery rehearsal, fixed to the disposable monorepo container.

Run after a fresh Ledger-only local initialization. Not a hosted migration runner.
"""
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parents[2]
command = ['docker', 'exec', '-i', 'supabase_db_building-suit-monorepo', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
base = (root / 'apps/shop-suit/docs/readiness/shop_crm_schema_baseline.sql').read_text()
functions = re.findall(r'CREATE OR REPLACE FUNCTION public\.(\w+)\(', base)
query = "select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname in (" + ','.join("'" + name + "'" for name in functions) + ")"
result = subprocess.run(command + ['-Atc', query], check=True, capture_output=True, text=True)
assert not result.stdout.strip(), 'Refusing to overwrite existing functions'
assert base.count('BEGIN;') == 1 and base.count('COMMIT;') == 1
sql = base.replace('COMMIT;', '')
sql += '\n'.join(p.read_text() for p in sorted((root / 'supabase/legacy/shop-suit/shop_crm_migrations').glob('*.sql')))
sql += '''
insert into shop_crm.portals (key, name) values ('shop-crm', 'Shop Suit local fixture');
insert into shop_crm.plans (portal_id, name, slug, price_amount, currency, trial_days, features)
select id, 'Basic', 'basic', 799, 'EGP', 30, '{"max_products":100,"max_services":50}' from shop_crm.portals where key='shop-crm';
insert into shop_crm.plans (portal_id, name, slug, price_amount, currency, trial_days, features)
select id, 'Pro', 'pro', 1199, 'EGP', 30, '{"inventory":true,"max_products":1000,"max_services":500}' from shop_crm.portals where key='shop-crm';
COMMIT;
'''
subprocess.run(command, input=sql, text=True, check=True)
