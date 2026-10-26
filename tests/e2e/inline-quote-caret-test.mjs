import { connect } from './cdp.mjs'
const { evaluate } = await connect()
const result = await evaluate(`(async () => {
  const wait=async(fn,timeout=8000)=>{const s=Date.now();while(Date.now()-s<timeout){const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100))}throw new Error('timeout')}
  const get=()=>window.__QUOTE_PROBE_DOCK__
  get().inputActions.setDraft('前后')
  await wait(()=>get().input.draft==='前后')
  const editor=document.querySelector('[contenteditable="true"]')
  editor.focus()
  const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT)
  let textNode=null
  while(walker.nextNode()){ if(walker.currentNode.nodeValue.includes('前后')){textNode=walker.currentNode;break} }
  if(!textNode) return {ok:false,error:'text node not found'}
  const range=document.createRange(); range.setStart(textNode,1); range.collapse(true)
  const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
  await new Promise(r=>setTimeout(r,500))
  const caret=get().inputActions.captureInsertion()
  window.dispatchEvent(new CustomEvent('dsh-inline-quote:insert',{detail:{text:'中间引用',kind:'text',lines:1}}))
  await wait(()=>get().input.occurrences.length===1)
  return {ok:true,caret,draft:get().input.draft,occurrence:get().input.occurrences[0].offset}
})()`)
console.log(JSON.stringify(result,null,2)); process.exit(0)

