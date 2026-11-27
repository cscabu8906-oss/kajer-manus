-- Kajer Manus Unified PostgreSQL Schema (Non-Destructive)
-- Safe for production: uses CREATE TABLE IF NOT EXISTS and ON CONFLICT DO NOTHING.
-- NEVER drops tables or overwrites existing user/booking data.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  mobile_number VARCHAR(24) NOT NULL,
  full_address TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'provider', 'admin')),
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  language_preference VARCHAR(5) NOT NULL DEFAULT 'bn' CHECK (language_preference IN ('bn', 'en')),
  bengali_numerals BOOLEAN NOT NULL DEFAULT TRUE,
  push_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label VARCHAR(60) NOT NULL,
  address_line TEXT NOT NULL,
  city VARCHAR(80) NOT NULL DEFAULT 'Kolkata',
  pincode VARCHAR(16) DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(180) NOT NULL,
  purpose VARCHAR(30) NOT NULL CHECK (purpose IN ('register_verify', 'password_reset')),
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON otp_codes (email, purpose, created_at DESC);

CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(60) NOT NULL UNIQUE,
  name_bn VARCHAR(120) NOT NULL,
  name_en VARCHAR(120) NOT NULL,
  description_bn TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  icon_key VARCHAR(40) NOT NULL DEFAULT 'wrench',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS provider_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bio_bn TEXT NOT NULL DEFAULT '',
  bio_en TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  service_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  service_location_bn VARCHAR(140) NOT NULL DEFAULT 'কলকাতা',
  service_location_en VARCHAR(140) NOT NULL DEFAULT 'Kolkata',
  experience_years INTEGER NOT NULL DEFAULT 1,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_approved BOOLEAN NOT NULL DEFAULT FALSE,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  reviews_count INTEGER NOT NULL DEFAULT 0,
  completed_jobs INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_slug VARCHAR(60) NOT NULL REFERENCES service_categories(slug) ON UPDATE CASCADE,
  provider_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title_bn VARCHAR(180) NOT NULL,
  title_en VARCHAR(180) NOT NULL,
  description_bn TEXT NOT NULL,
  description_en TEXT NOT NULL,
  provider_name_bn VARCHAR(120) NOT NULL DEFAULT 'কাজের মানুষ কর্মী',
  provider_name_en VARCHAR(120) NOT NULL DEFAULT 'Kajer Manus Pro',
  area_bn VARCHAR(140) NOT NULL DEFAULT 'কলকাতা',
  area_en VARCHAR(140) NOT NULL DEFAULT 'Kolkata',
  base_price_inr INTEGER NOT NULL CHECK (base_price_inr >= 0),
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  rating NUMERIC(3,2) NOT NULL DEFAULT 4.80,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES users(id) ON DELETE SET NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  category_slug VARCHAR(60) NOT NULL,
  service_title_bn VARCHAR(180) NOT NULL,
  service_title_en VARCHAR(180) NOT NULL,
  provider_name_bn VARCHAR(120) NOT NULL DEFAULT '',
  provider_name_en VARCHAR(120) NOT NULL DEFAULT '',
  customer_name VARCHAR(120) NOT NULL,
  customer_phone VARCHAR(24) NOT NULL,
  service_address TEXT NOT NULL,
  preferred_date VARCHAR(40) NOT NULL,
  preferred_time VARCHAR(60) NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  amount_inr INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'in_progress', 'completed', 'cancelled')),
  language_at_booking VARCHAR(5) NOT NULL DEFAULT 'bn',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings (provider_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID REFERENCES users(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL DEFAULT '',
  email VARCHAR(180) NOT NULL DEFAULT '',
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  subject VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  language_code VARCHAR(5) NOT NULL DEFAULT 'bn',
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved')),
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_bn VARCHAR(180) NOT NULL,
  title_en VARCHAR(180) NOT NULL,
  body_bn TEXT NOT NULL,
  body_en TEXT NOT NULL,
  booking_id UUID,
  type VARCHAR(40) NOT NULL DEFAULT 'system',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  language_code VARCHAR(5) NOT NULL DEFAULT 'bn',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL UNIQUE,
  platform VARCHAR(20) NOT NULL DEFAULT 'android',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_content (
  key VARCHAR(80) PRIMARY KEY,
  value_bn TEXT NOT NULL,
  value_en TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(60) NOT NULL,
  target_id VARCHAR(120) NOT NULL DEFAULT '',
  ip_address VARCHAR(64) NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the 12 Service Categories idempotently
INSERT INTO service_categories (slug, name_bn, name_en, description_bn, description_en, icon_key, sort_order) VALUES
  ('electrician', 'ইলেকট্রিশিয়ান', 'Electrician', 'ওয়্যারিং, এমসিবি, ফ্যান ও লাইট মেরামত', 'Wiring, MCB, fan & lighting repairs', 'bolt', 1),
  ('plumber', 'প্লাম্বার', 'Plumber', 'পাইপ লিকেজ, কল, বেসিন ও ট্যাঙ্ক মেরামত', 'Pipe leakages, taps, basins & tank fitting', 'droplets', 2),
  ('ac_repair', 'এসি মেরামত', 'AC Repair', 'স্প্লিট ও উইন্ডো এসি সার্ভিসিং ও গ্যাস রিফিল', 'Split & window AC servicing and gas refill', 'snowflake', 3),
  ('home_cleaning', 'বাড়ি পরিষ্কার', 'Home Cleaning', 'ঘর, বাথরুম ও রান্নাঘর ডিপ ক্লিনিং', 'Full home, bathroom & kitchen deep cleaning', 'sparkles', 4),
  ('carpenter', 'কাঠমিস্ত্রি', 'Carpenter', 'দরজা, আলমারি ও কাঠের আসবাব মেরামত', 'Doors, wardrobes & wooden furniture repair', 'hammer', 5),
  ('painter', 'রংমিস্ত্রি', 'Painter', 'ইন্টারিয়র, এক্সটেরিয়র ও ড্যাম্প প্রুফিং', 'Interior, exterior & damp-proof painting', 'paintbrush', 6),
  ('appliance_repair', 'যন্ত্রপাতি মেরামত', 'Appliance Repair', 'ফ্রিজ, ওয়াশিং মেশিন ও মাইক্রোওয়েভ মেরামত', 'Fridge, washing machine & microwave repair', 'cpu', 7),
  ('internet_technician', 'ইন্টারনেট টেকনিশিয়ান', 'Internet Technician', 'রাউটার, ফাইবার কেবল ও ওয়াই-ফাই সেটআপ', 'Router, fiber cable & Wi-Fi mesh setup', 'wifi', 8),
  ('construction_worker', 'নির্মাণ কর্মী', 'Construction Worker', 'রাজমিস্ত্রি, টাইলস ও ছোট সংস্কার কাজ', 'Masonry, tiling & home renovation work', 'hardhat', 9),
  ('driver', 'ড্রাইভার', 'Driver', 'দৈনিক বা ঘন্টাভিত্তিক অভিজ্ঞ গাড়ি চালক', 'Experienced on-demand & daily car drivers', 'car', 10),
  ('gardening', 'বাগানের কাজ', 'Gardening', 'ছাদবাগান ও ঘরের গাছের সম্পূর্ণ পরিচর্যা', 'Terrace garden setup & plant maintenance', 'trees', 11),
  ('other_services', 'অন্যান্য সেবা', 'Other Services', 'ঘরোয়া ও জরুরি যেকোনো বিশেষ কাজ', 'Custom household & general handyman help', 'wrench', 12)
ON CONFLICT (slug) DO NOTHING;

-- Seed default bilingual services (idempotent via fixed UUIDs)
INSERT INTO services (id, category_slug, title_bn, title_en, description_bn, description_en, provider_name_bn, provider_name_en, area_bn, area_en, base_price_inr, duration_minutes, rating) VALUES
  ('11111111-1111-4111-8111-111111111101', 'electrician', 'বাড়ির ওয়্যারিং, এমসিবি ও ফ্যান মেরামত', 'Home Wiring, MCB & Fan Repair', 'দক্ষ ইলেকট্রিশিয়ান দ্বারা সুইচবোর্ড, সিলিং ফ্যান ও ইনভার্টার পরীক্ষা ও মেরামত।', 'Certified electrician for switchboards, ceiling fans, and circuit safety checks.', 'সুমন দত্ত', 'Suman Dutta', 'সল্টলেক ও নিউটাউন, কলকাতা', 'Salt Lake & New Town, Kolkata', 249, 45, 4.90),
  ('11111111-1111-4111-8111-111111111102', 'plumber', 'জলের কল, পাইপ লিকেজ ও বেসিন মেরামত', 'Tap, Pipe Leakage & Basin Repair', 'বাথরুম ও রান্নাঘরের পাইপ লিকেজ বন্ধ, নতুন কল লাগানো ও ট্যাঙ্ক ফিটিং।', 'Bathroom & kitchen leak repair, tap installation, and drainage unclogging.', 'তাপস মণ্ডল', 'Tapas Mondal', 'যাদবপুর ও গড়িয়া, কলকাতা', 'Jadavpur & Garia, Kolkata', 299, 60, 4.80),
  ('11111111-1111-4111-8111-111111111103', 'ac_repair', 'স্প্লিট ও উইন্ডো এসি সার্ভিসিং ও গ্যাস রিফিল', 'Split & Window AC Servicing & Gas Refill', 'ফোম জেট ক্লিনিং, কুলিং কয়েল পরিষ্কার ও সম্পূর্ণ এসি রক্ষণাবেক্ষণ।', 'Foam-jet deep cleaning, cooling coil care, and complete AC repair.', 'অরিজিৎ সেন', 'Arijit Sen', 'বেহালা ও টালিগঞ্জ, কলকাতা', 'Behala & Tollygunge, Kolkata', 549, 75, 4.90),
  ('11111111-1111-4111-8111-111111111104', 'home_cleaning', 'সম্পূর্ণ বাড়ি ও রান্নাঘর ডিপ ক্লিনিং', 'Full Home & Kitchen Deep Cleaning', 'জীবাণুনাশক ব্যবহার করে মেঝে, বাথরুম ও রান্নাঘর সম্পূর্ণ পরিষ্কার।', 'Deep sanitization of floors, bathrooms, windows, and kitchen grease.', 'মৌসুমী বিশ্বাস', 'Mousumi Biswas', 'বালিগঞ্জ ও ভবানীপুর, কলকাতা', 'Ballygunge & Bhawanipur, Kolkata', 999, 180, 4.90),
  ('11111111-1111-4111-8111-111111111105', 'carpenter', 'দরজা, আলমারি ও আসবাব মেরামত', 'Door, Wardrobe & Furniture Repair', 'দরজার কব্জা, তালা, কাঠের আলমারি ও কাস্টম আসবাব তৈরির কাজ।', 'Door hinges, locks, wardrobe channels, and wooden furniture restoration.', 'রতন কর্মকার', 'Ratan Karmakar', 'হাওড়া ও শ্যামবাজার', 'Howrah & Shyambazar', 349, 90, 4.75),
  ('11111111-1111-4111-8111-111111111106', 'painter', 'ঘরের দেয়াল রং ও ড্যাম্প প্রুফিং', 'Interior Wall Painting & Damp Proofing', 'পুট্টি, প্রাইমার ও ড্যাম্প-প্রুফ ইমালশন পেইন্টের মাধ্যমে ঘরের সাজসজ্জা।', 'Wall putty, primer, damp-proofing, and smooth emulsion painting.', 'বিপ্লব পাল', 'Biplab Pal', 'দমদম ও বারাসাত', 'Dum Dum & Barasat', 1499, 240, 4.80),
  ('11111111-1111-4111-8111-111111111107', 'appliance_repair', 'ফ্রিজ, ওয়াশিং মেশিন ও মাইক্রোওয়েভ মেরামত', 'Fridge, Washing Machine & Microwave Repair', 'সকল ব্র্যান্ডের রেফ্রিজারেটর ও ওয়াশিং মেশিন দ্রুত মেরামত।', 'Expert diagnostics and repair for refrigerators, washers, and microwaves.', 'সৌরভ বসু', 'Sourav Bose', 'পার্ক স্ট্রিট ও কসবা, কলকাতা', 'Park Street & Kasba, Kolkata', 399, 60, 4.85),
  ('11111111-1111-4111-8111-111111111108', 'internet_technician', 'ওয়াই-ফাই রাউটার ও ল্যান নেটওয়ার্ক সেটআপ', 'Wi-Fi Router & LAN Network Setup', 'নতুন রাউটার কনফিগারেশন, মেশ ওয়াই-ফাই ও স্পিড সমস্যার সমাধান।', 'Router setup, mesh Wi-Fi coverage optimization, and LAN cabling.', 'অর্ক চ্যাটার্জি', 'Arka Chatterjee', 'সেক্টর ৫ ও রাজারহাট, কলকাতা', 'Sector V & Rajarhat, Kolkata', 299, 45, 4.85),
  ('11111111-1111-4111-8111-111111111109', 'construction_worker', 'টাইলস বসানো ও ছোট মেরামতি কাজ', 'Tile Fixing & Masonry Repair', 'দেয়াল প্লাস্টার, মেঝের টাইলস ও বাথরুম ওয়াটারপ্রুফিং কাজ।', 'Wall plastering, floor tile replacement, and bathroom waterproofing.', 'রহিম শেখ', 'Rahim Sheikh', 'বারুইপুর ও সোনারপুর', 'Baruipur & Sonarpur', 699, 180, 4.70),
  ('11111111-1111-4111-8111-111111111110', 'driver', 'শহরের ভেতর ও বাইরে অভিজ্ঞ ড্রাইভার', 'Verified Local & Outstation Driver', 'ম্যানুয়াল ও অটোমেটিক গাড়ির জন্য প্রশিক্ষিত ও বিশ্বস্ত চালক।', 'Verified experienced chauffeur for manual and automatic vehicles.', 'দেবাশীষ রায়', 'Debashis Roy', 'সমগ্র কলকাতা ও হাওড়া', 'All Kolkata & Howrah', 499, 240, 4.90),
  ('11111111-1111-4111-8111-111111111111', 'gardening', 'ছাদবাগান ও ঘরের গাছ পরিচর্যা', 'Terrace Garden & Plant Maintenance', 'টবের মাটি পরিবর্তন, জৈব সার প্রয়োগ ও গাছ ছাঁটাই।', 'Soil repotting, organic fertilizing, pruning, and rooftop garden care.', 'প্রদীপ মালিক', 'Pradip Malik', 'রাজারহাট ও চন্দননগর', 'Rajarhat & Chandannagar', 449, 90, 4.90),
  ('11111111-1111-4111-8111-111111111112', 'other_services', 'আসবাব স্থানান্তর ও সাধারণ হ্যান্ডিম্যান সেবা', 'Home Shifting Helper & General Handyman', 'ঘরের পর্দা, টিভি মাউন্টিং, আসবাব গোছানো ও সাধারণ মেরামতি।', 'Curtain rod fitting, TV wall mounting, and general home assistance.', 'শম্ভু নাথ', 'Shambhu Nath', 'কলকাতা মহানগর', 'Kolkata Metro Area', 299, 60, 4.75)
ON CONFLICT (id) DO NOTHING;

INSERT INTO site_content (key, value_bn, value_en) VALUES
  ('hero_headline', 'কাজ পাবেন, সহজে পাবেন!', 'Find Trusted Professionals, Easily!'),
  ('hero_description', 'আপনার এলাকার দক্ষ ও নির্ভরযোগ্য কর্মী খুঁজুন এবং সহজেই প্রয়োজনীয় পরিষেবা বুক করুন।', 'Find skilled and trusted professionals in your area and book services easily.'),
  ('announcement_banner', 'কলকাতা ও পশ্চিমবঙ্গ জুড়ে দ্রুত এবং নির্ভরযোগ্য গৃহপরিষেবা', 'Fast and trusted home services across Kolkata & West Bengal')
ON CONFLICT (key) DO NOTHING;
