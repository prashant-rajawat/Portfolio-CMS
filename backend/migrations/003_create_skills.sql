-- Migration: 003_create_skills
-- Description: Create skills table for technical and soft skills categorization

CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(100) NOT NULL,
  proficiency INTEGER CHECK (proficiency IS NULL OR (proficiency >= 0 AND proficiency <= 100)),
  icon_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_category ON skills(category);
CREATE INDEX IF NOT EXISTS idx_skills_display_order ON skills(display_order);

DROP TRIGGER IF EXISTS trigger_skills_updated_at ON skills;
CREATE TRIGGER trigger_skills_updated_at
  BEFORE UPDATE ON skills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
