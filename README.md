# P2P Market

Platform marketplace peer-to-peer untuk jual beli item game (Cowoncy, dll) dengan sistem escrow, real-time chat, dan pembayaran QRIS.

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19, Vite 7, TailwindCSS 4, Radix UI, Wouter |
| Backend | Express 5, Node.js 24, Drizzle ORM |
| Database | PostgreSQL |
| Real-time Chat | Polling API (PostgreSQL-backed) |
| Auth | Discord OAuth2 |
| Anti-bot | Cloudflare Turnstile |
| Process Manager | PM2 |
| Package Manager | pnpm (workspace monorepo) |

## Struktur Project

```
p2pmarket/
├── artifacts/
│   ├── api-server/       # Express API backend
│   └── p2p-market/       # React frontend (SPA)
├── lib/
│   ├── api-client-react/ # React hooks untuk API calls
│   ├── api-spec/         # OpenAPI spec + Orval codegen
│   ├── api-zod/          # Shared Zod schemas
│   ├── db/               # Drizzle ORM schema & config
│   └── object-storage-web/ # File upload utilities
├── public/               # Static assets (served by nginx)
├── scripts/              # Utility scripts (seed, post-merge)
├── ecosystem.config.cjs  # PM2 configuration
├── pnpm-workspace.yaml   # Workspace definition
└── tsconfig.base.json    # Shared TypeScript config
```

## Prerequisites

- **Node.js** >= 24.x
- **pnpm** >= 9.x
- **PostgreSQL** (sudah running & database dibuat)

- **Discord Application** (OAuth2 credentials)
- **Cloudflare Turnstile** (site key & secret)
- **PM2** (`npm install -g pm2`)
- **Nginx** (reverse proxy)

## Setup di VPS Baru

### 1. Clone Repository

```bash
git clone https://github.com/Pangleran/p2pmarket.git
cd p2pmarket
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Setup Environment Variables

```bash
cp .env.example .env
nano .env
```

Isi semua variabel yang diperlukan (lihat `.env.example` untuk daftar lengkap).

### 4. Push Database Schema

```bash
pnpm --filter db push
```

### 5. Build Project

```bash
pnpm run build
```

### 6. Start dengan PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### 7. Setup Nginx

Contoh konfigurasi nginx:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend (static files)
    location / {
        root /home/ubuntu/p2pmarket/public;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Development Commands

```bash
# Typecheck semua packages
pnpm run typecheck

# Build semua packages
pnpm run build

# Dev mode API server
pnpm --filter api-server dev

# Dev mode frontend
pnpm --filter p2p-market dev

# Push schema DB
pnpm --filter db push

# Seed database
pnpm --filter scripts run seed
```

## Deploy Update (di VPS)

```bash
git pull origin main
pnpm install --frozen-lockfile
pnpm --filter db push
pnpm run build
pm2 restart p2pmarket-api
```

Atau gunakan git hook otomatis (sudah ada di `scripts/post-merge.sh`):

```bash
# Setup git post-merge hook
cp scripts/post-merge.sh .git/hooks/post-merge
chmod +x .git/hooks/post-merge
```

## Environment Variables

| Variable | Deskripsi |
|----------|-----------|
| `APP_URL` | URL publik frontend (e.g. `https://p2pmarket.com`) |
| `API_URL` | URL publik API (e.g. `https://p2pmarket.com/api`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `DISCORD_CLIENT_ID` | Discord OAuth2 Client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth2 Client Secret |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key |
| `PORT` | Port API server (default: 3001) |

| `NODE_ENV` | `production` atau `development` |

## License

MIT
