import { getDbPool } from '../db/index.ts';
import { logger } from '../utils/logger.ts';

export interface SeedResult {
  success: boolean;
  insertedCount: number;
  skippedCount: number;
  message: string;
  error?: string;
}

/**
 * Idempotent seed function that populates empty portfolio CMS modules
 * with realistic sample data using parameterized PostgreSQL queries.
 * Never deletes or overwrites existing records.
 */
export async function seedDemoData(): Promise<SeedResult> {
  const pool = getDbPool();
  if (!pool) {
    const msg = 'Demo data could not be inserted because PostgreSQL is unavailable.';
    logger.warn(msg);
    return {
      success: false,
      insertedCount: 0,
      skippedCount: 0,
      message: msg,
    };
  }

  let client;
  let insertedCount = 0;
  let skippedCount = 0;

  try {
    client = await pool.connect();

    // 1. Seed About Profile
    const aboutCheck = await client.query('SELECT id FROM about LIMIT 1;');
    if (aboutCheck.rows.length === 0) {
      await client.query(
        `INSERT INTO about (title, short_description, full_description)
         VALUES ($1, $2, $3);`,
        [
          'Full Stack Developer',
          'I build modern, responsive and scalable web applications with clean UI and powerful backend systems.',
          'I am a Full Stack Developer focused on building modern web applications, AI-powered products, SaaS platforms and scalable digital experiences. I enjoy turning ideas into reliable, user-friendly products using modern frontend and backend technologies.',
        ]
      );
      insertedCount++;
    } else {
      skippedCount++;
    }

    // 2. Seed Skills
    const sampleSkills = [
      { name: 'React.js', category: 'Frontend', proficiency: 90, display_order: 1 },
      { name: 'TypeScript', category: 'Frontend', proficiency: 85, display_order: 2 },
      { name: 'Tailwind CSS', category: 'Frontend', proficiency: 90, display_order: 3 },
      { name: 'Node.js', category: 'Backend', proficiency: 88, display_order: 4 },
      { name: 'Express.js', category: 'Backend', proficiency: 85, display_order: 5 },
      { name: 'MongoDB / PostgreSQL', category: 'Database', proficiency: 82, display_order: 6 },
    ];

    for (const skill of sampleSkills) {
      const existing = await client.query('SELECT id FROM skills WHERE LOWER(name) = LOWER($1);', [skill.name]);
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO skills (name, category, proficiency, display_order)
           VALUES ($1, $2, $3, $4);`,
          [skill.name, skill.category, skill.proficiency, skill.display_order]
        );
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    // 3. Seed Projects
    const sampleProjects = [
      {
        title: 'CloudVault',
        slug: 'cloudvault',
        short_description: 'A modern cloud storage platform for uploading, managing, previewing and organizing files.',
        full_description: 'CloudVault is a cloud storage platform designed to make file management simple and efficient. Users can upload files, create folders, preview images, PDFs and videos, search files and manage their cloud storage.',
        technologies: ['React', 'TypeScript', 'Node.js', 'Express.js', 'Supabase'],
        display_order: 1,
      },
      {
        title: 'GymFlow',
        slug: 'gymflow',
        short_description: 'A modern gym management platform for gym owners and members.',
        full_description: 'GymFlow helps gym owners manage members, memberships, attendance and gym operations through a professional dashboard.',
        technologies: ['React', 'TypeScript', 'Node.js', 'Express.js', 'MongoDB'],
        display_order: 2,
      },
      {
        title: 'ApnaStore',
        slug: 'apnastore',
        short_description: 'A grocery marketplace platform connecting customers with local shopkeepers.',
        full_description: 'ApnaStore is a grocery marketplace application where customers can explore shops, browse products, manage their cart and place orders while shopkeepers manage their stores and products.',
        technologies: ['React', 'Tailwind CSS', 'Node.js', 'Express.js', 'Supabase'],
        display_order: 3,
      },
    ];

    for (const proj of sampleProjects) {
      const existing = await client.query('SELECT id FROM projects WHERE slug = $1;', [proj.slug]);
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO projects (title, slug, short_description, full_description, technologies, display_order)
           VALUES ($1, $2, $3, $4, $5, $6);`,
          [proj.title, proj.slug, proj.short_description, proj.full_description, proj.technologies, proj.display_order]
        );
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    // 4. Seed Services
    const sampleServices = [
      {
        title: 'Full Stack Development',
        description: 'Building complete web applications with modern frontend, backend and database technologies.',
        display_order: 1,
      },
      {
        title: 'Frontend Development',
        description: 'Creating responsive, modern and user-friendly interfaces using React, TypeScript and Tailwind CSS.',
        display_order: 2,
      },
      {
        title: 'Backend API Development',
        description: 'Designing secure and scalable REST APIs with Node.js and Express.js.',
        display_order: 3,
      },
    ];

    for (const svc of sampleServices) {
      const existing = await client.query('SELECT id FROM services WHERE LOWER(title) = LOWER($1);', [svc.title]);
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO services (title, description, display_order)
           VALUES ($1, $2, $3);`,
          [svc.title, svc.description, svc.display_order]
        );
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    // 5. Seed Experience
    const sampleExperience = [
      {
        company: 'Software Development',
        position: 'Full Stack Developer',
        description: 'Developing responsive web applications, REST APIs, database systems and CMS platforms.',
        start_date: '2024-01-01',
        end_date: null,
        is_current: true,
        display_order: 1,
      },
      {
        company: 'Web Development Projects',
        position: 'Frontend Developer',
        description: 'Built responsive interfaces and modern dashboard experiences using React, TypeScript and Tailwind CSS.',
        start_date: '2023-01-01',
        end_date: '2023-12-31',
        is_current: false,
        display_order: 2,
      },
    ];

    for (const exp of sampleExperience) {
      const existing = await client.query(
        'SELECT id FROM experience WHERE LOWER(company) = LOWER($1) AND LOWER(position) = LOWER($2);',
        [exp.company, exp.position]
      );
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO experience (company, position, description, start_date, end_date, is_current, display_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7);`,
          [exp.company, exp.position, exp.description, exp.start_date, exp.end_date, exp.is_current, exp.display_order]
        );
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    // 6. Seed Testimonials
    const sampleTestimonials = [
      {
        name: 'Rahul Sharma',
        role: 'Product Manager',
        company: 'Tech Solutions',
        content: 'Excellent work with a strong focus on UI quality, performance and user experience.',
        display_order: 1,
      },
      {
        name: 'Priya Patel',
        role: 'Business Owner',
        company: 'Startup Labs',
        content: 'Very professional development work with clean design and reliable functionality.',
        display_order: 2,
      },
    ];

    for (const test of sampleTestimonials) {
      const existing = await client.query(
        'SELECT id FROM testimonials WHERE LOWER(name) = LOWER($1) AND content = $2;',
        [test.name, test.content]
      );
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO testimonials (name, role, company, content, display_order)
           VALUES ($1, $2, $3, $4, $5);`,
          [test.name, test.role, test.company, test.content, test.display_order]
        );
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    // 7. Seed Blogs
    const userRes = await client.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1;");
    const authorId = userRes.rows.length > 0 ? userRes.rows[0].id : null;

    const sampleBlogs = [
      {
        title: 'Building Modern React Applications',
        slug: 'building-modern-react-applications',
        excerpt: 'Practical principles for creating scalable and maintainable React applications.',
        content: 'Modern React applications should focus on reusable components, clear state management, responsive design and maintainable project structure.',
        published: true,
        published_at: new Date(),
        author_id: authorId,
      },
      {
        title: 'Building REST APIs with Node.js',
        slug: 'building-rest-apis-with-nodejs',
        excerpt: 'Important principles for building reliable backend APIs.',
        content: 'Node.js and Express.js provide a flexible foundation for building REST APIs. Proper validation, authentication, error handling and database access are important for production applications.',
        published: true,
        published_at: new Date(),
        author_id: authorId,
      },
    ];

    for (const blog of sampleBlogs) {
      const existing = await client.query('SELECT id FROM blogs WHERE slug = $1;', [blog.slug]);
      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO blogs (title, slug, excerpt, content, published, published_at, author_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7);`,
          [blog.title, blog.slug, blog.excerpt, blog.content, blog.published, blog.published_at, blog.author_id]
        );
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    const msg = 'Demo data seeding completed successfully.';
    logger.info(msg);

    return {
      success: true,
      insertedCount,
      skippedCount,
      message: msg,
    };
  } catch (err: any) {
    const msg = 'Demo data could not be inserted because PostgreSQL is unavailable.';
    logger.warn(`Seed notice: ${err?.message || msg}`);
    return {
      success: false,
      insertedCount,
      skippedCount,
      message: msg,
      error: err?.message,
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}

// CLI Direct Execution
if (process.argv[1] && (process.argv[1].endsWith('seedDemoData.ts') || process.argv[1].endsWith('seedDemoData.js'))) {
  (async () => {
    const result = await seedDemoData();
    if (result.success) {
      console.log('Demo data seeding completed successfully.');
      console.log(`Inserted: ${result.insertedCount} record(s)`);
      console.log(`Skipped (already existing): ${result.skippedCount} record(s)`);
      process.exit(0);
    } else {
      console.log(result.message);
      process.exit(0);
    }
  })();
}
