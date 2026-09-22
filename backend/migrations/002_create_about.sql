-- Migration: 002_create_about
-- Description: Create about table for portfolio owner profile, bio, and resume

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

DROP TRIGGER IF EXISTS trigger_about_updated_at ON about;
CREATE TRIGGER trigger_about_updated_at
  BEFORE UPDATE ON about
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
