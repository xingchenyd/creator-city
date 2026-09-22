# Vercel deployment

Two Vercel projects serve the application:

- `apps/city`: Next.js city and live catalog APIs.
- `apps/chat-debate`: Vite council frontend and the Python function in `api/index.py`.

Deploy the council first, then configure these production variables in the city project:

- `CHAT_DEBATE_INTERNAL_URL=https://creator-city-council.vercel.app`
- `CHAT_API_INTERNAL_URL=https://creator-city-council.vercel.app`
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the existing Supabase project's public browser settings.

The council requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the same Supabase project. Configure the selected AI provider's secrets in the council project's production environment (see `apps/chat-debate/.env.example`). Without a provider key, health checks succeed but AI generation reports that the service is not configured.

The city proxies council pages, static assets and API requests, so visitors stay on the city domain. Both `/chat-debate` and `/chat-debate/` work. Do not set a browser URL to localhost in production.

After linking the corresponding Vercel project in each app directory:

```powershell
vercel deploy --prod --yes --scope ja-4a62
```

For future GitHub auto-deploy setup, select the matching app directory as each project's Root Directory. The current production releases were deployed with the CLI.

Verify the public city domain at `/`, `/city/neon`, `/api/models`, `/api/skills`, `/api/hackathons`, `/chat-debate/` and `/api/health`.

A custom domain requires the domain owner's DNS configuration or access to its existing hosting project. GitHub Pages only supports static hosting and cannot run this project's server APIs.

