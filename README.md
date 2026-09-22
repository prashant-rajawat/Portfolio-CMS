# Portfolio CMS

Custom CMS-powered portfolio backend and full-stack application foundation.

## Technology Stack

- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL through Supabase
- **Frontend** (Planned for future step): React, TypeScript, Tailwind CSS
- **API**: RESTful JSON API
- **Admin Auth**: JWT Authentication (Access + Refresh token rotation, bcrypt)
- **CMS**: Custom-built Admin Panel (Planned for future steps)

## Required Database Tables (Step 2)
The 10 core entities configured in PostgreSQL:
1. `users` — Administrator credentials (UUID, name, email, password_hash, role, timestamps)
2. `about` — Portfolio owner profile & resume (title, descriptions, media URLs, timestamps)
3. `skills` — Skills showcase with category and proficiency
4. `projects` — Projects portfolio with technologies array and URLs
5. `blogs` — Articles with author foreign key (`users.id`) and publishing flags
6. `experience` — Career timeline with date intervals and current status
7. `testimonials` — Client and peer reviews
8. `services` — Freelance and consulting offerings
9. `messages` — Inbound contact inquiries with read tracking
10. `media` — Media asset tracking with uploader foreign key (`users.id`)

## Project Structure

```text
├── backend/
│   ├── migrations/      # Sequential SQL migrations (001-010)
│   ├── src/
│   │   ├── config/      # Environment configuration & CORS
│   │   ├── controllers/ # Health controllers
│   │   ├── db/          # PostgreSQL pool, Supabase client, migrator, verifier
│   │   ├── middleware/  # Error handler, logger, Zod validator
│   │   ├── routes/      # API routes
│   │   ├── scripts/     # CLI scripts for migrations & verification
│   │   ├── services/    # DatabaseService
│   │   ├── utils/       # Logger and response helpers
│   │   ├── app.ts       # Express app
│   │   └── server.ts    # Standalone server
│   ├── .env.example
│   ├── tsconfig.json
│   └── README.md
├── server.ts            # Main application runner (Express + Vite)
├── package.json
└── README.md
```

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure:
- `PORT=3000`
- `NODE_ENV=development`
- `FRONTEND_URL=http://localhost:3000`
- `DATABASE_URL=postgres://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`
- `SUPABASE_URL=https://[REF].supabase.co`
- `SUPABASE_PUBLISHABLE_KEY=[KEY]`

### 3. Database & App Commands
- `npm run migrate`: Execute sequential database migrations (idempotent tracking in `schema_migrations`)
- `npm run db:verify`: Verify database connectivity, all 10 tables, and CRUD operations
- `npm run create:admin`: Interactive CLI to create an initial administrator account
- `npm run test:auth`: Execute full 21-scenario authentication & authorization test suite
- `npm run test:db`: Run offline schema integrity test harness
- `npm run dev`: Start development server on port 3000
- `npm run typecheck`: Run TypeScript type checking
- `npm run build`: Build production client assets and compile server
- `npm start`: Start production server (`dist/server.cjs`)

## Verification Endpoints
- Health API: `GET /api/health`
- Database Check: `GET /api/health/db`
