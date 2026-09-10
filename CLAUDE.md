# file_admin

Next.js 14 (App Router) + TypeScript + Tailwind admin dashboard for managing
the game/software file server backend
([../file_downloader_be](../file_downloader_be)). Lets an admin manage games,
tags, and user subscriptions. There is no end-user-facing UI here — this is
admin-only, talking to the backend's `/auth` and `/admin/*` routes.

## Running it

```bash
npm install
cp env.template .env.local   # set NEXT_PUBLIC_API_BASE_URL to the backend URL
npm run dev                  # http://localhost:3000, expects API at :9000
```

Default seeded backend login: `admin` / `pass123` (from the backend's
`seedAdmin.js`, not `admin`/`admin` as the README claims).

`npm run mock-api` / `npm run dev-with-api` reference a `mock-api-server.js`
that does not exist in this repo — treat those scripts as stale/non-functional.

## Architecture

- `app/` — App Router pages. `app/page.tsx` just redirects to `/dashboard` or
  `/login` based on auth state. `app/dashboard/*` are the real screens
  (games, tags, users), each a client component driving `apiClient` directly
  — there's no server-side data fetching here, everything is client-rendered.
- `app/dashboard/layout.tsx` wraps dashboard routes in
  `components/Layout/DashboardLayout.tsx`, which redirects to `/login` if
  `useAuth().isAuthenticated` is false and renders `Sidebar` otherwise.
- `context/AuthContext.tsx` — the only auth state. `admin_token` cookie
  (via `js-cookie`) is the source of truth for `isAuthenticated`.
- `lib/api.ts` — single `ApiClient` class (axios instance), exported as
  singleton `apiClient`. All backend calls go through here; don't call axios
  directly from components. Request interceptor attaches
  `Authorization: Bearer <admin_token cookie>`; response interceptor clears
  the cookie and hard-redirects to `/login` on any 401.
- `lib/types.ts` — shared `Game`, `AdditionalTag`, `User` types, mirroring
  the backend Mongoose schemas. Backend documents use `_id`; `apiClient`
  methods manually map `_id` → `id` on list responses for frontend
  convenience — components generally use `.id`.
- `.history/` is a VS Code local-history auto-save directory (timestamped
  snapshots of `api.ts`/`types.ts`/`globals.css`), not meaningful project
  content — ignore it, don't treat old snapshots as current source.

## Conventions

- All interactive pages/components are `"use client"` — this app has no
  server components doing real work.
- Toasts via `react-hot-toast` (`<Toaster>` mounted once in `app/layout.tsx`).
- Icons via `lucide-react`. Styling via Tailwind utility classes; the
  `primary` color scale is defined in `tailwind.config.js`.
- Path alias `@/*` maps to the repo root (`tsconfig.json`).
- When adding a new backend resource, follow the existing pattern: add types
  to `lib/types.ts`, methods to the `ApiClient` class in `lib/api.ts`, then a
  page under `app/dashboard/<resource>/page.tsx` plus any form component
  under `components/`.

## Known issues / gotchas

- **Login doesn't actually store the JWT.** `AuthContext.login` checks
  `response.success || response.token` and falls back to the literal string
  `"authenticated"` as the cookie value when the backend response has no
  top-level `token` field. The backend's real response shape is
  `{ success, data: { accessToken, refreshToken } }` (see
  `file_downloader_be` `controller/Auth.js`), so today `admin_token` is
  always just the string `"authenticated"`, never a real JWT — and
  `apiClient`'s request interceptor sends that as the bearer token on every
  subsequent request. This "works" only because none of the other API calls
  in `lib/api.ts` currently require a valid admin JWT to succeed against
  this particular backend's routes as wired. If the backend ever enforces
  `authenticateRequest` on `/admin/*` routes, this breaks. Fix by reading
  `response.data.accessToken` instead of `response.token`.
- `ApiClient.login` tries five different login endpoints in sequence
  (`/admin/auth/login`, `/admin/login`, `/auth/login`, `/adminAuth/login`,
  `/userAuth/login`) until one doesn't throw. Only `/auth/login` exists on
  the current backend. The other four are dead guesses from earlier backend
  iterations — safe to delete, but harmless as long as `/auth/login` keeps
  working (failed attempts before it just add latency).
- Default `NEXT_PUBLIC_API_BASE_URL` fallback in `lib/api.ts` points at a
  hardcoded external IP (`http://202.180.218.186:9000/`); `env.template`
  suggests a different LAN IP. Always set `.env.local` explicitly rather than
  relying on either default.
