# Portfolio CMS - Backend

Custom CMS-powered portfolio backend foundation built with Node.js, Express, TypeScript, and PostgreSQL through Supabase.

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL (hosted via Supabase) & Supabase Client
- **Security**: Helmet, CORS (origin-restricted in production), Request Body Limits
- **Validation**: Zod (schema validation foundation)
- **Logging**: Safe development and operational logging (sanitizing tokens, passwords, cookies)

## Directory Structure

```text
backend/
├── src/
│   ├── config/          # Environment configuration and CORS rules
│   ├── controllers/     # Controller handlers (e.g. HealthController)
│   ├── db/              # PostgreSQL connection pool and Supabase client
│   ├── middleware/      # Error handler, request logger, Zod validator
│   ├── routes/          # Express route definitions
│   ├── services/        # Service layer (e.g. DatabaseService)
│   ├── utils/           # Logger and API response helpers
│   ├── app.ts           # Express application setup
│   └── server.ts        # Standalone server bootstrap
├── .env.example         # Environment variable template
├── tsconfig.json        # Backend TypeScript configuration
└── README.md            # Documentation
```

## Setup & Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and provide your credentials:
   ```bash
   cp .env.example .env
   ```

   Required variables:
   - `PORT`: Port to listen on (default: `3000`)
   - `NODE_ENV`: `development` or `production`
   - `FRONTEND_URL`: Allowed frontend origin for CORS (e.g. `http://localhost:3000`)
   - `DATABASE_URL`: PostgreSQL connection string from Supabase:
     `postgres://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
   - `SUPABASE_URL`: Supabase project URL (e.g. `https://xyzcompany.supabase.co`)
   - `SUPABASE_PUBLISHABLE_KEY`: Supabase anon/publishable key

## Running the Application

### Development Mode
```bash
npm run dev
```

### Type Checking
```bash
npm run typecheck
```

### Production Build
```bash
npm run build
```

### Run Production Server
```bash
npm start
```

## Health & Verification Endpoints

### 1. System Health
- **Endpoint**: `GET /api/health`
- **Description**: Verifies the Express server is running, reports current environment, and checks database connectivity status.
- **Example Response**:
  ```json
  {
    "success": true,
    "message": "Portfolio CMS API is running",
    "data": {
      "environment": "development",
      "timestamp": "2026-09-21T18:55:00.000Z",
      "database": {
        "status": "connected",
        "message": "PostgreSQL database connection verified and responsive",
        "driver": "pg",
        "latencyMs": 18
      }
    }
  }
  ```

### 2. Database Connectivity Test
- **Endpoint**: `GET /api/health/db`
- **Description**: Detailed database ping (`SELECT 1`). Returns safe status without leaking credentials.

## Database Architecture & Required Entities

The database uses PostgreSQL hosted via Supabase. All primary keys are UUIDs (`gen_random_uuid()`), and timestamps (`created_at`, `updated_at`) are automatically maintained via triggers (`update_updated_at_column`).

### Required Tables
1. **`users`**: CMS administrator accounts (id, name, email, password_hash, role, created_at, updated_at).
2. **`about`**: Portfolio owner bio and resume references (id, title, short_description, full_description, profile_image_url, resume_url, created_at, updated_at).
3. **`skills`**: Technical/professional skills with proficiency and categorization (id, name, category, proficiency, icon_url, display_order, created_at, updated_at).
4. **`projects`**: Portfolio projects showcase (id, title, slug, short_description, full_description, image_url, technologies, live_url, github_url, display_order, created_at, updated_at).
5. **`blogs`**: Blog articles with author relationship (id, title, slug, excerpt, content, featured_image_url, author_id, published, published_at, created_at, updated_at).
6. **`experience`**: Employment history & timeline (id, company, position, description, start_date, end_date, is_current, display_order, created_at, updated_at).
7. **`testimonials`**: Client and peer reviews (id, name, role, company, content, profile_image_url, display_order, created_at, updated_at).
8. **`services`**: Freelance / professional service offerings (id, title, description, icon_url, display_order, created_at, updated_at).
9. **`messages`**: Inbound contact form submissions (id, name, email, subject, message, is_read, created_at, updated_at).
10. **`media`**: Stored asset registry (id, filename, original_filename, storage_path, storage_url, mime_type, file_size, uploaded_by, created_at, updated_at).

### Database Relationships
- `blogs.author_id` -> `users.id` (`ON DELETE SET NULL` to preserve content).
- `media.uploaded_by` -> `users.id` (`ON DELETE SET NULL` to preserve uploaded assets).

---

## Database Migrations & Verification

### Running Migrations
Applies all pending `.sql` migration files sequentially inside managed transactions:
```bash
npm run migrate
```
Migration status is tracked idempotently in the `schema_migrations` table so no migration is ever executed twice.

### Verifying Database Schema & Integrity
Checks database connectivity, verifies that all 10 required tables exist, validates unique constraints and foreign keys, and tests safe INSERT/SELECT/UPDATE/DELETE operations:
```bash
npm run db:verify
```

---

## Supabase & Database Configuration Notes

### Configuring DATABASE_URL
1. Obtain the Connection String from your Supabase project dashboard (**Settings > Database > Connection string > URI**).
2. Mode: Use the direct connection (port 5432) or transaction pooler (port 6543):
   ```env
   DATABASE_URL=postgres://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   SUPABASE_URL=https://[PROJECT-REF].supabase.co
   SUPABASE_PUBLISHABLE_KEY=[ANON-KEY]
   ```
3. SSL is automatically enabled for all remote Supabase connections with `{ rejectUnauthorized: false }`.

### Development vs Production Notes
- **Development**: When `DATABASE_URL` is omitted, the API continues to operate safely in unconfigured mode, and migration/verification commands will cleanly output informative status messages without leaking credentials or throwing unhandled errors.
- **Production**: Ensure `DATABASE_URL`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` are configured in production environment variables. Never commit `.env` containing real credentials.

---

## Authentication & Authorization (Step 3)

### Overview
Admin authentication is built using bcrypt password hashing, signed JWT access tokens, and cryptographic refresh tokens with rotation and hashed database persistence.

### Endpoints
1. **`POST /api/auth/login`**:
   - Authenticates administrator credentials (`email`, `password`).
   - Protected with IP-based rate limiting (20 attempts / 15 minutes).
   - Validated with Zod schemas.
   - Returns `{ accessToken, refreshToken, user: { id, name, email, role } }`.
   - Returns generic failure message (`"Invalid email or password"`) to prevent account enumeration.

2. **`POST /api/auth/refresh`**:
   - Rotates refresh tokens and issues fresh access/refresh token pairs.
   - Requires `{ refreshToken }`.

3. **`GET /api/auth/me`**:
   - Internal/development verification endpoint protected with `authenticateToken`.

### Middleware
- **`authenticateToken`**: Validates `Authorization: Bearer <token>`, verifies JWT access token signature, checks expiration, and attaches authenticated user context (`req.user = { id, role }`).
- **`requireAdmin`**: Enforces administrator role check (`role === 'admin'`). Rejects unauthorized requests with `403 Forbidden`.

### Admin Management CLI
To create an initial administrator account:
```bash
npm run create:admin
```
Interactive prompt securely gathers name, email, and password, hashes the password with bcrypt, and inserts the record into `users`.

### Authentication Test Suite
Runs the comprehensive 21-scenario authentication test suite:
```bash
npm run test:auth
```
