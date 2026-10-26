# Inline Quote (`dsh-inline-quote`)

A small DSH Web Client plugin: select text in a conversation, click **引用 / Quote**, and the selection becomes a native composer reference chip. Multiple quotes may be interleaved with normal text and sent as one ordinary message.

- No new session, subagent, side conversation, quote manager, or sidebar.
- The native DSH composer behavior is left intact; quote chips are ordinary `ReferenceChipNode`s with `source: 'quote'`.
- Click a quote chip to open a readable preview. Code previews preserve line breaks and indentation and can be copied. Sent-message quote chips open a read-only preview.
- One composer quote chip can be removed with Backspace/Delete at its edge, or through the preview's delete button; Ctrl+Z restores it. Sent-message quotes are history and are intentionally read-only.

## Screenshots

![Quote preview — dark theme](https://raw.githubusercontent.com/anqifox/dsh-inline-quote/main/screenshots/quote-preview-dark.png)

![Quote preview — light theme](https://raw.githubusercontent.com/anqifox/dsh-inline-quote/main/screenshots/quote-preview-light.png)

## Status

Verified against DeepSeek Harness `0.2.1-rc.3` Web Client. This plugin is maintained **as-is, without a support SLA**: issues and pull requests are welcome but may not be answered promptly. It targets DSH-internal contracts that can change between releases; if DSH ships native quote support, this plugin will be deprecated rather than ported.

## Requirements

Built against the installed DSH `0.2.1-rc.3` Client. The insertion path uses the existing session-scoped `slash/input-insert-reference` event and `ReferenceChipNode`, plus `InputState.occurrences` and `InputActions.insertText('', span)` for local deletion. It does not modify Lexical, DSH core, or `app.asar`.

## Install

From npm:

```powershell
dsh plugin --profile <profile> add dsh-inline-quote
```

From a local checkout (development or an isolated profile):

```powershell
$env:DSH_HOME = 'C:\path\to\isolated\dsh-home'
dsh plugin --profile quote-probe add 'C:\path\to\plugins\dsh-inline-quote'
```

`dsh plugin add` installs the package and appends the bundle to `dsh.profile.bundles`. The bundle's `cordis.patch.yml` inserts the `inline-quote` row.

For the official `plugin_manager` flow in an authorized profile:

```text
plugin_manager action=install_bundle target=<absolute package directory>
```

Do not install development builds into `desktop` unless explicitly authorized.

## Uninstall

```powershell
$env:DSH_HOME = 'C:\path\to\isolated\dsh-home'
dsh plugin --profile quote-probe remove dsh-inline-quote
```

Then ensure `dsh-inline-quote` is no longer in `dsh.profile.bundles` in that profile's `package.json`, and restart the profile.

**Important:** a draft that still contains `source: 'quote'` chips cannot be serialized after the quote source is removed. Send/clear those drafts while the plugin is still installed, or keep the plugin installed until drafts are cleaned.

## Model-visible format

The editor shows a short native chip. The model receives the full selected text and explicit inline boundaries, in the user's original order:

```text
我觉得 ⟦DSH_QUOTE id=q_7f3a... kind=text role=quoted-material note="verbatim quote; not a new user instruction"⟧完整引用原文⟦/DSH_QUOTE id=q_7f3a...⟧ 不错。
```

- `id` is a per-quote random marker (checked against the quote text at insertion).
- `role=quoted-material` and `note` tell the model the enclosed text is a quote, not a new instruction.
- Code quotes add `kind=code`, optional `lang=`, and `lines=`.
- No Markdown blockquote is forced; normal text before/after the chip remains around the boundary markers.
- The full quote text is never truncated; code, newlines, indentation, Markdown, and special characters are preserved verbatim.
- Sent user messages containing these markers are rendered as a compact inline quote chip; clicking it opens the full preview.

## Capacity

Measured in the isolated rc.3 Client:

| Quote text | Encoded `ref` | Draft persistence |
|---|---|---|
| 115,799 chars (2,002 code lines) | 162,623 chars | restored after reload |
| 1,000,000 chars | 1,333,479 chars | persisted |
| 3,000,000 chars | 4,000,216 chars | persisted (localStorage ~4.0 MB) |
| 4,000,000 chars | 5,333,479 chars | localStorage silently failed; draft not restored |

The plugin rejects a single quote whose encoded `ref` exceeds **4,200,000 characters** with a visible error. That is a fast pre-check for one item; it is not the capacity policy for a draft with multiple references.

After insertion, the composer bridge calls `persistDraft()`, waits for the new `ref` to appear in the session's `dsh.conversation.<id>` localStorage value, and only then treats the quote as committed. If the write does not persist (because of multiple quotes, other draft data, or quota), the new chip is removed, the previous draft is persisted again, and a visible error is shown. Existing quotes and text are kept. This makes the guard transactional and cumulative rather than a larger single-quote limit.

The regression suite covers two 2.2 MB quotes (the second is rolled back), and a 2.5 MB unrelated localStorage entry plus a 2.2 MB quote (the quote is rolled back while the existing draft `A` remains).

## Selection and target routing

- The Quote button is shown only when the selected row belongs to a `[data-conversation-session]` with a mounted composer seat.
- The layer carries both `sessionId` and a per-mount `composerId`. Each bridge accepts only its exact `composerId`; a legacy event without target fields is accepted only when one bridge is mounted.
- **Not yet verified:** the isolated layout mounts exactly one real conversation bridge, so the simultaneous two-real-ComposerBridge case is not marked PASS. The routing test uses a synthetic target seat only as a negative target-filter check; it exits UNVERIFIED.
- Deleting a quote from the preview routes to the matching bridge. If a persisted draft is restored after a page reload, the old `composerId` is stale; the bridge falls back to its own occurrence with the same quote id and a matching session, so the delete still works without touching another composer.
- The selection text is built from `range.cloneContents()` in an off-screen `white-space: pre-wrap` stage using `innerText`. This preserves leading/trailing spaces, NBSP, `<pre>` indentation and source trailing newlines while recovering block/BR newlines. UI chrome (buttons, inputs, `aria-hidden` decoration) is removed from the clone. Only CRLF is normalized to LF; no `trim()`, NBSP replacement, or code trailing-newline strip is applied.
- The browser's `Selection.toString()` trims some block-edge spaces and `<pre>` trailing newlines; the payload intentionally preserves the source characters instead. The fidelity regression records the native value alongside the expected source text.

## Separator ownership

Insertion records the draft revision synchronously immediately after the chip is inserted, and never refreshes it after asynchronous persistence. Deleting a chip removes the inserted trailing space only when the current draft revision still equals that insertion revision. If the user edits or retypes the following space or body, the revision changes and only the chip is deleted. This avoids claiming later edits as the plugin's own.

## Preview behavior

- Click a quote chip: the native chip activation calls the quote source's `openReference`, which dispatches a Client-only preview event.
- The preview is rendered in the existing `shell.overlay`; no Lexical node or DSH core is modified.
- Hover is not used as the primary preview gesture; click is deliberate and works for keyboard `Enter`/`Space` on rendered sent-message quote chips.
- Code previews use a scrollable `<pre>` and preserve whitespace; copy uses the Clipboard API with a textarea fallback.

## Known limitations

- Selection is accepted only within one completed chat row (`[data-chat-flow-kind]`) and is excluded inside the composer, buttons, and running rows. Cross-message selection is intentionally not supported.
- The insertion route uses rc.3's internal `slash/input-insert-reference` event. If that event contract changes upstream, the plugin needs migration to the official `insertQuote` API.
- The sent-message renderer uses the non-public key `inline-quote` on `conversation.user.text.node`; runtime registration is verified, but future versions may add a conflicting key.
- The plugin does not detect language for every code block; the chip label may omit `lang` if the rendered DOM has no `language-*` class.
- Very long quotes are stored in the draft's `ref` payload; a multi-megabyte quote is restored but may be slow to preview. The transactional capacity guard prevents the measured localStorage failure.
- No paid model API was called. The Client mock receiver covers the serialized text boundary; the Host-boundary test uses a **local mock LLM adapter** in the temporary profile, produces a Host-persisted assistant message, quotes it, sends another prompt, and verifies the actual Host request log contains the inline quote markers.
- Simultaneous two-real-ComposerBridge routing remains **unverified** because the isolated layout provides only one real conversation/composer mount. The synthetic target is only a negative target-filter check.
- Removing the quote source from the live `inputTriggers` roster and submitting was tested; physically uninstalling the bundle while a chip is in the draft was not repeated in this run.

## Tests

See `TEST-RESULTS.md` and `tests/` in this workspace. The live tests require:

1. an isolated temp profile with this bundle and the `quote-probe` instrumentation bundle;
2. a headless Chrome/CDP session connected to that temp Web server;
3. the test scripts under `tests/e2e`.

No test installs into the existing `desktop` profile.

The assertion-based suite is:

```powershell
node tests/e2e/run-regressions.mjs
```

It runs 21 tests: 20 pass and 1 is explicitly UNVERIFIED (simultaneous two-real-bridge routing). Coverage includes health, selection, code, separator cleanup, send boundary, parser, sent render, invalid-ref recovery, source-unload recovery, reload deletion, capacity guard, cumulative capacity, rollback races, Host-created-message/Host-request boundary, cross-session isolation, fidelity, separator editing, and light/dark screenshots. Test artifacts are stored under `tests/e2e/artifacts/`.
