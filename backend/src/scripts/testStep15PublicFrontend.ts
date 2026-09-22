import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import { newDb } from 'pg-mem';
import { setDbPool } from '../db/index.ts';
import { createApp } from '../app.ts';
import { AuthService } from '../services/auth.service.ts';

interface TestResult {
  id: number;
  description: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function recordTest(id: number, description: string, condition: boolean, errorDetail?: string) {
  const result: TestResult = {
    id,
    description,
    passed: condition,
    error: condition ? undefined : (errorDetail || 'Assertion failed'),
  };
  results.push(result);
  console.log(`[TEST ${id.toString().padStart(2, '0')}] ${result.passed ? '✓ PASS' : '✗ FAIL'} - ${description}`);
  if (!result.passed && errorDetail) {
    console.error(`       Error: ${errorDetail}`);
  }
}

async function runStep15PublicFrontendTests() {
  console.log('====================================================');
  console.log('Step 15 Public Portfolio & Dynamic CMS Test Suite');
  console.log('====================================================\n');

  // 1. Initialize In-Memory PostgreSQL database using pg-mem
  const db = newDb();

  db.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

  // Execute migrations
  const migrationsDir = path.resolve(process.cwd(), 'backend', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const rawSql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const sqlForPgMem = rawSql
      .replace(/CREATE OR REPLACE FUNCTION[\s\S]*?LANGUAGE plpgsql;/gi, '')
      .replace(/DROP TRIGGER IF EXISTS[\s\S]*?;/gi, '')
      .replace(/CREATE TRIGGER[\s\S]*?EXECUTE FUNCTION[\s\S]*?;/gi, '');
    db.public.none(sqlForPgMem);
  }

  const pgAdapter = db.adapters.createPg();
  const pool = new pgAdapter.Pool();
  setDbPool(pool as any);

  // Setup admin user & seed sample dynamic CMS data
  const adminId = crypto.randomUUID();
  const passwordHash = await AuthService.hashPassword('AdminSecure123!');
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5);`,
    [adminId, 'Lead Architect', 'admin@portfolio.test', passwordHash, 'admin']
  );

  // Seed sample About
  await pool.query(
    `INSERT INTO about (title, short_description, full_description, profile_image_url, resume_url)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      'Lead Distributed Systems Architect',
      'Specializing in cloud resilience, PostgreSQL internals, and high-load web systems.',
      'Over 10 years experience leading engineering teams and designing robust full-stack software architectures.',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      'https://example.com/resume.pdf',
    ]
  );

  // Seed sample Skills
  await pool.query(
    `INSERT INTO skills (name, category, proficiency, display_order)
     VALUES 
     ('TypeScript', 'Languages', 95, 1),
     ('PostgreSQL', 'Databases', 90, 2),
     ('React', 'Frontend', 92, 3)`
  );

  // Seed sample Projects
  await pool.query(
    `INSERT INTO projects (title, slug, short_description, full_description, technologies, live_url, github_url, display_order)
     VALUES 
     ('Cloud Analytics Engine', 'cloud-analytics-engine', 'Real-time telemetry and query aggregation platform.', 'Detailed full description of the distributed telemetry pipeline.', '{"TypeScript", "PostgreSQL", "React"}', 'https://analytics.example.com', 'https://github.com/example/analytics', 1)`
  );

  // Seed sample Services
  await pool.query(
    `INSERT INTO services (title, description, display_order)
     VALUES 
     ('System Architecture & Design', 'End-to-end distributed system blueprints with microservices and caching.', 1),
     ('Database Optimization', 'PostgreSQL indexing, query tuning, and schema migration strategies.', 2)`
  );

  // Seed sample Experience
  await pool.query(
    `INSERT INTO experience (company, position, description, start_date, is_current, display_order)
     VALUES 
     ('HyperScale Cloud', 'Principal Architect', 'Architected multi-region event pipelines serving 500k rps.', '2022-01-01', true, 1)`
  );

  // Seed sample Testimonial
  await pool.query(
    `INSERT INTO testimonials (name, role, company, content, display_order)
     VALUES 
     ('Sarah Jenkins', 'VP of Engineering', 'FinTech Global', 'Outstanding technical leadership that delivered our core trading engine on time.', 1)`
  );

  // Seed published and draft Blogs
  await pool.query(
    `INSERT INTO blogs (title, slug, excerpt, content, published, author_id, published_at)
     VALUES 
     ('Optimizing PostgreSQL B-Tree Indexes', 'optimizing-postgres-btree', 'How to reduce write amplification with fillfactor and covering indexes.', 'Full article content here...', true, $1, NOW()),
     ('Draft Internal Note', 'draft-internal-note', 'Unpublished draft.', 'Internal only...', false, $1, NULL)`,
    [adminId]
  );

  // Start HTTP Server
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Test server running at ${baseUrl}\n`);

  const makeReq = async (endpoint: string, options: any = {}): Promise<{ status: number; body: any }> => {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, baseUrl);
      const req = http.request(
        url,
        {
          method: options.method || 'GET',
          headers: options.headers || {},
        },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => (raw += chunk));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(raw);
              resolve({ status: res.statusCode || 200, body: parsed });
            } catch {
              resolve({ status: res.statusCode || 200, body: raw });
            }
          });
        }
      );
      req.on('error', reject);
      if (options.body) {
        req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
      }
      req.end();
    });
  };

  try {
    console.log('--- 1. Public API Endpoints Availability & Dynamic Content ---');

    // 1. GET /api/about
    const aboutRes = await makeReq('/api/about');
    recordTest(
      1,
      'GET /api/about returns 200 with dynamic about biography data',
      aboutRes.status === 200 && aboutRes.body.data?.title === 'Lead Distributed Systems Architect'
    );

    // 2. GET /api/skills
    const skillsRes = await makeReq('/api/skills');
    recordTest(
      2,
      'GET /api/skills returns 200 with ordered list of skills',
      skillsRes.status === 200 && Array.isArray(skillsRes.body.data) && skillsRes.body.data.length === 3
    );

    // 3. GET /api/projects
    const projectsRes = await makeReq('/api/projects');
    recordTest(
      3,
      'GET /api/projects returns 200 with projects list',
      projectsRes.status === 200 && Array.isArray(projectsRes.body.data) && projectsRes.body.data.length === 1
    );

    // 4. GET /api/projects/:slug
    const singleProjRes = await makeReq('/api/projects/cloud-analytics-engine');
    recordTest(
      4,
      'GET /api/projects/:slug returns 200 with specific project details',
      singleProjRes.status === 200 && singleProjRes.body.data?.slug === 'cloud-analytics-engine'
    );

    // 5. GET /api/services
    const servicesRes = await makeReq('/api/services');
    recordTest(
      5,
      'GET /api/services returns 200 with services list',
      servicesRes.status === 200 && Array.isArray(servicesRes.body.data) && servicesRes.body.data.length === 2
    );

    // 6. GET /api/experience
    const expRes = await makeReq('/api/experience');
    recordTest(
      6,
      'GET /api/experience returns 200 with career history',
      expRes.status === 200 && Array.isArray(expRes.body.data) && expRes.body.data[0]?.company === 'HyperScale Cloud'
    );

    // 7. GET /api/testimonials
    const testRes = await makeReq('/api/testimonials');
    recordTest(
      7,
      'GET /api/testimonials returns 200 with testimonials',
      testRes.status === 200 && Array.isArray(testRes.body.data) && testRes.body.data[0]?.name === 'Sarah Jenkins'
    );

    // 8. GET /api/blogs and GET /api/blogs/:slug
    const blogsRes = await makeReq('/api/blogs');
    const singleBlogRes = await makeReq('/api/blogs/optimizing-postgres-btree');
    const publishedBlogs = Array.isArray(blogsRes.body.data) ? blogsRes.body.data.filter((b: any) => b.published) : [];
    recordTest(
      8,
      'GET /api/blogs and GET /api/blogs/:slug return articles with published status metadata',
      blogsRes.status === 200 &&
      singleBlogRes.status === 200 &&
      singleBlogRes.body.data?.slug === 'optimizing-postgres-btree' &&
      publishedBlogs.length === 1
    );

    console.log('\n--- 2. Public Contact Ingestion Tests ---');

    // 9. POST /api/contact
    const contactPost = await makeReq('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        name: 'Enterprise Client',
        email: 'recruiter@enterprise.com',
        subject: 'Principal Architect Opportunity',
        message: 'We are impressed by your distributed systems work and would love to connect.',
      },
    });
    recordTest(
      9,
      'POST /api/contact receives and stores public inquiries returning 201 Created',
      contactPost.status === 201 && contactPost.body.success === true
    );

    // 10. POST /api/contact validation error handling
    const contactInvalid = await makeReq('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        name: '',
        email: 'bad-email',
        subject: '',
        message: '',
      },
    });
    recordTest(
      10,
      'POST /api/contact rejects invalid payloads with 400 Bad Request and validation errors',
      contactInvalid.status === 400 && contactInvalid.body.success === false
    );

    console.log('\n--- 3. Admin Route Security & Separation Tests ---');

    // 11. Unauthenticated mutation rejection
    const unauthPut = await makeReq('/api/about', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: { title: 'Hacked Title' },
    });
    recordTest(
      11,
      'PUT /api/about rejects unauthenticated requests with 401 Unauthorized',
      unauthPut.status === 401
    );

    const unauthProj = await makeReq('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { title: 'Fake Project', slug: 'fake-proj' },
    });
    recordTest(
      12,
      'POST /api/projects rejects unauthenticated requests with 401 Unauthorized',
      unauthProj.status === 401
    );

    const unauthMessages = await makeReq('/api/messages');
    recordTest(
      13,
      'GET /api/messages requires Admin JWT and rejects public requests with 401 Unauthorized',
      unauthMessages.status === 401
    );

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('\n====================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Step 15 Test Summary: Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep15PublicFrontendTests().catch((err) => {
  console.error('Fatal error running Step 15 tests:', err);
  process.exit(1);
});
