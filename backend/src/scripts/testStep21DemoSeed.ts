import assert from 'assert';
import { seedDemoData } from './seedDemoData.ts';
import { setDbPool, closeDatabaseConnections } from '../db/index.ts';

async function runSeedAudit() {
  console.log('================================================================');
  console.log('Step 21: Demo Portfolio Data Seed Audit');
  console.log('================================================================');

  // Test 1: Unavailable Database Pool Handling
  setDbPool(null as any);
  const unavailResult = await seedDemoData();
  assert.strictEqual(unavailResult.success, false);
  assert.strictEqual(unavailResult.message, 'Demo data could not be inserted because PostgreSQL is unavailable.');
  console.log('✓ PASS 1: Unavailable PostgreSQL handled gracefully without throwing');

  // Prepare In-Memory Database Mock for Isolated Seed Testing
  const inMemoryTables: Record<string, any[]> = {
    about: [],
    skills: [],
    projects: [],
    services: [],
    experience: [],
    testimonials: [],
    blogs: [],
    users: [{ id: 'mock-admin-uuid', role: 'admin' }],
  };

  const mockPool = {
    connect: async () => ({
      query: async (queryText: string, params?: any[]) => {
        const text = queryText.trim();

        // 1. About queries
        if (text.includes('SELECT id FROM about')) {
          return { rows: inMemoryTables.about.map((a) => ({ id: a.id })) };
        }
        if (text.startsWith('INSERT INTO about')) {
          inMemoryTables.about.push({
            id: 'about-1',
            title: params![0],
            short_description: params![1],
            full_description: params![2],
          });
          return { rowCount: 1 };
        }

        // 2. Skills queries
        if (text.includes('SELECT id FROM skills')) {
          const match = inMemoryTables.skills.filter(
            (s) => s.name.toLowerCase() === (params![0] || '').toLowerCase()
          );
          return { rows: match };
        }
        if (text.startsWith('INSERT INTO skills')) {
          inMemoryTables.skills.push({
            id: `skill-${inMemoryTables.skills.length + 1}`,
            name: params![0],
            category: params![1],
            proficiency: params![2],
            display_order: params![3],
          });
          return { rowCount: 1 };
        }

        // 3. Projects queries
        if (text.includes('SELECT id FROM projects')) {
          const match = inMemoryTables.projects.filter((p) => p.slug === params![0]);
          return { rows: match };
        }
        if (text.startsWith('INSERT INTO projects')) {
          inMemoryTables.projects.push({
            id: `proj-${inMemoryTables.projects.length + 1}`,
            title: params![0],
            slug: params![1],
            short_description: params![2],
            full_description: params![3],
            technologies: params![4],
            display_order: params![5],
          });
          return { rowCount: 1 };
        }

        // 4. Services queries
        if (text.includes('SELECT id FROM services')) {
          const match = inMemoryTables.services.filter(
            (s) => s.title.toLowerCase() === (params![0] || '').toLowerCase()
          );
          return { rows: match };
        }
        if (text.startsWith('INSERT INTO services')) {
          inMemoryTables.services.push({
            id: `svc-${inMemoryTables.services.length + 1}`,
            title: params![0],
            description: params![1],
            display_order: params![2],
          });
          return { rowCount: 1 };
        }

        // 5. Experience queries
        if (text.includes('SELECT id FROM experience')) {
          const match = inMemoryTables.experience.filter(
            (e) =>
              e.company.toLowerCase() === (params![0] || '').toLowerCase() &&
              e.position.toLowerCase() === (params![1] || '').toLowerCase()
          );
          return { rows: match };
        }
        if (text.startsWith('INSERT INTO experience')) {
          inMemoryTables.experience.push({
            id: `exp-${inMemoryTables.experience.length + 1}`,
            company: params![0],
            position: params![1],
            description: params![2],
            start_date: params![3],
            end_date: params![4],
            is_current: params![5],
            display_order: params![6],
          });
          return { rowCount: 1 };
        }

        // 6. Testimonials queries
        if (text.includes('SELECT id FROM testimonials')) {
          const match = inMemoryTables.testimonials.filter(
            (t) => t.name.toLowerCase() === (params![0] || '').toLowerCase() && t.content === params![1]
          );
          return { rows: match };
        }
        if (text.startsWith('INSERT INTO testimonials')) {
          inMemoryTables.testimonials.push({
            id: `test-${inMemoryTables.testimonials.length + 1}`,
            name: params![0],
            role: params![1],
            company: params![2],
            content: params![3],
            display_order: params![4],
          });
          return { rowCount: 1 };
        }

        // 7. Users query for blog author
        if (text.includes("SELECT id FROM users WHERE role = 'admin'")) {
          return { rows: inMemoryTables.users };
        }

        // 8. Blogs queries
        if (text.includes('SELECT id FROM blogs')) {
          const match = inMemoryTables.blogs.filter((b) => b.slug === params![0]);
          return { rows: match };
        }
        if (text.startsWith('INSERT INTO blogs')) {
          inMemoryTables.blogs.push({
            id: `blog-${inMemoryTables.blogs.length + 1}`,
            title: params![0],
            slug: params![1],
            excerpt: params![2],
            content: params![3],
            published: params![4],
            published_at: params![5],
            author_id: params![6],
          });
          return { rowCount: 1 };
        }

        return { rows: [] };
      },
      release: () => {},
    }),
    end: async () => {},
  };

  setDbPool(mockPool as any);

  // Test 2: Initial Seed on Clean Database
  const firstRun = await seedDemoData();
  assert.strictEqual(firstRun.success, true);
  assert.strictEqual(firstRun.insertedCount, 19); // 1 about + 6 skills + 3 projects + 3 services + 2 exp + 2 test + 2 blogs = 19
  assert.strictEqual(firstRun.skippedCount, 0);
  assert.strictEqual(inMemoryTables.about.length, 1);
  assert.strictEqual(inMemoryTables.skills.length, 6);
  assert.strictEqual(inMemoryTables.projects.length, 3);
  assert.strictEqual(inMemoryTables.services.length, 3);
  assert.strictEqual(inMemoryTables.experience.length, 2);
  assert.strictEqual(inMemoryTables.testimonials.length, 2);
  assert.strictEqual(inMemoryTables.blogs.length, 2);
  console.log(`✓ PASS 2: Clean seed inserted ${firstRun.insertedCount} demo records across 7 CMS modules`);

  // Test 3: Idempotency & Duplicate Protection on Second Run
  const secondRun = await seedDemoData();
  assert.strictEqual(secondRun.success, true);
  assert.strictEqual(secondRun.insertedCount, 0);
  assert.strictEqual(secondRun.skippedCount, 19);
  assert.strictEqual(inMemoryTables.about.length, 1);
  assert.strictEqual(inMemoryTables.skills.length, 6);
  assert.strictEqual(inMemoryTables.projects.length, 3);
  assert.strictEqual(inMemoryTables.services.length, 3);
  assert.strictEqual(inMemoryTables.experience.length, 2);
  assert.strictEqual(inMemoryTables.testimonials.length, 2);
  assert.strictEqual(inMemoryTables.blogs.length, 2);
  console.log('✓ PASS 3: Second run created 0 duplicates (19 existing records preserved)');

  // Test 4: Verification of Specific Sample Records
  assert.strictEqual(inMemoryTables.about[0].title, 'Full Stack Developer');
  assert.strictEqual(inMemoryTables.skills[0].name, 'React.js');
  assert.strictEqual(inMemoryTables.skills[0].proficiency, 90);
  assert.strictEqual(inMemoryTables.projects[0].slug, 'cloudvault');
  assert.deepStrictEqual(inMemoryTables.projects[0].technologies, ['React', 'TypeScript', 'Node.js', 'Express.js', 'Supabase']);
  assert.strictEqual(inMemoryTables.services[0].title, 'Full Stack Development');
  assert.strictEqual(inMemoryTables.experience[0].company, 'Software Development');
  assert.strictEqual(inMemoryTables.experience[0].is_current, true);
  assert.strictEqual(inMemoryTables.testimonials[0].name, 'Rahul Sharma');
  assert.strictEqual(inMemoryTables.blogs[0].slug, 'building-modern-react-applications');
  console.log('✓ PASS 4: Sample data fields and content match project specification precisely');

  await closeDatabaseConnections();
  console.log('================================================================');
  console.log('All Demo Seed Checks Passed Successfully!');
  console.log('================================================================');
}

runSeedAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
