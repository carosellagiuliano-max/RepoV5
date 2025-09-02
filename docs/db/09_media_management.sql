-- Media Management Schema
-- Manages uploaded media files with Supabase Storage integration

-- Media table to track uploaded files
CREATE TABLE media (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL, -- Path in Supabase Storage
  file_size BIGINT NOT NULL, -- Size in bytes
  mime_type TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'salon-media',
  
  -- Metadata
  title TEXT,
  description TEXT,
  tags TEXT[], -- Array of tags for categorization
  category TEXT, -- Optional category (e.g., 'before_after', 'team', 'salon', 'products')
  
  -- Upload info
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false, -- Whether file can be accessed publicly
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_media_category ON media(category) WHERE category IS NOT NULL;
CREATE INDEX idx_media_tags ON media USING GIN(tags) WHERE tags IS NOT NULL;
CREATE INDEX idx_media_uploaded_by ON media(uploaded_by);
CREATE INDEX idx_media_uploaded_at ON media(uploaded_at);
CREATE INDEX idx_media_active ON media(is_active) WHERE is_active = true;
CREATE INDEX idx_media_mime_type ON media(mime_type);

-- Create updated_at trigger
CREATE TRIGGER update_media_updated_at
  BEFORE UPDATE ON media
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create Supabase Storage bucket if not exists (to be run in Supabase dashboard)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('salon-media', 'salon-media', false);

-- Comments for documentation
COMMENT ON TABLE media IS 'Tracks all uploaded media files with metadata and storage information';
COMMENT ON COLUMN media.file_path IS 'Full path to the file in Supabase Storage bucket';
COMMENT ON COLUMN media.is_public IS 'Whether the file can be accessed without authentication';
COMMENT ON COLUMN media.category IS 'Optional categorization for organizing media';
COMMENT ON COLUMN media.tags IS 'Array of tags for flexible categorization and search';