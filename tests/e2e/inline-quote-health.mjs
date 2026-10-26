import { connect } from './cdp.mjs'
const { evaluate } = await connect()
const info = await evaluate(`(() => ({
  crashed: document.body.innerText.includes('slot entry crashed'),
  preview: !!document.querySelector('[data-inline-quote-preview]'),
  probeErrors: window.__QUOTE_PROBE_ERRORS__ ?? [],
  pluginSourceCount: window.__QUOTE_PROBE_DOCK__ ? 1 : 0,
}))()`)
console.log(JSON.stringify(info,null,2)); process.exit(0)
