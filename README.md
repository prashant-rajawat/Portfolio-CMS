# Portfolio CMS

A full-stack, production-ready Portfolio and Content Management System (CMS) built with React, TypeScript, Tailwind CSS, Express.js, and PostgreSQL through Supabase.

---

## Technology Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide React, Motion
- **Backend**: Node.js, Express.js, TypeScript, Helmet, CORS, Express Rate Limit
- **Database**: PostgreSQL (hosted via Supabase)
- **Object Storage**: Supabase Cloud Storage
- **Authentication**: JWT Access & Cryptographic Refresh Token Rotation with bcrypt
- **Email Delivery**: Nodemailer SMTP integration with non-blocking graceful fallback
- **Build & Bundling**: Vite (client SPA) & esbuild (Node.js CommonJS backend bundle)

---

## Production Deployment Architectures

The project supports two deployment patterns:

### Option A: Unified Full-Stack Container (Render / Railway / Cloud Run / Docker)
The application builds the React client into static assets and bundles the Express backend server into a single production artifact (`dist/server.cjs`), which serves both the REST API (`/api/*`) and SPA frontend client (`/dist/index.html`).

- **Build Command**: `npm run build`
- **Start Command**: `npm start` (or `node dist/server.cjs`)
- **Port**: Configured via `PORT` (defaults to `3000` or assigned by host)

### Option B: Decoupled Deployments (Frontend on Vercel/Netlify + Backend on Render/Railway)
- **Frontend (Vercel / Netlify)**:
  - **Build Command**: `npm run build` (or `vite build`)
  - **Output Directory**: `dist`
  - **Environment Variables**: `VITE_API_BASE_URL=https://your-backend-api.onrender.com`
  - **SPA Routing**: Handled automatically by `vercel.json` and `public/_redirects`.
- **Backend (Render / Railway)**:
  - **Build Command**: `npm run build`
  - **Start Command**: `npm start`
  - **Environment Variables**: Set `FRONTEND_URL` and `CORS_ORIGIN` to your frontend domain (e.g., `https://your-portfolio.vercel.app`).

---

## Production Environment Variables

Configure these environment variables in your deployment environment:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | HTTP server listening port | `3000` |
| `NODE_ENV` | Application runtime mode | `production` |
| `FRONTEND_URL` | Allowed frontend origin for CORS | `https://your-portfolio.vercel.app` |
| `CORS_ORIGIN` | Comma-separated allowed CORS origins | `https://your-portfolio.vercel.app,https://portfolio.com` |
| `DATABASE_URL` | PostgreSQL connection URI from Supabase | `postgres://postgres:[PASS]@db.[REF].supabase.co:5432/postgres` |
| `SUPABASE_URL` | Supabase Project API URL | `https://[REF].supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY`| Supabase anon / publishable key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY`| Supabase service role key (backend only) | `eyJhbGciOi...` |
| `SUPABASE_STORAGE_BUCKET` | Supabase Cloud Storage bucket name | `portfolio-media` |
| `JWT_ACCESS_SECRET` | Secret key for signing access tokens (min 32 chars) | `your-32-character-access-secret-key...` |
| `JWT_REFRESH_SECRET` | Secret key for signing refresh tokens (min 32 chars) | `your-32-character-refresh-secret-key...` |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifespan | `15m` |
| `JWT_REFRESH_EXPIRES_IN`| Refresh token lifespan | `7d` |
| `SMTP_HOST` | *(Optional)* SMTP mail server host | `smtp.resend.com` or `smtp.gmail.com` |
| `SMTP_PORT` | *(Optional)* SMTP mail server port | `587` |
| `SMTP_SECURE` | *(Optional)* SMTP SSL/TLS toggle | `false` |
| `SMTP_USER` | *(Optional)* SMTP authentication username | `apikey` or `user@domain.com` |
| `SMTP_PASS` | *(Optional)* SMTP authentication password/token | `[TOKEN]` |
| `CONTACT_EMAIL_TO` | *(Optional)* Admin recipient for contact notifications | `admin@domain.com` |
| `CONTACT_EMAIL_FROM` | *(Optional)* Sender address for contact emails | `no-reply@domain.com` |
| `VITE_API_BASE_URL` | Frontend API client base URL (empty for same-origin) | `https://your-backend-api.onrender.com` |

---

## Production Deployment Checklist & Step-by-Step

### 1. Database Setup & Migration
1. Create a PostgreSQL project on [Supabase](https://supabase.com).
2. Obtain the database connection URI from **Settings > Database > Connection string > URI**.
3. Run the migrations to provision all 10 core tables, indexes, and triggers:
   ```bash
   npm run migrate
   ```
4. Verify database schema and table integrity:
   ```bash
   npm run db:verify
   ```

### 2. Create Initial Administrator Account
Create your secure admin login credentials:
```bash
npm run create:admin
```

### 3. Verify Code Quality & Build Production Artifacts
```bash
# 1. Typecheck all TypeScript code
npm run typecheck

# 2. Run automated verification test suite
npm run test:deployment

# 3. Compile and bundle for production
npm run build
```

### 4. Deploy to Host
- **Render / Railway**: Link your repository, set the build command to `npm run build`, set the start command to `npm start`, and supply the production environment variables.
- **Vercel / Netlify**: Link your repository, set the output directory to `dist`, and set `VITE_API_BASE_URL` to your backend service URL.

---

## Health & Verification Endpoints

- **System Health**: `GET /api/health` — Returns application status and database health without exposing sensitive credentials.
- **Database Health**: `GET /api/health/db` — Tests PostgreSQL pool ping (`SELECT 1`).

---

## Automated Test Suites

| Command | Description |
| :--- | :--- |
| `npm run test:deployment` | **Step 17**: Production deployment configuration and readiness suite |
| `npm run test:public-pages` | **Step 16**: Public portfolio pages verification |
| `npm run test:public` | **Step 15**: Public API client & Home page showcase verification |
| `npm run test:messages` | **Step 14**: Messages CMS & contact form ingestion test |
| `npm run test:media` | **Step 13**: Media storage and upload tracking test |
| `npm run test:services` | **Step 12**: Services CMS test suite |
| `npm run test:testimonials` | **Step 11**: Testimonials CMS test suite |
| `npm run test:experience` | **Step 10**: Experience timeline CMS test suite |
| `npm run test:blogs` | **Step 9**: Blogs & publishing CMS test suite |
| `npm run test:projects` | **Step 8**: Projects CMS test suite |
| `npm run test:about-skills` | **Step 7**: About & Skills CMS test suite |
| `npm run test:auth` | **Step 3**: JWT authentication & authorization test suite |
| `npm run test:db` | **Step 2**: Database schema integrity test suite |

