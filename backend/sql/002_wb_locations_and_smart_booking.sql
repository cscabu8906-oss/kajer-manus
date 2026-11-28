-- Kajer Manus Incremental Non-Destructive Migration 002
-- West Bengal Complete Location Hierarchy & Smart Service Provider Marketplace
-- SAFETY GUARANTEE: Zero DROP TABLE, zero TRUNCATE, zero destructive ALTERs.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. WEST BENGAL HIERARCHICAL LOCATION MASTER TABLES
CREATE TABLE IF NOT EXISTS wb_districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  lgd_code VARCHAR(40) NOT NULL DEFAULT '',
  state_code VARCHAR(10) NOT NULL DEFAULT '19',
  name_en VARCHAR(120) NOT NULL,
  name_bn VARCHAR(120) NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wb_districts_active_name ON wb_districts (is_active, name_en);

CREATE TABLE IF NOT EXISTS wb_subdivisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) NOT NULL UNIQUE,
  district_id UUID NOT NULL REFERENCES wb_districts(id) ON DELETE RESTRICT,
  district_code VARCHAR(40) NOT NULL,
  name_en VARCHAR(120) NOT NULL,
  name_bn VARCHAR(120) NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wb_subdivisions_district ON wb_subdivisions (district_id, is_active, name_en);

CREATE TABLE IF NOT EXISTS wb_local_bodies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(60) NOT NULL UNIQUE,
  lgd_code VARCHAR(40) NOT NULL DEFAULT '',
  district_id UUID NOT NULL REFERENCES wb_districts(id) ON DELETE RESTRICT,
  subdivision_id UUID REFERENCES wb_subdivisions(id) ON DELETE SET NULL,
  area_type VARCHAR(16) NOT NULL CHECK (area_type IN ('rural', 'urban')),
  body_type VARCHAR(30) NOT NULL CHECK (body_type IN ('block', 'municipality', 'municipal_corporation', 'notified_area')),
  name_en VARCHAR(140) NOT NULL,
  name_bn VARCHAR(140) NOT NULL,
  pincodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wb_local_bodies_lookup ON wb_local_bodies (district_id, subdivision_id, area_type, is_active);

CREATE TABLE IF NOT EXISTS wb_gp_wards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(60) NOT NULL UNIQUE,
  lgd_code VARCHAR(40) NOT NULL DEFAULT '',
  district_id UUID NOT NULL REFERENCES wb_districts(id) ON DELETE RESTRICT,
  subdivision_id UUID REFERENCES wb_subdivisions(id) ON DELETE SET NULL,
  local_body_id UUID NOT NULL REFERENCES wb_local_bodies(id) ON DELETE RESTRICT,
  unit_type VARCHAR(16) NOT NULL CHECK (unit_type IN ('gp', 'ward')),
  ward_number VARCHAR(20),
  name_en VARCHAR(160) NOT NULL,
  name_bn VARCHAR(160) NOT NULL,
  pincode VARCHAR(16),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wb_gp_wards_local_body ON wb_gp_wards (local_body_id, unit_type, is_active, name_en);
CREATE INDEX IF NOT EXISTS idx_wb_gp_wards_district ON wb_gp_wards (district_id);

CREATE TABLE IF NOT EXISTS wb_villages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(80) NOT NULL UNIQUE,
  lgd_code VARCHAR(40),
  district_id UUID NOT NULL REFERENCES wb_districts(id) ON DELETE RESTRICT,
  subdivision_id UUID REFERENCES wb_subdivisions(id) ON DELETE SET NULL,
  local_body_id UUID NOT NULL REFERENCES wb_local_bodies(id) ON DELETE RESTRICT,
  gp_ward_id UUID REFERENCES wb_gp_wards(id) ON DELETE SET NULL,
  locality_type VARCHAR(24) NOT NULL DEFAULT 'village' CHECK (locality_type IN ('village', 'urban_locality', 'locality')),
  name_en VARCHAR(180) NOT NULL,
  name_bn VARCHAR(180) NOT NULL,
  pincode VARCHAR(16),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wb_villages_gp_ward ON wb_villages (gp_ward_id, is_active);
CREATE INDEX IF NOT EXISTS idx_wb_villages_local_body ON wb_villages (local_body_id, locality_type, is_active);
CREATE INDEX IF NOT EXISTS idx_wb_villages_pincode ON wb_villages (pincode);
CREATE INDEX IF NOT EXISTS idx_wb_villages_name_en ON wb_villages (LOWER(name_en));

CREATE TABLE IF NOT EXISTS wb_pincodes (
  pincode VARCHAR(10) PRIMARY KEY,
  district_id UUID REFERENCES wb_districts(id) ON DELETE SET NULL,
  subdivision_id UUID REFERENCES wb_subdivisions(id) ON DELETE SET NULL,
  local_body_id UUID REFERENCES wb_local_bodies(id) ON DELETE SET NULL,
  gp_ward_id UUID REFERENCES wb_gp_wards(id) ON DELETE SET NULL,
  village_id UUID REFERENCES wb_villages(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. EXTEND USERS & SAVED ADDRESSES NON-DESTRUCTIVELY
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS state_name VARCHAR(60) NOT NULL DEFAULT 'West Bengal';
ALTER TABLE users ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES wb_districts(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subdivision_id UUID REFERENCES wb_subdivisions(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS area_type VARCHAR(16) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS local_body_id UUID REFERENCES wb_local_bodies(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gp_ward_id UUID REFERENCES wb_gp_wards(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS village_id UUID REFERENCES wb_villages(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS village_locality TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS pincode VARCHAR(16) NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location_consent BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_district ON users (district_id);
CREATE INDEX IF NOT EXISTS idx_users_local_body ON users (local_body_id);
CREATE INDEX IF NOT EXISTS idx_users_pincode ON users (pincode);

ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES wb_districts(id) ON DELETE SET NULL;
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS subdivision_id UUID REFERENCES wb_subdivisions(id) ON DELETE SET NULL;
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS area_type VARCHAR(16) NOT NULL DEFAULT '';
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS local_body_id UUID REFERENCES wb_local_bodies(id) ON DELETE SET NULL;
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS gp_ward_id UUID REFERENCES wb_gp_wards(id) ON DELETE SET NULL;
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS village_id UUID REFERENCES wb_villages(id) ON DELETE SET NULL;
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS village_locality TEXT NOT NULL DEFAULT '';
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE user_addresses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 3. EXTEND OTP CODES FOR MOBILE VERIFICATION SAFELY
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS channel VARCHAR(16) NOT NULL DEFAULT 'email';
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS target VARCHAR(180) NOT NULL DEFAULT '';
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS verification_token_hash TEXT NOT NULL DEFAULT '';
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'otp_codes_purpose_check'
  ) THEN
    ALTER TABLE otp_codes DROP CONSTRAINT otp_codes_purpose_check;
  END IF;
  ALTER TABLE otp_codes ADD CONSTRAINT otp_codes_purpose_check
    CHECK (purpose IN ('register_verify', 'password_reset', 'mobile_register'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_otp_target_purpose ON otp_codes (target, purpose, created_at DESC);

-- 4. EXTEND SERVICE CATEGORIES WITH SUBCATEGORIES
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS subcategories JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 5. EXTEND PROVIDER PROFILES FOR FULL WB REGISTRATION, KYC, PORTFOLIO & GEO
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS subcategories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS starting_price_inr INTEGER NOT NULL DEFAULT 299;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS working_hours JSONB NOT NULL DEFAULT '{"days":["Mon","Tue","Wed","Thu","Fri","Sat"],"start":"09:00","end":"20:00"}'::jsonb;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS portfolio_photos JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS id_doc_type VARCHAR(40) NOT NULL DEFAULT '';
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS id_doc_number_masked VARCHAR(40) NOT NULL DEFAULT '';
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS id_doc_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS id_verification_status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS id_verification_note TEXT NOT NULL DEFAULT '';
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES wb_districts(id) ON DELETE SET NULL;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS subdivision_id UUID REFERENCES wb_subdivisions(id) ON DELETE SET NULL;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS area_type VARCHAR(16) NOT NULL DEFAULT '';
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS local_body_id UUID REFERENCES wb_local_bodies(id) ON DELETE SET NULL;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS gp_ward_id UUID REFERENCES wb_gp_wards(id) ON DELETE SET NULL;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS village_id UUID REFERENCES wb_villages(id) ON DELETE SET NULL;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS village_locality TEXT NOT NULL DEFAULT '';
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS pincode VARCHAR(16) NOT NULL DEFAULT '';
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS gps_consent BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS public_area_label_bn VARCHAR(180) NOT NULL DEFAULT '';
ALTER TABLE provider_profiles ADD COLUMN IF NOT EXISTS public_area_label_en VARCHAR(180) NOT NULL DEFAULT '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'provider_profiles_approval_status_check'
  ) THEN
    ALTER TABLE provider_profiles DROP CONSTRAINT provider_profiles_approval_status_check;
  END IF;
  ALTER TABLE provider_profiles ADD CONSTRAINT provider_profiles_approval_status_check
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'suspended'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_provider_profiles_geo ON provider_profiles (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_location_ids ON provider_profiles (district_id, subdivision_id, local_body_id, gp_ward_id);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_categories ON provider_profiles USING GIN (service_categories);
CREATE INDEX IF NOT EXISTS idx_provider_profiles_active_search ON provider_profiles (approval_status, is_approved, is_available);

-- 6. PROVIDER MULTI-LOCATION SERVICE AREAS & AVAILABILITY
CREATE TABLE IF NOT EXISTS provider_service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  district_id UUID REFERENCES wb_districts(id) ON DELETE SET NULL,
  subdivision_id UUID REFERENCES wb_subdivisions(id) ON DELETE SET NULL,
  local_body_id UUID REFERENCES wb_local_bodies(id) ON DELETE SET NULL,
  gp_ward_id UUID REFERENCES wb_gp_wards(id) ON DELETE SET NULL,
  village_id UUID REFERENCES wb_villages(id) ON DELETE SET NULL,
  pincode VARCHAR(16) NOT NULL DEFAULT '',
  area_label_en VARCHAR(180) NOT NULL DEFAULT '',
  area_label_bn VARCHAR(180) NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  radius_km INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_psa_provider ON provider_service_areas (provider_user_id);
CREATE INDEX IF NOT EXISTS idx_psa_location ON provider_service_areas (district_id, subdivision_id, local_body_id, gp_ward_id, pincode);
CREATE INDEX IF NOT EXISTS idx_psa_geo ON provider_service_areas (latitude, longitude);

CREATE TABLE IF NOT EXISTS provider_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  status_note VARCHAR(120) NOT NULL DEFAULT '',
  working_hours JSONB NOT NULL DEFAULT '{"days":["Mon","Tue","Wed","Thu","Fri","Sat"],"start":"09:00","end":"20:00"}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. CUSTOMER FAVOURITE PROVIDERS
CREATE TABLE IF NOT EXISTS favourite_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, provider_user_id)
);
CREATE INDEX IF NOT EXISTS idx_favourites_customer ON favourite_providers (customer_id, created_at DESC);

-- 8. EXTEND BOOKINGS FOR WB LOCATION, PROBLEM PHOTOS & DUPLICATE PROTECTION
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES wb_districts(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS subdivision_id UUID REFERENCES wb_subdivisions(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS local_body_id UUID REFERENCES wb_local_bodies(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gp_ward_id UUID REFERENCES wb_gp_wards(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS village_id UUID REFERENCES wb_villages(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pincode VARCHAR(16) NOT NULL DEFAULT '';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS problem_photos JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(120) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_bookings_district_created ON bookings (district_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_local_body ON bookings (local_body_id);
CREATE INDEX IF NOT EXISTS idx_bookings_category ON bookings (category_slug);
CREATE INDEX IF NOT EXISTS idx_bookings_geo ON bookings (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_bookings_dup_guard ON bookings (customer_id, provider_id, category_slug, preferred_date, preferred_time, status);
