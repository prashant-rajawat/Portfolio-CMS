-- Migration: 007_create_testimonials
-- Description: Create testimonials table for client and peer reviews

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

CREATE INDEX IF NOT EXISTS idx_testimonials_display_order ON testimonials(display_order);

DROP TRIGGER IF EXISTS trigger_testimonials_updated_at ON testimonials;
CREATE TRIGGER trigger_testimonials_updated_at
  BEFORE UPDATE ON testimonials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
