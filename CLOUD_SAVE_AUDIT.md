# Cloud save protection audit

## Findings and changes

| Risk in the previous implementation | Protection added |
| --- | --- |
| A restart forgot the last common cloud state and prompted even when saves matched. | A versioned device-side baseline compares actual game contents. Matching progress syncs without a prompt. Unchanged devices pull cloud progress; only divergent branches require a choice. |
| Cloud revision timestamps came from device clocks. | All writes compare the exact previously read `updated_at`, including explicit device choices. The optional SQL migration makes that token server-generated and strictly increasing, including legacy clients. No unguarded upsert is used. |
| A timeout/termination could occur after a write committed but before its acknowledgement. | The attempted snapshot is durably recorded before sending. Restart/reconnect can recognize that committed ancestor even if more local actions followed. |
| Failed reads/writes had no reconnect, resume, or periodic retry. | Retry on browser online/focus/visibility/pagehide and Capacitor app state changes, plus a 30-second visible/online check and an Account retry button. Requests time out after 12 seconds. |
| Delayed requests could change local progress or metadata after sign-out/account switching. | Each account has a cancellable sync controller; old callbacks cannot load saves, acknowledge revisions, or queue more writes. Sign-out attempts a bounded flush, preserves device progress, and signs out this device only. |
| Multiple actions during a request could race or be dropped from the queue. | Writes are serialized; the exact uploaded snapshot is acknowledged, then the newest local snapshot is drained. A stale browser tab must match the current device save before writing an action; otherwise the latest progress is reloaded and the player retries. |
| Conflict choices lacked a useful comparison and could race newer cloud progress. | Show device/cloud month, cash, and Lab level. Reread both versions; changed versions require review again. The final device overwrite still uses an atomic revision filter. |
| Replacing one branch permanently discarded it. | Keep the last eight replacement snapshots in device storage, including the discarded cloud branch. Account can export current progress plus recovery copies. Backup failures block replacement. |
| Invalid saves or localStorage errors could cause crashes or appear successfully saved. | Validate incoming saves and persist game actions before updating React state. Storage failures keep previous progress and show an error. Malformed device data is backed up before replacement. Legacy save keys remain readable. |

## Verification

- `npm test`: deterministic regression tests of the production synchronization module with isolated storage and a conditional-write cloud fake.
- `npm run build`: TypeScript and production Vite compilation.
- Browser integration uses intercepted Supabase responses only; no live account or cloud save is modified.
- Authentication provider configuration, native nonce/deep-link logic, game formulas, and existing responsive styles are unchanged.

## Database rollout — not applied

Review `supabase/migrations/202610150001_save_revision_guard.sql` before running it on Supabase. It creates a revision trigger; it does not rewrite, delete, or reset existing saves. `schema.sql` includes the same trigger for new installations and retains owner-only RLS.

The client remains compatible with the existing schema by advancing the previous revision timestamp and filtering updates by exact equality. The migration removes reliance on device clocks and prevents old clients from accidentally reusing a revision. Database SQL/RLS behavior still requires validation in a disposable Supabase project before an approved production rollout. No live database configuration was changed during this work.

## Physical-device checks

1. On iPhone and web, sign into the same test account through the existing Google/email flows. Verify matching saves do not prompt repeatedly.
2. Change progress on iPhone, then resume an unchanged web session: it should load cloud progress. Change both before synchronization: compare the conflict summaries and exercise each choice.
3. Use airplane mode, trade/advance, force-quit, and reopen. Device progress must remain. Reconnect with and without changes on web; expect upload or a conflict respectively.
4. Background immediately after several actions, resume, then repeat while disconnecting Wi-Fi. A delayed write must not overwrite a newer cloud branch.
5. Sign out while offline/while a write is pending, then sign back in. Verify local progress remains and cloud is reconciled. Try a different test account: device progress must not upload without an explicit choice.
6. Install the next development build over the existing app with the same bundle ID. Check month, holdings, cash, baseline, and cloud reconciliation. Do not uninstall the app or clear website data.
7. Test recovery export on iOS (download/share behavior depends on WebView support), and inspect conflict dialog scrolling with the keyboard/safe areas.

## Limits

Background network completion is best effort; correctness relies on the local snapshot and baseline surviving. Uninstalling the app, clearing browser storage, private-session eviction, or device loss can remove unsynced progress and device-only backups. Recovery copies are bounded and do not replace a server-side backup/history service. A save is a whole game branch: conflicting progress is chosen, never merged or ranked by month/device time. Existing clients do not gain the improved offline/retry UX until updated.

Reference behavior: [Supabase auth state callbacks](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) stay synchronous; [Capacitor App lifecycle](https://capacitorjs.com/docs/apis/app) supplies native resume/background events.

## Migration validation follow-up

The migration now includes transaction-local 5-second lock and 30-second statement timeouts. See [local validation results](supabase/review/LOCAL_VALIDATION_RESULT.md) and [backup/rollout checklist](supabase/review/CLOUD_SAVE_ROLLOUT.md). Real PostgreSQL tests remain blocked by missing tooling; application regression tests do not establish database correctness. No production checks or migrations were executed.
