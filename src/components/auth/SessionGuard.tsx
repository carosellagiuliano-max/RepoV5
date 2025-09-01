import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'

interface SessionGuardProps {
  children: React.ReactNode
  requireAdmin?: boolean
  requireCustomer?: boolean
  requireStaff?: boolean
  redirectTo?: string
}

export const SessionGuard: React.FC<SessionGuardProps> = ({
  children,
  requireAdmin = false,
  requireCustomer = false,
  requireStaff = false,
  redirectTo = '/'
}) => {
  const { user, loading, isAdmin, isCustomer, isStaff, profile } = useAuth()

  // Show loading spinner while checking session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Redirect if not authenticated
  if (!user) {
    return <Navigate to={redirectTo} replace />
  }

  // Wait for profile to load
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Check admin requirement
  if (requireAdmin && !isAdmin) {
    return <Navigate to={redirectTo} replace />
  }

  // Check customer requirement
  if (requireCustomer && !isCustomer) {
    return <Navigate to={redirectTo} replace />
  }

  // Check staff requirement
  if (requireStaff && !isStaff) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}