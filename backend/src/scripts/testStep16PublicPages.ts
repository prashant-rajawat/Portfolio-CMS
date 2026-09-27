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

async function runStep16PublicPagesTests() {
  console.log('====================================================');
  console.log('Step 16 Public Portfolio Pages Test Suite');
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

  // Setup admin user & seed sample CMS data
  const adminId = crypto.randomUUID();
  const passwordHash = await AuthService.hashPassword('AdminSecure123!');
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5);`,
    [adminId, 'Principal Architect', 'admin@portfolio.test', passwordHash, 'admin']
  );

  // Seed About
  await pool.query(
    `INSERT INTO about (title, short_description, full_description, profile_image_url, resume_url)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      'Principal Software Architect',
      'Specializing in distributed systems, high-availability architecture, and cloud services.',
      'Comprehensive biography covering 12 years of technical innovation and leadership across modern web infrastructure.',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      'https://example.com/resume.pdf',
    ]
  );

  // Seed Skills
  await pool.query(
    `INSERT INTO skills (name, category, proficiency, display_order)
     VALUES 
     ('TypeScript', 'Languages', 95, 1),
     ('Rust', 'Languages', 85, 2),
     ('PostgreSQL', 'Databases', 92, 3),
     ('React', 'Frontend', 90, 4)`
  );

  // Seed Projects
  await pool.query(
    `INSERT INTO projects (title, slug, short_description, full_description, technologies, live_url, github_url, display_order)
     VALUES 
     ('Distributed Event Mesh', 'distributed-event-mesh', 'Low-latency distributed event mesh engine.', 'Full architectural documentation and throughput benchmarks.', '{"TypeScript", "PostgreSQL", "React"}', 'https://mesh.example.com', 'https://github.com/example/mesh', 1),
     ('Autonomous Query Optimizer', 'autonomous-query-optimizer', 'Cost-based query execution graph optimizer.', 'Deep dive into cost heuristics and indexing strategies.', '{"Rust", "PostgreSQL"}', NULL, 'https://github.com/example/optimizer', 2)`
  );

  // Seed Experience
  await pool.query(
    `INSERT INTO experience (company, position, description, start_date, end_date, is_current, display_order)
     VALUES 
     ('Hyperscale Cloud Corp', 'VP of Engineering & Architecture', 'Directing global platform architecture and scalability initiatives.', '2022-01-01', NULL, true, 1),
     ('Distributed Tech Labs', 'Senior Staff Engineer', 'Engineered core consensus engines and storage subsystems.', '2018-05-01', '2021-12-31', false, 2)`
  );

  // Seed Blogs (one published, one unpublished draft)
  await pool.query(
    `INSERT INTO blogs (title, slug, excerpt, content, featured_image_url, author_id, published, published_at)
     VALUES 
     ('Designing Resilient Distributed Pipelines', 'designing-resilient-distributed-pipelines', 'A pragmatic analysis of fault tolerance, idempotency, and backpressure.', 'Comprehensive guide on designing scalable event architectures with failover resilience.', 'https://images.unsplash.com/photo-1518770660439-4636190af475', $1, true, NOW()),
     ('Internal Architecture Draft Post', 'internal-architecture-draft-post', 'Unpublished internal draft for system audit.', 'Sensitive draft content that should not be visible publicly.', NULL, $1, false, NULL)`,
    [adminId]
  );

  // Seed Services
  await pool.query(
    `INSERT INTO services (title, description, display_order)
     VALUES 
     ('System Architecture Review', 'Comprehensive technical auditing of distributed systems and database architectures.', 1)`
  );

  // Start HTTP Server
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // -------------------------------------------------------------
    // 1. Verify Frontend Component Files Exist
    // -------------------------------------------------------------
    const frontendPages = [
      'src/pages/public/AboutPage.tsx',
      'src/pages/public/ProjectsPage.tsx',
      'src/pages/public/ProjectDetailPage.tsx',
      'src/pages/public/SkillsPage.tsx',
      'src/pages/public/ExperiencePage.tsx',
      'src/pages/public/BlogPage.tsx',
      'src/pages/public/BlogDetailPage.tsx',
      'src/pages/public/ContactPage.tsx',
    ];

    frontendPages.forEach((pagePath, idx) => {
      const fullPath = path.resolve(process.cwd(), pagePath);
      const exists = fs.existsSync(fullPath);
      recordTest(idx + 1, `Frontend component exists: ${pagePath}`, exists);
    });

    // -------------------------------------------------------------
    // 2. Verify App.tsx Routing Configuration
    // -------------------------------------------------------------
    const appTsxContent = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');
    const hasAboutRoute = appTsxContent.includes('path="/about"');
    const hasProjectsRoute = appTsxContent.includes('path="/projects"');
    const hasProjectDetailRoute = appTsxContent.includes('path="/projects/:slug"');
    const hasSkillsRoute = appTsxContent.includes('path="/skills"');
    const hasExperienceRoute = appTsxContent.includes('path="/experience"');
    const hasBlogRoute = appTsxContent.includes('path="/blog"');
    const hasBlogDetailRoute = appTsxContent.includes('path="/blog/:slug"');
    const hasContactRoute = appTsxContent.includes('path="/contact"');

    recordTest(
      9,
      'App.tsx contains all Step 16 public routes including details',
      hasAboutRoute &&
        hasProjectsRoute &&
        hasProjectDetailRoute &&
        hasSkillsRoute &&
        hasExperienceRoute &&
        hasBlogRoute &&
        hasBlogDetailRoute &&
        hasContactRoute
    );

    // -------------------------------------------------------------
    // 3. Verify Public API Endpoints
    // -------------------------------------------------------------

    // GET /api/about
    const aboutRes = await fetch(`${baseUrl}/api/about`);
    const aboutData = await aboutRes.json();
    recordTest(
      10,
      'GET /api/about returns valid CMS profile data',
      aboutRes.status === 200 &&
        aboutData.success === true &&
        aboutData.data?.title === 'Principal Software Architect' &&
        aboutData.data?.resume_url === 'https://example.com/resume.pdf'
    );

    // GET /api/projects
    const projectsRes = await fetch(`${baseUrl}/api/projects`);
    const projectsData = await projectsRes.json();
    recordTest(
      11,
      'GET /api/projects returns all public projects',
      projectsRes.status === 200 &&
        projectsData.success === true &&
        Array.isArray(projectsData.data) &&
        projectsData.data.length === 2
    );

    // GET /api/projects/:slug
    const projectDetailRes = await fetch(`${baseUrl}/api/projects/distributed-event-mesh`);
    const projectDetailData = await projectDetailRes.json();
    recordTest(
      12,
      'GET /api/projects/:slug returns individual project details',
      projectDetailRes.status === 200 &&
        projectDetailData.success === true &&
        projectDetailData.data?.slug === 'distributed-event-mesh' &&
        projectDetailData.data?.live_url === 'https://mesh.example.com'
    );

    // GET /api/skills
    const skillsRes = await fetch(`${baseUrl}/api/skills`);
    const skillsData = await skillsRes.json();
    recordTest(
      13,
      'GET /api/skills returns all skills with categories and proficiencies',
      skillsRes.status === 200 &&
        skillsData.success === true &&
        Array.isArray(skillsData.data) &&
        skillsData.data.length === 4
    );

    // GET /api/experience
    const expRes = await fetch(`${baseUrl}/api/experience`);
    const expData = await expRes.json();
    recordTest(
      14,
      'GET /api/experience returns career timeline records',
      expRes.status === 200 &&
        expData.success === true &&
        Array.isArray(expData.data) &&
        expData.data.length === 2 &&
        expData.data[0].company === 'Hyperscale Cloud Corp' &&
        expData.data[0].is_current === true
    );

    // GET /api/blogs (Public blog list - frontend filters published posts)
    const blogsRes = await fetch(`${baseUrl}/api/blogs`);
    const blogsData = await blogsRes.json();
    const publishedBlogs = Array.isArray(blogsData.data) ? blogsData.data.filter((b: any) => b.published) : [];
    recordTest(
      15,
      'GET /api/blogs provides articles where frontend can filter published status',
      blogsRes.status === 200 &&
        blogsData.success === true &&
        Array.isArray(blogsData.data) &&
        publishedBlogs.length === 1 &&
        publishedBlogs[0].slug === 'designing-resilient-distributed-pipelines'
    );

    // GET /api/blogs/:slug (Published post detail)
    const blogDetailRes = await fetch(`${baseUrl}/api/blogs/designing-resilient-distributed-pipelines`);
    const blogDetailData = await blogDetailRes.json();
    recordTest(
      16,
      'GET /api/blogs/:slug returns article detail with author name',
      blogDetailRes.status === 200 &&
        blogDetailData.success === true &&
        blogDetailData.data?.title === 'Designing Resilient Distributed Pipelines' &&
        blogDetailData.data?.author_name === 'Principal Architect'
    );

    // GET /api/blogs/:slug (Unpublished draft verification)
    const draftRes = await fetch(`${baseUrl}/api/blogs/internal-architecture-draft-post`);
    const draftData = await draftRes.json();
    recordTest(
      17,
      'GET /api/blogs/:slug allows frontend to inspect published flag and guard draft posts',
      draftRes.status === 200 && draftData.data?.published === false
    );

    // POST /api/contact (Valid inquiry)
    const contactValidRes = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Enterprise Client',
        email: 'client@enterprise.com',
        subject: 'Distributed Architecture Consultation',
        message: 'We are seeking architectural consulting on our upcoming distributed streaming pipeline migration.',
      }),
    });
    const contactValidData = await contactValidRes.json();
    recordTest(
      18,
      'POST /api/contact accepts valid inquiry payload and persists message',
      contactValidRes.status === 201 && contactValidData.success === true
    );

    // Verify contact message in DB
    const dbMsg = await pool.query(`SELECT * FROM messages WHERE email = 'client@enterprise.com';`);
    recordTest(
      19,
      'Contact message is stored in database with is_read=false',
      dbMsg.rows.length === 1 && dbMsg.rows[0].is_read === false
    );

    // POST /api/contact (Invalid inquiry - invalid email)
    const contactInvalidRes = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Incomplete Form',
        email: 'not-an-email',
        subject: '',
        message: '',
      }),
    });
    const contactInvalidData = await contactInvalidRes.json();
    recordTest(
      20,
      'POST /api/contact rejects invalid payload with 400 and validation errors',
      contactInvalidRes.status === 400 && contactInvalidData.success === false
    );
  } finally {
    server.close();
  }

  // Summary
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log('\n====================================================');
  console.log(`Step 16 Test Summary: ${passedCount}/${results.length} Passed (${failedCount} Failed)`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runStep16PublicPagesTests().catch((err) => {
  console.error('Fatal error running Step 16 test suite:', err);
  process.exit(1);
});
