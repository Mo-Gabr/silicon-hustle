# Optional Rankings Authentication

## Gameplay needs no account or backend

**One device. One game.** Silicon Hustle saves and resumes on the current browser profile or installed iOS app. Guest gameplay, Founder’s Gamble, Month 30 victories and achievements work offline. Sign-in never gates launch or changes the local game.

Cloud synchronization, server-save reads/writes, save-source selection and cloud recovery have been removed from the application. Existing Supabase data remains untouched. No `game_saves` table setup or database migration is needed for this client.

## Optional online Rankings

Public Rankings reads use the existing `get_billionaire_board` RPC anonymously. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the project URL and public publishable/anon key in each intended build environment. Never use service-role credentials or database passwords. Missing configuration or connectivity does not prevent local gameplay.

Google or email sign-in is optional and can identify an existing published record. Score publishing and founder-name editing are paused: the previous matching-server-save attribution requirement has not been bypassed. A separately reviewed local-only attribution model is required before publishing resumes.

For optional authentication, configure the existing Supabase Email/Google providers and approved web redirect URLs. Google provider credentials belong in Supabase, not in the browser bundle. The committed iOS integration uses `com.siliconhustle.game://auth/callback` for email/deep links and the existing native Google integration. No provider configuration was changed for this release. Native sign-in still requires physical-device validation.

## Local persistence and recovery

The client reads `silicon-hustle-local-v1` first, then historical `silicon-hustle-v04` or `compute-empire-v04` snapshots. It never deletes historical snapshots. Supported older saves receive presentation defaults in memory while preserving financial state and unknown metadata. New progress uses the local-only key.

An incompatible game is held in place, with **Save a Copy** and **Try Again**. Starting fresh is explicit and only proceeds after original snapshots are retained locally. Exported copies contain game data, not authentication tokens. Native download/export needs device testing; retained originals do not depend on a successful external download. Device storage failures block unsafe replacements. Clearing app/browser storage removes the game and its local recovery history; signing into an account does not restore it. No import or synchronization occurs automatically.

## Build and validate

```bash
npm install
npm test
npm run test:browser
npm run build -- --mode production
```

For iOS, use the committed project and the commands in [README.md](README.md#ios-development). The React/TypeScript persistence and gameplay implementation is shared across web and native iOS. Browser tests use disposable synthetic snapshots and intercepted APIs; they do not inspect production accounts or saves.
