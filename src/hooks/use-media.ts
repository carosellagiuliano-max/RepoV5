/**
 * Media Management Hooks
 * React hooks for managing media files with Supabase Storage
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Media, MediaInsert, MediaUpdate, MediaFilters, APIResponse } from '@/lib/types/database'
import { toast } from 'sonner'

const API_BASE = '/.netlify/functions/admin/media'

// Types for upload operations
interface UploadUrlResponse {
  uploadUrl: string
  filePath: string
  uniqueFilename: string
}

interface UploadCompleteData {
  filePath: string
  originalFilename: string
  fileSize: number
  mimeType: string
  title?: string
  description?: string
  category?: string
  tags?: string[]
  is_public?: boolean
}

interface SignedUrlResponse {
  media: Media
  signedUrl: string
  expiresAt: string
}

// API functions
const mediaAPI = {
  // Get media list with filters and pagination
  getMedia: async (filters: MediaFilters = {}): Promise<APIResponse<{ 
    media: Media[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }>> => {
    const params = new URLSearchParams()
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          params.append(key, JSON.stringify(value))
        } else {
          params.append(key, String(value))
        }
      }
    })

    const response = await fetch(`${API_BASE}?${params}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch media: ${response.statusText}`)
    }
    return response.json()
  },

  // Create media record
  createMedia: async (data: MediaInsert): Promise<APIResponse<Media>> => {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      throw new Error(`Failed to create media: ${response.statusText}`)
    }
    return response.json()
  },

  // Update media record
  updateMedia: async (id: string, data: MediaUpdate): Promise<APIResponse<Media>> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      throw new Error(`Failed to update media: ${response.statusText}`)
    }
    return response.json()
  },

  // Delete media
  deleteMedia: async (id: string): Promise<APIResponse<{ message: string }>> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE'
    })
    if (!response.ok) {
      throw new Error(`Failed to delete media: ${response.statusText}`)
    }
    return response.json()
  },

  // Get upload URL
  getUploadUrl: async (filename: string, mimeType: string): Promise<APIResponse<UploadUrlResponse>> => {
    const params = new URLSearchParams({ filename, mimeType })
    const response = await fetch(`${API_BASE}/upload?${params}`)
    if (!response.ok) {
      throw new Error(`Failed to get upload URL: ${response.statusText}`)
    }
    return response.json()
  },

  // Complete upload
  completeUpload: async (data: UploadCompleteData): Promise<APIResponse<Media>> => {
    const response = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) {
      throw new Error(`Failed to complete upload: ${response.statusText}`)
    }
    return response.json()
  },

  // Get signed URL for media
  getSignedUrl: async (id: string, expiresIn?: number): Promise<APIResponse<SignedUrlResponse>> => {
    const params = expiresIn ? `?expiresIn=${expiresIn}` : ''
    const response = await fetch(`${API_BASE}/signed-url/${id}${params}`)
    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`)
    }
    return response.json()
  },

  // Get batch signed URLs
  getBatchSignedUrls: async (mediaIds: string[], expiresIn?: number): Promise<APIResponse<{
    results: SignedUrlResponse[]
    failed: Array<{ mediaId: string; error: string }>
    expiresIn: number
  }>> => {
    const response = await fetch(`${API_BASE}/signed-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaIds, expiresIn })
    })
    if (!response.ok) {
      throw new Error(`Failed to get batch signed URLs: ${response.statusText}`)
    }
    return response.json()
  }
}

// Hook for getting media list
export const useMedia = (filters: MediaFilters = {}) => {
  return useQuery({
    queryKey: ['media', filters],
    queryFn: () => mediaAPI.getMedia(filters),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Hook for media mutations
export const useMediaMutations = () => {
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: mediaAPI.createMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      toast.success('Media created successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to create media: ${error.message}`)
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MediaUpdate }) => 
      mediaAPI.updateMedia(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      toast.success('Media updated successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to update media: ${error.message}`)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: mediaAPI.deleteMedia,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      toast.success('Media deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete media: ${error.message}`)
    }
  })

  return {
    createMedia: createMutation.mutate,
    updateMedia: updateMutation.mutate,
    deleteMedia: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending
  }
}

// Hook for file upload operations
export const useMediaUpload = () => {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
  const queryClient = useQueryClient()

  const uploadFile = useCallback(async (
    file: File,
    metadata: {
      title?: string
      description?: string
      category?: string
      tags?: string[]
      is_public?: boolean
    } = {}
  ): Promise<Media> => {
    const fileId = `${Date.now()}-${file.name}`
    
    try {
      setUploadProgress(prev => ({ ...prev, [fileId]: 0 }))

      // Step 1: Get signed upload URL
      const uploadUrlResponse = await mediaAPI.getUploadUrl(file.name, file.type)
      if (!uploadUrlResponse.success || !uploadUrlResponse.data) {
        throw new Error('Failed to get upload URL')
      }

      const { uploadUrl, filePath, uniqueFilename } = uploadUrlResponse.data

      // Step 2: Upload file to storage
      setUploadProgress(prev => ({ ...prev, [fileId]: 25 }))
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to storage')
      }

      setUploadProgress(prev => ({ ...prev, [fileId]: 75 }))

      // Step 3: Complete upload and create media record
      const completeResponse = await mediaAPI.completeUpload({
        filePath,
        originalFilename: file.name,
        fileSize: file.size,
        mimeType: file.type,
        ...metadata
      })

      if (!completeResponse.success || !completeResponse.data) {
        throw new Error('Failed to complete upload')
      }

      setUploadProgress(prev => ({ ...prev, [fileId]: 100 }))
      
      // Invalidate media queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ['media'] })
      
      toast.success('File uploaded successfully')
      
      return completeResponse.data

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      toast.error(errorMessage)
      throw error
    } finally {
      // Clean up progress tracking after a delay
      setTimeout(() => {
        setUploadProgress(prev => {
          const { [fileId]: _, ...rest } = prev
          return rest
        })
      }, 2000)
    }
  }, [queryClient])

  return {
    uploadFile,
    uploadProgress
  }
}

// Hook for signed URL operations
export const useSignedUrls = () => {
  const getSignedUrl = useCallback(async (mediaId: string, expiresIn?: number) => {
    const response = await mediaAPI.getSignedUrl(mediaId, expiresIn)
    if (!response.success || !response.data) {
      throw new Error('Failed to get signed URL')
    }
    return response.data
  }, [])

  const getBatchSignedUrls = useCallback(async (mediaIds: string[], expiresIn?: number) => {
    const response = await mediaAPI.getBatchSignedUrls(mediaIds, expiresIn)
    if (!response.success || !response.data) {
      throw new Error('Failed to get batch signed URLs')
    }
    return response.data
  }, [])

  return {
    getSignedUrl,
    getBatchSignedUrls
  }
}