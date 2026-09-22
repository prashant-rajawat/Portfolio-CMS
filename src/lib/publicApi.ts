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
    } catch (err) {
      console.warn('publicApi.getAbout warning:', err);
      return null;
    }
  },

  /**
   * Fetch ordered technical skills.
   */
  async getSkills(): Promise<SkillRecord[]> {
    try {
      const data = await fetchPublicJson<SkillRecord[]>('/api/skills');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('publicApi.getSkills warning:', err);
      return [];
    }
  },

  /**
   * Fetch ordered projects list.
   */
  async getProjects(): Promise<ProjectRecord[]> {
    try {
      const data = await fetchPublicJson<ProjectRecord[]>('/api/projects');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('publicApi.getProjects warning:', err);
      return [];
    }
  },

  /**
   * Fetch a single project by unique slug.
   */
  async getProjectBySlug(slug: string): Promise<ProjectRecord | null> {
    try {
      const data = await fetchPublicJson<ProjectRecord>(`/api/projects/${encodeURIComponent(slug)}`);
      return data || null;
    } catch (err) {
      console.warn(`publicApi.getProjectBySlug("${slug}") warning:`, err);
      return null;
    }
  },

  /**
   * Fetch published blog posts.
   */
  async getBlogs(): Promise<BlogRecord[]> {
    try {
      const data = await fetchPublicJson<BlogRecord[]>('/api/blogs');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('publicApi.getBlogs warning:', err);
      return [];
    }
  },

  /**
   * Fetch a single published blog by slug.
   */
  async getBlogBySlug(slug: string): Promise<BlogRecord | null> {
    try {
      const data = await fetchPublicJson<BlogRecord>(`/api/blogs/${encodeURIComponent(slug)}`);
      return data || null;
    } catch (err) {
      console.warn(`publicApi.getBlogBySlug("${slug}") warning:`, err);
      return null;
    }
  },

  /**
   * Fetch career history and work experience.
   */
  async getExperience(): Promise<ExperienceRecord[]> {
    try {
      const data = await fetchPublicJson<ExperienceRecord[]>('/api/experience');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('publicApi.getExperience warning:', err);
      return [];
    }
  },

  /**
   * Fetch client recommendations and testimonials.
   */
  async getTestimonials(): Promise<TestimonialRecord[]> {
    try {
      const data = await fetchPublicJson<TestimonialRecord[]>('/api/testimonials');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('publicApi.getTestimonials warning:', err);
      return [];
    }
  },

  /**
   * Fetch service offerings and consulting capabilities.
   */
  async getServices(): Promise<ServiceRecord[]> {
    try {
      const data = await fetchPublicJson<ServiceRecord[]>('/api/services');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('publicApi.getServices warning:', err);
      return [];
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
