# Wayfarer

A personal travel journal built with Next.js, React, and TypeScript. Add a country and city, optionally include the date and a short note, then see visited countries highlighted on the world map and browse recent entries.

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Supabase account sync

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key from the Supabase project settings.
3. Run `supabase/schema.sql` in the Supabase SQL Editor. The table uses row-level security so each signed-in account can access only its own entries.
4. In Supabase Auth settings, allow email/password sign-in and add your local URL and deployed Vercel URL to the redirect URL list.
5. Restart `pnpm dev`, create an account in Wayfarer, and confirm your email if Supabase asks.

Without Supabase environment values, the app remains a local browser preview. Existing browser entries are kept there; after signing in to a newly connected Supabase project, Wayfarer offers to import them into that account.

## Deploy to Vercel

1. Push this repo to GitHub (`.env.local` is gitignored, so your keys stay private).
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` under Settings → Environment Variables, then redeploy.
4. In Supabase → Authentication → URL Configuration, set the Site URL to your Vercel URL and add `https://<your-app>.vercel.app/auth/callback` to the redirect URLs.
