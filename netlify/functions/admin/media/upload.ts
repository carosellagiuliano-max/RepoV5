/**
 * Admin Media Upload API
 * Handles file uploads to Supabase Storage with signed URLs
 */

import { Handler, HandlerEvent } from '@netlify/functions'
import { withAuthAndRateLimit, createSuccessResponse, createErrorResponse, createLogger, generateCorrelationId, createAdminClient, AuthenticatedContext } from '../../../src/lib/auth/netlify-auth'
import { validateBody, schemas } from '../../../src/lib/validation/schemas'
import { randomUUID } from 'crypto'

type SupabaseClient = ReturnType<typeof createAdminClient>
type Logger = ReturnType<typeof createLogger>

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime'
]

const MAX_FILE_SIZE = parseInt(process.env.VITE_MAX_FILE_SIZE_MB || '10') * 1024 * 1024 // 10MB default

export const handler: Handler = withAuthAndRateLimit(
  async (event, context) => {
    const correlationId = generateCorrelationId()
    const logger = createLogger(correlationId)
    const supabase = createAdminClient()

    logger.info('Admin media upload request', {
      method: event.httpMethod,
      path: event.path,
      userId: context.user.id
    })

    try {
      switch (event.httpMethod) {
        case 'POST':
          return await handleUploadRequest(event, supabase, logger, context.user.id)

        case 'GET':
          return await handleGetUploadUrl(event, supabase, logger)

        default:
          return createErrorResponse({
            statusCode: 405,
            message: 'Method not allowed',
            code: 'METHOD_NOT_ALLOWED'
          })
      }
    } catch (error) {
      logger.error('Media upload operation failed', { error })
      return createErrorResponse({
        statusCode: 500,
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      })
    }
  },
  { requireAdmin: true },
  { maxRequests: 20, windowMs: 60 * 1000 }
)

async function handleGetUploadUrl(event: HandlerEvent, supabase: SupabaseClient, logger: Logger) {
  const query = event.queryStringParameters || {}
  
  if (!query.filename || !query.mimeType) {
    return createErrorResponse({
      statusCode: 400,
      message: 'filename and mimeType are required',
      code: 'MISSING_PARAMETERS'
    })
  }

  const filename = query.filename as string
  const mimeType = query.mimeType as string

  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return createErrorResponse({
      statusCode: 400,
      message: `File type ${mimeType} is not allowed`,
      code: 'INVALID_FILE_TYPE'
    })
  }

  // Generate unique filename
  const fileExtension = filename.split('.').pop()
  const uniqueFilename = `${randomUUID()}.${fileExtension}`
  const filePath = `uploads/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${uniqueFilename}`

  // Create signed upload URL
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('salon-media')
    .createSignedUploadUrl(filePath)

  if (uploadError) {
    logger.error('Failed to create signed upload URL', { error: uploadError })
    throw new Error('Failed to create upload URL')
  }

  logger.info('Signed upload URL created', { filePath })

  return createSuccessResponse({
    uploadUrl: uploadData.signedUrl,
    filePath: filePath,
    uniqueFilename: uniqueFilename
  })
}

async function handleUploadRequest(event: HandlerEvent, supabase: SupabaseClient, logger: Logger, adminUserId: string) {
  const body = JSON.parse(event.body || '{}')
  
  // Validate the request body
  const uploadData = validateBody(schemas.media.upload, {
    title: body.title,
    description: body.description,
    category: body.category,
    tags: body.tags,
    is_public: body.is_public || false
  })

  // Required fields for upload completion
  if (!body.filePath || !body.originalFilename || !body.fileSize || !body.mimeType) {
    return createErrorResponse({
      statusCode: 400,
      message: 'filePath, originalFilename, fileSize, and mimeType are required',
      code: 'MISSING_UPLOAD_DATA'
    })
  }

  const filePath = body.filePath as string
  const originalFilename = body.originalFilename as string
  const fileSize = parseInt(body.fileSize)
  const mimeType = body.mimeType as string

  // Validate file size
  if (fileSize > MAX_FILE_SIZE) {
    return createErrorResponse({
      statusCode: 400,
      message: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      code: 'FILE_TOO_LARGE'
    })
  }

  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return createErrorResponse({
      statusCode: 400,
      message: `File type ${mimeType} is not allowed`,
      code: 'INVALID_FILE_TYPE'
    })
  }

  // Verify file exists in storage
  const { data: fileData, error: fileError } = await supabase.storage
    .from('salon-media')
    .list(filePath.split('/').slice(0, -1).join('/'), {
      search: filePath.split('/').pop()
    })

  if (fileError || !fileData || fileData.length === 0) {
    return createErrorResponse({
      statusCode: 400,
      message: 'File not found in storage. Please upload the file first.',
      code: 'FILE_NOT_FOUND'
    })
  }

  // Extract filename from path
  const filename = filePath.split('/').pop() || originalFilename

  // Create media record
  const { data: media, error: insertError } = await supabase
    .from('media')
    .insert({
      filename: filename,
      original_filename: originalFilename,
      file_path: filePath,
      file_size: fileSize,
      mime_type: mimeType,
      storage_bucket: 'salon-media',
      title: uploadData.title,
      description: uploadData.description,
      category: uploadData.category,
      tags: uploadData.tags,
      is_public: uploadData.is_public,
      uploaded_by: adminUserId,
      uploaded_at: new Date().toISOString()
    })
    .select()
    .single()

  if (insertError) {
    logger.error('Failed to create media record', { error: insertError })
    throw new Error('Failed to create media record')
  }

  // Generate signed URL for immediate access
  const { data: signedUrlData } = await supabase.storage
    .from('salon-media')
    .createSignedUrl(filePath, 60 * 60) // 1 hour expiry

  const result = {
    ...media,
    signedUrl: signedUrlData?.signedUrl
  }

  logger.info('Media upload completed successfully', { mediaId: media.id })

  return createSuccessResponse(result, 201)
}