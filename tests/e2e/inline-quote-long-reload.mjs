import { connect } from './cdp.mjs'
const { evaluate } = await connect()
await evaluate('location.reload()')
await new Promise(r=>setTimeout(r,2500))
const result = await (async()=>{
  const { evaluate } = await connect()
  const start=Date.now()
  while(Date.now()-start<15000){
    const v=await evaluate(`(() => {
      const dock=window.__QUOTE_PROBE_DOCK__
      if(!dock) return undefined
      const occ=dock.input.occurrences[0]
      if(!occ) return undefined
      let payload=null; try{payload=window.__QUOTE_PROBE_DECODE_REF__(occ.ref)}catch(e){}
      return {draft:dock.input.draft, occurrences:dock.input.occurrences.length, refLength:occ.ref.length, textLength:payload?.text?.length, label:occ.label}
    })()`)
    if(v) return v
    await new Promise(r=>setTimeout(r,250))
  }
  return null
})()
console.log(JSON.stringify(result,null,2)); process.exit(0)

