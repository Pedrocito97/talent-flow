# Talent Flow CRM - Setup Guide

## Prerequisites

- Node.js 18.17 or later
- pnpm 8.0 or later (`npm install -g pnpm`)
- PostgreSQL 14+ (local or cloud)
- Cloudflare R2 account (for file storage)
- Resend account (for email)

## Quick Start

```bash
# Clone/navigate to project
cd talent-flow

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env.local

# Edit .env.local with your values
# (see Environment Variables section below)

# Setup database
pnpm prisma generate
pnpm prisma db push
pnpm prisma db seed

# Run development server
pnpm dev

# In separate terminal, run background jobs (when implemented)
pnpm jobs:dev
```

## Environment Variables

Create a `.env.local` file with the following variables:

### Database
```
DATABASE_URL="postgresql://user:password@localhost:5432/talent_flow?schema=public"
```

### Authentication
```
NEXTAUTH_SECRET="your-secret-key-generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
```

### Cloudflare R2 (File Storage)
```
R2_ACCOUNT_ID="your-account-id"
R2_ACCESS_KEY_ID="your-access-key"
R2_SECRET_ACCESS_KEY="your-secret-key"
R2_BUCKET_NAME="talent-flow-files"
R2_PUBLIC_URL="https://your-bucket.r2.cloudflarestorage.com"
```

### Email (Resend)
```
RESEND_API_KEY="re_xxxxxxxxxxxx"
RESEND_FROM_EMAIL="noreply@yourdomain.com"
```

### Background Jobs (Trigger.dev)
```
TRIGGER_API_KEY="tr_dev_xxxxxxxxxxxx"
TRIGGER_API_URL="https://api.trigger.dev"
```

## Available Scripts

```bash
# Development
pnpm dev              # Start dev server (http://localhost:3000)
pnpm build            # Production build
pnpm start            # Start production server

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix ESLint issues
pnpm format           # Format with Prettier
pnpm format:check     # Check formatting

# Database (after Prisma setup)
pnpm prisma generate  # Generate Prisma client
pnpm prisma db push   # Push schema to database
pnpm prisma db seed   # Seed database
pnpm prisma studio    # Open Prisma Studio GUI

# Background Jobs (after setup)
pnpm jobs:dev         # Run job server locally
```

## Project Structure

```
talent-flow/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth pages (login, invite)
│   ├── (dashboard)/       # Dashboard pages
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   └── globals.css        # Global styles
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── layout/            # Layout components (sidebar, header)
│   ├── kanban/            # Kanban board components
│   ├── table/             # Table view components
│   ├── candidates/        # Candidate-related components
│   └── pipelines/         # Pipeline-related components
├── lib/
│   ├── auth.ts            # NextAuth configuration
│   ├── db.ts              # Prisma client
│   ├── r2.ts              # R2 file storage
│   ├── permissions.ts     # RBAC utilities
│   └── parsing/           # CV parsing utilities
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Seed script
├── jobs/                  # Background job definitions
└── docs/
    ├── PROGRESS.md        # Development progress
    ├── SETUP.md           # This file
    └── decisions/         # Architecture Decision Records
```

## Database Setup (Local PostgreSQL)

### macOS (Homebrew)
```bash
brew install postgresql@14
brew services start postgresql@14
createdb talent_flow
```

### Docker
```bash
docker run --name talent-flow-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=talent_flow \
  -p 5432:5432 \
  -d postgres:14
```

### Cloud Options
- **Vercel Postgres:** Recommended for Vercel deployment
- **Neon:** Serverless PostgreSQL
- **Supabase:** PostgreSQL with extras

## Cloudflare R2 Setup

1. Go to Cloudflare Dashboard → R2
2. Create a bucket named `talent-flow-files`
3. Create an API token with Object Read & Write permissions
4. Copy credentials to `.env.local`

## Resend Setup

1. Sign up at resend.com
2. Verify your domain
3. Create an API key
4. Copy to `.env.local`

## Trigger.dev Setup (Background Jobs)

1. Sign up at trigger.dev
2. Create a new project
3. Copy API key to `.env.local`
4. Follow integration guide for Next.js

## Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

### Vercel Environment Variables
Set all variables from `.env.example` in your Vercel project settings.

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check DATABASE_URL format
- Verify network/firewall settings

### Build Errors
```bash
# Clear caches
rm -rf .next node_modules
pnpm install
pnpm build
```

### Type Errors
```bash
# Regenerate types
pnpm prisma generate
```
