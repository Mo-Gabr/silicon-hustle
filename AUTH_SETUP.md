# Silicon Hustle v0.9 — Optional Accounts

Guest play works without any backend. First visit shows a retro founder welcome; returning visitors go directly to the game. Sign-in is optional and is meant to enable cross-device saves.

## Enable Google + email sign-in and cloud saves

1. Create a Supabase project at https://supabase.com/dashboard.
2. In Supabase SQL Editor, run `supabase/schema.sql` to create the protected game saves table.
3. Under Authentication → Providers, enable Email (magic links) and Google. Google requires OAuth credentials from Google Cloud and the Supabase callback URL shown in the provider setup.
4. Under Authentication → URL Configuration, set the site URL to `https://silicon-hustle.vercel.app`, and allow redirect URLs for this site (and any later custom domain).
5. In Vercel project Settings → Environment Variables, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the project's Supabase URL and publishable/anon key. These are public client credentials; **never use a service_role key**.
6. Redeploy Vercel after adding variables. Google and email buttons remain disabled until configured.
7. Upload the supplied pixel portrait to `public/founder.png` in GitHub. Vite serves it at `/founder.png`. The splash remains usable without the image, but the portrait won't appear until uploaded.

## Save behavior

Guest saves continue in localStorage. Signed-in players automatically resume identical copies or a valid cloud-only save. A valid device-only save resumes after a successful cloud read confirms absence; **Account → Saved Games** provides explicit consent before importing an unbound device game into that account. Once synchronized, account-specific local history permits automatic uploads only while the cloud snapshot remains unchanged. A changed cloud save or unproven continuation opens **PICK UP WHERE YOU LEFT OFF**; timestamps and valuation are not used to choose a winner.

Cloud read errors leave device play available and pause sync. Online/focus/app-foreground events recheck the cloud. Writes use a conditional timestamp and full-snapshot comparison; competing changes require review. Recovery copies are persisted locally before replacements; manual choices preserve both originals, and ordinary sync retains its latest before/after pair. Players can export them from Saved Games. Storage failure pauses sync; clearing app/browser storage removes this local history and recovery data. No additional database columns, triggers, or migrations are used. Supabase owner-only RLS remains required.

Cross-device syncing is best used on one device at a time; this is not a collaborative live session. Other-tab changes pause sync and local writes until reload. Older client versions retain their previous behavior. Large snapshots can exceed gateway URL limits for full-snapshot conditional writes: a rejected request pauses sync without an unconditional fallback. Offline and cross-device behavior is covered with synthetic browser/API tests; native authentication and real-device cross-device flows still require validation.

## iOS

The React UI works within Capacitor. Before shipping iOS, configure a reliable native OAuth callback/deep-link strategy and consider Sign in with Apple to meet App Store rules for apps offering third-party sign-in.

## Build

```bash
npm install
npm run build
```
