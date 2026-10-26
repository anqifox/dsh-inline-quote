import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connect } from './cdp.mjs'

const { send, evaluate } = await connect()
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 800, deviceScaleFactor: 1, mobile: false })
const setup = await evaluate("(async () => { const wait=async(fn,t=8000)=>{const s=Date.now();while(Date.now()-s<t){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}; const get=()=>window.__QUOTE_PROBE_DOCK__; for (const dialog of document.querySelectorAll('[role=dialog]')) { if (dialog.hasAttribute('data-inline-quote-preview')) continue; const close=dialog.querySelector('button[aria-label=\"关闭\"]'); if (close) close.click(); } await new Promise(r=>setTimeout(r,400)); get().inputActions.setDraft(''); await wait(()=>get().input.draft===''); const host=document.querySelector('[data-chat-flow]')||document.querySelector('[data-conversation-scroll]'); const row=document.createElement('div'); row.setAttribute('data-chat-flow-kind','assistant-step'); row.setAttribute('data-chat-turn','7'); row.innerHTML='<p>Visual check: quote background and contrast.</p>'; host.appendChild(row); const p=row.querySelector('p'); const range=document.createRange(); range.selectNodeContents(p); const selection=window.getSelection(); selection.removeAllRanges(); selection.addRange(range); document.dispatchEvent(new Event('selectionchange')); await new Promise(r=>setTimeout(r,600)); let button=null; for(let attempt=0;attempt<4&&!button;attempt+=1){ button=[...document.querySelectorAll('button')].find(b=>(b.innerText||'').trim()==='引用'); if(!button){ selection.removeAllRanges(); selection.addRange(range); document.dispatchEvent(new Event('selectionchange')); await new Promise(r=>setTimeout(r,500)) } } if(!button) throw new Error('quote button missing'); button.click(); await wait(()=>get().input.occurrences.length===1); const chip=document.querySelector('[data-composer-chip=\\\"quote\\\"]'); if(!chip) throw new Error('chip missing'); chip.click(); await new Promise(r=>setTimeout(r,300)); window.__QUOTE_VISUAL_ROW__=row; return true; })()")
const themes = ['light','dark']
const captures = []
for (const theme of themes) {
  const info = await evaluate("(async () => { const theme=" + JSON.stringify(theme) + "; const service=window.__QUOTE_PROBE_CTX__.get('theme'); await service.setTheme(theme); await new Promise(r=>setTimeout(r,500)); const dialog=document.querySelector('[data-inline-quote-preview]'); const chip=document.querySelector('[data-composer-chip=\\\"quote\\\"]'); const body=document.body; const style=(node)=>node?getComputedStyle(node):null; const rect=dialog?.getBoundingClientRect(); return { theme, rootTheme: document.documentElement.getAttribute('data-ds-theme'), rootSource: document.documentElement.getAttribute('data-ds-theme-source'), bodyBg: style(body)?.backgroundColor, dialogBg: style(dialog)?.backgroundColor, dialogColor: style(dialog)?.color, chipColor: style(chip)?.color, dialogWidth: rect?.width, dialogHeight: rect?.height, preview: !!dialog }; })()")
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'artifacts')
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, 'inline-quote-' + theme + '.png')
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'))
  captures.push({ ...info, file })
}
const cleanup = await evaluate("(async () => { document.querySelector('[data-inline-quote-preview] button[aria-label=\\\"关闭\\\"]')?.click(); window.__QUOTE_VISUAL_ROW__?.remove(); window.__QUOTE_PROBE_DOCK__.inputActions.setDraft(''); const service=window.__QUOTE_PROBE_CTX__.get('theme'); await service.setTheme('system'); window.getSelection()?.removeAllRanges(); return true; })()")
await send('Emulation.clearDeviceMetricsOverride')
console.log(JSON.stringify({ captures, cleanup }, null, 2))
const failures=[]
if (captures.length !== 2) failures.push('expected two theme captures')
for (const item of captures) {
  if (!item.preview) failures.push(item.theme + ': preview not visible')
  if (!item.dialogBg || !item.dialogColor) failures.push(item.theme + ': missing preview colors')
  const alpha = item.dialogBg?.startsWith('rgba(')
    ? Number(item.dialogBg.slice(item.dialogBg.lastIndexOf(',') + 1, -1))
    : 1
  if (alpha !== 1) failures.push(item.theme + ': preview background is not opaque')
  if (!item.dialogWidth || !item.dialogHeight) failures.push(item.theme + ': empty preview bounds')
}
if (captures[0]?.bodyBg === captures[1]?.bodyBg) failures.push('light/dark body background did not change')
if (failures.length > 0) { console.error('VISUAL FAIL: ' + failures.join('; ')); process.exit(1) }
console.log('VISUAL PASS')
process.exit(0)

