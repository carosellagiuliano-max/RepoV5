/**
 * Admin Media Signed URL API
 * Generates signed URLs for accessing media files in Supabase Storage
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../../src/lib/auth/netlify-auth'
import { Media } from '../../../src/lib/types/database'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Admin media signed URL request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      switch (event.httpMethod) {
        case 'GET':
          return await handleGetSignedUrl(event, supabase, logger)

        case 'POST':
          return await handleBatchSignedUrls(event, supabase, logger)

        default:
          return createErrorResponse({
            statusCode: 405,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          })
      }
    } catch (error) {
      logger.error('Signed URL operation failed', { error })
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

async function handleGetSignedUrl(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const mediaId = event.path.split('/').pop()
  const query = event.queryStringParameters || {}
  
  if (!mediaId) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Media ID is required',
      code: 'MEDIA_ID_REQUIRED'
    })
  }

  // Get media record
  const { data: media, error: fetchError } = await supabase
    .from('media')
    .select('*')
    .eq('id', mediaId)
    .eq('is_active', true)
    .single()

  if (fetchError || !media) {
    return createErrorResponse({
      statusCode: 404,
      message: 'Media not found',
      code: 'MEDIA_NOT_FOUND'
    })
  }

  // Parse expiry time (default 1 hour)
  const expiresIn = parseInt(query.expiresIn as string) || 3600 // 1 hour in seconds

  // Generate signed URL
  const { data: signedUrlData, error: urlError } = await supabase.storage
    .from(media.storage_bucket)
    .createSignedUrl(media.file_path, expiresIn)

  if (urlError || !signedUrlData) {
    logger.error('Failed to create signed URL', { error: urlError })
    throw new Error('Failed to create signed URL')
  }

  logger.info('Signed URL created', { mediaId, expiresIn })

  return createSuccessResponse({
    media: media,
    signedUrl: signedUrlData.signedUrl,
    expiresAt: new Date(Date.now() + (expiresIn * 1000)).toISOString()
  })
}

async function handleBatchSignedUrls(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const body = JSON.parse(event.body || '{}')
  
  if (!body.mediaIds || !Array.isArray(body.mediaIds)) {
    return createErrorResponse({
      statusCode: 400,
      message: 'mediaIds array is required',
      code: 'MEDIA_IDS_REQUIRED'
    })
  }

  const mediaIds = body.mediaIds as string[]
  const expiresIn = parseInt(body.expiresIn) || 3600 // 1 hour in seconds

  if (mediaIds.length > 50) {
    return createErrorResponse({
      statusCode: 400,
      message: 'Maximum 50 media IDs allowed per request',
      code: 'TOO_MANY_MEDIA_IDS'
    })
  }

  // Get media records
  const { data: mediaRecords, error: fetchError } = await supabase
    .from('media')
    .select('*')
    .in('id', mediaIds)
    .eq('is_active', true)

  if (fetchError) {
    logger.error('Failed to fetch media records', { error: fetchError })
    throw new Error('Failed to fetch media records')
  }

  // Generate signed URLs for each media
  const results = await Promise.allSettled(
    (mediaRecords || []).map(async (media) => {
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from(media.storage_bucket)
        .createSignedUrl(media.file_path, expiresIn)

      if (urlError || !signedUrlData) {
        throw new Error(`Failed to create signed URL for media ${media.id}`)
      }

      return {
        media: media,
        signedUrl: signedUrlData.signedUrl,
        expiresAt: new Date(Date.now() + (expiresIn * 1000)).toISOString()
      }
    })
  )

  const successful = results
    .filter((result): result is PromiseFulfilledResult<{
      media: Media
      signedUrl: string
      expiresAt: string
    }> => result.status === 'fulfilled')
    .map(result => result.value)

  const failed = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result, index) => ({
      mediaId: mediaIds[index],
      error: result.reason?.message || 'Unknown error'
    }))

  logger.info('Batch signed URLs created', { 
    successful: successful.length, 
    failed: failed.length 
  })

  return createSuccessResponse({
    results: successful,
    failed: failed,
    expiresIn: expiresIn
  })
}