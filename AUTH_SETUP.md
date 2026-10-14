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

Guest saves continue in localStorage. Once signed in, changes are also synced to Supabase. If a device has both a local save and an existing cloud save, players are asked which to keep. Cross-device syncing is best used on one device at a time; this version is not a collaborative multi-device live session. Save errors are shown to the player.

## iOS

The React UI works within Capacitor. Before shipping iOS, configure a reliable native OAuth callback/deep-link strategy and consider Sign in with Apple to meet App Store rules for apps offering third-party sign-in.

## Build

```bash
npm install
npm run build
```
