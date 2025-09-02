-- Duplicate Detection & Import/Export Migration
-- This migration adds tables and functions for customer duplicate detection,
-- merging, and CSV import/export functionality with GDPR compliance

-- Customer duplicates tracking table
CREATE TABLE customer_duplicates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_a_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  customer_b_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('email', 'phone', 'name_fuzzy', 'manual')),
  confidence_score DECIMAL(3,2) CHECK (confidence_score BETWEEN 0.0 AND 1.0), -- 0.0 to 1.0
  match_details JSONB, -- Store details about what matched
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'merged', 'dismissed')),
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_a_id, customer_b_id),
  CONSTRAINT no_self_duplicate CHECK (customer_a_id != customer_b_id)
);

-- Customer merges audit table
CREATE TABLE customer_merges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  primary_customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  merged_customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  duplicate_id UUID REFERENCES customer_duplicates(id) ON DELETE SET NULL,
  merged_by UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  merge_strategy JSONB NOT NULL, -- Which fields were kept from which customer
  data_before JSONB NOT NULL, -- Complete state before merge
  data_after JSONB NOT NULL, -- Complete state after merge
  appointments_transferred INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer import logs table
CREATE TABLE customer_import_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL,
  processed_rows INTEGER DEFAULT 0,
  successful_imports INTEGER DEFAULT 0,
  failed_imports INTEGER DEFAULT 0,
  skipped_rows INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  import_mode TEXT DEFAULT 'create_only' CHECK (import_mode IN ('create_only', 'update_existing', 'create_and_update')),
  field_mapping JSONB, -- CSV column to database field mapping
  validation_errors JSONB, -- Array of validation errors
  duplicate_handling TEXT DEFAULT 'skip' CHECK (duplicate_handling IN ('skip', 'update', 'create_new')),
  dry_run BOOLEAN DEFAULT false,
  imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer import details table (for tracking individual row results)
CREATE TABLE customer_import_details (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  import_log_id UUID REFERENCES customer_import_logs(id) ON DELETE CASCADE NOT NULL,
  row_number INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped', 'duplicate')),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL, -- Created customer ID if successful
  input_data JSONB, -- Original CSV row data
  processed_data JSONB, -- Cleaned/processed data
  error_messages TEXT[],
  warnings TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_customer_duplicates_customer_a ON customer_duplicates(customer_a_id);
CREATE INDEX idx_customer_duplicates_customer_b ON customer_duplicates(customer_b_id);
CREATE INDEX idx_customer_duplicates_status ON customer_duplicates(status);
CREATE INDEX idx_customer_duplicates_match_type ON customer_duplicates(match_type);
CREATE INDEX idx_customer_duplicates_confidence ON customer_duplicates(confidence_score DESC);

CREATE INDEX idx_customer_merges_primary_customer ON customer_merges(primary_customer_id);
CREATE INDEX idx_customer_merges_merged_customer ON customer_merges(merged_customer_id);
CREATE INDEX idx_customer_merges_merged_by ON customer_merges(merged_by);
CREATE INDEX idx_customer_merges_created_at ON customer_merges(created_at);

CREATE INDEX idx_customer_import_logs_imported_by ON customer_import_logs(imported_by);
CREATE INDEX idx_customer_import_logs_status ON customer_import_logs(status);
CREATE INDEX idx_customer_import_logs_created_at ON customer_import_logs(created_at);

CREATE INDEX idx_customer_import_details_import_log ON customer_import_details(import_log_id);
CREATE INDEX idx_customer_import_details_status ON customer_import_details(status);
CREATE INDEX idx_customer_import_details_customer_id ON customer_import_details(customer_id);

-- Add updated_at triggers
CREATE TRIGGER update_customer_duplicates_updated_at 
  BEFORE UPDATE ON customer_duplicates 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_import_logs_updated_at 
  BEFORE UPDATE ON customer_import_logs 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to detect potential duplicates using fuzzy matching
CREATE OR REPLACE FUNCTION detect_customer_duplicates(
  customer_id_param UUID DEFAULT NULL, -- If provided, only check this customer
  confidence_threshold DECIMAL DEFAULT 0.7,
  limit_results INTEGER DEFAULT 100
)
RETURNS TABLE (
  customer_a_id UUID,
  customer_b_id UUID,
  match_type TEXT,
  confidence_score DECIMAL,
  match_details JSONB
) AS $$
BEGIN
  -- Clear existing pending duplicates if checking all customers
  IF customer_id_param IS NULL THEN
    DELETE FROM customer_duplicates WHERE status = 'pending';
  ELSE
    DELETE FROM customer_duplicates 
    WHERE status = 'pending' 
    AND (customer_a_id = customer_id_param OR customer_b_id = customer_id_param);
  END IF;

  -- Find exact email matches
  INSERT INTO customer_duplicates (customer_a_id, customer_b_id, match_type, confidence_score, match_details)
  SELECT DISTINCT
    LEAST(c1.id, c2.id) as customer_a_id,
    GREATEST(c1.id, c2.id) as customer_b_id,
    'email' as match_type,
    1.0 as confidence_score,
    jsonb_build_object(
      'matched_email', p1.email,
      'customer_a_name', p1.full_name,
      'customer_b_name', p2.full_name
    ) as match_details
  FROM customers c1
  JOIN profiles p1 ON c1.profile_id = p1.id
  JOIN customers c2 ON c1.id < c2.id
  JOIN profiles p2 ON c2.profile_id = p2.id
  WHERE c1.is_deleted = false 
    AND c2.is_deleted = false
    AND p1.email = p2.email
    AND p1.email IS NOT NULL
    AND p1.email != ''
    AND (customer_id_param IS NULL OR c1.id = customer_id_param OR c2.id = customer_id_param)
  ON CONFLICT (customer_a_id, customer_b_id) DO NOTHING;

  -- Find exact phone matches
  INSERT INTO customer_duplicates (customer_a_id, customer_b_id, match_type, confidence_score, match_details)
  SELECT DISTINCT
    LEAST(c1.id, c2.id) as customer_a_id,
    GREATEST(c1.id, c2.id) as customer_b_id,
    'phone' as match_type,
    0.95 as confidence_score,
    jsonb_build_object(
      'matched_phone', p1.phone,
      'customer_a_name', p1.full_name,
      'customer_b_name', p2.full_name,
      'customer_a_email', p1.email,
      'customer_b_email', p2.email
    ) as match_details
  FROM customers c1
  JOIN profiles p1 ON c1.profile_id = p1.id
  JOIN customers c2 ON c1.id < c2.id
  JOIN profiles p2 ON c2.profile_id = p2.id
  WHERE c1.is_deleted = false 
    AND c2.is_deleted = false
    AND p1.phone = p2.phone
    AND p1.phone IS NOT NULL
    AND p1.phone != ''
    AND (customer_id_param IS NULL OR c1.id = customer_id_param OR c2.id = customer_id_param)
    AND NOT EXISTS (
      SELECT 1 FROM customer_duplicates cd 
      WHERE cd.customer_a_id = LEAST(c1.id, c2.id) 
      AND cd.customer_b_id = GREATEST(c1.id, c2.id)
    )
  ON CONFLICT (customer_a_id, customer_b_id) DO NOTHING;

  -- Find fuzzy name matches (using basic similarity - in production would use pg_trgm or similar)
  INSERT INTO customer_duplicates (customer_a_id, customer_b_id, match_type, confidence_score, match_details)
  SELECT DISTINCT
    LEAST(c1.id, c2.id) as customer_a_id,
    GREATEST(c1.id, c2.id) as customer_b_id,
    'name_fuzzy' as match_type,
    -- Simple similarity calculation - normalize and compare
    CASE 
      WHEN levenshtein(
        lower(trim(p1.full_name)), 
        lower(trim(p2.full_name))
      ) <= 2 THEN 0.9
      WHEN levenshtein(
        lower(trim(p1.full_name)), 
        lower(trim(p2.full_name))
      ) <= 3 THEN 0.8
      ELSE 0.7
    END as confidence_score,
    jsonb_build_object(
      'customer_a_name', p1.full_name,
      'customer_b_name', p2.full_name,
      'customer_a_email', p1.email,
      'customer_b_email', p2.email,
      'customer_a_phone', p1.phone,
      'customer_b_phone', p2.phone,
      'levenshtein_distance', levenshtein(
        lower(trim(p1.full_name)), 
        lower(trim(p2.full_name))
      )
    ) as match_details
  FROM customers c1
  JOIN profiles p1 ON c1.profile_id = p1.id
  JOIN customers c2 ON c1.id < c2.id
  JOIN profiles p2 ON c2.profile_id = p2.id
  WHERE c1.is_deleted = false 
    AND c2.is_deleted = false
    AND p1.full_name IS NOT NULL 
    AND p2.full_name IS NOT NULL
    AND trim(p1.full_name) != ''
    AND trim(p2.full_name) != ''
    AND length(p1.full_name) > 3
    AND length(p2.full_name) > 3
    AND levenshtein(
      lower(trim(p1.full_name)), 
      lower(trim(p2.full_name))
    ) <= 3
    AND (customer_id_param IS NULL OR c1.id = customer_id_param OR c2.id = customer_id_param)
    AND NOT EXISTS (
      SELECT 1 FROM customer_duplicates cd 
      WHERE cd.customer_a_id = LEAST(c1.id, c2.id) 
      AND cd.customer_b_id = GREATEST(c1.id, c2.id)
    )
  ON CONFLICT (customer_a_id, customer_b_id) DO NOTHING;

  -- Return the detected duplicates above the confidence threshold
  RETURN QUERY
  SELECT 
    cd.customer_a_id,
    cd.customer_b_id,
    cd.match_type,
    cd.confidence_score,
    cd.match_details
  FROM customer_duplicates cd
  WHERE cd.status = 'pending'
    AND cd.confidence_score >= confidence_threshold
    AND (customer_id_param IS NULL 
         OR cd.customer_a_id = customer_id_param 
         OR cd.customer_b_id = customer_id_param)
  ORDER BY cd.confidence_score DESC, cd.created_at ASC
  LIMIT limit_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to merge two customers with full audit trail
CREATE OR REPLACE FUNCTION merge_customers(
  primary_customer_id UUID,
  merge_customer_id UUID,
  merge_strategy JSONB,
  merging_user_id UUID,
  notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  primary_customer customers%ROWTYPE;
  merge_customer customers%ROWTYPE;
  primary_profile profiles%ROWTYPE;
  merge_profile profiles%ROWTYPE;
  data_before JSONB;
  data_after JSONB;
  appointments_count INTEGER;
  result JSONB;
BEGIN
  -- Validate inputs
  IF primary_customer_id IS NULL OR merge_customer_id IS NULL OR merging_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'All customer IDs and merging user ID are required');
  END IF;

  IF primary_customer_id = merge_customer_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot merge customer with itself');
  END IF;

  -- Get customers and their profiles
  SELECT * INTO primary_customer FROM customers WHERE id = primary_customer_id AND is_deleted = false;
  SELECT * INTO merge_customer FROM customers WHERE id = merge_customer_id AND is_deleted = false;

  IF primary_customer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Primary customer not found or deleted');
  END IF;

  IF merge_customer.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Customer to merge not found or deleted');
  END IF;

  SELECT * INTO primary_profile FROM profiles WHERE id = primary_customer.profile_id;
  SELECT * INTO merge_profile FROM profiles WHERE id = merge_customer.profile_id;

  -- Store data before merge
  data_before := jsonb_build_object(
    'primary_customer', row_to_json(primary_customer),
    'primary_profile', row_to_json(primary_profile),
    'merge_customer', row_to_json(merge_customer),
    'merge_profile', row_to_json(merge_profile)
  );

  -- Set audit context
  PERFORM set_config('app.current_user_id', merging_user_id::text, true);

  -- Apply merge strategy to update primary customer
  -- Update profile fields based on strategy
  UPDATE profiles SET
    full_name = CASE 
      WHEN (merge_strategy->>'full_name') = 'merge' THEN merge_profile.full_name
      ELSE primary_profile.full_name
    END,
    phone = CASE 
      WHEN (merge_strategy->>'phone') = 'merge' THEN merge_profile.phone
      WHEN (merge_strategy->>'phone') = 'combine' AND merge_profile.phone IS NOT NULL 
        THEN COALESCE(primary_profile.phone, merge_profile.phone)
      ELSE primary_profile.phone
    END,
    updated_at = NOW()
  WHERE id = primary_customer.profile_id;

  -- Update customer fields based on strategy
  UPDATE customers SET
    date_of_birth = CASE 
      WHEN (merge_strategy->>'date_of_birth') = 'merge' THEN merge_customer.date_of_birth
      ELSE COALESCE(primary_customer.date_of_birth, merge_customer.date_of_birth)
    END,
    address_street = CASE 
      WHEN (merge_strategy->>'address_street') = 'merge' THEN merge_customer.address_street
      ELSE COALESCE(primary_customer.address_street, merge_customer.address_street)
    END,
    address_city = CASE 
      WHEN (merge_strategy->>'address_city') = 'merge' THEN merge_customer.address_city
      ELSE COALESCE(primary_customer.address_city, merge_customer.address_city)
    END,
    address_postal_code = CASE 
      WHEN (merge_strategy->>'address_postal_code') = 'merge' THEN merge_customer.address_postal_code
      ELSE COALESCE(primary_customer.address_postal_code, merge_customer.address_postal_code)
    END,
    emergency_contact_name = CASE 
      WHEN (merge_strategy->>'emergency_contact_name') = 'merge' THEN merge_customer.emergency_contact_name
      ELSE COALESCE(primary_customer.emergency_contact_name, merge_customer.emergency_contact_name)
    END,
    emergency_contact_phone = CASE 
      WHEN (merge_strategy->>'emergency_contact_phone') = 'merge' THEN merge_customer.emergency_contact_phone
      ELSE COALESCE(primary_customer.emergency_contact_phone, merge_customer.emergency_contact_phone)
    END,
    notes = CASE 
      WHEN (merge_strategy->>'notes') = 'merge' THEN merge_customer.notes
      WHEN (merge_strategy->>'notes') = 'combine' THEN 
        CASE 
          WHEN primary_customer.notes IS NOT NULL AND merge_customer.notes IS NOT NULL 
          THEN primary_customer.notes || E'\n\n--- Merged from customer ' || merge_customer.customer_number || ' ---\n' || merge_customer.notes
          ELSE COALESCE(primary_customer.notes, merge_customer.notes)
        END
      ELSE primary_customer.notes
    END,
    gdpr_consent_given = primary_customer.gdpr_consent_given OR merge_customer.gdpr_consent_given,
    gdpr_consent_date = CASE 
      WHEN merge_customer.gdpr_consent_given AND merge_customer.gdpr_consent_date > COALESCE(primary_customer.gdpr_consent_date, '1900-01-01'::timestamptz)
      THEN merge_customer.gdpr_consent_date
      ELSE primary_customer.gdpr_consent_date
    END,
    updated_at = NOW()
  WHERE id = primary_customer_id;

  -- Transfer appointments from merge customer to primary customer
  UPDATE appointments 
  SET customer_id = primary_customer_id,
      internal_notes = COALESCE(internal_notes || E'\n', '') || 'Transferred from customer ' || merge_customer.customer_number || ' during merge on ' || NOW()::date
  WHERE customer_id = merge_customer_id;

  GET DIAGNOSTICS appointments_count = ROW_COUNT;

  -- Soft delete the merged customer
  UPDATE customers 
  SET 
    is_deleted = true,
    deleted_at = NOW(),
    deleted_by = merging_user_id,
    deletion_reason = 'Merged into customer ' || primary_customer.customer_number,
    updated_at = NOW()
  WHERE id = merge_customer_id;

  -- Get data after merge
  SELECT jsonb_build_object(
    'primary_customer', row_to_json(c),
    'primary_profile', row_to_json(p)
  ) INTO data_after
  FROM customers c
  JOIN profiles p ON c.profile_id = p.id
  WHERE c.id = primary_customer_id;

  -- Record the merge in audit table
  INSERT INTO customer_merges (
    primary_customer_id,
    merged_customer_id,
    merged_by,
    merge_strategy,
    data_before,
    data_after,
    appointments_transferred,
    notes
  ) VALUES (
    primary_customer_id,
    merge_customer_id,
    merging_user_id,
    merge_strategy,
    data_before,
    data_after,
    appointments_count,
    notes
  );

  -- Update duplicate status
  UPDATE customer_duplicates 
  SET status = 'merged', 
      reviewed_by = merging_user_id,
      reviewed_at = NOW()
  WHERE (customer_a_id = primary_customer_id AND customer_b_id = merge_customer_id)
     OR (customer_a_id = merge_customer_id AND customer_b_id = primary_customer_id);

  result := jsonb_build_object(
    'success', true, 
    'message', 'Customers merged successfully',
    'primary_customer_id', primary_customer_id,
    'merged_customer_id', merge_customer_id,
    'appointments_transferred', appointments_count
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to export customers to CSV format (GDPR compliant)
CREATE OR REPLACE FUNCTION export_customers_csv(
  filters JSONB DEFAULT '{}'::jsonb,
  export_format TEXT DEFAULT 'basic' -- 'basic', 'detailed', 'gdpr_full'
)
RETURNS TABLE (
  customer_data JSONB
) AS $$
DECLARE
  where_conditions TEXT := 'WHERE c.is_deleted = false';
  query_text TEXT;
BEGIN
  -- Build dynamic WHERE clause based on filters
  IF filters ? 'hasGdprConsent' AND (filters->>'hasGdprConsent')::boolean = true THEN
    where_conditions := where_conditions || ' AND c.gdpr_consent_given = true';
  END IF;

  IF filters ? 'city' AND filters->>'city' != '' THEN
    where_conditions := where_conditions || ' AND c.address_city ILIKE ''%' || (filters->>'city') || '%''';
  END IF;

  IF filters ? 'postalCode' AND filters->>'postalCode' != '' THEN
    where_conditions := where_conditions || ' AND c.address_postal_code = ''' || (filters->>'postalCode') || '''';
  END IF;

  IF filters ? 'registeredAfter' AND filters->>'registeredAfter' != '' THEN
    where_conditions := where_conditions || ' AND c.created_at >= ''' || (filters->>'registeredAfter') || '''';
  END IF;

  IF filters ? 'registeredBefore' AND filters->>'registeredBefore' != '' THEN
    where_conditions := where_conditions || ' AND c.created_at <= ''' || (filters->>'registeredBefore') || '''';
  END IF;

  -- Only export customers with GDPR consent for detailed exports
  IF export_format IN ('detailed', 'gdpr_full') THEN
    where_conditions := where_conditions || ' AND c.gdpr_consent_given = true';
  END IF;

  -- Build query based on export format
  IF export_format = 'basic' THEN
    query_text := '
      SELECT jsonb_build_object(
        ''customer_number'', c.customer_number,
        ''full_name'', p.full_name,
        ''email'', p.email,
        ''created_at'', c.created_at
      ) as customer_data
      FROM customers c
      JOIN profiles p ON c.profile_id = p.id
    ' || where_conditions || '
    ORDER BY c.created_at DESC';
  
  ELSIF export_format = 'detailed' THEN
    query_text := '
      SELECT jsonb_build_object(
        ''customer_number'', c.customer_number,
        ''full_name'', p.full_name,
        ''email'', p.email,
        ''phone'', p.phone,
        ''date_of_birth'', c.date_of_birth,
        ''address_street'', c.address_street,
        ''address_city'', c.address_city,
        ''address_postal_code'', c.address_postal_code,
        ''emergency_contact_name'', c.emergency_contact_name,
        ''emergency_contact_phone'', c.emergency_contact_phone,
        ''gdpr_consent_given'', c.gdpr_consent_given,
        ''gdpr_consent_date'', c.gdpr_consent_date,
        ''created_at'', c.created_at,
        ''updated_at'', c.updated_at
      ) as customer_data
      FROM customers c
      JOIN profiles p ON c.profile_id = p.id
    ' || where_conditions || '
    ORDER BY c.created_at DESC';
  
  ELSE -- gdpr_full
    query_text := '
      SELECT jsonb_build_object(
        ''customer_number'', c.customer_number,
        ''full_name'', p.full_name,
        ''email'', p.email,
        ''phone'', p.phone,
        ''date_of_birth'', c.date_of_birth,
        ''address_street'', c.address_street,
        ''address_city'', c.address_city,
        ''address_postal_code'', c.address_postal_code,
        ''emergency_contact_name'', c.emergency_contact_name,
        ''emergency_contact_phone'', c.emergency_contact_phone,
        ''notes'', c.notes,
        ''gdpr_consent_given'', c.gdpr_consent_given,
        ''gdpr_consent_date'', c.gdpr_consent_date,
        ''created_at'', c.created_at,
        ''updated_at'', c.updated_at,
        ''appointment_count'', COALESCE(stats.total_appointments, 0),
        ''total_spent'', COALESCE(stats.total_spent, 0),
        ''last_appointment'', stats.last_appointment_date
      ) as customer_data
      FROM customers c
      JOIN profiles p ON c.profile_id = p.id
      LEFT JOIN (
        SELECT 
          customer_id,
          COUNT(*) as total_appointments,
          SUM(CASE WHEN status = ''completed'' THEN price ELSE 0 END) as total_spent,
          MAX(starts_at) as last_appointment_date
        FROM appointments
        GROUP BY customer_id
      ) stats ON c.id = stats.customer_id
    ' || where_conditions || '
    ORDER BY c.created_at DESC';
  END IF;

  RETURN QUERY EXECUTE query_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;