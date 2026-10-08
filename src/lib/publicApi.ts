import {
  AboutRecord,
  SkillRecord,
  ProjectRecord,
  BlogRecord,
  ExperienceRecord,
  TestimonialRecord,
  ServiceRecord,
  ContactPayload,
  ApiResponse,
} from '../types.ts';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * Clean public HTTP client without authorization headers.
 */
async function fetchPublicJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});
  
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let payload: any = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    payload = await response.json();
  } else {
    const text = await response.text();
    payload = { message: text };
  }

  if (!response.ok) {
    const errorMsg = payload?.error || payload?.message || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return payload?.data !== undefined ? payload.data : payload;
}

export const publicApi = {
  /**
   * Fetch portfolio bio and profile details.
   */
  async getAbout(): Promise<AboutRecord | null> {
    try {
      const data = await fetchPublicJson<AboutRecord>('/api/about');
      return data || null;
    } catch {
      return {
        id: 'sample-about',
        title: 'Full Stack Developer',
        short_description: 'I build modern, responsive and scalable web applications with clean UI and powerful backend systems.',
        full_description: 'I am a Full Stack Developer focused on building modern web applications, AI-powered products, SaaS platforms and scalable digital experiences.',
        profile_image_url: null,
        resume_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  },

  /**
   * Fetch ordered technical skills.
   */
  async getSkills(): Promise<SkillRecord[]> {
    try {
      const data = await fetchPublicJson<SkillRecord[]>('/api/skills');
      return Array.isArray(data) ? data : [];
    } catch {
      return [
        { id: '1', name: 'React.js', category: 'Frontend', proficiency: 90, icon_url: null, display_order: 1, created_at: '', updated_at: '' },
        { id: '2', name: 'TypeScript', category: 'Frontend', proficiency: 85, icon_url: null, display_order: 2, created_at: '', updated_at: '' },
        { id: '3', name: 'Tailwind CSS', category: 'Frontend', proficiency: 90, icon_url: null, display_order: 3, created_at: '', updated_at: '' },
        { id: '4', name: 'Node.js', category: 'Backend', proficiency: 88, icon_url: null, display_order: 4, created_at: '', updated_at: '' },
        { id: '5', name: 'Express.js', category: 'Backend', proficiency: 85, icon_url: null, display_order: 5, created_at: '', updated_at: '' },
        { id: '6', name: 'PostgreSQL / Supabase', category: 'Database', proficiency: 82, icon_url: null, display_order: 6, created_at: '', updated_at: '' },
      ];
    }
  },

  /**
   * Fetch ordered projects list.
   */
  async getProjects(): Promise<ProjectRecord[]> {
    try {
      const data = await fetchPublicJson<ProjectRecord[]>('/api/projects');
      return Array.isArray(data) ? data : [];
    } catch {
      return [
        {
          id: 'p1',
          title: 'CloudVault',
          slug: 'cloudvault',
          short_description: 'A modern cloud storage platform for uploading, managing, previewing and organizing files.',
          full_description: 'CloudVault is a cloud storage platform designed to make file management simple and efficient.',
          image_url: null,
          technologies: ['React', 'TypeScript', 'Node.js', 'Express.js', 'Supabase'],
          live_url: null,
          github_url: null,
          display_order: 1,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'p2',
          title: 'GymFlow',
          slug: 'gymflow',
          short_description: 'A modern gym management platform for gym owners and members.',
          full_description: 'GymFlow helps gym owners manage members, memberships, attendance and gym operations.',
          image_url: null,
          technologies: ['React', 'TypeScript', 'Node.js', 'Express.js', 'MongoDB'],
          live_url: null,
          github_url: null,
          display_order: 2,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'p3',
          title: 'ApnaStore',
          slug: 'apnastore',
          short_description: 'A grocery marketplace platform connecting customers with local shopkeepers.',
          full_description: 'ApnaStore is a grocery marketplace application where customers can explore shops and place orders.',
          image_url: null,
          technologies: ['React', 'Tailwind CSS', 'Node.js', 'Express.js', 'Supabase'],
          live_url: null,
          github_url: null,
          display_order: 3,
          created_at: '',
          updated_at: '',
        },
      ];
    }
  },

  /**
   * Fetch a single project by unique slug.
   */
  async getProjectBySlug(slug: string): Promise<ProjectRecord | null> {
    try {
      const data = await fetchPublicJson<ProjectRecord>(`/api/projects/${encodeURIComponent(slug)}`);
      return data || null;
    } catch {
      const projects = await this.getProjects();
      return projects.find((p) => p.slug === slug) || projects[0] || null;
    }
  },

  /**
   * Fetch published blog posts.
   */
  async getBlogs(): Promise<BlogRecord[]> {
    try {
      const data = await fetchPublicJson<BlogRecord[]>('/api/blogs');
      return Array.isArray(data) ? data : [];
    } catch {
      return [
        {
          id: 'b1',
          title: 'Building Scalable Web Applications with React and Node.js',
          slug: 'building-scalable-web-apps',
          excerpt: 'Best practices for designing high-performance full stack web applications.',
          content: 'Full content...',
          featured_image_url: null,
          author_id: null,
          published: true,
          published_at: new Date().toISOString(),
          display_order: 1,
          created_at: '',
          updated_at: '',
        } as any,
      ];
    }
  },

  /**
   * Fetch a single published blog by slug.
   */
  async getBlogBySlug(slug: string): Promise<BlogRecord | null> {
    try {
      const data = await fetchPublicJson<BlogRecord>(`/api/blogs/${encodeURIComponent(slug)}`);
      return data || null;
    } catch {
      const blogs = await this.getBlogs();
      return blogs.find((b) => b.slug === slug) || blogs[0] || null;
    }
  },

  /**
   * Fetch career history and work experience.
   */
  async getExperience(): Promise<ExperienceRecord[]> {
    try {
      const data = await fetchPublicJson<ExperienceRecord[]>('/api/experience');
      return Array.isArray(data) ? data : [];
    } catch {
      return [
        {
          id: 'e1',
          company: 'Software Development',
          position: 'Full Stack Developer',
          description: 'Developing responsive web applications, REST APIs, database systems and CMS platforms.',
          start_date: '2024-01-01',
          end_date: null,
          is_current: true,
          display_order: 1,
          created_at: '',
          updated_at: '',
        },
      ];
    }
  },

  /**
   * Fetch client recommendations and testimonials.
   */
  async getTestimonials(): Promise<TestimonialRecord[]> {
    try {
      const data = await fetchPublicJson<TestimonialRecord[]>('/api/testimonials');
      return Array.isArray(data) ? data : [];
    } catch {
      return [
        {
          id: 't1',
          name: 'Alex Morgan',
          role: 'Product Manager',
          company: 'Tech Corp',
          content: 'An exceptional developer who delivers high-quality applications on time and with incredible attention to detail.',
          profile_image_url: null,
          display_order: 1,
          created_at: '',
          updated_at: '',
        },
      ];
    }
  },

  /**
   * Fetch service offerings and consulting capabilities.
   */
  async getServices(): Promise<ServiceRecord[]> {
    try {
      const data = await fetchPublicJson<ServiceRecord[]>('/api/services');
      return Array.isArray(data) ? data : [];
    } catch {
      return [
        { id: 's1', title: 'Full Stack Development', description: 'Building complete web applications with modern frontend, backend and database technologies.', icon_url: null, display_order: 1, created_at: '', updated_at: '' },
        { id: 's2', title: 'Frontend Development', description: 'Creating responsive, modern and user-friendly interfaces using React, TypeScript and Tailwind CSS.', icon_url: null, display_order: 2, created_at: '', updated_at: '' },
        { id: 's3', title: 'Backend API Development', description: 'Designing secure and scalable REST APIs with Node.js and Express.js.', icon_url: null, display_order: 3, created_at: '', updated_at: '' },
      ];
    }
  },

  /**
   * Send a contact inquiry.
   */
  async submitContact(payload: ContactPayload): Promise<ApiResponse> {
    const url = `${API_BASE_URL}/api/contact`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        success: false,
        error: data?.error || data?.message || 'Failed to send message. Please try again.',
        errors: data?.errors,
      };
    }

    return {
      success: true,
      message: data?.message || 'Thank you! Your message has been sent successfully.',
      data: data?.data,
    };
  },
};
