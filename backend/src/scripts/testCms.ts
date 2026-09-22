import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import { newDb } from 'pg-mem';
import { setDbPool } from '../db/index.ts';
import { createApp } from '../app.ts';
import { AuthService } from '../services/auth.service.ts';
import { AboutService } from '../services/about.service.ts';
import { SkillsService } from '../services/skills.service.ts';
import { ProjectsService } from '../services/projects.service.ts';
import { BlogsService } from '../services/blogs.service.ts';
import { ExperienceService } from '../services/experience.service.ts';
import { TestimonialsService } from '../services/testimonials.service.ts';
import { ServicesService } from '../services/services.service.ts';
import { uuidParamSchema } from '../validators/common.validator.ts';
import { updateAboutSchema } from '../validators/about.validator.ts';
import { createSkillSchema } from '../validators/skills.validator.ts';
import { createProjectSchema } from '../validators/projects.validator.ts';
import { createBlogSchema } from '../validators/blogs.validator.ts';
import { createExperienceSchema } from '../validators/experience.validator.ts';
import { createTestimonialSchema } from '../validators/testimonials.validator.ts';
import { createServiceSchema } from '../validators/services.validator.ts';
import { ConflictError, NotFoundError } from '../utils/errors.ts';

interface TestSummary {
  id: number;
  description: string;
  passed: boolean;
  detail?: string;
}

const testResults: TestSummary[] = [];

function recordTest(id: number, description: string, passed: boolean, detail?: string) {
  testResults.push({ id, description, passed, detail });
  const status = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[TEST ${id.toString().padStart(2, '0')}] ${status} - ${description}`);
  if (detail && !passed) {
    console.log(`         Detail: ${detail}`);
  }
}

async function runCmsTests() {
  console.log('====================================================');
  console.log('Portfolio CMS - Step 4 CMS CRUD API Test Suite');
  console.log('====================================================\n');

  // 1. Initialize in-memory PostgreSQL for unit and operational query verification
  const db = newDb();
  db.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

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
  const testPool = new pgAdapter.Pool();
  setDbPool(testPool as any);

  // Setup sample admin in users table
  const adminId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  await testPool.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
    [adminId, 'Portfolio Admin', 'admin@portfolio.local', 'hash123', 'admin']
  );

  const adminToken = AuthService.generateAccessToken({ id: adminId, role: 'admin' });
  const userToken = AuthService.generateAccessToken({ id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', role: 'user' });

  // 1. UUID Validation Schema
  try {
    const validUuid = uuidParamSchema.safeParse({ id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' });
    const invalidUuid = uuidParamSchema.safeParse({ id: 'not-a-valid-uuid-123' });
    recordTest(1, 'UUID parameter schema validation', validUuid.success && !invalidUuid.success);
  } catch (err: any) {
    recordTest(1, 'UUID parameter schema validation', false, err.message);
  }

  // 2. JWT Access Token verification for Admin
  try {
    const decodedAdmin = AuthService.verifyAccessToken(adminToken);
    const decodedUser = AuthService.verifyAccessToken(userToken);
    recordTest(2, 'JWT token verification for admin and non-admin', decodedAdmin?.role === 'admin' && decodedUser?.role === 'user');
  } catch (err: any) {
    recordTest(2, 'JWT token verification for admin and non-admin', false, err.message);
  }

  // 3. About Module - Empty initial fetch returns null without error
  try {
    const initialAbout = await AboutService.getAbout();
    recordTest(3, 'About GET returns null when empty (clean 200 response)', initialAbout === null);
  } catch (err: any) {
    recordTest(3, 'About GET returns null when empty', false, err.message);
  }

  // 4. About Module - Schema validation
  try {
    const valid = updateAboutSchema.safeParse({
      title: 'Full Stack Engineer & Cloud Architect',
      short_description: 'Building high-scale resilient web applications.',
      full_description: 'Extensive background in TypeScript, Node.js, and Cloud architectures.',
      profile_image_url: 'https://example.com/avatar.jpg',
      resume_url: 'https://example.com/resume.pdf',
    });
    const invalid = updateAboutSchema.safeParse({
      title: '',
      short_description: '',
    });
    recordTest(4, 'About update schema validation', valid.success && !invalid.success);
  } catch (err: any) {
    recordTest(4, 'About update schema validation', false, err.message);
  }

  // 5. About Module - Upsert creation and update
  try {
    const createdAbout = await AboutService.upsertAbout({
      title: 'Full Stack Engineer',
      short_description: 'Short bio',
      full_description: 'Detailed bio content',
      profile_image_url: 'https://example.com/me.png',
      resume_url: 'https://example.com/cv.pdf',
    });
    const fetchedAbout = await AboutService.getAbout();
    const isMatched = fetchedAbout?.title === 'Full Stack Engineer';

    // Update the same record
    const updatedAbout = await AboutService.upsertAbout({
      title: 'Senior Full Stack Architect',
      short_description: 'Updated short bio',
      full_description: 'Updated detailed bio content',
      profile_image_url: 'https://example.com/me2.png',
      resume_url: 'https://example.com/cv2.pdf',
    });
    recordTest(5, 'About upsert creation and update flow', isMatched && updatedAbout.title === 'Senior Full Stack Architect');
  } catch (err: any) {
    recordTest(5, 'About upsert creation and update flow', false, err.message);
  }

  // 6. Skills Module - Initial empty fetch
  try {
    const skills = await SkillsService.getAll();
    recordTest(6, 'Skills GET returns empty array initially', Array.isArray(skills));
  } catch (err: any) {
    recordTest(6, 'Skills GET returns empty array initially', false, err.message);
  }

  // 7. Skills Module - Validation
  try {
    const invalid = createSkillSchema.safeParse({
      name: '',
      category: 'Backend',
      proficiency: 150, // exceeds 100
    });
    const valid = createSkillSchema.safeParse({
      name: 'TypeScript',
      category: 'Frontend/Backend',
      proficiency: 95,
      icon_url: 'https://example.com/ts.svg',
      display_order: 1,
    });
    recordTest(7, 'Skills validation (rejection of proficiency > 100 & empty name)', !invalid.success && valid.success);
  } catch (err: any) {
    recordTest(7, 'Skills validation', false, err.message);
  }

  // 8. Skills Module - CRUD Flow (Create, Update, Delete)
  let skillId = '';
  try {
    const createdSkill = await SkillsService.create({
      name: 'PostgreSQL',
      category: 'Database',
      proficiency: 90,
      icon_url: 'https://example.com/pg.svg',
      display_order: 2,
    });
    skillId = createdSkill.id;

    const updatedSkill = await SkillsService.update(skillId, {
      proficiency: 95,
      display_order: 1,
    });

    const deleteResult = await SkillsService.delete(skillId);
    recordTest(8, 'Skills CRUD operations (Create, Update, Delete)', !!skillId && updatedSkill.proficiency === 95 && deleteResult.id === skillId);
  } catch (err: any) {
    recordTest(8, 'Skills CRUD operations', false, err.message);
  }

  // 9. Skills Module - 404 on deleting non-existent ID
  try {
    await SkillsService.delete('99999999-9999-9999-9999-999999999999');
    recordTest(9, 'Skills 404 on non-existent record deletion', false, 'Should have thrown NotFoundError');
  } catch (err: any) {
    recordTest(9, 'Skills 404 on non-existent record deletion', err instanceof NotFoundError);
  }

  // 10. Projects Module - Validation (slug formatting)
  try {
    const invalidSlug = createProjectSchema.safeParse({
      title: 'Test Project',
      slug: 'Invalid Slug With Spaces!',
      short_description: 'Short',
      full_description: 'Full',
    });
    const validProject = createProjectSchema.safeParse({
      title: 'Portfolio CMS',
      slug: 'portfolio-cms-app',
      short_description: 'A portfolio CMS backend',
      full_description: 'Comprehensive CMS with 10 tables and JWT auth',
      technologies: ['TypeScript', 'Express', 'PostgreSQL'],
      live_url: 'https://example.com',
      github_url: 'https://github.com/example/repo',
      display_order: 1,
    });
    recordTest(10, 'Projects slug format validation', !invalidSlug.success && validProject.success);
  } catch (err: any) {
    recordTest(10, 'Projects slug format validation', false, err.message);
  }

  // 11. Projects Module - Create & Slug uniqueness enforcement
  let projectId = '';
  try {
    const p1 = await ProjectsService.create({
      title: 'E-Commerce Platform',
      slug: 'ecommerce-platform',
      short_description: 'Modern shopping experience',
      full_description: 'Full-featured checkout and catalog',
      technologies: ['React', 'Node.js'],
      display_order: 1,
    });
    projectId = p1.id;

    let duplicateCaught = false;
    try {
      await ProjectsService.create({
        title: 'Duplicate Slug Project',
        slug: 'ecommerce-platform',
        short_description: 'Duplicate',
        full_description: 'Duplicate description',
        technologies: [],
      });
    } catch (err: any) {
      duplicateCaught = err instanceof ConflictError;
    }

    recordTest(11, 'Projects creation & unique slug conflict enforcement (409)', !!projectId && duplicateCaught);
  } catch (err: any) {
    recordTest(11, 'Projects creation & unique slug conflict enforcement', false, err.message);
  }

  // 12. Projects Module - Update slug conflict check & delete
  try {
    const p2 = await ProjectsService.create({
      title: 'AI Dashboard',
      slug: 'ai-dashboard',
      short_description: 'Analytics dashboard',
      full_description: 'Metrics and analytics',
      technologies: ['Python'],
    });

    let updateConflictCaught = false;
    try {
      // Attempting to rename p2's slug to p1's slug
      await ProjectsService.update(p2.id, { slug: 'ecommerce-platform' });
    } catch (err: any) {
      updateConflictCaught = err instanceof ConflictError;
    }

    await ProjectsService.delete(p2.id);
    await ProjectsService.delete(projectId);
    recordTest(12, 'Projects update conflict check and cleanup', updateConflictCaught);
  } catch (err: any) {
    recordTest(12, 'Projects update conflict check and cleanup', false, err.message);
  }

  // 13. Blogs Module - Create with authenticated admin as author
  let blogId = '';
  try {
    const createdBlog = await BlogsService.create(
      {
        title: 'Architecting Resilient APIs',
        slug: 'architecting-resilient-apis',
        excerpt: 'Key strategies for production Node.js services',
        content: 'Long form markdown content on robust architecture...',
        published: true,
      },
      adminId
    );
    blogId = createdBlog.id;
    recordTest(13, 'Blogs creation with authenticated admin author relationship', createdBlog.author_id === adminId && createdBlog.published);
  } catch (err: any) {
    recordTest(13, 'Blogs creation with authenticated admin author relationship', false, err.message);
  }

  // 14. Blogs Module - Public GET query safety (no password_hash or auth credentials exposed)
  try {
    const allBlogs = await BlogsService.getAll();
    const blog = allBlogs.find((b) => b.id === blogId);
    const hasNoAuthSecrets = !('password_hash' in (blog || {})) && !('password' in (blog || {}));
    const hasAuthorName = blog?.author_name === 'Portfolio Admin';
    recordTest(14, 'Blogs public GET safely returns author_name without authentication secrets', hasNoAuthSecrets && hasAuthorName);
  } catch (err: any) {
    recordTest(14, 'Blogs public GET query safety', false, err.message);
  }

  // 15. Blogs Module - Duplicate slug conflict enforcement
  try {
    let blogConflictCaught = false;
    try {
      await BlogsService.create({
        title: 'Another Post with same slug',
        slug: 'architecting-resilient-apis',
        excerpt: 'Duplicate excerpt',
        content: 'Duplicate content',
      });
    } catch (err: any) {
      blogConflictCaught = err instanceof ConflictError;
    }
    await BlogsService.delete(blogId);
    recordTest(15, 'Blogs duplicate slug conflict enforcement (409)', blogConflictCaught);
  } catch (err: any) {
    recordTest(15, 'Blogs duplicate slug conflict enforcement', false, err.message);
  }

  // 16. Experience Module - Date validation (end_date >= start_date)
  try {
    const invalidDates = createExperienceSchema.safeParse({
      company: 'Tech Corp',
      position: 'Software Engineer',
      description: 'Built APIs',
      start_date: '2024-01-01',
      end_date: '2023-01-01', // before start_date!
      is_current: false,
    });
    const validDates = createExperienceSchema.safeParse({
      company: 'Tech Corp',
      position: 'Software Engineer',
      description: 'Built APIs',
      start_date: '2023-01-01',
      end_date: '2024-01-01',
      is_current: false,
    });
    recordTest(16, 'Experience date ordering validation (rejects end_date < start_date)', !invalidDates.success && validDates.success);
  } catch (err: any) {
    recordTest(16, 'Experience date ordering validation', false, err.message);
  }

  // 17. Experience Module - CRUD Flow
  let expId = '';
  try {
    const createdExp = await ExperienceService.create({
      company: 'Cloud Innovations',
      position: 'Lead Backend Engineer',
      description: 'Led cloud migration and microservices redesign.',
      start_date: '2023-06-01',
      is_current: true,
      display_order: 1,
    });
    expId = createdExp.id;

    const updatedExp = await ExperienceService.update(expId, {
      position: 'Principal Backend Engineer',
    });

    const deletedExp = await ExperienceService.delete(expId);
    recordTest(17, 'Experience CRUD operations (Create, Update, Delete)', !!expId && updatedExp.position === 'Principal Backend Engineer' && deletedExp.id === expId);
  } catch (err: any) {
    recordTest(17, 'Experience CRUD operations', false, err.message);
  }

  // 18. Testimonials Module - Validation & CRUD Flow
  let testId = '';
  try {
    const createdTestimonial = await TestimonialsService.create({
      name: 'Jane Doe',
      role: 'VP of Engineering',
      company: 'Global Enterprises',
      content: 'Exceptional engineer who consistently delivers outstanding work on time.',
      display_order: 1,
    });
    testId = createdTestimonial.id;

    const updatedTestimonial = await TestimonialsService.update(testId, {
      company: 'Global Tech Enterprises',
    });

    const deleted = await TestimonialsService.delete(testId);
    recordTest(18, 'Testimonials CRUD operations (Create, Update, Delete)', !!testId && updatedTestimonial.company === 'Global Tech Enterprises' && deleted.id === testId);
  } catch (err: any) {
    recordTest(18, 'Testimonials CRUD operations', false, err.message);
  }

  // 19. Services Module - Validation & CRUD Flow
  let serviceId = '';
  try {
    const createdService = await ServicesService.create({
      title: 'Full-Stack Web Development',
      description: 'Modern, fast, and secure web applications with Node.js and React.',
      icon_url: 'https://example.com/icons/code.svg',
      display_order: 1,
    });
    serviceId = createdService.id;

    const updatedService = await ServicesService.update(serviceId, {
      title: 'Full-Stack Architecture & Development',
    });

    const deleted = await ServicesService.delete(serviceId);
    recordTest(19, 'Services CRUD operations (Create, Update, Delete)', !!serviceId && updatedService.title === 'Full-Stack Architecture & Development' && deleted.id === serviceId);
  } catch (err: any) {
    recordTest(19, 'Services CRUD operations', false, err.message);
  }

  // 20. Parameterized query safety
  try {
    const injectionAttempt = "TypeScript'; DROP TABLE skills; --";
    const skill = await SkillsService.create({
      name: injectionAttempt,
      category: 'Security Test',
      display_order: 99,
    });
    const checkSkills = await SkillsService.getAll();
    const sanitizedRecord = checkSkills.find((s) => s.id === skill.id);
    await SkillsService.delete(skill.id);

    recordTest(20, 'Parameterized SQL query injection resistance', sanitizedRecord?.name === injectionAttempt);
  } catch (err: any) {
    recordTest(20, 'Parameterized SQL query injection resistance', false, err.message);
  }

  // 21. HTTP Integration Tests on Express App Server
  console.log('\n--- 2. End-to-End HTTP Integration Tests ---');
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { port: number; address: string };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 21. Public GET /api/about
    const aboutRes = await fetch(`${baseUrl}/api/about`);
    const aboutJson = await aboutRes.json();
    recordTest(21, 'HTTP GET /api/about (Public)', aboutRes.status === 200 && aboutJson.success === true);

    // 22. Protected PUT /api/about rejection without token (401)
    const putAboutNoAuth = await fetch(`${baseUrl}/api/about`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title', short_description: 'Short', full_description: 'Full' }),
    });
    recordTest(22, 'HTTP PUT /api/about rejected without token (401)', putAboutNoAuth.status === 401);

    // 23. Protected PUT /api/about rejection for non-admin token (403)
    const putAboutNonAdmin = await fetch(`${baseUrl}/api/about`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ title: 'New Title', short_description: 'Short', full_description: 'Full' }),
    });
    recordTest(23, 'HTTP PUT /api/about rejected for non-admin token (403)', putAboutNonAdmin.status === 403);

    // 24. Protected PUT /api/about validation error on invalid payload (400)
    const putAboutInvalid = await fetch(`${baseUrl}/api/about`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ title: '' }), // missing required fields
    });
    recordTest(24, 'HTTP PUT /api/about payload validation error (400)', putAboutInvalid.status === 400);

    // 25. Protected PUT /api/about authorized upsert (200)
    const putAboutSuccess = await fetch(`${baseUrl}/api/about`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Lead Software Engineer',
        short_description: 'Passionate builder of robust cloud software',
        full_description: 'Detailed description of engineering philosophy and accomplishments.',
      }),
    });
    const putAboutJson = await putAboutSuccess.json();
    recordTest(25, 'HTTP PUT /api/about authorized upsert (200)', putAboutSuccess.status === 200 && putAboutJson.data?.title === 'Lead Software Engineer');

    // 26. HTTP GET /api/skills (Public)
    const skillsRes = await fetch(`${baseUrl}/api/skills`);
    const skillsJson = await skillsRes.json();
    recordTest(26, 'HTTP GET /api/skills (Public returns array)', skillsRes.status === 200 && Array.isArray(skillsJson.data));

    // 27. HTTP POST /api/skills (Authorized Admin returns 201)
    const createSkillRes = await fetch(`${baseUrl}/api/skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'React 19',
        category: 'Frontend',
        proficiency: 95,
        display_order: 1,
      }),
    });
    const createdSkillJson = await createSkillRes.json();
    const httpSkillId = createdSkillJson.data?.id;
    recordTest(27, 'HTTP POST /api/skills (Authorized Admin returns 201)', createSkillRes.status === 201 && !!httpSkillId);

    // 28. HTTP PUT /api/skills/:id with malformed UUID (400)
    const putSkillBadUuid = await fetch(`${baseUrl}/api/skills/not-a-uuid-123`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ proficiency: 98 }),
    });
    recordTest(28, 'HTTP PUT /api/skills/:id with invalid UUID rejected before DB query (400)', putSkillBadUuid.status === 400);

    // 29. HTTP PUT /api/skills/:id with valid UUID (200)
    const putSkillSuccess = await fetch(`${baseUrl}/api/skills/${httpSkillId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ proficiency: 98 }),
    });
    const putSkillJson = await putSkillSuccess.json();
    recordTest(29, 'HTTP PUT /api/skills/:id authorized update (200)', putSkillSuccess.status === 200 && putSkillJson.data?.proficiency === 98);

    // 30. HTTP DELETE /api/skills/:id with invalid UUID (400)
    const deleteSkillBadUuid = await fetch(`${baseUrl}/api/skills/invalid-uuid`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    recordTest(30, 'HTTP DELETE /api/skills/:id with invalid UUID rejected (400)', deleteSkillBadUuid.status === 400);

    // 31. HTTP DELETE /api/skills/:id authorized delete (200)
    const deleteSkillSuccess = await fetch(`${baseUrl}/api/skills/${httpSkillId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    recordTest(31, 'HTTP DELETE /api/skills/:id authorized delete (200)', deleteSkillSuccess.status === 200);

    // 32. HTTP POST /api/projects slug format validation (400)
    const createProjectBadSlug = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Bad Project',
        slug: 'Bad Slug Spaces!',
        short_description: 'Short',
        full_description: 'Full',
      }),
    });
    recordTest(32, 'HTTP POST /api/projects rejects invalid slug (400)', createProjectBadSlug.status === 400);

    // 33. HTTP POST /api/projects valid creation (201)
    const createProjectRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Portfolio Website',
        slug: 'portfolio-website',
        short_description: 'Personal showcase',
        full_description: 'Full description of portfolio website showcase',
        technologies: ['TypeScript', 'Express', 'React'],
      }),
    });
    const createProjectJson = await createProjectRes.json();
    const httpProjectId = createProjectJson.data?.id;
    recordTest(33, 'HTTP POST /api/projects authorized creation (201)', createProjectRes.status === 201 && !!httpProjectId);

    // 34. HTTP POST /api/projects duplicate slug conflict (409)
    const createProjectDup = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Another Project Same Slug',
        slug: 'portfolio-website',
        short_description: 'Short',
        full_description: 'Full',
      }),
    });
    recordTest(34, 'HTTP POST /api/projects duplicate slug returns 409 Conflict', createProjectDup.status === 409);

    // 35. HTTP DELETE /api/projects/:id cleanup (200)
    const deleteProjectRes = await fetch(`${baseUrl}/api/projects/${httpProjectId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    recordTest(35, 'HTTP DELETE /api/projects/:id cleanup (200)', deleteProjectRes.status === 200);

    // 36. HTTP POST /api/blogs creates blog with admin author (201)
    const createBlogRes = await fetch(`${baseUrl}/api/blogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Modern TypeScript Best Practices',
        slug: 'modern-typescript-best-practices',
        excerpt: 'Tips for clean production TypeScript code.',
        content: 'Article content regarding strict typing and immutability...',
        published: true,
      }),
    });
    const createBlogJson = await createBlogRes.json();
    const httpBlogId = createBlogJson.data?.id;
    recordTest(36, 'HTTP POST /api/blogs sets admin as author (201)', createBlogRes.status === 201 && createBlogJson.data?.author_id === adminId);

    // 37. HTTP GET /api/blogs returns public data with author_name and no password_hash (200)
    const getBlogsRes = await fetch(`${baseUrl}/api/blogs`);
    const getBlogsJson = await getBlogsRes.json();
    const fetchedBlog = getBlogsJson.data?.find((b: any) => b.id === httpBlogId);
    const blogIsSecure = !('password_hash' in (fetchedBlog || {})) && fetchedBlog?.author_name === 'Portfolio Admin';
    recordTest(37, 'HTTP GET /api/blogs returns public data safely (200)', getBlogsRes.status === 200 && blogIsSecure);

    // 38. HTTP DELETE /api/blogs/:id cleanup (200)
    const deleteBlogRes = await fetch(`${baseUrl}/api/blogs/${httpBlogId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    recordTest(38, 'HTTP DELETE /api/blogs/:id cleanup (200)', deleteBlogRes.status === 200);

    // 39. Endpoint security: /api/upload enforces auth (401), and /api/contact rejects unauthenticated/invalid requests
    const uploadRes = await fetch(`${baseUrl}/api/upload`);
    const contactPostInvalid = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    recordTest(
      39,
      'Endpoint security: /api/upload enforces auth (401) and /api/contact validates input (400)',
      uploadRes.status === 401 && contactPostInvalid.status === 400
    );

  } finally {
    server.close();
  }

  // Summary
  console.log('\n====================================================');
  console.log('Test Summary:');
  const passedCount = testResults.filter((r) => r.passed).length;
  const totalCount = testResults.length;
  console.log(`Total: ${totalCount} | Passed: ${passedCount} | Failed: ${totalCount - passedCount}`);
  console.log('====================================================\n');

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runCmsTests().catch((err) => {
  console.error('Fatal error during CMS test suite execution:', err);
  process.exit(1);
});
