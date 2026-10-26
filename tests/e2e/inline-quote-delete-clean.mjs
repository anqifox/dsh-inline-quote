import { connect } from './cdp.mjs'
const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  const wait=async(fn,timeout=10000)=>{const s=Date.now();while(Date.now()-s<timeout){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}
  const get=()=>window.__QUOTE_PROBE_DOCK__
  get().inputActions.setDraft('A  B')
  await wait(()=>get().input.draft==='A  B')
  window.dispatchEvent(new CustomEvent('dsh-inline-quote:insert',{detail:{text:'要删除的引用',kind:'text',lines:1}}))
  await wait(()=>get().input.occurrences.length===1)
  const before={draft:get().input.draft,n:get().input.occurrences.length,label:get().input.occurrences[0].label}
  const chip=document.querySelector('[data-composer-chip="quote"]')
  chip.click()
  await new Promise(r=>setTimeout(r,300))
  const dialog=document.querySelector('[role="dialog"]')
  const del=[...dialog.querySelectorAll('button')].find(b=>(b.innerText||'').trim()==='删除引用')
  del.click()
  await wait(()=>get().input.occurrences.length===0)
  const afterDelete={draft:get().input.draft,n:get().input.occurrences.length}
  const editor=document.querySelector('[contenteditable="true"]'); editor.focus()
  const ev=new KeyboardEvent('keydown',{key:'z',code:'KeyZ',keyCode:90,which:90,ctrlKey:true,bubbles:true,cancelable:true}); editor.dispatchEvent(ev)
  await wait(()=>get().input.occurrences.length===1)
  return {before,afterDelete,afterUndo:{draft:get().input.draft,n:get().input.occurrences.length},prevented:ev.defaultPrevented}
})()`)
console.log(JSON.stringify(result,null,2))
const failures=[]
if (result.afterDelete?.n !== 0) failures.push('quote not deleted')
if (result.afterDelete?.draft !== 'A  B') failures.push('draft not restored')
if (result.afterUndo?.n !== 1) failures.push('undo did not restore quote')
if (!result.prevented) failures.push('undo was not handled by the composer')
if (failures.length > 0) { console.error('DELETE FAIL: ' + failures.join('; ')); process.exit(1) }
console.log('DELETE PASS')
process.exit(0)

