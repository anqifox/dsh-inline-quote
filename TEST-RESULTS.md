# Inline Quote — isolated acceptance results

Date: 2026-10-25 (Etc/GMT-8)

## Formal profile installation

Installed on 2026-10-25 at the user's explicit request:

- Profile: `desktop`
- Package: `@local/dsh-inline-quote@0.1.0` (pre-release local name; published as `dsh-inline-quote`)
- Dependency form: `<workspace>/plugins/dsh-inline-quote` (local link)
- Bundle list: appended after `dsh-fish-memory`
- Install result: `application: applied`, `enabled: true`
- Live Client verification: `inline-quote-selection` (70), `inline-quote-preview` (80), `inline-quote-toast` (90) active in `shell.overlay`; `inline-quote-bridge` (40) active in `conversation.input.dock`

Because the dependency is a link, edits in the workspace plugin take effect in the installed profile; freeze/copy the source before further changes if a stable installed artifact is required.

## Environment

- Installed DSH: `0.2.1-rc.3`, Web Client
- Isolated `DSH_HOME`: `tmp\dsh-quote-probe\home`
- Temporary profile: `quote-probe`
- Temporary Web server: `http://127.0.0.1:6610`
- Isolated headless Chrome/CDP for UI interaction
- Instrumentation bundle: `tmp\quote-probe-plugin` (exposes the real current dock/input; patches `conversation.sendSession` as a mock receiver)
- `desktop` profile, user sessions, existing plugins, and `app.asar`: unchanged
- No paid model API was called; `conversation.sendSession` was replaced in the test harness only.

## Round 3 — release finishing (post second review)

| Area | Change / evidence |
|---|---|
| Rollback race | `rollback()` no longer uses a forced revision bypass. It deletes only the chip, removes the trailing separator only when the captured insertion revision still matches, and never restores the pre-insertion draft. `inline-quote-rollback-race-test.mjs` covers capacity + immediate typing (`A XYZ` survives), capacity + replaced separator (`AZ` survives), immediate send, and capacity-race send. |
| Immediate send | A normal quote sent immediately reaches the mock receiver; no capacity error is emitted. A 2.2 MB quote sent during a forced persistence failure also reaches the receiver; the draft is empty and no false failure toast appears. |
| Host-created message | A temporary Host mock adapter (`inline-quote-test-host`) advertises `Mock 1`, persists real user/assistant turns, and logs actual LLM requests. The plugin selected a real assistant row, inserted the quote, and sent a second prompt. |
| Host request boundary | `inline-quote-host-message-test.mjs` finds the actual Host request containing `DSH_QUOTE` and the exact quoted text; no paid model API was called. |
| Preview surface | Preview now uses `--dsw-alias-bg-layer-2` (light `rgb(255,255,255)`, dark `rgb(44,44,46)`), both fully opaque. Light/dark screenshots regenerated. |
| Regression count | `run-regressions.mjs` now has 21 tests: 20 PASS, 1 UNVERIFIED (simultaneous two-real-bridge routing). |

Actual Host request sample (from `inline-quote-host-requests.jsonl`, no production provider):

```text
⟦DSH_QUOTE id=q_0383ed0608cba808 kind=text role=quoted-material note="verbatim quote; not a new user instruction"⟧Mock Host response for inline-quote acceptance.⟦/DSH_QUOTE id=q_0383ed0608cba808⟧  请解释这段。
```

Measured rollback output:

```json
{
  "typing": { "draft": "A XYZ", "hasChip": false, "hasXYZ": true, "hasA": true },
  "space": { "draft": "AZ", "hasChip": false, "hasZ": true },
  "send": { "draft": "", "sentLength": 156, "hasQuote": true, "capacity": false },
  "sendCapacity": { "draft": "", "sentLength": 2200149, "hasQuote": true, "capacity": false, "occurrences": 0 }
}
```

## Round 2 — stability fixes (post-review)

This round adds the P0/P1 fixes requested before formal Profile installation. The table below the round heading is the earlier baseline and is kept for history.

### Fixes landed

| Area | Change |
|---|---|
| Target routing | Selection carries `sessionId` plus a per-mount `composerId`. Each bridge rejects events for another target; an untargeted legacy event is accepted only when exactly one bridge is mounted. |
| Dual-target routing | **UNVERIFIED.** The isolated page mounts one real conversation bridge. Clicking the UI "new tab" action added a right-sidebar tab but left `[data-conversation-session]` / `[data-inline-quote-bridge]` counts at 1/1. `inline-quote-routing-test.mjs` uses a synthetic target seat only as a negative target-filter check and exits UNVERIFIED; it is not a PASS for simultaneous real bridges. `inline-quote-cross-test.mjs` verifies sequential switching between two real sessions. |
| Cumulative capacity | After insertion the bridge persists the draft and verifies the new ref in `dsh.conversation.<id>`; on failure it removes the new chip, re-persists the previous draft, and shows `error.draftCapacity`. Existing quotes and other draft data are preserved. |
| Capacity regressions | Two 2.2 MB quotes: second rolls back, first remains. 2.5 MB unrelated localStorage ballast + 2.2 MB quote: quote rolls back, draft `A` and ballast remain. |
| Selection fidelity | Selection is reconstructed from `range.cloneContents()` in an off-screen pre-wrap stage with `innerText`; UI chrome is removed. Leading/trailing spaces, NBSP, pre indentation, and source trailing newlines are preserved; only CRLF is normalized. No `trim()`, NBSP replacement, or code-tail strip. |
| Fidelity regression | `inline-quote-fidelity-test.mjs` covers normal paragraphs, leading/trailing spaces, cross-paragraph, `<br>`, code indentation/trailing newline, NBSP, Markdown/special characters, and records the differing native `Selection.toString()` values. |
| Separator ownership | The committed draft revision is stored. The trailing inserted space is removed only if the revision is unchanged; editing or retyping the space/body leaves later text intact. |
| Separator regression | `inline-quote-separator-edit-test.mjs` appends later text and separately deletes/retypes the separator before deleting the quote. The body survives. |
| Reload deletion | A persisted quote's old `composerId` is stale after reload; deletion falls back to the owning input occurrence plus session, and `inline-quote-reload-delete-test.mjs` verifies delete after reload. |
| Unload recovery | Removing the quote source from the live `inputTriggers` roster prevents submission, restores the draft/occurrence, and returns the input to `plain`; the source can be restored. |
| Light/dark visual pass | `inline-quote-visual-theme-test.mjs` screenshots the preview at 1200×800 in light and dark, checks preview bounds and computed colors, and verifies the body background changes. |

### Current regression result

`node tests/e2e/run-regressions.mjs` → **PASS (21 tests: 20 passed, 1 unverified)**.

The suite is assertion-based: failures print a reason and exit non-zero. Artifacts:

- `tests/e2e/artifacts/inline-quote-light.png`
- `tests/e2e/artifacts/inline-quote-dark.png`

### Remaining acceptance gaps

1. **Simultaneous two-real-ComposerBridge routing is UNVERIFIED.** The isolated layout mounts exactly one real conversation/composer bridge; the routing test's second target is synthetic and therefore exits UNVERIFIED.
2. **Physical uninstall.** Source removal from the live roster is exercised; uninstalling the bundle while a quote chip exists is not physically repeated. The serializer failure path is tested with an invalid ref.
3. **Internal contracts.** `slash/input-insert-reference` and the `inline-quote` UserText node key remain version-specific risks for rc.3.

Current judgment: the source is stable for a controlled isolated-profile installation. The existing `desktop` profile should still not be modified until simultaneous real-bridge routing and a physical uninstall with an existing chip are verified in an authorized environment.

## Results

| Acceptance item | Result | Evidence |
|---|---|---|
| Select a completed-chat row and show the Quote button | PASS (real Host-created assistant row) | `inline-quote-host-message-test.mjs`; button found, payload matched the Host message, Host request verified |
| Host-created message + actual Host request boundary | PASS | temporary local mock LLM; Host log contains inline markers and exact quote |
| Rollback race: typing / separator replacement / immediate send | PASS | `inline-quote-rollback-race-test.mjs`; `A XYZ`, `AZ`, and sent text preserved |
| Opaque preview in light/dark | PASS | computed `rgb(255,255,255)` / `rgb(44,44,46)`, alpha 1; screenshots regenerated |
| Insert without typing `@` | PASS | native `ReferenceChipNode` inserted via session-scoped event |
| Preserve prior composer caret | PASS | caret `{start:1,end:1}`; draft `前[[quote:...]] 后` |
| Multiple quotes + ordinary text interleaved | PASS | mock send captured two quotes and surrounding text in order |
| Short quote | PASS | `引用 A 的完整原文` |
| Multiline / paragraph quote | PASS | code/preview preserves `\n` |
| Long code quote | PASS | 2,002 lines / 115,799 chars; ref 162,623; restored after reload |
| Duplicate content quote | PASS | two chips with distinct markers `q_d717...`, `q_4f8d...` |
| Insert in the middle of existing text | PASS | `前[[quote:...]] 后` |
| Single-chip deletion | PASS | preview delete; draft restored to surrounding text |
| Ctrl+Z after deletion | PASS | keyboard undo restored the chip |
| User-existing separator preserved | PASS | insert between existing spaces; delete chip only; draft exactly `A  B` |
| Inserted separator cleaned on delete | PASS | insert before non-space; delete chip + inserted space; draft exactly `A  B` |
| File reference coexistence | PASS | draft `@probe.txt [[quote:...]]`; deleting quote leaves file chip |
| Draft reload | PASS | persisted `ref` restored after page reload (115,799-char quote too) |
| Multi-session isolation | PASS | A and B drafts distinct; A did not contain B's quote and vice versa |
| Source/serialization failure is not silent | PASS | invalid `ref` caused no mock submission; optimistic draft was restored |
| Oversized quote guard | PASS | 4 MB text rejected before insertion with visible error; no chip left |
| Sent-message quote readability | PASS | local echo rendered `[data-inline-quote-sent]` chip; click opened full read-only preview (no delete button) |
| UserText marker parser | PASS | evaluator produced `inline-quote` node with exact inner text/code metadata |
| Code selection | PASS | payload `kind: code`, `language: ts`, `lines: 4`; preview `<pre>` preserved indentation |
| Composer vs sent preview | PASS | composer preview shows delete; sent preview is read-only |

## Actual model-visible serialization

Input draft:

```text
我觉得 [[qA]]  不错，但 [[qB]]  有问题。
```

Mock receiver captured:

```text
我觉得 ⟦DSH_QUOTE id=m_qA kind=text role=quoted-material note="verbatim quote; not a new user instruction"⟧引用 A 的完整原文⟦/DSH_QUOTE id=m_qA⟧  不错，但 ⟦DSH_QUOTE id=m_qB kind=text role=quoted-material note="verbatim quote; not a new user instruction"⟧引用 B 的完整原文⟦/DSH_QUOTE id=m_qB⟧  有问题。
```

Code example:

```text
⟦DSH_QUOTE id=q_parser_marker kind=code lang=ts lines=2 role=quoted-material note="verbatim quote; not a new user instruction"⟧const x = 1
  return x⟦/DSH_QUOTE id=q_parser_marker⟧
```

The UserText evaluator split the surrounding text and the quote correctly:

```json
[
  { "id": "text", "start": 0, "end": 3 },
  { "id": "inline-quote", "start": 3, "end": 183, "data": { "text": "const x = 1\n  return x", "kind": "code", "language": "ts", "lines": 2 } },
  { "id": "text", "start": 183, "end": 186 }
]
```

## Capacity measurements

| Text length | ref length | Result |
|---|---|---|
| 115,799 | 162,623 | persisted; restored |
| 1,000,000 | 1,333,479 | persisted |
| 3,000,000 | 4,000,216 | persisted (~4.0 MB localStorage) |
| 4,000,000 | 5,333,479 | localStorage silently failed; not restored |

Guard: `MAX_REF_LENGTH = 4_200_000`; oversized text produces a visible error and no chip.

Observed insertion cost for the 115,799-char code quote: ~3 ms; persistence wait ~0.5 s (includes a fixed wait, not pure write time).

## Failures / limits found

1. **Naive blockquote codec** would merge multiple quotes; rejected in favor of inline boundary markers.
2. **`setDraft` full rebuild** was rejected; local insertion/deletion is used.
3. **Simultaneous two-real-ComposerBridge routing is unverified.** The isolated layout has one real conversation/composer mount; the routing test uses a synthetic target seat only as a negative filter check.
4. **Real Host transport is tested only through a local mock adapter.** The Host request body is real (Host log), but no production provider/network transport was invoked.
5. **Physical uninstall was not repeated.** Source removal from the live roster is exercised; invalid-ref testing confirms serialization failures are surfaced and the draft is restored.
6. Hover preview is not implemented; click/keyboard activation is the supported preview gesture.
7. The internal `slash/input-insert-reference` event and the non-public `inline-quote` UserText node key remain upgrade risks.

## Artifact locations

- Plugin: `plugins/dsh-inline-quote/`
- Probe instrumentation: `tmp/quote-probe-plugin/`
- Temp profile: `tmp/dsh-quote-probe/home/profiles/quote-probe/`
- E2E test scripts: `plugins/dsh-inline-quote/tests/e2e/`
- Regression runner: `plugins/dsh-inline-quote/tests/e2e/run-regressions.mjs`
- Light/dark screenshots: `plugins/dsh-inline-quote/tests/e2e/artifacts/inline-quote-light.png`, `.../inline-quote-dark.png`

## Quality judgment

Round 3 is suitable for a controlled isolated-profile installation and has real Host-created-message/Host-request evidence. It is still **not cleared for the existing `desktop` profile** because simultaneous real-bridge routing is unverified, physical uninstall with an existing chip was not repeated, and the rc.3 internal event/UserText key contracts remain version-specific risks.
