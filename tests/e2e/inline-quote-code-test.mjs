import { connect } from './cdp.mjs'
const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  const wait=async(fn,timeout=8000)=>{const s=Date.now();while(Date.now()-s<timeout){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}
  const get=()=>window.__QUOTE_PROBE_DOCK__
  get().inputActions.setDraft('')
  await wait(()=>get().input.draft==='')
  const host=document.querySelector('[data-chat-flow]')||document.querySelector('[data-conversation-scroll]')||document.body
  const row=document.createElement('div')
  row.setAttribute('data-chat-flow-kind','assistant-step')
  row.setAttribute('data-chat-turn','2')
  row.setAttribute('data-chat-node-key','probe-code')
  row.innerHTML='<pre><code class="language-ts">function demo() {\\n  const value = 1\\n  return value\\n}</code></pre>'
  host.appendChild(row)
  const code=row.querySelector('code')
  const range=document.createRange(); range.selectNodeContents(code)
  const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
  await new Promise(r=>setTimeout(r,600))
  let btn=null
  for(let attempt=0;attempt<4&&!btn;attempt+=1){ btn=[...document.querySelectorAll('button')].find(b=>(b.innerText||'').trim()==='引用'); if(!btn){ sel.removeAllRanges(); sel.addRange(range); document.dispatchEvent(new Event('selectionchange')); await new Promise(r=>setTimeout(r,500)) } }
  if(!btn) throw new Error('quote button missing')
  btn.click()
  const input=await wait(()=>get().input.occurrences.length===1?get().input:undefined)
  const occ=input.occurrences[0]
  const payload=window.__QUOTE_PROBE_DECODE_REF__(occ.ref)
  const chip=document.querySelector('[data-composer-chip="quote"]')
  if(chip) chip.click()
  await new Promise(r=>setTimeout(r,300))
  const dialog=document.querySelector('[data-inline-quote-preview]')
  const pre=dialog?.querySelector('pre')
  const res={payload,label:occ.label,previewText:dialog?.innerText?.slice(0,300),preText:pre?.innerText}
  row.remove(); sel.removeAllRanges(); dialog?.querySelector('button[aria-label="关闭"]')?.click()
  return res
})()`)
console.log(JSON.stringify(result,null,2))
const failures = []
if (result.payload?.kind !== 'code') failures.push('kind is not code')
if (result.payload?.language !== 'ts') failures.push('language is not ts')
if (!result.payload?.text?.includes('  const value = 1')) failures.push('code indentation lost')
if (!result.payload?.text?.includes('\n  return value')) failures.push('code newline lost')
if (!result.preText?.includes('function demo()')) failures.push('preview code missing')
if (failures.length > 0) { console.error('CODE FAIL: ' + failures.join('; ')); process.exit(1) }
console.log('CODE PASS')
process.exit(0)

