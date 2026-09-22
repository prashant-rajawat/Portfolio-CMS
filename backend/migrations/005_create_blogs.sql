-- Migration: 005_create_blogs
-- Description: Create blogs table with author relationship

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

CREATE INDEX IF NOT EXISTS idx_blogs_slug ON blogs(slug);
CREATE INDEX IF NOT EXISTS idx_blogs_published ON blogs(published);
CREATE INDEX IF NOT EXISTS idx_blogs_author_id ON blogs(author_id);
CREATE INDEX IF NOT EXISTS idx_blogs_created_at ON blogs(created_at DESC);

DROP TRIGGER IF EXISTS trigger_blogs_updated_at ON blogs;
CREATE TRIGGER trigger_blogs_updated_at
  BEFORE UPDATE ON blogs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
