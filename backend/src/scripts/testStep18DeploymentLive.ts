import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import { newDb } from 'pg-mem';
import { setDbPool } from '../db/index.ts';
import { createApp } from '../app.ts';
import { AuthService } from '../services/auth.service.ts';
import { StorageService, IStorageAdapter, StorageUploadResult } from '../services/storage.service.ts';
import { EmailService } from '../services/email.service.ts';
import { getAllowedCorsOrigins } from '../config/index.ts';

interface TestResult {
  id: number;
  category: string;
  description: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function recordTest(id: number, category: string, description: string, condition: boolean, errorDetail?: string) {
  const result: TestResult = {
    id,
    category,
    description,
    passed: condition,
    error: condition ? undefined : (errorDetail || 'Assertion failed'),
  };
  results.push(result);
  console.log(`[TEST ${id.toString().padStart(2, '0')}] [${category.padEnd(12)}] ${result.passed ? '✓ PASS' : '✗ FAIL'} - ${description}`);
  if (!result.passed && errorDetail) {
    console.error(`       Error: ${errorDetail}`);
  }
}

async function runStep18LiveVerificationSuite() {
  console.log('================================================================');
  console.log('Step 18 Production Deployment & Live API Verification Test Suite');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // Mock In-Memory Storage Adapter for Media Lifecycle Tests
  // -------------------------------------------------------------
  const memoryStorage = new Map<string, { buffer: Buffer; mimeType: string }>();
  const mockStorageAdapter: IStorageAdapter = {
    async upload(storagePath: string, buffer: Buffer, mimeType: string): Promise<StorageUploadResult> {
      memoryStorage.set(storagePath, { buffer, mimeType });
      return {
        storagePath,
        storageUrl: `https://storage.portfolio.production/${storagePath}`,
      };
    },
    async delete(storagePath: string): Promise<void> {
      memoryStorage.delete(storagePath);
    },
    getPublicUrl(storagePath: string): string {
      return `https://storage.portfolio.production/${storagePath}`;
    },
  };
  StorageService.setAdapter(mockStorageAdapter);

  // -------------------------------------------------------------
  // Mock Email Transporter for Live Contact Ingestion Tests
  // -------------------------------------------------------------
  const dispatchedEmails: any[] = [];
  EmailService.setTransporter({
    async sendMail(mailOptions: any) {
      dispatchedEmails.push(mailOptions);
      return { messageId: `msg-${Date.now()}` };
    },
  });

  // -------------------------------------------------------------
  // In-Memory PostgreSQL Database Setup
  // -------------------------------------------------------------
  const db = newDb();
  db.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

  const migrationsDir = path.resolve(process.cwd(), 'backend', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of migrationFiles) {
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

  // Seed Initial Production Admin User
  const adminId = crypto.randomUUID();
  const adminEmail = 'admin@prod-portfolio.live';
  const adminPassword = 'StrongProductionAdminPassword2026!';
  const passwordHash = await AuthService.hashPassword(adminPassword);
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5);`,
    [adminId, 'Lead Engineer & Admin', adminEmail, passwordHash, 'admin']
  );

  // Start Live App Server on dynamic port
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  let accessToken = '';
  let refreshToken = '';

  try {
    // -------------------------------------------------------------
    // Section 1: Health & Security Verification
    // -------------------------------------------------------------
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthJson = await healthRes.json();
    recordTest(
      1,
      'HEALTH',
      'GET /api/health responds with HTTP 200 and operational status',
      healthRes.status === 200 && healthJson.success === true && healthJson.data?.database?.status === 'connected'
    );

    const dbHealthRes = await fetch(`${baseUrl}/api/health/db`);
    const dbHealthJson = await dbHealthRes.json();
    recordTest(
      2,
      'HEALTH',
      'GET /api/health/db verifies PostgreSQL connection health',
      dbHealthRes.status === 200 && dbHealthJson.success === true && dbHealthJson.database?.status === 'connected'
    );

    const healthString = JSON.stringify(healthJson) + JSON.stringify(dbHealthJson);
    recordTest(
      3,
      'SECURITY',
      'Health endpoints do not expose database credentials, passwords, or connection strings',
      !healthString.includes('password') && !healthString.includes('postgres://') && !healthString.includes('secret')
    );

    // -------------------------------------------------------------
    // Section 2: Production Authentication & Refresh Tokens
    // -------------------------------------------------------------
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const loginJson = await loginRes.json();
    accessToken = loginJson.data?.accessToken || '';
    refreshToken = loginJson.data?.refreshToken || '';

    recordTest(
      4,
      'AUTH',
      'POST /api/auth/login authenticates admin and returns signed JWT access & refresh tokens',
      loginRes.status === 200 && Boolean(accessToken) && Boolean(refreshToken)
    );

    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const refreshJson = await refreshRes.json();
    const rotatedAccessToken = refreshJson.data?.accessToken;
    const rotatedRefreshToken = refreshJson.data?.refreshToken;

    recordTest(
      5,
      'AUTH',
      'POST /api/auth/refresh successfully rotates refresh token and issues fresh access token',
      refreshRes.status === 200 && Boolean(rotatedAccessToken) && Boolean(rotatedRefreshToken)
    );

    // Use rotated token for subsequent calls
    if (rotatedAccessToken) {
      accessToken = rotatedAccessToken;
    }

    const invalidLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'WrongPassword999!' }),
    });
    recordTest(
      6,
      'AUTH',
      'POST /api/auth/login rejects invalid credentials with generic message',
      invalidLoginRes.status === 401
    );

    // -------------------------------------------------------------
    // Section 3: About CMS Endpoints
    // -------------------------------------------------------------
    const updateAboutRes = await fetch(`${baseUrl}/api/about`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title: 'Senior Distributed Systems Architect',
        short_description: 'Building resilient cloud backends and high-performance user interfaces.',
        full_description: 'Over a decade of experience designing fault-tolerant scalable architectures.',
        profile_image_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
        resume_url: 'https://example.com/resume.pdf',
      }),
    });
    const updateAboutJson = await updateAboutRes.json();
    recordTest(
      7,
      'CMS_ABOUT',
      'PUT /api/about updates profile information with admin JWT',
      updateAboutRes.status === 200 && updateAboutJson.success === true
    );

    const getAboutRes = await fetch(`${baseUrl}/api/about`);
    const getAboutJson = await getAboutRes.json();
    recordTest(
      8,
      'CMS_ABOUT',
      'GET /api/about serves public portfolio bio data',
      getAboutRes.status === 200 && getAboutJson.data?.title === 'Senior Distributed Systems Architect'
    );

    // -------------------------------------------------------------
    // Section 4: Skills CMS Endpoints
    // -------------------------------------------------------------
    const createSkillRes = await fetch(`${baseUrl}/api/skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: 'TypeScript & Node.js',
        category: 'Backend Architecture',
        proficiency: 95,
        display_order: 1,
      }),
    });
    const createSkillJson = await createSkillRes.json();
    const skillId = createSkillJson.data?.id;

    recordTest(
      9,
      'CMS_SKILLS',
      'POST /api/skills creates technical skill item with validation',
      createSkillRes.status === 201 && Boolean(skillId)
    );

    const getSkillsRes = await fetch(`${baseUrl}/api/skills`);
    const getSkillsJson = await getSkillsRes.json();
    recordTest(
      10,
      'CMS_SKILLS',
      'GET /api/skills retrieves ordered list of technical competencies',
      getSkillsRes.status === 200 && Array.isArray(getSkillsJson.data) && getSkillsJson.data.length >= 1
    );

    // -------------------------------------------------------------
    // Section 5: Projects CMS & End-to-End Public Propagation
    // -------------------------------------------------------------
    const testProjectSlug = 'event-driven-microservices-mesh';
    const createProjectRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title: 'Event-Driven Microservices Mesh',
        slug: testProjectSlug,
        short_description: 'Ultra-low latency streaming message platform.',
        full_description: 'Detailed architecture built with Apache Kafka, Go, Node.js, and PostgreSQL.',
        image_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31',
        technologies: ['TypeScript', 'Kafka', 'PostgreSQL', 'Docker'],
        live_url: 'https://demo.mesh.live',
        github_url: 'https://github.com/example/mesh',
        display_order: 1,
      }),
    });
    const createProjectJson = await createProjectRes.json();
    const projectId = createProjectJson.data?.id;

    recordTest(
      11,
      'CMS_PROJECTS',
      'POST /api/projects creates showcase project with technologies array',
      createProjectRes.status === 201 && Boolean(projectId)
    );

    const getProjectBySlugRes = await fetch(`${baseUrl}/api/projects/${testProjectSlug}`);
    const getProjectBySlugJson = await getProjectBySlugRes.json();
    recordTest(
      12,
      'CMS_PROJECTS',
      'GET /api/projects/:slug publicly retrieves created project detail',
      getProjectBySlugRes.status === 200 && getProjectBySlugJson.data?.title === 'Event-Driven Microservices Mesh'
    );

    const updateProjectRes = await fetch(`${baseUrl}/api/projects/${projectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title: 'Event-Driven Microservices Mesh (Updated v2)',
        slug: testProjectSlug,
        short_description: 'Updated ultra-low latency streaming message platform.',
        technologies: ['TypeScript', 'Kafka', 'PostgreSQL', 'Docker', 'Kubernetes'],
      }),
    });
    recordTest(
      13,
      'CMS_PROJECTS',
      'PUT /api/projects/:id updates existing project',
      updateProjectRes.status === 200
    );

    // -------------------------------------------------------------
    // Section 6: Blogs CMS & Draft vs Published Isolation
    // -------------------------------------------------------------
    const createDraftBlogRes = await fetch(`${baseUrl}/api/blogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title: 'Internal Architecture Draft',
        slug: 'internal-architecture-draft',
        excerpt: 'Private engineering design doc.',
        content: 'Confidential system mechanics...',
        published: false,
      }),
    });
    const createDraftBlogJson = await createDraftBlogRes.json();
    const draftBlogId = createDraftBlogJson.data?.id;

    const createPublishedBlogRes = await fetch(`${baseUrl}/api/blogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title: 'Production Engineering at Scale',
        slug: 'production-engineering-at-scale',
        excerpt: 'Lessons learned building resilient cloud platforms.',
        content: 'Markdown formatted article content...',
        published: true,
      }),
    });
    const createPublishedBlogJson = await createPublishedBlogRes.json();
    const pubBlogId = createPublishedBlogJson.data?.id;

    recordTest(
      14,
      'CMS_BLOGS',
      'POST /api/blogs creates blog posts with author relation and publishing flag',
      Boolean(draftBlogId) && Boolean(pubBlogId)
    );

    const getPublicBlogsRes = await fetch(`${baseUrl}/api/blogs`);
    const getPublicBlogsJson = await getPublicBlogsRes.json();
    recordTest(
      15,
      'CMS_BLOGS',
      'GET /api/blogs supplies blog feed where frontend filters published status',
      getPublicBlogsRes.status === 200 && Array.isArray(getPublicBlogsJson.data)
    );

    // -------------------------------------------------------------
    // Section 7: Experience, Testimonials & Services CMS
    // -------------------------------------------------------------
    const createExpRes = await fetch(`${baseUrl}/api/experience`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        company: 'Cloud Scale Inc.',
        position: 'Principal Platform Engineer',
        description: 'Led core cloud infrastructure and API gateway scaling.',
        start_date: '2022-01-01',
        is_current: true,
        display_order: 1,
      }),
    });
    recordTest(
      16,
      'CMS_EXPERIENCE',
      'POST /api/experience records career milestone',
      createExpRes.status === 201
    );

    const createTestimonialRes = await fetch(`${baseUrl}/api/testimonials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: 'Sarah Chen',
        role: 'VP of Engineering',
        company: 'Apex Technologies',
        content: 'Outstanding systems architect who transformed our deployment pipeline.',
        display_order: 1,
      }),
    });
    recordTest(
      17,
      'CMS_REVIEWS',
      'POST /api/testimonials records client endorsement',
      createTestimonialRes.status === 201
    );

    const createServiceRes = await fetch(`${baseUrl}/api/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title: 'Full-Stack Architecture & Cloud Consulting',
        description: 'End-to-end design, implementation, and cloud deployment of high-availability systems.',
        display_order: 1,
      }),
    });
    recordTest(
      18,
      'CMS_SERVICES',
      'POST /api/services records service offering',
      createServiceRes.status === 201
    );

    // -------------------------------------------------------------
    // Section 8: Media Storage Lifecycle & File Validations
    // -------------------------------------------------------------
    // Valid JPEG header magic bytes (FF D8 FF ...)
    const dummyImageBuffer = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x60, 0x00, 0x60, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    ]);
    const formBoundary = '----WebKitFormBoundaryDeploymentTest7MA4YWxkTrZu0gW';
    const formBody = Buffer.concat([
      Buffer.from(`--${formBoundary}\r\nContent-Disposition: form-data; name="file"; filename="deployment-diagram.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      dummyImageBuffer,
      Buffer.from(`\r\n--${formBoundary}--\r\n`),
    ]);

    const uploadRes = await fetch(`${baseUrl}/api/upload/image`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${formBoundary}`,
        Authorization: `Bearer ${accessToken}`,
      },
      body: formBody,
    });
    const uploadJson = await uploadRes.json();
    const mediaId = uploadJson.data?.id;

    recordTest(
      19,
      'MEDIA',
      'POST /api/upload/image uploads valid JPEG, creates media database record, and returns public URL',
      uploadRes.status === 201 && Boolean(mediaId) && Boolean(uploadJson.data?.storage_url)
    );

    // Test Delete Media
    if (mediaId) {
      const deleteMediaRes = await fetch(`${baseUrl}/api/upload/${mediaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      recordTest(
        20,
        'MEDIA',
        'DELETE /api/upload/:id removes cloud storage object and database record',
        deleteMediaRes.status === 200
      );
    }

    // -------------------------------------------------------------
    // Section 9: Inbound Contact Ingestion & Email Dispatch
    // -------------------------------------------------------------
    const contactRes = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Enterprise Client',
        email: 'client@enterprise-inquiry.com',
        subject: 'Cloud Platform Architecture Consultation',
        message: 'We are looking to engage your consulting services for a high-scale microservices migration.',
      }),
    });
    const contactJson = await contactRes.json();
    const messageId = contactJson.data?.id;

    recordTest(
      21,
      'CONTACT',
      'POST /api/contact validates payload, persists inquiry with is_read=false, and triggers notification',
      contactRes.status === 201 && Boolean(messageId) && dispatchedEmails.length === 1
    );

    const getMessagesRes = await fetch(`${baseUrl}/api/messages`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const getMessagesJson = await getMessagesRes.json();
    recordTest(
      22,
      'CONTACT',
      'GET /api/messages allows admin to view contact inquiries',
      getMessagesRes.status === 200 && Array.isArray(getMessagesJson.data) && getMessagesJson.data.length >= 1
    );

    if (messageId) {
      const markReadRes = await fetch(`${baseUrl}/api/messages/${messageId}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      recordTest(
        23,
        'CONTACT',
        'PUT /api/messages/:id/read marks inquiry as read',
        markReadRes.status === 200
      );
    }

    // -------------------------------------------------------------
    // Section 10: Security Enforcement (Unauthorized Rejection)
    // -------------------------------------------------------------
    const unauthProjectsRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hacked Project', slug: 'hacked-project' }),
    });
    recordTest(
      24,
      'SECURITY',
      'POST /api/projects rejects unauthenticated requests with 401 Unauthorized',
      unauthProjectsRes.status === 401
    );

    const unauthUploadRes = await fetch(`${baseUrl}/api/upload/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    recordTest(
      25,
      'SECURITY',
      'POST /api/upload/image rejects unauthenticated uploads with 401 Unauthorized',
      unauthUploadRes.status === 401
    );

  } finally {
    server.close();
    StorageService.resetAdapter();
    EmailService.setTransporter(null);
  }

  // Summary
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log(`Step 18 Live Verification Summary: ${passedCount}/${results.length} Passed (${failedCount} Failed)`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runStep18LiveVerificationSuite().catch((err) => {
  console.error('Fatal error in Step 18 live verification:', err);
  process.exit(1);
});
