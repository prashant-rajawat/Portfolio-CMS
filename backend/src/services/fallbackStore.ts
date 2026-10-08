import fs from 'fs';
import path from 'path';

interface FallbackDb {
  about: any[];
  skills: any[];
  projects: any[];
  blogs: any[];
  experience: any[];
  testimonials: any[];
  services: any[];
  users: any[];
}

const STORAGE_DIR = path.resolve(process.cwd(), 'backend', 'data');
const STORAGE_FILE = path.join(STORAGE_DIR, 'cms_storage.json');

function getInitialData(): FallbackDb {
  return {
    about: [
      {
        id: 'sample-about-1',
        title: 'Full Stack Developer',
        short_description: 'I build modern, responsive and scalable web applications with clean UI and powerful backend systems.',
        full_description: 'I am a Full Stack Developer focused on building modern web applications, AI-powered products, SaaS platforms and scalable digital experiences. I enjoy turning ideas into reliable, user-friendly products using modern frontend and backend technologies.',
        profile_image_url: null,
        resume_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    skills: [
      { id: 's-1', name: 'React.js', category: 'Frontend', proficiency: 90, icon_url: null, display_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 's-2', name: 'TypeScript', category: 'Frontend', proficiency: 85, icon_url: null, display_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 's-3', name: 'Tailwind CSS', category: 'Frontend', proficiency: 90, icon_url: null, display_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 's-4', name: 'Node.js', category: 'Backend', proficiency: 88, icon_url: null, display_order: 4, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 's-5', name: 'Express.js', category: 'Backend', proficiency: 85, icon_url: null, display_order: 5, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 's-6', name: 'PostgreSQL / Supabase', category: 'Database', proficiency: 82, icon_url: null, display_order: 6, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ],
    projects: [
      {
        id: 'p-1',
        title: 'CloudVault',
        slug: 'cloudvault',
        short_description: 'A modern cloud storage platform for uploading, managing, previewing and organizing files.',
        full_description: 'CloudVault is a cloud storage platform designed to make file management simple and efficient.',
        image_url: null,
        technologies: ['React', 'TypeScript', 'Node.js', 'Express.js', 'Supabase'],
        live_url: null,
        github_url: null,
        display_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'p-2',
        title: 'GymFlow',
        slug: 'gymflow',
        short_description: 'A modern gym management platform for gym owners and members.',
        full_description: 'GymFlow helps gym owners manage members, memberships, attendance and gym operations.',
        image_url: null,
        technologies: ['React', 'TypeScript', 'Node.js', 'Express.js', 'MongoDB'],
        live_url: null,
        github_url: null,
        display_order: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'p-3',
        title: 'ApnaStore',
        slug: 'apnastore',
        short_description: 'A grocery marketplace platform connecting customers with local shopkeepers.',
        full_description: 'ApnaStore is a grocery marketplace application where customers can explore shops and place orders.',
        image_url: null,
        technologies: ['React', 'Tailwind CSS', 'Node.js', 'Express.js', 'Supabase'],
        live_url: null,
        github_url: null,
        display_order: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    blogs: [
      {
        id: 'b-1',
        title: 'Building Scalable Web Applications with React and Node.js',
        slug: 'building-scalable-web-apps',
        excerpt: 'Best practices for designing high-performance full stack web applications.',
        content: 'Full content of the blog post discussing architecture, components, and backend design.',
        featured_image_url: null,
        author_id: 'user-admin',
        author_name: 'Administrator',
        published: true,
        published_at: new Date().toISOString(),
        display_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'b-2',
        title: 'Mastering PostgreSQL and Supabase for Modern SaaS',
        slug: 'mastering-postgresql-supabase',
        excerpt: 'A comprehensive guide to relational database design and indexing.',
        content: 'Content about relational database management, performance tuning, and schema design.',
        featured_image_url: null,
        author_id: 'user-admin',
        author_name: 'Administrator',
        published: true,
        published_at: new Date().toISOString(),
        display_order: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    experience: [
      {
        id: 'e-1',
        company: 'Tech Solutions Inc.',
        position: 'Senior Full Stack Developer',
        description: 'Led development of cloud-native web applications and microservices architecture.',
        start_date: '2022-01-01',
        end_date: null,
        is_current: true,
        display_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'e-2',
        company: 'Digital Labs',
        position: 'Frontend Engineer',
        description: 'Built responsive user interfaces and interactive dashboards using React and TypeScript.',
        start_date: '2020-03-01',
        end_date: '2021-12-31',
        is_current: false,
        display_order: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    testimonials: [
      {
        id: 't-1',
        name: 'Alex Morgan',
        role: 'Product Manager',
        company: 'Tech Corp',
        content: 'An exceptional developer who delivers high-quality applications on time and with incredible attention to detail.',
        profile_image_url: null,
        display_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 't-2',
        name: 'Sarah Connor',
        role: 'CTO',
        company: 'Innovate AI',
        content: 'Brilliant technical skills and strong architectural vision. Delivered our entire platform ahead of schedule.',
        profile_image_url: null,
        display_order: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    services: [
      { id: 'srv-1', title: 'Full Stack Development', description: 'Building complete web applications with modern frontend, backend and database technologies.', icon_url: null, display_order: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'srv-2', title: 'Frontend Development', description: 'Creating responsive, modern and user-friendly interfaces using React, TypeScript and Tailwind CSS.', icon_url: null, display_order: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: 'srv-3', title: 'Backend API Development', description: 'Designing secure and scalable REST APIs with Node.js and Express.js.', icon_url: null, display_order: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ],
    users: [
      {
        id: 'user-admin',
        name: 'Administrator',
        email: 'dreambattle311@gmail.com',
        password_hash: '$2a$10$abcdefghijklmnopqrstuvwxyz123456', // placeholder hash handled by auth service
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
  };
}

export class FallbackStore {
  public static readStore(): FallbackDb {
    try {
      if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
      }
      if (!fs.existsSync(STORAGE_FILE)) {
        const initial = getInitialData();
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
        return initial;
      }
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      return {
        about: data.about || [],
        skills: data.skills || [],
        projects: data.projects || [],
        blogs: data.blogs || [],
        experience: data.experience || [],
        testimonials: data.testimonials || [],
        services: data.services || [],
        users: data.users || [],
      };
    } catch {
      return getInitialData();
    }
  }

  public static writeStore(data: FallbackDb): void {
    try {
      if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
      }
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write fallback store:', err);
    }
  }
}
