-- Migration: 010_create_media
-- Description: Create media table for uploaded portfolio images and documents

CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  storage_path TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_uploaded_by ON media(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at DESC);

DROP TRIGGER IF EXISTS trigger_media_updated_at ON media;
CREATE TRIGGER trigger_media_updated_at
  BEFORE UPDATE ON media
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
