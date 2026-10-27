# Wayfarer — a personal travel journal

Wayfarer is a small web app for keeping track of the places you have been. Add a country and a city (plus an optional date and a short note), and the country lights up on a world map. Your recent places are listed next to it, and you can edit or delete any of them.

**Live demo:** https://wayfarer-travel-journal.vercel.app

## Features

- Interactive world map that highlights every country you have visited
- Passport checker (Explore tab): pick your passport and the map shows where you can go visa-free, with a visa on arrival, with an e-visa, or only with a visa; add "Near me" (use your device location, which never leaves your browser, or pick the country you are in) to see the closest easy destinations with distances, and add any country to your journal
- English and French: the interface follows your browser language, with an EN/FR toggle in the top bar that remembers your choice
- Schengen residence permits (Explore tab): say you hold a residence permit from a Schengen country and the other Schengen countries show as accessible for up to 90 days in any 180
- Light and dark mode: follows your device setting, with a toggle in the top bar that remembers your choice
- Photos (signed-in accounts): attach up to 5 pictures to a place, see them as thumbnails and in a full-screen gallery. Pictures are shrunk in your browser (and their hidden GPS data removed) before upload, and stored privately
- Counters for countries, cities and memories
- Add, edit and delete places (city, country, date, short note)
- Works instantly with no account: your journal is saved in your browser
- Optional account (email + password): your journal is saved in the cloud and follows you across devices
- Private by design: each account can only ever read and change its own entries

## Tech stack

- [Next.js](https://nextjs.org) (App Router) with React and TypeScript
- [Supabase](https://supabase.com) for accounts and the database (Postgres with row-level security)
- [react-simple-maps](https://www.react-simple-maps.io) and `world-atlas` for the map
- Hosted on [Vercel](https://vercel.com)

## How it works

| Situation | Where your places are stored |
| --- | --- |
| Not signed in | In your browser (`localStorage`). Nothing leaves your device. |
| Signed in | In the `travel_entries` table in Supabase, tied to your account. |

If you used the app before signing in, Wayfarer offers to **import** your browser journal into your new account the first time you sign in.

Security note: the `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is meant to be public (it ships to the browser). What keeps data private is the row-level security in `supabase/schema.sql`, which only lets a user touch rows where `user_id` is their own. Never put a `service_role` or `sb_secret_...` key in this project.

## Project structure

```
src/
  app/page.tsx            Main screen: stats, map, places list, add/edit form
  app/auth/callback/      Handles the link in the confirmation email
  components/WorldMap.tsx The map
  components/AccountDialog.tsx  Sign in / create account
  lib/supabase/           Supabase clients (browser + server) and env helpers
  proxy.ts                Keeps signed-in sessions fresh (Next.js proxy)
supabase/schema.sql       Database table and security rules
supabase/photos.sql       Photos table, private storage bucket and their rules
```

---

## Run it on your computer

You need [Node.js](https://nodejs.org) (v20 or newer) and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/Yerima18/wayfarer-travel-journal.git
cd wayfarer-travel-journal
pnpm install
pnpm dev
```

Open http://127.0.0.1:3000. Without any extra setup the app runs in **local mode** (places saved in your browser only). To enable accounts, follow the Supabase steps below.

## Set up Supabase (accounts and cloud sync)

1. **Create a project** at [supabase.com](https://supabase.com) (the free plan is enough).
2. **Get your keys:** in your project go to *Project Settings → API Keys* and copy the **Project URL** and the **publishable key** (it starts with `sb_publishable_`).
3. **Add them locally:** copy `.env.example` to `.env.local` and fill it in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
   `.env.local` is gitignored, so your keys are never pushed to GitHub.
4. **Create the table:** open *SQL Editor* in Supabase, paste the whole content of `supabase/schema.sql`, and run it. This creates the `travel_entries` table and the security rules. You only do this once.
5. **Enable photos (optional):** in *SQL Editor*, paste and run `supabase/photos.sql` once. It creates the `entry_photos` table and a private `entry-photos` storage bucket, both readable only by their owner.
6. **Allow email + password sign-in:** *Authentication → Providers → Email* must be enabled (it is by default).
7. **Tell Supabase your site address:** *Authentication → URL Configuration*
   - **Site URL:** `http://localhost:3000` for local work (use your Vercel URL in production).
   - **Redirect URLs:** add `http://localhost:3000/auth/callback`.
8. Restart `pnpm dev`, click **Sign in → Create an account**, confirm your email, and add a place.

## Deploy your own copy on Vercel

1. Fork or push this repo to your own GitHub account.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository. Keep the Next.js preset.
3. Before deploying, open **Environment Variables** and add exactly these two (names must match letter for letter):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
4. Click **Deploy**. Vercel gives you a URL like `https://your-app.vercel.app`.
5. Back in Supabase, *Authentication → URL Configuration*:
   - set **Site URL** to your Vercel URL
   - add `https://your-app.vercel.app/auth/callback` to **Redirect URLs**

   If you skip step 5, the confirmation link in sign-up emails will not work.

Any later `git push` to `main` redeploys automatically. If you change an environment variable in Vercel, trigger a redeploy for it to take effect.

## Troubleshooting

| Problem | Likely cause and fix |
| --- | --- |
| "Account sync is ready to connect" in the sign-in window | The two environment variables are missing or misspelled. Fix them (locally or in Vercel) and redeploy/restart. |
| Confirmation email link goes to the wrong page or errors | Site URL / Redirect URLs in Supabase do not match your site address (step 7 / step 5 above). |
| "Sync issue" badge after signing in | The `travel_entries` table does not exist yet. Run `supabase/schema.sql`. |
| "Your photos could not be loaded" | The photos table or bucket does not exist yet. Run `supabase/photos.sql`. |
| Places disappear when switching browsers | You are not signed in. Browser-only places stay in that browser; sign in to sync. |
| Confirmation emails do not arrive | Supabase's built-in email sender is rate-limited on the free plan. Wait a bit, check spam, or turn off "Confirm email" in *Authentication → Providers → Email* while testing. |

## Scripts

```bash
pnpm dev     # start the dev server
pnpm build   # production build
pnpm start   # run the production build
pnpm lint    # run ESLint
```

## Visa data

Residence-permit rules are only modelled for the Schengen area. Other countries have their own rules for permit holders that are not in the dataset, so they are intentionally not guessed.

The Explore tab uses the open [passport-index-dataset](https://github.com/ilyankou/passport-index-dataset) (MIT). It was last updated in **January 2025**, so treat it as a guide and always confirm with the official government or embassy website before booking.

To refresh it, download `passport-index-matrix-iso2.csv` from that repository and run:

```bash
node scripts/build-visa-data.mjs path/to/passport-index-matrix-iso2.csv path/to/folder-with-d3-geo-and-topojson-client
```

The script writes one small file per passport to `public/visa/` and the country centres in `src/lib/centroids.json`. The last argument is a folder where `d3-geo` and `topojson-client` are installed (needed only for the centres).
