// Existing prerequisite suites against the fixed disposable backend. No billing source/plan mutation.
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
for (const file of ['shop_pos_checkout.sql','shop_cash_shifts.sql','shop_sale_corrections.sql','ss-launch-cash-policy-001-1.test.sql','shop_offline_counter.sql','shop_business_currency.sql','shop_document_settings.sql']) {
  let text=await readFile(new URL(`../../supabase/tests/${file}`,import.meta.url),'utf8')
  // Historical fixtures name discontinued commercial selectors. Use the current default trial overload,
  // preserving the business mode and every financial/authorization assertion. Original files stay intact.
  text=text.replace(/create_owner_shop\(('(?:[^']*)'),\s*'(?:pro|team|multi)',\s*'(product|service|mixed)'(?:\s*::\s*public\.business_mode)?\)/g,"create_owner_shop($1, '$2'::public.business_mode)")
  text=text.replace("create_owner_shop('First monetary ' || fixture.kind,'team','mixed')", "create_owner_shop('First monetary ' || fixture.kind,'mixed'::public.business_mode)")
  const result=spawnSync('docker',['exec','-i','supabase_db_building-suit-shop','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:`BEGIN;\n${text}\nROLLBACK;`,encoding:'utf8'})
  if(result.status!==0){console.error(`${file}: FAILED\n${result.stderr}`);process.exit(1)}
  console.log(`${file}: PASS; test-only default-trial adaptation where needed; fixtures rolled back`)
}
