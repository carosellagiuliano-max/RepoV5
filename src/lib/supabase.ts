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

// Database types for the new consolidated schema
export type UserRole = 'admin' | 'customer' | 'staff'
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export interface Profile {
  id: string
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  avatar_url?: string
  is_active: boolean
  role: UserRole
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  profile_id?: string
  created_at: string
  updated_at: string
  // Relations
  profiles?: Profile
}

export interface Staff {
  id: string
  profile_id?: string
  specialties?: string[]
  bio?: string
  hire_date?: string
  hourly_rate?: number
  commission_rate?: number
  is_active: boolean
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
  price_cents: number  // ✅ FIXED: Changed from base_price
  requires_consultation: boolean
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
  start_time: string  // ✅ FIXED: Changed from starts_at
  end_time: string    // ✅ FIXED: Changed from ends_at
  status: AppointmentStatus
  notes?: string
  cancellation_reason?: string
  cancelled_at?: string
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
  day_of_week: number
  start_time: string
  end_time: string
  is_available: boolean
  created_at: string
  updated_at: string
}

export interface StaffTimeOff {
  id: string
  staff_id: string
  start_date: string
  end_date: string
  start_time?: string
  end_time?: string
  reason?: string
  type: string
  is_approved: boolean
  approved_by?: string
  approved_at?: string
  created_at: string
  updated_at: string
}

export interface MediaFile {
  id: string
  filename: string
  original_name: string
  file_path: string
  file_size: number
  mime_type: string
  category?: string
  tags?: string[]
  uploaded_by?: string
  is_public: boolean
  title?: string
  description?: string
  storage_bucket?: string
  width?: number
  height?: number
  blur_hash?: string
  created_at: string
  updated_at: string
}

export interface BusinessSetting {
  id: string
  key: string
  value: string
  description?: string
  created_at: string
  updated_at: string
}

// Helper functions for data transformation
export const transformServicePrice = (priceCents: number): number => {
  return priceCents / 100; // Convert cents to euros for display
};

export const transformAppointmentTime = (appointment: any): any => {
  return {
    ...appointment,
    starts_at: appointment.start_time, // For backward compatibility
    ends_at: appointment.end_time,
    price: appointment.price_cents ? transformServicePrice(appointment.price_cents) : undefined
  };
};

// API helper functions
export const getServices = async () => {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data;
};

export const getStaff = async () => {
  const { data, error } = await supabase
    .from('staff')
    .select(`
      *,
      profiles (
        id,
        first_name,
        last_name,
        email,
        phone,
        avatar_url
      )
    `)
    .eq('is_active', true);

  if (error) throw error;
  return data;
};

export const getAppointments = async (userId?: string) => {
  let query = supabase
    .from('appointments')
    .select(`
      *,
      customers (
        id,
        profiles (
          first_name,
          last_name,
          email
        )
      ),
      staff (
        id,
        profiles (
          first_name,
          last_name
        )
      ),
      services (
        name,
        duration_minutes,
        price_cents
      )
    `)
    .order('start_time', { ascending: true });

  if (userId) {
    // Filter by user role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profile?.role === 'customer') {
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', userId)
        .single();

      if (customer) {
        query = query.eq('customer_id', customer.id);
      }
    } else if (profile?.role === 'staff') {
      const { data: staffMember } = await supabase
        .from('staff')
        .select('id')
        .eq('profile_id', userId)
        .single();

      if (staffMember) {
        query = query.eq('staff_id', staffMember.id);
      }
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  // Transform data for backward compatibility
  return data?.map(transformAppointmentTime);
};

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
    start_time: string  // ✅ FIXED: Changed from starts_at
    end_time: string    // ✅ FIXED: Changed from ends_at
    price_cents: number // ✅ FIXED: Changed from price
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
          profiles (first_name, last_name, email, phone)
        ),
        services (
          id,
          name,
          description,
          category,
          duration_minutes,
          price_cents
        )
      `)
      .eq('customer_id', customer.id)
      .order('start_time', { ascending: true })  // ✅ FIXED: Changed from starts_at

    return { data, error }
  },

  async getAllAppointments() {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        customers (
          id,
          profiles (first_name, last_name, email, phone)
        ),
        staff (
          id,
          profiles (first_name, last_name, email, phone)
        ),
        services (
          id,
          name,
          description,
          category,
          duration_minutes,
          price_cents
        )
      `)
      .order('start_time', { ascending: true })  // ✅ FIXED: Changed from starts_at

    return { data, error }
  }
}