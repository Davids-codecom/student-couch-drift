# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/21986d44-79f0-408f-97e0-963cbfc6ee6d

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/21986d44-79f0-408f-97e0-963cbfc6ee6d) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Supabase configuration

1. Create a `.env.local` (or `.env`) file in the project root with:

   ```
   VITE_SUPABASE_URL=YOUR_URL
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
   ```

2. In Supabase Studio, go to **Settings → API** to copy the *Project URL* (use it for `VITE_SUPABASE_URL`) and the *anon public key* (use it for `VITE_SUPABASE_ANON_KEY`).

### Auth settings (email + password)

- Supabase Studio → **Authentication → Settings → Auth Providers**
  - Enable **Email** provider.
  - Turn **Confirm email** ON so new users must verify their inbox.
  - Set the **Site URL** (under Authentication → URL configuration) to `https://YOUR_DOMAIN/auth` so the verification link returns to your app.
- App behavior:
  - Regular users can only sign up with a `.edu` email and must verify it.
  - Owner signup bypass is only allowed for `davids.akis@unil.ch` and skips email verification.

### Owner signup bypass setup (`owner-signup`)

The app uses `supabase/functions/owner-signup/index.ts` for secure owner-only signup bypass.

1. (Optional) set a different owner bypass email:

   ```bash
   supabase secrets set OWNER_BYPASS_EMAIL=owner@example.com
   ```

2. Deploy the function:

   ```bash
   supabase functions deploy owner-signup
   ```

3. Keep **Confirm email** enabled in Supabase auth settings. The function confirms only the approved owner email.

### Messaging table & policies

Run this SQL in Supabase Studio → SQL Editor to enable user-to-user messaging:

```sql
create extension if not exists pgcrypto;

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now()
);

alter table public.direct_messages enable row level security;

drop policy if exists "direct messages select" on public.direct_messages;
create policy "direct messages select"
  on public.direct_messages for select
  to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "direct messages insert" on public.direct_messages;
create policy "direct messages insert"
  on public.direct_messages for insert
  to authenticated
  with check (auth.uid() = sender_id);
```


## Supabase Edge function (`transform-note`)

This repository includes an edge function that uppercases note content before inserting it.

### Function source

- Location: `supabase/functions/transform-note/index.ts`
- Request body: `{ "content": "hello" }`
- Behaviour: uppercases content and inserts into `notes` with the caller’s `user_id`

### Deploying

1. Install the Supabase CLI if you haven’t already: `npm install -g supabase`
2. Log in: `supabase login`
3. Link the project (run once): `supabase link --project-ref <your-project-ref>`
4. Deploy the function: `supabase functions deploy transform-note`
5. To test locally: `supabase functions serve transform-note`

### Using in the app

- Helper: `src/lib/callTransformNote.ts` invokes the function via `supabase.functions.invoke('transform-note', { body: { content } })`
- The Notes demo page (`/notes`) uses the helper when you add a note.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/21986d44-79f0-408f-97e0-963cbfc6ee6d) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
