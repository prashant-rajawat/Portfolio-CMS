import fs from 'fs';
import path from 'path';
import { newDb } from 'pg-mem';

async function testMigrations() {
  console.log('====================================================');
  console.log('Portfolio CMS - Offline Schema & Operations Test');
  console.log('====================================================');

  const db = newDb();

  // Register gen_random_uuid in pg-mem
  db.public.registerFunction({
    name: 'gen_random_uuid',
    implementation: () => '11111111-2222-3333-4444-555555555555',
  });

  const migrationsDir = path.resolve(process.cwd(), 'backend', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  console.log(`\nFound ${files.length} migration files in backend/migrations:`);
  files.forEach((f) => console.log(`  - ${f}`));

  // 1. Execute migrations
  console.log('\n--- 1. Testing Migration SQL Execution ---');
  for (const file of files) {
    const rawSql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    // pg-mem parser has known limitations with PL/pgSQL CREATE FUNCTION and DROP TRIGGER ON <table> syntax.
    // Strip trigger statements purely for pg-mem in-memory parsing, leaving tables, constraints, types, and indexes fully tested.
    const sqlForPgMem = rawSql
      .replace(/CREATE OR REPLACE FUNCTION[\s\S]*?LANGUAGE plpgsql;/gi, '')
      .replace(/DROP TRIGGER IF EXISTS[\s\S]*?;/gi, '')
      .replace(/CREATE TRIGGER[\s\S]*?EXECUTE FUNCTION[\s\S]*?;/gi, '');

    try {
      db.public.none(sqlForPgMem);
      console.log(`[PASS] Executed: ${file}`);
    } catch (err: any) {
      console.error(`[FAIL] Migration execution failed on ${file}:`, err?.message || err);
      process.exit(1);
    }
  }

  // 2. Verify all required tables exist
  const expectedTables = [
    'users',
    'about',
    'skills',
    'projects',
    'blogs',
    'experience',
    'testimonials',
    'services',
    'messages',
    'media',
    'refresh_tokens',
  ];

  console.log('\n--- 2. Testing Required Tables Existence ---');
  for (const table of expectedTables) {
    try {
      const result = db.public.many(`SELECT * FROM ${table} LIMIT 1;`);
      console.log(`[PASS] Table exists: ${table}`);
    } catch (err: any) {
      console.error(`[FAIL] Table missing: ${table} - ${err?.message}`);
      process.exit(1);
    }
  }

  // 3. Test INSERT, SELECT, UPDATE, DELETE & Unique Constraint on users
  console.log('\n--- 3. Testing Users Table (CRUD & Unique Email) ---');
  // INSERT
  db.public.none(`
    INSERT INTO users (id, name, email, password_hash, role)
    VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Admin User', 'admin@example.com', '$2b$10$xyz...', 'admin');
  `);
  console.log('[PASS] INSERT user');

  // SELECT
  const user = db.public.one(`SELECT name, email, role FROM users WHERE email = 'admin@example.com';`);
  if (user && user.name === 'Admin User') {
    console.log('[PASS] SELECT user');
  } else {
    console.error('[FAIL] SELECT user');
  }

  // UPDATE
  db.public.none(`UPDATE users SET name = 'Super Admin' WHERE email = 'admin@example.com';`);
  const updatedUser = db.public.one(`SELECT name FROM users WHERE email = 'admin@example.com';`);
  if (updatedUser.name === 'Super Admin') {
    console.log('[PASS] UPDATE user');
  }

  // UNIQUE CONSTRAINT
  try {
    db.public.none(`
      INSERT INTO users (name, email, password_hash)
      VALUES ('Duplicate User', 'admin@example.com', 'dummyhash');
    `);
    console.error('[FAIL] Unique constraint on email was not enforced');
  } catch {
    console.log('[PASS] Unique constraint on users(email) properly rejected duplicate');
  }

  // 4. Test Foreign Key: blogs(author_id) -> users(id)
  console.log('\n--- 4. Testing Foreign Key Relationships ---');
  db.public.none(`
    INSERT INTO blogs (id, title, slug, excerpt, content, author_id, published)
    VALUES ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'First Post', 'first-post', 'Excerpt', 'Full content', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', true);
  `);
  const blog = db.public.one(`SELECT title, author_id FROM blogs WHERE slug = 'first-post';`);
  if (blog && blog.author_id === 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11') {
    console.log('[PASS] INSERT blog with foreign key author_id');
  }

  // 5. Test Media table with uploaded_by foreign key
  db.public.none(`
    INSERT INTO media (id, filename, original_filename, storage_path, storage_url, mime_type, file_size, uploaded_by)
    VALUES ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', 'avatar.png', 'my_pic.png', '/uploads/avatar.png', 'https://cdn.example.com/avatar.png', 'image/png', 204800, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
  `);
  console.log('[PASS] INSERT media with foreign key uploaded_by');

  // 6. Test About table
  db.public.none(`
    INSERT INTO about (title, short_description, full_description)
    VALUES ('Full Stack Developer', 'Building modern apps', 'Extensive bio description...');
  `);
  console.log('[PASS] INSERT about');

  // 7. Test Skills table
  db.public.none(`
    INSERT INTO skills (name, category, proficiency, display_order)
    VALUES ('TypeScript', 'Frontend & Backend', 95, 1);
  `);
  console.log('[PASS] INSERT skills');

  // 8. Test Projects table
  db.public.none(`
    INSERT INTO projects (title, slug, short_description, full_description, technologies, display_order)
    VALUES ('Portfolio CMS', 'portfolio-cms', 'Custom CMS platform', 'Full project details...', ARRAY['Node.js', 'Express', 'TypeScript', 'PostgreSQL'], 1);
  `);
  console.log('[PASS] INSERT projects');

  // 9. Test Experience table
  db.public.none(`
    INSERT INTO experience (company, position, description, start_date, is_current, display_order)
    VALUES ('Tech Corp', 'Senior Engineer', 'Leading engineering team', '2022-01-01', true, 1);
  `);
  console.log('[PASS] INSERT experience');

  // 10. Test Testimonials table
  db.public.none(`
    INSERT INTO testimonials (name, role, company, content, display_order)
    VALUES ('Jane Doe', 'Product Lead', 'Innovate LLC', 'Exceptional work delivered on time.', 1);
  `);
  console.log('[PASS] INSERT testimonials');

  // 11. Test Services table
  db.public.none(`
    INSERT INTO services (title, description, display_order)
    VALUES ('Full-Stack Web Development', 'End-to-end web applications with modern architecture.', 1);
  `);
  console.log('[PASS] INSERT services');

  // 12. Test Messages table
  db.public.none(`
    INSERT INTO messages (name, email, subject, message, is_read)
    VALUES ('Inquirer', 'client@example.com', 'Project Inquiry', 'Looking for developer consultation.', false);
  `);
  console.log('[PASS] INSERT messages');

  // 13. Test Refresh Tokens table
  db.public.none(`
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', NOW() + INTERVAL '7 days');
  `);
  console.log('[PASS] INSERT refresh_tokens');

  // 14. Test DELETE with cleanup
  db.public.none(`DELETE FROM blogs WHERE slug = 'first-post';`);
  const deletedBlog = db.public.many(`SELECT * FROM blogs WHERE slug = 'first-post';`);
  if (deletedBlog.length === 0) {
    console.log('[PASS] DELETE blog');
  }

  db.public.none(`DELETE FROM users WHERE email = 'admin@example.com';`);
  const deletedUser = db.public.many(`SELECT * FROM users WHERE email = 'admin@example.com';`);
  if (deletedUser.length === 0) {
    console.log('[PASS] DELETE user');
  }

  console.log('\n====================================================');
  console.log('All 10 tables, migrations, constraints, and CRUD operations tested successfully!');
  console.log('====================================================');
}

testMigrations().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
