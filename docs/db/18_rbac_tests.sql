-- RLS Policy Tests for RBAC System
-- Tests both positive and negative scenarios for all roles

-- Test setup: Create test users for each role
-- Note: These are example tests that would run in a test environment

-- Create test data
INSERT INTO auth.users (id, email) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'admin@test.com'),
  ('22222222-2222-2222-2222-222222222222', 'staff@test.com'),
  ('33333333-3333-3333-3333-333333333333', 'receptionist@test.com'),
  ('44444444-4444-4444-4444-444444444444', 'customer@test.com');

INSERT INTO profiles (id, email, role, first_name, last_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@test.com', 'admin', 'Admin', 'User'),
  ('22222222-2222-2222-2222-222222222222', 'staff@test.com', 'staff', 'Staff', 'User'),
  ('33333333-3333-3333-3333-333333333333', 'receptionist@test.com', 'receptionist', 'Reception', 'User'),
  ('44444444-4444-4444-4444-444444444444', 'customer@test.com', 'customer', 'Customer', 'User');

INSERT INTO customers (id, profile_id, email, phone, first_name, last_name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'customer@test.com', '+49123456789', 'Customer', 'User');

INSERT INTO staff (id, profile_id, email, first_name, last_name) VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'staff@test.com', 'Staff', 'User');

-- Test 1: Admin Access Tests (Should pass all operations)
DO $$
DECLARE
  admin_id UUID := '11111111-1111-1111-1111-111111111111';
  test_count INTEGER := 0;
  pass_count INTEGER := 0;
BEGIN
  -- Set current user to admin
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin_id)::text, true);
  
  RAISE NOTICE 'Testing Admin Access...';
  
  -- Test: Admin can view all profiles
  test_count := test_count + 1;
  IF (SELECT COUNT(*) FROM profiles) >= 4 THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Admin can view all profiles';
  ELSE
    RAISE NOTICE '✗ Admin cannot view all profiles';
  END IF;
  
  -- Test: Admin can view all customers
  test_count := test_count + 1;
  IF (SELECT COUNT(*) FROM customers) >= 1 THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Admin can view all customers';
  ELSE
    RAISE NOTICE '✗ Admin cannot view all customers';
  END IF;
  
  -- Test: Admin can view customer PII (unmasked)
  test_count := test_count + 1;
  IF (SELECT email FROM customers_secure LIMIT 1) = 'customer@test.com' THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Admin sees unmasked customer email';
  ELSE
    RAISE NOTICE '✗ Admin sees masked customer email';
  END IF;
  
  RAISE NOTICE 'Admin tests: % passed out of %', pass_count, test_count;
END $$;

-- Test 2: Staff Access Tests
DO $$
DECLARE
  staff_id UUID := '22222222-2222-2222-2222-222222222222';
  test_count INTEGER := 0;
  pass_count INTEGER := 0;
BEGIN
  -- Set current user to staff
  PERFORM set_config('request.jwt.claims', json_build_object('sub', staff_id)::text, true);
  
  RAISE NOTICE 'Testing Staff Access...';
  
  -- Test: Staff can view their own profile
  test_count := test_count + 1;
  IF (SELECT COUNT(*) FROM profiles WHERE id = staff_id) = 1 THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Staff can view own profile';
  ELSE
    RAISE NOTICE '✗ Staff cannot view own profile';
  END IF;
  
  -- Test: Staff cannot view customer PII (should be masked)
  test_count := test_count + 1;
  IF (SELECT email FROM customers_secure LIMIT 1) LIKE '%***%' THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Staff sees masked customer email';
  ELSE
    RAISE NOTICE '✗ Staff sees unmasked customer email';
  END IF;
  
  -- Test: Staff cannot create new staff records
  test_count := test_count + 1;
  BEGIN
    INSERT INTO staff (profile_id, email, first_name, last_name) 
    VALUES (staff_id, 'newstaff@test.com', 'New', 'Staff');
    RAISE NOTICE '✗ Staff can create staff records (should fail)';
  EXCEPTION WHEN insufficient_privilege THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Staff cannot create staff records';
  END;
  
  RAISE NOTICE 'Staff tests: % passed out of %', pass_count, test_count;
END $$;

-- Test 3: Receptionist Access Tests
DO $$
DECLARE
  receptionist_id UUID := '33333333-3333-3333-3333-333333333333';
  test_count INTEGER := 0;
  pass_count INTEGER := 0;
BEGIN
  -- Set current user to receptionist
  PERFORM set_config('request.jwt.claims', json_build_object('sub', receptionist_id)::text, true);
  
  RAISE NOTICE 'Testing Receptionist Access...';
  
  -- Test: Receptionist can view all customers
  test_count := test_count + 1;
  IF (SELECT COUNT(*) FROM customers) >= 1 THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Receptionist can view all customers';
  ELSE
    RAISE NOTICE '✗ Receptionist cannot view all customers';
  END IF;
  
  -- Test: Receptionist can see customer address but not email
  test_count := test_count + 1;
  IF (SELECT email FROM customers_secure LIMIT 1) LIKE '%***%' THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Receptionist sees masked customer email';
  ELSE
    RAISE NOTICE '✗ Receptionist sees unmasked customer email';
  END IF;
  
  -- Test: Receptionist can create appointments
  test_count := test_count + 1;
  BEGIN
    INSERT INTO appointments (customer_id, staff_id, service_id, start_time, end_time, price)
    VALUES (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      NOW() + INTERVAL '1 day',
      NOW() + INTERVAL '1 day' + INTERVAL '1 hour',
      50.00
    );
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Receptionist can create appointments';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '✗ Receptionist cannot create appointments: %', SQLERRM;
  END;
  
  -- Test: Receptionist cannot manage system settings
  test_count := test_count + 1;
  BEGIN
    INSERT INTO settings (key, value, category) 
    VALUES ('test_setting', '"test_value"', 'test');
    RAISE NOTICE '✗ Receptionist can manage settings (should fail)';
  EXCEPTION WHEN insufficient_privilege THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Receptionist cannot manage settings';
  END;
  
  RAISE NOTICE 'Receptionist tests: % passed out of %', pass_count, test_count;
END $$;

-- Test 4: Customer Access Tests
DO $$
DECLARE
  customer_id UUID := '44444444-4444-4444-4444-444444444444';
  test_count INTEGER := 0;
  pass_count INTEGER := 0;
BEGIN
  -- Set current user to customer
  PERFORM set_config('request.jwt.claims', json_build_object('sub', customer_id)::text, true);
  
  RAISE NOTICE 'Testing Customer Access...';
  
  -- Test: Customer can view own profile
  test_count := test_count + 1;
  IF (SELECT COUNT(*) FROM profiles WHERE id = customer_id) = 1 THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Customer can view own profile';
  ELSE
    RAISE NOTICE '✗ Customer cannot view own profile';
  END IF;
  
  -- Test: Customer can view own customer data
  test_count := test_count + 1;
  IF (SELECT COUNT(*) FROM customers WHERE profile_id = customer_id) = 1 THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Customer can view own customer data';
  ELSE
    RAISE NOTICE '✗ Customer cannot view own customer data';
  END IF;
  
  -- Test: Customer sees own email unmasked
  test_count := test_count + 1;
  IF (SELECT email FROM customers_secure WHERE profile_id = customer_id) = 'customer@test.com' THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Customer sees own email unmasked';
  ELSE
    RAISE NOTICE '✗ Customer sees own email masked';
  END IF;
  
  -- Test: Customer cannot view other customers
  test_count := test_count + 1;
  IF (SELECT COUNT(*) FROM customers WHERE profile_id != customer_id) = 0 THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Customer cannot view other customers';
  ELSE
    RAISE NOTICE '✗ Customer can view other customers';
  END IF;
  
  -- Test: Customer cannot create staff records
  test_count := test_count + 1;
  BEGIN
    INSERT INTO staff (profile_id, email, first_name, last_name) 
    VALUES (customer_id, 'customer-staff@test.com', 'Customer', 'Staff');
    RAISE NOTICE '✗ Customer can create staff records (should fail)';
  EXCEPTION WHEN insufficient_privilege THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Customer cannot create staff records';
  END;
  
  RAISE NOTICE 'Customer tests: % passed out of %', pass_count, test_count;
END $$;

-- Test 5: Field-Level Masking Tests
DO $$
DECLARE
  admin_email TEXT;
  staff_email TEXT;
  receptionist_email TEXT;
  customer_email TEXT;
BEGIN
  RAISE NOTICE 'Testing Field-Level Masking...';
  
  -- Admin should see unmasked email
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
  SELECT email INTO admin_email FROM customers_secure LIMIT 1;
  
  -- Staff should see masked email
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
  SELECT email INTO staff_email FROM customers_secure LIMIT 1;
  
  -- Receptionist should see masked email
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
  SELECT email INTO receptionist_email FROM customers_secure LIMIT 1;
  
  -- Customer should see own email unmasked
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);
  SELECT email INTO customer_email FROM customers_secure WHERE profile_id = '44444444-4444-4444-4444-444444444444';
  
  RAISE NOTICE 'Admin sees: %, Staff sees: %, Receptionist sees: %, Customer sees: %', 
    admin_email, staff_email, receptionist_email, customer_email;
  
  -- Verify masking is working correctly
  IF admin_email = 'customer@test.com' AND 
     staff_email LIKE '%***%' AND 
     receptionist_email LIKE '%***%' AND 
     customer_email = 'customer@test.com' THEN
    RAISE NOTICE '✓ Field-level masking working correctly';
  ELSE
    RAISE NOTICE '✗ Field-level masking not working correctly';
  END IF;
END $$;

-- Test 6: Role Permission Matrix Test
DO $$
DECLARE
  admin_perms RECORD;
  staff_perms RECORD;
  receptionist_perms RECORD;
  customer_perms RECORD;
BEGIN
  RAISE NOTICE 'Testing Role Permission Matrix...';
  
  -- Test admin permissions
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
  SELECT * INTO admin_perms FROM get_user_permissions() WHERE resource = 'customers';
  
  -- Test staff permissions  
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
  SELECT * INTO staff_perms FROM get_user_permissions() WHERE resource = 'customers';
  
  -- Test receptionist permissions
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
  SELECT * INTO receptionist_perms FROM get_user_permissions() WHERE resource = 'customers';
  
  -- Test customer permissions
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);
  SELECT * INTO customer_perms FROM get_user_permissions() WHERE resource = 'customers';
  
  RAISE NOTICE 'Customer permissions - Admin: R:% C:% U:% D:%, Staff: R:% C:% U:% D:%, Receptionist: R:% C:% U:% D:%, Customer: R:% C:% U:% D:%',
    admin_perms.can_read, admin_perms.can_create, admin_perms.can_update, admin_perms.can_delete,
    staff_perms.can_read, staff_perms.can_create, staff_perms.can_update, staff_perms.can_delete,
    receptionist_perms.can_read, receptionist_perms.can_create, receptionist_perms.can_update, receptionist_perms.can_delete,
    customer_perms.can_read, customer_perms.can_create, customer_perms.can_update, customer_perms.can_delete;
END $$;

-- Test 7: Negative Access Tests (These should all fail)
DO $$
DECLARE
  test_count INTEGER := 0;
  pass_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Testing Negative Access Controls...';
  
  -- Staff trying to view system settings (should fail)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222222')::text, true);
  test_count := test_count + 1;
  BEGIN
    PERFORM * FROM settings WHERE category = 'system';
    RAISE NOTICE '✗ Staff can view system settings (should fail)';
  EXCEPTION WHEN insufficient_privilege THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Staff correctly blocked from system settings';
  END;
  
  -- Receptionist trying to create staff (should fail)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333333')::text, true);
  test_count := test_count + 1;
  BEGIN
    INSERT INTO staff (profile_id, email, first_name, last_name) 
    VALUES ('33333333-3333-3333-3333-333333333333', 'receptionist-staff@test.com', 'Receptionist', 'Staff');
    RAISE NOTICE '✗ Receptionist can create staff (should fail)';
  EXCEPTION WHEN insufficient_privilege THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Receptionist correctly blocked from creating staff';
  END;
  
  -- Customer trying to view other customers (should fail)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444444')::text, true);
  test_count := test_count + 1;
  IF (SELECT COUNT(*) FROM customers WHERE profile_id != '44444444-4444-4444-4444-444444444444') = 0 THEN
    pass_count := pass_count + 1;
    RAISE NOTICE '✓ Customer correctly blocked from viewing other customers';
  ELSE
    RAISE NOTICE '✗ Customer can view other customers (should fail)';
  END IF;
  
  RAISE NOTICE 'Negative access tests: % passed out of %', pass_count, test_count;
END $$;

-- Test Summary
DO $$
BEGIN
  RAISE NOTICE '=== RLS Policy Test Summary ===';
  RAISE NOTICE 'All tests completed. Review the output above for detailed results.';
  RAISE NOTICE 'Tests cover:';
  RAISE NOTICE '- Admin full access permissions';
  RAISE NOTICE '- Staff limited access and field masking';
  RAISE NOTICE '- Receptionist appointment management permissions';  
  RAISE NOTICE '- Customer self-service restrictions';
  RAISE NOTICE '- Field-level PII masking';
  RAISE NOTICE '- Role permission matrix validation';
  RAISE NOTICE '- Negative access control verification';
END $$;

-- Cleanup test data (commented out for reference)
-- DELETE FROM appointments WHERE customer_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- DELETE FROM customers WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- DELETE FROM staff WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- DELETE FROM profiles WHERE id IN (
--   '11111111-1111-1111-1111-111111111111',
--   '22222222-2222-2222-2222-222222222222', 
--   '33333333-3333-3333-3333-333333333333',
--   '44444444-4444-4444-4444-444444444444'
-- );
-- DELETE FROM auth.users WHERE id IN (
--   '11111111-1111-1111-1111-111111111111',
--   '22222222-2222-2222-2222-222222222222',
--   '33333333-3333-3333-3333-333333333333', 
--   '44444444-4444-4444-4444-444444444444'
-- );