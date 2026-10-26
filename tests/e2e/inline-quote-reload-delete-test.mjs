import { connect } from './cdp.mjs'

const { send, evaluate } = await connect()
const inserted = await evaluate("(async () => { const wait=async(fn,t=10000)=>{const s=Date.now();while(Date.now()-s<t){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}; const get=()=>window.__QUOTE_PROBE_DOCK__; get().inputActions.setDraft(''); await wait(()=>get().input.draft===''); window.dispatchEvent(new CustomEvent('dsh-inline-quote:insert',{detail:{text:'刷新后仍可删除的引用',kind:'text',lines:1}})); await wait(()=>get().input.occurrences.length===1); const occurrence=get().input.occurrences[0]; get().inputActions.persistDraft(); await wait(()=>(localStorage.getItem('dsh.conversation.'+get().sessionId)||'').includes(occurrence.ref)); return {draft:get().input.draft,refLength:occurrence.ref.length}; })()")
await send('Page.reload', { ignoreCache: true })
let restored = null
const start = Date.now()
while (Date.now() - start < 20000) {
  try {
    restored = await evaluate("(function(){ const get=()=>window.__QUOTE_PROBE_DOCK__; try { return { ready:!!get(), draft:get()?.input?.draft, occurrences:get()?.input?.occurrences?.length }; } catch { return null; } })()")
    if (restored?.ready && restored.occurrences === 1) break
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 300))
}
const deleted = await evaluate("(async () => { const wait=async(fn,t=10000)=>{const s=Date.now();while(Date.now()-s<t){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}; const get=()=>window.__QUOTE_PROBE_DOCK__; const chip=document.querySelector('[data-composer-chip=\\\"quote\\\"]'); if(!chip) return { error:'chip missing' }; chip.click(); await new Promise(r=>setTimeout(r,300)); const dialog=document.querySelector('[role=dialog]'); const del=dialog?[...dialog.querySelectorAll('button')].find(b=>(b.innerText||'').trim()==='删除引用'):null; if(!del) return { error:'delete button missing' }; del.click(); await wait(()=>get().input.occurrences.length===0); return { draft:get().input.draft, occurrences:get().input.occurrences.length }; })()")
console.log(JSON.stringify({ inserted, restored, deleted }, null, 2))
const failures=[]
if (!inserted?.draft?.includes('[[quote:')) failures.push('quote not inserted before reload')
if (restored?.occurrences !== 1) failures.push('draft quote did not restore after reload')
if (deleted?.error) failures.push(deleted.error)
if (deleted?.occurrences !== 0) failures.push('quote did not delete after reload')
if (failures.length > 0) { console.error('RELOAD DELETE FAIL: ' + failures.join('; ')); process.exit(1) }
console.log('RELOAD DELETE PASS')
process.exit(0)
