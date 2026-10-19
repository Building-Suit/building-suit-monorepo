#!/usr/bin/env python3
"""Split the approved proposals losslessly; no network or database operations."""
import hashlib
import json
import subprocess
from pathlib import Path

BASE=Path(__file__).resolve().parents[1]
ROOT=BASE.parents[3]
OUT=BASE/'import-delivery'
SOURCE_HEAD='7a6dcc2084000b4054010d94a04a85a408282497'
def encoded(value): return (json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()
def record(path,raw):
 return {'artifact_id':str(path.relative_to(OUT)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'git_blob_sha1':hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest()}
def save(path,value):
 raw=encoded(value);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw);return record(path,raw)

def main():
 manifest={'schema':'doctor-lossless-import-delivery-v1','source_head':SOURCE_HEAD,'source_status':'approved planning contracts; not proof of hosted import','files':[]}
 for n in range(1,10):
  mid=f'DOS-M{n}';source=BASE/f'{mid}.import-proposal.json';raw=source.read_bytes()
  pinned=subprocess.check_output(['git','show',SOURCE_HEAD+':'+str(source.relative_to(ROOT))],cwd=ROOT)
  assert raw==pinned,'Never package a stale or unreviewed proposal: '+mid
  proposal=json.loads(raw);folder=OUT/mid
  header=save(folder/'header.json',{k:v for k,v in proposal.items() if k!='create_task_calls'})
  calls=[save(folder/(c['arguments']['p_task_id']+'.create.json'),c) for c in proposal['create_task_calls']]
  rebuilt={k:proposal[k] for k in proposal}  # Validate the exact formatting contract too.
  assert encoded(rebuilt)==raw
  packet=BASE/proposal['packet_file'];packet_raw=packet.read_bytes()
  assert packet_raw==subprocess.check_output(['git','show',SOURCE_HEAD+':'+str(packet.relative_to(ROOT))],cwd=ROOT)
  assert max([header['bytes']]+[c['bytes'] for c in calls])<100000
  manifest['files'].append({'milestone_id':mid,'source_file':source.name,'source_bytes':len(raw),'source_sha256':hashlib.sha256(raw).hexdigest(),'source_git_blob_sha1':hashlib.sha1(f'blob {len(raw)}\0'.encode()+raw).hexdigest(),'packet_content_sha256':proposal['packet_sha256'],'packet_bytes':len(packet_raw),'packet_file_sha256':hashlib.sha256(packet_raw).hexdigest(),'top_level_key_order':list(proposal),'header':header,'create_task_calls':calls})
 save(OUT/'manifest.json',manifest)
 print(json.dumps({'milestones':len(manifest['files']),'calls':sum(len(f['create_task_calls']) for f in manifest['files']),'max_part_bytes':max(r['bytes'] for f in manifest['files'] for r in [f['header']]+f['create_task_calls'])}))
if __name__=='__main__':main()
