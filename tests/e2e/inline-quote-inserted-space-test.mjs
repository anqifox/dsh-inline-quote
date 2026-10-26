import { connect } from './cdp.mjs'
const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  const wait=async(fn,timeout=8000)=>{const s=Date.now();while(Date.now()-s<timeout){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}
  const get=()=>window.__QUOTE_PROBE_DOCK__
  get().inputActions.setDraft('A  B'); await wait(()=>get().input.draft==='A  B')
  const editor=document.querySelector('[contenteditable="true"]'); editor.focus()
  const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT); let node=null
  while(walker.nextNode()){if(walker.currentNode.nodeValue.includes('A  B')){node=walker.currentNode;break}}
  const range=document.createRange(); range.setStart(node,3); range.collapse(true)
  const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(range); document.dispatchEvent(new Event('selectionchange'))
  await new Promise(r=>setTimeout(r,400))
  window.dispatchEvent(new CustomEvent('dsh-inline-quote:insert',{detail:{text:'新增空格引用',kind:'text',lines:1}}))
  await wait(()=>get().input.occurrences.length===1)
  const occ=get().input.occurrences[0]; const payload=window.__QUOTE_PROBE_DECODE_REF__(occ.ref)
  const chip=document.querySelector('[data-composer-chip="quote"]'); chip.click(); await new Promise(r=>setTimeout(r,300))
  const dialog=document.querySelector('[role="dialog"]'); const del=[...dialog.querySelectorAll('button')].find(b=>(b.innerText||'').trim()==='删除引用'); del.click()
  await wait(()=>get().input.occurrences.length===0)
  return {ok:true,separator:payload.separator,draftAfter:get().input.draft,exact:get().input.draft==='A  B'}
})()`)
console.log(JSON.stringify(result,null,2))
if (!result.exact || result.separator !== 'inserted') { console.error('SPACE FAIL: inserted separator cleanup mismatch'); process.exit(1) }
console.log('SPACE PASS (inserted)')
process.exit(0)

