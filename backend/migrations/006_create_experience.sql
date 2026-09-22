-- Migration: 006_create_experience
-- Description: Create experience table for career timeline and employment history

CREATE TABLE IF NOT EXISTS experience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company VARCHAR(255) NOT NULL,
  position VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_experience_display_order ON experience(display_order);

DROP TRIGGER IF EXISTS trigger_experience_updated_at ON experience;
CREATE TRIGGER trigger_experience_updated_at
  BEFORE UPDATE ON experience
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
