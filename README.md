# PageOne

PageOne is a React + TypeScript + Vite screenplay editor with Supabase-backed auth and script storage.

## Environment Variables

Create a `.env` file in the project root:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Development

```bash
npm install
npm run dev
```

The Vite dev server is configured with host access enabled, so devices on the same Wi-Fi can open it.

## Open On iPad/Phone (Same Wi-Fi)

1. Start the dev server:

```bash
npm run dev
```

2. Find your computer's local IP address:
   - macOS:

```bash
ipconfig getifaddr en0
```

   - Windows (PowerShell):

```powershell
ipconfig
```

   - Linux:

```bash
hostname -I
```

3. On iPad/phone, open:
   - `http://LOCAL-IP:5173`

Example: `http://192.168.1.42:5173`

## Deploy To Vercel

1. Push your project to GitHub.
2. In Vercel, create a new project and import that GitHub repo.
3. In the Vercel project settings, add these environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy.

Vite uses the default production output folder `dist`, which works with Vercel defaults.

## PWA (Installable App)

PageOne uses a manual web app manifest setup (`public/manifest.webmanifest`) for basic installability.

### Install On iPad/iPhone

1. Open PageOne in Safari.
2. Tap the Share button.
3. Tap "Add to Home Screen".
4. Confirm the name and tap "Add".

When opened from the Home Screen, PageOne launches in standalone mode.
