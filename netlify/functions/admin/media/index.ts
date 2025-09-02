/**
 * Admin Media Management API
 * Handles CRUD operations for media files with Supabase Storage
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../../src/lib/auth/netlify-auth'
import { validateBody, validateQuery, schemas } from '../../../src/lib/validation/schemas'
import { Media, MediaInsert, MediaUpdate } from '../../../src/lib/types/database'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Admin media management request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      switch (event.httpMethod) {
        case 'GET':
          return await handleGetMedia(event, supabase, logger)

        case 'POST':
          return await handleCreateMedia(event, supabase, logger, context.user.id)

        case 'PUT':
        case 'PATCH':
          return await handleUpdateMedia(event, supabase, logger)

        case 'DELETE':
          return await handleDeleteMedia(event, supabase, logger)

        default:
          return createErrorResponse({
            statusCode: 405,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          })
      }
    } catch (error) {
      logger.error('Media management operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireAdmin: true },
  { maxRequests: 100, windowMs: 60 * 1000 }
)

async function handleGetMedia(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const query = validateQuery(schemas.mediaFilters, event.queryStringParameters || {})
  
  let dbQuery = supabase
    .from('media')
    .select('*')

  // Apply filters
  if (query.isActive !== undefined) {
    dbQuery = dbQuery.eq('is_active', query.isActive)
  }

  if (query.isPublic !== undefined) {
    dbQuery = dbQuery.eq('is_public', query.isPublic)
  }

  if (query.category) {
    dbQuery = dbQuery.eq('category', query.category)
  }

  if (query.mimeType) {
    dbQuery = dbQuery.eq('mime_type', query.mimeType)
  }

  if (query.tags && query.tags.length > 0) {
    dbQuery = dbQuery.overlaps('tags', query.tags)
  }

  if (query.search) {
    dbQuery = dbQuery.or(`title.ilike.%${query.search}%,filename.ilike.%${query.search}%,description.ilike.%${query.search}%`)
  }

  // Apply sorting
  const sortColumn = query.sortBy || 'created_at'
  const sortOrder = query.sortOrder || 'desc'
  dbQuery = dbQuery.order(sortColumn, { ascending: sortOrder === 'asc' })

  // Apply pagination
  const from = (query.page - 1) * query.limit
  const to = from + query.limit - 1
  dbQuery = dbQuery.range(from, to)

  const { data: media, error, count } = await dbQuery

  if (error) {
    logger.error('Failed to fetch media', { error })
    throw error
  }

  const totalPages = count ? Math.ceil(count / query.limit) : 0

  logger.info('Media fetched successfully', { count: media?.length })

  return createSuccessResponse({
    media: media || [],
    pagination: {
      page: query.page,
      limit: query.limit,
      total: count || 0,
      totalPages
    }
  })
}

async function handleCreateMedia(event: HandlerEvent, supabase: SupabaseClient, logger: Logger, adminUserId: string) {
  const body = JSON.parse(event.body || '{}')
  
  // Validate the request body
  const mediaData = validateBody(schemas.media.create, {
    filename: body.filename,
    original_filename: body.original_filename,
    file_path: body.file_path,
    file_size: body.file_size,
    mime_type: body.mime_type,
    storage_bucket: body.storage_bucket || 'salon-media',
    title: body.title,
    description: body.description,
    category: body.category,
    tags: body.tags,
    is_public: body.is_public || false
  })

  // Create media record
  const { data: media, error: insertError } = await supabase
    .from('media')
    .insert({
      ...mediaData,
      uploaded_by: adminUserId,
      uploaded_at: new Date().toISOString()
    })
    .select()
    .single()

  if (insertError) {
    logger.error('Failed to create media record', { error: insertError })
    throw new Error('Failed to create media record')
  }

  logger.info('Media record created successfully', { mediaId: media.id })

  return createSuccessResponse(media, 201)
}

async function handleUpdateMedia(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const mediaId = event.path.split('/').pop()
  if (!mediaId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Media ID is required',
      code: 'MEDIA_ID_REQUIRED'
    })
  }

  const body = JSON.parse(event.body || '{}')

  // Get existing media record
  const { data: existingMedia, error: fetchError } = await supabase
    .from('media')
    .select('*')
    .eq('id', mediaId)
    .single()

  if (fetchError || !existingMedia) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Media not found',
      code: 'MEDIA_NOT_FOUND'
    })
  }

  // Validate updates
  const mediaUpdates = validateBody(schemas.media.update, {
    title: body.title,
    description: body.description,
    category: body.category,
    tags: body.tags,
    is_public: body.is_public,
    is_active: body.is_active
  })

  // Update media record
  const { data: updatedMedia, error: updateError } = await supabase
    .from('media')
    .update(mediaUpdates)
    .eq('id', mediaId)
    .select()
    .single()

  if (updateError) {
    logger.error('Failed to update media', { error: updateError })
    throw new Error('Failed to update media')
  }

  logger.info('Media updated successfully', { mediaId })

  return createSuccessResponse(updatedMedia)
}

async function handleDeleteMedia(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const mediaId = event.path.split('/').pop()
  if (!mediaId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Media ID is required',
      code: 'MEDIA_ID_REQUIRED'
    })
  }

  // Get existing media record
  const { data: existingMedia, error: fetchError } = await supabase
    .from('media')
    .select('*')
    .eq('id', mediaId)
    .single()

  if (fetchError || !existingMedia) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Media not found',
      code: 'MEDIA_NOT_FOUND'
    })
  }

  // Delete from storage first
  const { error: storageError } = await supabase.storage
    .from(existingMedia.storage_bucket)
    .remove([existingMedia.file_path])

  if (storageError) {
    logger.error('Failed to delete file from storage', { error: storageError, filePath: existingMedia.file_path })
    // Continue with database deletion even if storage deletion fails
  }

  // Delete media record
  const { error: deleteError } = await supabase
    .from('media')
    .delete()
    .eq('id', mediaId)

  if (deleteError) {
    logger.error('Failed to delete media record', { error: deleteError })
    throw new Error('Failed to delete media record')
  }

  logger.info('Media deleted successfully', { mediaId })

  return createSuccessResponse({ message: 'Media deleted successfully' })
}