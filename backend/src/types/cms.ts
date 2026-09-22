export interface AboutRecord {
  id: string;
  title: string;
  short_description: string;
  full_description: string;
  profile_image_url: string | null;
  resume_url: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface SkillRecord {
  id: string;
  name: string;
  category: string;
  proficiency: number | null;
  icon_url: string | null;
  display_order: number;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface ProjectRecord {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  full_description: string;
  image_url: string | null;
  technologies: string[];
  live_url: string | null;
  github_url: string | null;
  display_order: number;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface BlogRecord {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image_url: string | null;
  author_id: string | null;
  author_name?: string | null;
  published: boolean;
  published_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface ExperienceRecord {
  id: string;
  company: string;
  position: string;
  description: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  display_order: number;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface TestimonialRecord {
  id: string;
  name: string;
  role: string;
  company: string | null;
  content: string;
  profile_image_url: string | null;
  display_order: number;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface ServiceRecord {
  id: string;
  title: string;
  description: string;
  icon_url: string | null;
  display_order: number;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface MediaRecord {
  id: string;
  filename: string;
  original_filename: string;
  storage_path: string;
  storage_url: string;
  mime_type: string;
  file_size: number | string;
  uploaded_by: string | null;
  created_at: string | Date;
  updated_at: string | Date;
}
