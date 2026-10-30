# Inline Quote acceptance tests

These are the real Client scripts used in the isolated rc.3 probe. They are not a portable CI suite: they assume the temp profile, probe instrumentation, and local CDP port used during development.

## Layout

- `probe-plugin/` — instrumentation bundle exposing the live dock/input; its `conversation.sendSession` wrapper is a mock by default and can be bypassed with `window.__QUOTE_PROBE_MOCK_SEND__ = false`.
- `host-mock/` — host-only mock LLM adapter (`inline-quote-mock` / `mock-1`) used to create real Host-persisted turns and log actual Host requests.
- `e2e/cdp.mjs` — minimal Chrome DevTools Protocol client. It imports the `ws` package; install it with `npm install ws` in `tests/e2e` before running.
- `e2e/inline-quote-*.mjs` — test steps.
- `e2e/run-regressions.mjs` — 22-test runner after adding the v0.2 synthetic Trajectory selection case; one pre-existing test exits 2 and is reported UNVERIFIED. The new test is not yet run.

## Environment

```text
DSH_HOME = <workspace>\tmp\dsh-quote-probe\home
profile  = quote-probe
server   = http://127.0.0.1:6610
CDP      = http://127.0.0.1:9224
```

The temp profile must contain:

- `plugins/dsh-inline-quote` (the real plugin)
- `probe-plugin` (instrumentation)
- `host-mock` (mock Host LLM)

Install all through the official CLI in the temp profile:

```powershell
$env:DSH_HOME = '...\tmp\dsh-quote-probe\home'
dsh plugin --profile quote-probe add '...\plugins\dsh-inline-quote'
dsh plugin --profile quote-probe add '...\plugins\dsh-inline-quote\tests\probe-plugin'
dsh plugin --profile quote-probe add '...\plugins\dsh-inline-quote\tests\host-mock'
```

Add this to the temp profile's `cordis.patch.yml` so the mock model is selected:

```yaml
- id: agent-default-model
  config:
    provider: inline-quote-mock
    model: mock-1
```

The Host mock writes actual provider request bodies to `tmp/inline-quote-host-requests.jsonl`. The probe plugin expects `probe-plugin/package.json` as its own local package; the original workspace used `tmp\quote-probe-plugin` with id `@local/dsh-quote-probe`.

## Suggested order

1. `inline-quote-smoke.mjs` — plugin/source/codec present.
2. `inline-quote-selection-test.mjs` — synthetic completed-row selection, button, real chip preview.
3. `inline-quote-trajectory-selection-test.mjs` — synthetic multi-record Trajectory view under a live Session + real native composer insertion. Does NOT prove the real Trajectory component, Host delivery or fidelity of complex tables.
4. `inline-quote-send-test.mjs` — two inline quotes + text; mock receiver.
4. `inline-quote-delete-clean.mjs` — preview delete + Ctrl+Z.
5. `inline-quote-existing-space-test.mjs` / `inline-quote-inserted-space-test.mjs` — separator ownership.
6. `inline-quote-caret-test.mjs` — insertion at the prior composer caret.
7. `inline-quote-code-test.mjs` — code selection, language/lines, `<pre>` preview.
8. `inline-quote-file-test.mjs` — file chip coexistence.
9. `inline-quote-duplicate-test.mjs` — duplicate text, distinct markers.
10. `inline-quote-long-test.mjs`, `inline-quote-long-reload.mjs` — 115k code quote / reload.
11. `inline-quote-1m-test.mjs`, `inline-quote-3m-test.mjs` — capacity.
12. `inline-quote-capacity-guard-test.mjs` — oversized quote rejected with visible error.
13. `inline-quote-cross-test.mjs` — two-session isolation.
14. `inline-quote-sent-render-test.mjs` — local-echo sent-message chip + preview.
15. `inline-quote-parser-test.mjs` — UserText marker evaluator.
16. `inline-quote-failure-test.mjs` — invalid ref does not submit and restores the draft.
17. `inline-quote-capacity-cumulative-test.mjs` — second quote/other draft data under quota pressure.
18. `inline-quote-rollback-race-test.mjs` — capacity + immediate typing/replaced separator/immediate send.
19. `inline-quote-host-message-test.mjs` — real Host-created assistant selection and actual Host request body.
20. `inline-quote-visual-theme-test.mjs` — light/dark opaque preview screenshots.
21. `inline-quote-routing-test.mjs` — synthetic negative target check only; exits 2 UNVERIFIED.

`run-regressions.mjs` runs all 22 in this order, including the synthetic Trajectory selection case. Results from 0.1.x's historical 21 tests cannot be treated as v0.2 results without a fresh run. Some scripts depend on state left by earlier scripts (notably the persisted `quote-probe-persist-expected` localStorage key used by the cross-session test).

## Notes

- The probe replaces `conversation.sendSession` by default; set `window.__QUOTE_PROBE_MOCK_SEND__ = false` for Host-boundary tests. No paid model API is called.
- The real plugin's public behavior is tested through its UI events (`dsh-inline-quote:insert`, native chip activation, preview delete) and through the real composer.
- `inline-quote-host-message-test.mjs` uses a real Host-persisted assistant message and the real Host request body. Selection tests without the Host mock still use a synthetic completed-row fixture with the same `data-chat-*` attributes.
- Simultaneous two-real-ComposerBridge routing is UNVERIFIED; the isolated page has one real conversation mount. The routing test's second target is synthetic and must not be reported as a PASS.
- Run `npm install ws` in `tests/e2e` before executing the scripts.
