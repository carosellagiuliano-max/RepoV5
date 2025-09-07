-- Media Management Schema
-- Extends the existing media_files table with additional features

-- Add missing columns to existing media_files table
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'salon-media';
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS height INTEGER;
ALTER TABLE media_files ADD COLUMN IF NOT EXISTS blur_hash TEXT;

-- Add new indexes for enhanced performance
CREATE INDEX IF NOT EXISTS idx_media_files_title ON media_files(title) WHERE title IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_files_description ON media_files(description) WHERE description IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_files_storage_bucket ON media_files(storage_bucket);
CREATE INDEX IF NOT EXISTS idx_media_files_dimensions ON media_files(width, height) WHERE width IS NOT NULL AND height IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_media_files_mime_type ON media_files(mime_type);

-- Create a view for media with enhanced metadata
CREATE OR REPLACE VIEW media_with_metadata AS
SELECT
  mf.*,
  -- Calculate file type from mime_type
  CASE
    WHEN mf.mime_type LIKE 'image/%' THEN 'image'
    WHEN mf.mime_type LIKE 'video/%' THEN 'video'
    WHEN mf.mime_type LIKE 'audio/%' THEN 'audio'
    ELSE 'document'
  END as file_type,
  -- Calculate file size in human readable format
  CASE
    WHEN mf.file_size < 1024 THEN mf.file_size::text || ' B'
    WHEN mf.file_size < 1024*1024 THEN (mf.file_size/1024)::text || ' KB'
    WHEN mf.file_size < 1024*1024*1024 THEN (mf.file_size/(1024*1024))::text || ' MB'
    ELSE (mf.file_size/(1024*1024*1024))::text || ' GB'
  END as file_size_human
FROM media_files mf;

-- Function to get media by category
CREATE OR REPLACE FUNCTION get_media_by_category(p_category TEXT)
RETURNS TABLE(
  id UUID,
  filename TEXT,
  file_path TEXT,
  mime_type TEXT,
  file_size BIGINT,
  category TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    mf.id,
    mf.filename,
    mf.file_path,
    mf.mime_type,
    mf.file_size,
    mf.category,
    mf.uploaded_by,
    mf.created_at
  FROM media_files mf
  WHERE mf.category = p_category
    AND mf.is_public = true
  ORDER BY mf.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get media statistics
CREATE OR REPLACE FUNCTION get_media_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_files', COUNT(*),
    'total_size', SUM(file_size),
    'by_category', json_object_agg(
      COALESCE(category, 'uncategorized'),
      COUNT(*)
    ),
    'by_type', json_object_agg(
      CASE
        WHEN mime_type LIKE 'image/%' THEN 'images'
        WHEN mime_type LIKE 'video/%' THEN 'videos'
        WHEN mime_type LIKE 'audio/%' THEN 'audio'
        ELSE 'documents'
      END,
      COUNT(*)
    )
  ) INTO result
  FROM media_files
  WHERE is_active = true;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON TABLE media_files IS 'Media files with enhanced metadata and Supabase Storage integration';
COMMENT ON COLUMN media_files.title IS 'Optional title for the media file';
COMMENT ON COLUMN media_files.description IS 'Optional description for the media file';
COMMENT ON COLUMN media_files.storage_bucket IS 'Supabase Storage bucket name';
COMMENT ON COLUMN media_files.width IS 'Image width in pixels (for images only)';
COMMENT ON COLUMN media_files.height IS 'Image height in pixels (for images only)';
COMMENT ON COLUMN media_files.blur_hash IS 'BlurHash for image preview optimization';
COMMENT ON TABLE media IS 'Tracks all uploaded media files with metadata and storage information';
COMMENT ON COLUMN media.file_path IS 'Full path to the file in Supabase Storage bucket';
COMMENT ON COLUMN media.is_public IS 'Whether the file can be accessed without authentication';
COMMENT ON COLUMN media.category IS 'Optional categorization for organizing media';
COMMENT ON COLUMN media.tags IS 'Array of tags for flexible categorization and search';