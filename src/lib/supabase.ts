import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl) {
  throw new Error('Missing environment variable: VITE_SUPABASE_URL')
}

if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types for the new schema
export type UserRole = 'admin' | 'customer' | 'staff'
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'
export type StaffStatus = 'active' | 'inactive'

export interface Profile {
  id: string
  email: string
  full_name?: string
  phone?: string
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  profile_id?: string
  customer_number?: string
  date_of_birth?: string
  address_street?: string
  address_city?: string
  address_postal_code?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  notes?: string
  created_at: string
  updated_at: string
  // Relations
  profiles?: Profile
}

export interface Staff {
  id: string
  profile_id?: string
  staff_number: string
  full_name: string
  email?: string
  phone?: string
  status: StaffStatus
  specialties?: string[]
  bio?: string
  hire_date?: string
  hourly_rate?: number
  avatar_url?: string
  created_at: string
  updated_at: string
  // Relations
  profiles?: Profile
  services?: ServiceWithCustomPrice[]
}

export interface Service {
  id: string
  name: string
  description?: string
  category: string
  duration_minutes: number
  base_price: number
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ServiceWithCustomPrice extends Service {
  custom_price?: number
  estimated_duration_minutes?: number
}

export interface StaffService {
  id: string
  staff_id: string
  service_id: string
  custom_price?: number
  estimated_duration_minutes?: number
  is_active: boolean
  created_at: string
  // Relations
  staff?: Staff
  services?: Service
}

export interface Appointment {
  id: string
  customer_id: string
  staff_id: string
  service_id: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  price: number
  notes?: string
  internal_notes?: string
  created_at: string
  updated_at: string
  // Relations
  customers?: Customer
  staff?: Staff
  services?: Service
}

export interface StaffAvailability {
  id: string
  staff_id: string
  day_of_week: number // 0 = Sunday, 6 = Saturday
  start_time: string // HH:MM format
  end_time: string // HH:MM format
  availability_type: 'available' | 'unavailable'
  created_at: string
  updated_at: string
}

export interface StaffTimeoff {
  id: string
  staff_id: string
  start_date: string
  end_date: string
  start_time?: string
  end_time?: string
  reason?: string
  type: string
  created_at: string
  updated_at: string
}

export interface MediaAsset {
  id: string
  filename: string
  original_filename: string
  file_path: string
  file_size?: number
  mime_type?: string
  width?: number
  height?: number
  category?: string
  tags?: string[]
  alt_text?: string
  caption?: string
  uploaded_by?: string
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface Setting {
  id: string
  key: string
  value: unknown
  description?: string
  category: string
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface AvailableSlot {
  start_time: string
  end_time: string
  duration_minutes: number
}

export interface StaffWithAvailability extends Staff {
  available_slots: AvailableSlot[]
}

// Legacy appointment interface for backwards compatibility
export interface LegacyAppointment {
  id: string
  user_id: string
  starts_at: string
  ends_at: string
  service_type: string
  service_name: string
  hairdresser_name: string
  price: number
  status: 'pending' | 'confirmed' | 'cancelled'
  notes?: string
  created_at: string
  updated_at: string
}

// Auth helper functions
export const authHelpers = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession()
    return { session, error }
  },

  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  }
}

// Booking helper functions (updated for new schema)
export const bookingHelpers = {
  async createAppointment(appointmentData: {
    customer_id: string
    staff_id: string
    service_id: string
    starts_at: string
    ends_at: string
    price: number
    notes?: string
  }) {
    const { data: session } = await supabase.auth.getSession()
    if (!session.session?.access_token) {
      throw new Error('Not authenticated')
    }

    const response = await fetch('/.netlify/functions/booking-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`
      },
      body: JSON.stringify(appointmentData)
    })

    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create appointment')
    }

    return result
  },

  async cancelAppointment(appointmentId: string, reason?: string) {
    const { data: session } = await supabase.auth.getSession()
    if (!session.session?.access_token) {
      throw new Error('Not authenticated')
    }

    const response = await fetch('/.netlify/functions/booking-cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`
      },
      body: JSON.stringify({ appointment_id: appointmentId, reason })
    })

    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Failed to cancel appointment')
    }

    return result
  },

  async getUserAppointments(userId: string) {
    // Get customer ID from user ID
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('profile_id', userId)
      .single()

    if (customerError || !customer) {
      return { data: [], error: customerError }
    }

    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        staff (
          id,
          full_name,
          email,
          phone
        ),
        services (
          id,
          name,
          description,
          category,
          duration_minutes
        )
      `)
      .eq('customer_id', customer.id)
      .order('starts_at', { ascending: true })
    
    return { data, error }
  },

  async getAllAppointments() {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        customers (
          id,
          profiles (full_name, email, phone)
        ),
        staff (
          id,
          full_name,
          email,
          phone
        ),
        services (
          id,
          name,
          description,
          category,
          duration_minutes
        )
      `)
      .order('starts_at', { ascending: true })
    
    return { data, error }
  }
}