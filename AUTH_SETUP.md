# Optional Account Authentication

## Gameplay and Rankings need no account or backend

**One device. One game.** Guest gameplay, local autosave, Founder’s Gamble, Month 30 victories and achievements work offline. Authentication is optional; it is not required to play.

THE OVERLORD displays a **fixed fictional Top 10**, not live Supabase Rankings. MOGABR is #1 and Gabe M. is #2. MOGABR’s featured valuation and #1 entry both display **$203,718,617,301.68**. The screen also shows the selected profile’s local Personal Best. Browsing it makes no Supabase Rankings reads or score submissions and requires no sign-in or Supabase configuration.

Historical live Rankings, score publishing and public founder-name editing are not exposed by the current UI. Existing implementation files and server records remain intact; they are not instructions to enable those features or apply migrations.

## Separate local games for Guest and accounts

Guest and each authenticated Google or email account have separate local games, recovery copies and Personal Best records on the same device. Isolation follows the Supabase user ID, not the email address or sign-in method: two providers linked to the same Supabase account select the same local profile.

- **Sign in:** select that authenticated account’s local game, or start its own game if it has none. The Guest game is not silently transferred to the account.
- **Sign out:** return to a fresh Guest game after preserving earlier Guest progress in the Guest recovery archive. The signed-out account’s local game and Personal Best remain separate. Guest Personal Best is retained across games.
- **Storage or recovery failure:** unsafe replacement is blocked. Sign-out may stop before completion, or show **Guest save recovery** with **Retry Guest Setup** if Guest initialization fails after authentication signs out. Existing snapshots remain available; do not clear app storage to resolve the error.
- **Legacy games:** assigning a shared historical game to Guest or an account requires an explicit choice. Original shared saves and recovery archives are retained, including Month 42 recovery candidates. Account switching never automatically claims an unassigned legacy game.

Authentication does **not** provide cloud-save synchronization, remote game recovery, or cross-device progress. Signing into the same account on another device does not transfer the game or Personal Best. Existing Supabase gameplay data is neither loaded nor changed. No `game_saves` table setup or database migration is needed for this client.

## Optional Supabase authentication setup

For optional accounts, configure a Supabase project’s Email/Google providers and allowed authentication redirects for each intended environment. From the repository root, copy the public configuration template:

```bash
cp .env.example .env.local
```

Replace the placeholders in `.env.local` using only the project URL and public publishable/anon key:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

These values enable optional account authentication, not live Rankings or cloud saves. Missing configuration does not prevent Guest gameplay. Never use service-role credentials or database passwords in the client. Keep provider secrets in Supabase/Google configuration, never in source code or `VITE_` variables, and do not commit `.env.local`.

### Web Google and email sign-in

The web client uses Supabase Google OAuth and email magic links. Both request a redirect to the current page’s origin and pathname. Ensure the intended development, Preview and production return URLs are allowed in Supabase Auth. Configure the Google provider with the appropriate OAuth client and Supabase callback in Google’s settings; do not substitute a client-side secret or change existing working provider settings merely to build the app.

### Native iOS sign-in

The existing native implementation uses the Google Sign-In SDK through the social-login plugin, then authenticates with Supabase using the returned ID token. For your Supabase/Google project, match the iOS and web/server OAuth client IDs configured in `src/AuthGate.tsx` with the native URL scheme and bundle configuration. Preserve nonce handling; changing environment values alone does not configure these native clients.

Email/deep links use `com.siliconhustle.game://auth/callback`, handled through Capacitor’s App plugin. The committed native URL registrations are:

- `com.siliconhustle.game` for the app callback.
- `com.googleusercontent.apps.665622953523-143uatg5tp21h14sjnvgnbk8imdkifnt` for the existing reversed Google iOS client ID.

AppDelegate passes Google callbacks to Google Sign-In first and forwards other URLs to Capacitor. Keep the app callback allowed in Supabase Auth and preserve the existing Google iOS client/bundle configuration. URL schemes and OAuth client IDs are public identifiers; private provider credentials and signing material must not enter the repository.

When configuring a build, test native Google sign-in, email magic-link callbacks, sign-out and account switching on a physical iPhone, including cold starts and local-profile isolation. A successful build does not establish correct provider configuration or callback handling.

## Local persistence and recovery

Gameplay keys are scoped to Guest or the authenticated account. Within that profile, `silicon-hustle-local-v1` takes priority over compatible `silicon-hustle-v04` and `compute-empire-v04` snapshots. Shared historical snapshots are copied only after explicit assignment, without deleting or overwriting the original shared keys. Existing scoped recovery copies remain available to the save-selection flow.

Personal Best persists separately across games, resets and restarts for each profile, including eligible Founder’s Gamble valuations through Month 42. It is a local record, not a verified online score or a cross-device backup.

An incompatible game is held in place, with **Save a Copy** and **Try Again**. Starting fresh is explicit and only proceeds after original snapshots are retained locally. Exported recovery copies contain game data, not authentication tokens. Check that recovery exports actually reach the intended destination; retained originals remain device-local and do not depend on a successful external download. Clearing app/browser storage removes local games and recovery history; signing in cannot restore deleted data. No cloud import or synchronization occurs automatically.

Preserve application identity when installing an update. An in-place update is not a backup and does not guarantee recovery after uninstalling, changing identity, or clearing storage.

## Build and validate

```bash
npm ci
npm test
npm run test:browser
npm run build
```

For iOS, follow the existing-project build → `npx cap sync ios` → Xcode workspace workflow in [README.md](README.md#building-for-ios) and [IOS_SETUP.md](IOS_SETUP.md). Preserve working native signing settings and the installed app. The React/TypeScript gameplay and persistence implementation is shared across web and iOS. Browser regressions use disposable synthetic snapshots and intercepted APIs; they do not establish physical-device authentication success or inspect production accounts and saves.
