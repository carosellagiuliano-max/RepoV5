import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { bookingHelpers, Appointment } from '@/lib/supabase'

export const useAppointments = () => {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAppointments = async () => {
    if (!user) {
      setAppointments([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const { data, error: fetchError } = await bookingHelpers.getUserAppointments(user.id)
      
      if (fetchError) {
        setError(fetchError.message)
        return
      }

      setAppointments(data || [])
    } catch (err) {
      setError('Failed to fetch appointments')
      console.error('Error fetching appointments:', err)
    } finally {
      setLoading(false)
    }
  }

  const cancelAppointment = async (appointmentId: string) => {
    if (!user) return { error: 'User not authenticated' }

    try {
      const { data, error } = await bookingHelpers.cancelAppointment(appointmentId, user.id)
      
      if (error) {
        return { error: error.message }
      }

      // Update local state
      setAppointments(prev => 
        prev.map(apt => 
          apt.id === appointmentId 
            ? { ...apt, status: 'cancelled' }
            : apt
        )
      )

      return { data }
    } catch (err) {
      return { error: 'Failed to cancel appointment' }
    }
  }

  const refreshAppointments = () => {
    fetchAppointments()
  }

  useEffect(() => {
    fetchAppointments()
  }, [user]) // Only depend on user, not fetchAppointments to avoid infinite loops

  return {
    appointments,
    loading,
    error,
    cancelAppointment,
    refreshAppointments
  }
}