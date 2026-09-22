-- Migration: 004_create_projects
-- Description: Create projects table for portfolio showcase

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

CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_display_order ON projects(display_order);

DROP TRIGGER IF EXISTS trigger_projects_updated_at ON projects;
CREATE TRIGGER trigger_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
