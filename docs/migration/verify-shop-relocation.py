"""One-time preservation evidence; requires the disposable Shop baseline-only database.

Do not run against hosted data. See independent-project-verification.md.
"""
from pathlib import Path
import subprocess,json
root=Path(__file__).resolve().parents[2]
def sql(text):
 r=subprocess.run(['docker','exec','-i','supabase_db_building-suit-shop','psql','-U','postgres','-d','postgres','-X','-At','-v','ON_ERROR_STOP=1'],input=text,text=True,capture_output=True)
 if r.returncode: raise RuntimeError(r.stderr)
 return r.stdout
assert sql("select to_regnamespace('shop_crm') is not null;").strip()=='t'
seed=(root/'apps/shop-suit/supabase/seed.sql').read_text().replace('public.','shop_crm.')
fixture=(root/'apps/shop-suit/supabase/tests/shop_crm_product_catalog.sql').read_text().replace('rollback;','')
sql('BEGIN;\n'+seed+'\n'+fixture+'\nCOMMIT;')
def snapshot(schema):
 tables=sql(f"select tablename from pg_tables where schemaname='{schema}' order by tablename;").splitlines()
 return {
  'rows':{t:sql(f'SELECT coalesce(jsonb_agg(r ORDER BY r::text),\'[]\'::jsonb) FROM (SELECT to_jsonb(t) r FROM {schema}."{t}" t) x;').strip() for t in tables},
  'columns':sql(f"select c.relname,a.attname,a.atttypid,a.attnum,a.attnotnull,a.attidentity,a.attgenerated,coalesce(pg_get_expr(d.adbin,d.adrelid),'') from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='{schema}' and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum;"),
  'table_oids_grants_rls':sql(f"select relname,oid,coalesce(relacl::text,''),relrowsecurity,relforcerowsecurity from pg_class where relnamespace='{schema}'::regnamespace and relkind in ('r','p') order by relname;")
 }
before=snapshot('shop_crm')
r=subprocess.run(['pnpm','db','shop-suit','migration','up','--local'],cwd=root,capture_output=True,text=True)
if r.returncode: raise RuntimeError(r.stderr)
after=snapshot('public')
assert before==after, 'Relocation changed data, columns, table identities, grants or RLS flags'
assert sql("select to_regnamespace('shop_crm') is null;").strip()=='t'
print(f"Relocation preservation PASS: {len(before['rows'])} tables; all rows/IDs, column metadata, table OIDs, grants and RLS flags unchanged with populated catalog/user/shop fixtures.")
(root/'.local').mkdir(exist_ok=True)
(root/'.local/shop-relocation-result.json').write_text(json.dumps({'passed':True,'tables':len(before['rows']),'checks':['all business rows','column definitions/defaults','table OIDs','table grants','RLS flags','old schema removed']},indent=2)+'\n')
