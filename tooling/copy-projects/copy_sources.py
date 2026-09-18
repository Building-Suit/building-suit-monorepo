"""One-time, non-destructive source import. Never overwrites destination files."""
from pathlib import Path
import hashlib,json,shutil,subprocess
ROOT=Path(__file__).resolve().parents[2]
SOURCE_ROOT=ROOT.parent
manifest=[]
def target_for(project,rel):
 p=Path(rel)
 if project=='ledger-suit':
  if p.parts[0]=='supabase': return ROOT/p
  if p.parts[0]=='.github': return ROOT/'docs/migration/source-workflows'/project/Path(*p.parts[1:])
  if rel in ['pnpm-lock.yaml','pnpm-workspace.yaml']: return ROOT/'docs/migration/source-config'/project/p
  return ROOT/'apps/ledger-suit'/p
 if project=='shop-suit':
  if p.parts[:2]==('apps','shop-crm'): return ROOT/'apps/shop-suit'/Path(*p.parts[2:])
  if p.parts[:2] in [('supabase','migrations'),('supabase','shop_crm_migrations')]: return ROOT/'supabase/legacy/shop-suit'/Path(*p.parts[1:])
  if p.parts[:2]==('supabase','tests'): return ROOT/'supabase/tests/shop-suit'/Path(*p.parts[2:])
  if p.parts[0]=='supabase': return ROOT/'supabase/legacy/config/shop-suit'/Path(*p.parts[1:])
  if p.parts[0]=='.github': return ROOT/'docs/migration/source-workflows'/project/Path(*p.parts[1:])
  if rel in ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.npmrc']: return ROOT/'docs/migration/source-config'/project/p
  if rel=='README.md': return ROOT/'apps/shop-suit/docs/source-repository-README.md'
  return ROOT/'apps/shop-suit'/p
 if p.parts[0]=='.docs': return ROOT/'apps/building-suit-docs/content/building-suit'/Path(*p.parts[1:])
 if p.parts[0]=='prototype': return ROOT/'apps/building-suit-docs/reference'/p
 return ROOT/'apps/building-suit-docs/reference/agent-guidance'/p
for project in ['ledger-suit','shop-suit','building-suit']:
 source=SOURCE_ROOT/project
 files=subprocess.check_output(['git','-C',str(source),'ls-files','--cached','--others','--exclude-standard','-z']).decode().split('\0')
 for rel in sorted(set(filter(None,files))):
  f=source/rel
  if f.name.startswith('.env') and f.name not in ['.env.example','.env.sample','.env.template']:
   manifest.append({'project':project,'source':rel,'excluded':'environment credentials'});continue
  if f.is_symlink(): raise RuntimeError(f'Symlink requires explicit review: {project}/{rel}')
  if not f.is_file(): continue
  target=target_for(project,rel)
  if target.exists(): raise RuntimeError(f'Refusing overwrite: {target}')
  target.parent.mkdir(parents=True,exist_ok=True)
  shutil.copy2(f,target)
  manifest.append({'project':project,'source':rel,'destination':str(target.relative_to(ROOT)),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
(ROOT/'docs/migration/copy-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Copied {sum("destination" in f for f in manifest)} source files; originals unchanged.')
