import pgMem from 'pg-mem';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger.ts';

const { newDb } = pgMem;

let memoryDbInstance: any = null;
let memoryPoolInstance: any = null;

/**
 * Initializes an in-memory PostgreSQL instance using pg-mem,
 * registers custom functions (gen_random_uuid), applies the 11 schema tables,
 * and seeds baseline portfolio data.
 */
export function getOrCreateMemoryPool(): any {
  if (memoryPoolInstance) {
    return memoryPoolInstance;
  }

  const db = newDb();

  // Register gen_random_uuid with impure: true so it generates a fresh UUID on every call
  db.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

  // Schema Tables DDL
  const schemaSql = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'admin',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS about (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      short_description TEXT NOT NULL,
      full_description TEXT NOT NULL,
      profile_image_url TEXT,
      resume_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS skills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      category VARCHAR(100) NOT NULL,
      proficiency INTEGER,
      icon_url TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      short_description TEXT NOT NULL,
      full_description TEXT NOT NULL,
      image_url TEXT,
      technologies TEXT[] NOT NULL DEFAULT '{}',
      live_url TEXT,
      github_url TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS blogs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      featured_image_url TEXT,
      author_id UUID REFERENCES users(id) ON DELETE SET NULL,
      published BOOLEAN NOT NULL DEFAULT false,
      published_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS experience (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company VARCHAR(255) NOT NULL,
      position VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      is_current BOOLEAN NOT NULL DEFAULT false,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      role VARCHAR(255) NOT NULL,
      company VARCHAR(255),
      content TEXT NOT NULL,
      profile_image_url TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS services (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      icon_url TEXT,
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS media (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      filename VARCHAR(255) NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      storage_path TEXT NOT NULL,
      storage_url TEXT NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      file_size BIGINT NOT NULL,
      uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  try {
    db.public.none(schemaSql);
  } catch (err) {
    logger.error('Error executing in-memory schema DDL:', err);
  }

  // Seed baseline data
  const adminPasswordHash = bcrypt.hashSync('AdminPassword123!', 10);
  const adminId = 'aeacc6e3-1062-4df7-8845-499973536b95';

  try {
    // 1. Seed Admin User
    db.public.none(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES ('${adminId}', 'Administrator', 'admin@portfolio.local', '${adminPasswordHash}', 'admin');
    `);

    // 2. Seed About Profile
    const aboutId = crypto.randomUUID();
    db.public.none(`
      INSERT INTO about (id, title, short_description, full_description, profile_image_url, resume_url)
      VALUES (
        '${aboutId}',
        'Senior Full-Stack Engineer & Cloud Architect',
        'Designing and building high-performance, scalable web applications and resilient cloud platforms.',
        'With over 8 years of engineering experience across React, Node.js, TypeScript, PostgreSQL, and cloud infrastructures, I build reliable, production-grade applications that solve complex problems and deliver exceptional user experiences.',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
        'https://example.com/resume.pdf'
      );
    `);

    // 3. Seed Skills
    const skills = [
      { id: crypto.randomUUID(), name: 'TypeScript & JavaScript', category: 'Frontend', proficiency: 98, display_order: 1 },
      { id: crypto.randomUUID(), name: 'React 19 & Next.js', category: 'Frontend', proficiency: 95, display_order: 2 },
      { id: crypto.randomUUID(), name: 'Tailwind CSS & UI Systems', category: 'Frontend', proficiency: 92, display_order: 3 },
      { id: crypto.randomUUID(), name: 'Node.js & Express', category: 'Backend', proficiency: 96, display_order: 4 },
      { id: crypto.randomUUID(), name: 'PostgreSQL & Database Design', category: 'Backend', proficiency: 90, display_order: 5 },
      { id: crypto.randomUUID(), name: 'REST & GraphQL APIs', category: 'Backend', proficiency: 94, display_order: 6 },
      { id: crypto.randomUUID(), name: 'Docker & Containerization', category: 'Cloud & DevOps', proficiency: 88, display_order: 7 },
      { id: crypto.randomUUID(), name: 'CI/CD & Cloud Deployments', category: 'Cloud & DevOps', proficiency: 89, display_order: 8 },
    ];
    for (const skill of skills) {
      db.public.none(`
        INSERT INTO skills (id, name, category, proficiency, display_order)
        VALUES ('${skill.id}', '${skill.name}', '${skill.category}', ${skill.proficiency}, ${skill.display_order});
      `);
    }

    // 4. Seed Projects
    db.public.none(`
      INSERT INTO projects (id, title, slug, short_description, full_description, technologies, display_order)
      VALUES (
        '${crypto.randomUUID()}',
        'Portfolio CMS & Management Platform',
        'portfolio-cms',
        'Custom content management system with role-based access control, analytics, and responsive client experience.',
        'A full-stack portfolio management platform built with React, Express, PostgreSQL, and Supabase cloud storage.',
        ARRAY['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Tailwind CSS'],
        1
      );
    `);

    db.public.none(`
      INSERT INTO projects (id, title, slug, short_description, full_description, technologies, display_order)
      VALUES (
        '${crypto.randomUUID()}',
        'Enterprise Analytics Engine',
        'enterprise-analytics',
        'Real-time streaming telemetry dashboard handling millions of metric events daily.',
        'High-throughput data visualization and reporting platform with distributed caching and interactive charting.',
        ARRAY['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Redis'],
        2
      );
    `);

    // 5. Seed Experience
    db.public.none(`
      INSERT INTO experience (id, company, position, description, start_date, is_current, display_order)
      VALUES (
        '${crypto.randomUUID()}',
        'Tech Innovations Inc.',
        'Lead Full-Stack Architect',
        'Led architecture and delivery of distributed cloud microservices and responsive web platforms.',
        '2022-01-01',
        true,
        1
      );
    `);
    db.public.none(`
      INSERT INTO experience (id, company, position, description, start_date, end_date, is_current, display_order)
      VALUES (
        '${crypto.randomUUID()}',
        'Digital Product Studio',
        'Senior Software Engineer',
        'Engineered scalable REST APIs, database schemas, and modern frontend user interfaces.',
        '2019-06-01',
        '2021-12-31',
        false,
        2
      );
    `);

    // 6. Seed Testimonials
    db.public.none(`
      INSERT INTO testimonials (id, name, role, company, content, display_order)
      VALUES (
        '${crypto.randomUUID()}',
        'Sarah Jenkins',
        'VP of Engineering',
        'CloudScale Systems',
        'An exceptional engineer who consistently delivers robust, secure, and performant solutions ahead of schedule.',
        1
      );
    `);

    // 7. Seed Services
    db.public.none(`
      INSERT INTO services (id, title, description, display_order)
      VALUES (
        '${crypto.randomUUID()}',
        'Full-Stack Web Development',
        'End-to-end architecture and implementation of scalable web applications using modern React and Node.js ecosystems.',
        1
      );
    `);
    db.public.none(`
      INSERT INTO services (id, title, description, display_order)
      VALUES (
        '${crypto.randomUUID()}',
        'Database & API Architecture',
        'High-performance schema modeling, query optimization, secure authentication, and resilient API design.',
        2
      );
    `);

    // 8. Seed Blog
    db.public.none(`
      INSERT INTO blogs (id, title, slug, excerpt, content, author_id, published, published_at)
      VALUES (
        '${crypto.randomUUID()}',
        'Architecting Production-Ready Full-Stack Applications',
        'architecting-production-ready-full-stack-applications',
        'Best practices for structuring TypeScript monorepos, database connections, and secure authentication flows.',
        'Building scalable applications requires careful attention to database pooling, environment isolation, and error boundaries...',
        '${adminId}',
        true,
        NOW()
      );
    `);
  } catch (err) {
    logger.error('Error inserting seed data into in-memory database:', err);
  }

  memoryDbInstance = db;
  const { Pool } = db.adapters.createPg();
  memoryPoolInstance = new Pool();
  return memoryPoolInstance;
}
