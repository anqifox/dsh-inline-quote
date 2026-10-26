# Changelog

## 0.1.0 — 2026-10-26

Initial public release. Verified against DSH `0.2.1-rc.3` Web Client.

- Select text in a completed conversation row; insert it as a native composer reference chip (`source: 'quote'`). Multiple quotes interleave with ordinary text and are sent as one normal message.
- Model-visible `⟦DSH_QUOTE ...⟧` boundaries carry `role=quoted-material`; code quotes add `kind=code`, `lang`, and `lines`. Quote text is never truncated.
- Click a chip to preview. Code previews preserve indentation and can be copied; sent-message quotes are read-only history.
- Delete a composer chip with Backspace/Delete at its edge or through the preview button; Ctrl+Z restores it. Trailing-separator cleanup only happens when the draft revision is unchanged.
- Transactional capacity guard: a quote is committed only after its `ref` is observed in the persisted draft; otherwise the chip is rolled back and an error is shown.
- Session and composer routing: a bridge accepts only its exact `composerId`; a stale `composerId` after reload falls back to the quote id within the same session.
- Test suite: 21 assertions, 20 PASS and 1 explicitly UNVERIFIED (simultaneous two-real-bridge routing).

### Compatibility

This release targets `slash/input-insert-reference`, `ReferenceChipNode` with `source: 'quote'`, `InputState.occurrences`, and the non-public `inline-quote` key on `conversation.user.text.node`. A DSH minor release that changes those contracts may require a migration.
