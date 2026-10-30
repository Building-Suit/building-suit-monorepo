import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import MarkdownIt from 'markdown-it'

// Each pathological parse has its own bounded process; a regression cannot pin CI.
for (const [name, expression] of [
  ['linkification over soft-broken email lines', "'a@b.co\\n'.repeat(100000)"],
  ['an unterminated multi-line reference title', "'[a]: /u \"' + 'x\\n'.repeat(1000000)"],
]) {
  test(`documentation Markdown bounds ${name}`, () => {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import MarkdownIt from 'markdown-it'; const md = new MarkdownIt({html:false,linkify:true,typographer:false}); const output=md.render(${expression}); if(!output.length)process.exit(2); console.log('rendered');`], { encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 })
    assert.equal(result.error, undefined, result.error?.message)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout.trim(), 'rendered')
  })
}

test('documentation Markdown retains bilingual text, links, tables and escaped raw HTML', () => {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: false })
  const rendered = md.render('# Ledger دفتر الأستاذ\n\n[Account](./account.md) and contact@example.com\n\n| المدين | Credit |\n| --- | --- |\n| 321.00 | 321.00 |\n\n<script>alert(1)</script>\n\n```sql\nselect 1;\n```\n')
  assert.match(rendered, /<h1>Ledger دفتر الأستاذ<\/h1>/)
  assert.match(rendered, /href="\.\/account.md"/)
  assert.match(rendered, /href="mailto:contact@example.com"/)
  assert.match(rendered, /<table>/)
  assert.match(rendered, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.doesNotMatch(rendered, /<script>/)
  assert.match(rendered, /class="language-sql"/)
})
