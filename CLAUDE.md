# CLAUDE.md — Project Context for AI Assistants

## Project Overview

P2P Market adalah platform marketplace peer-to-peer untuk jual beli item game (Cowoncy, dll). Menggunakan arsitektur monorepo dengan pnpm workspaces.

## Architecture

- **Monorepo** dengan pnpm workspaces
- **Frontend**: React 19 SPA di `artifacts/p2p-market/` — build output ke `public/` (root)
- **Backend**: Express 5 API di `artifacts/api-server/` — build output ke `artifacts/api-server/dist/`
- **Shared libs**: `lib/` berisi packages yang di-share antara frontend & backend
- **Process Manager**: PM2 menjalankan API server di production

## Key Directories

```
artifacts/api-server/src/     → Express routes, middlewares, services
artifacts/p2p-market/src/     → React pages, components, hooks
lib/db/src/                   → Drizzle ORM schema (PostgreSQL)
lib/api-zod/src/              → Shared Zod validation schemas
lib/api-client-react/src/     → React Query hooks (auto-generated dari OpenAPI)
lib/api-spec/                 → OpenAPI spec (source of truth untuk API contract)
lib/object-storage-web/src/   → File upload component & hooks
```

## Important Conventions

### Package Manager
- **HARUS pakai pnpm** — project akan reject npm/yarn via preinstall script
- Lockfile: `pnpm-lock.yaml`

### TypeScript
- Semua code TypeScript strict
- Base config di `tsconfig.base.json`, setiap package extend dari sini
- Build menggunakan project references (`tsc --build` untuk libs)

### Build System
- Frontend: Vite (build → `artifacts/p2p-market/dist/` lalu di-copy ke `public/`)
- Backend: esbuild (bundle ke single file `artifacts/api-server/dist/index.mjs`)
- Full build: `pnpm run build` (typecheck dulu, lalu build semua)

### Database
- PostgreSQL via Drizzle ORM
- Schema di `lib/db/src/schema/`
- Push schema: `pnpm --filter db push`
- Config: `lib/db/drizzle.config.ts`

### API Pattern
- Express 5 dengan Zod validation
- Routes di `artifacts/api-server/src/routes/`
- OpenAPI spec di `lib/api-spec/openapi.yaml`
- Frontend hooks auto-generated via Orval

### Frontend Routing
- Menggunakan **Wouter** (bukan React Router)
- Pages di `artifacts/p2p-market/src/pages/`

### Styling
- TailwindCSS 4 + Radix UI primitives
- Component library menggunakan shadcn/ui pattern (CVA + clsx + tailwind-merge)

## Common Commands

```bash
# Install dependencies
pnpm install

# Full build (typecheck + build all)
pnpm run build

# Dev API server
pnpm --filter api-server dev

# Dev frontend
pnpm --filter p2p-market dev

# Push DB schema
pnpm --filter db push

# Typecheck only
pnpm run typecheck

# PM2 restart
pm2 restart p2pmarket-api
```

## Environment

- `.env` file di root — JANGAN commit (ada di .gitignore)
- Variabel `VITE_*` diakses di frontend via `import.meta.env`
- Variabel lain hanya tersedia di backend
- Lihat `.env` untuk daftar lengkap variabel yang diperlukan

## Deployment

- VPS Ubuntu dengan PM2 + Nginx
- PM2 config: `ecosystem.config.cjs`
- Nginx serve static files dari `public/` dan proxy `/api/` ke port 3001
- Deploy flow: `git pull → pnpm install → db push → build → pm2 restart`

## Things to Watch Out For

1. **Jangan edit `public/assets/`** — ini adalah build output dari frontend, akan di-overwrite saat build
2. **Selalu run `pnpm run build`** setelah mengubah code — PM2 menjalankan compiled output
3. **Schema changes** perlu `pnpm --filter db push` untuk sync ke database
4. **Chat** menggunakan polling API setiap 4 detik (bukan WebSocket)
5. **Frontend build** output harus di-serve sebagai SPA (semua routes fallback ke `index.html`)
