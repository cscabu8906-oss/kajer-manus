export type AppLanguage = 'bn' | 'en';
export type UserRole = 'customer' | 'provider' | 'admin';

export interface User {
  id: string;
  full_name: string;
  email: string;
  mobile_number: string;
  full_address: string;
  role: UserRole;
  is_verified: boolean;
  language_preference: AppLanguage;
  bengali_numerals: boolean;
  push_notifications_enabled: boolean;
  email_notifications_enabled: boolean;
}

export interface UserAddress {
  id: string;
  label: string;
  address_line: string;
  city: string;
  pincode: string;
  is_default: boolean;
}

export interface ServiceCategory {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string;
  description_bn: string;
  description_en: string;
  icon_key: string;
}

export interface ServiceItem {
  id: string;
  category_slug: string;
  provider_user_id: string | null;
  title_bn: string;
  title_en: string;
  description_bn: string;
  description_en: string;
  provider_name_bn: string;
  provider_name_en: string;
  area_bn: string;
  area_en: string;
  base_price_inr: number;
  duration_minutes: number;
  rating: number;
}

export interface WorkerProfile {
  id: string;
  user_id: string;
  full_name: string;
  bio_bn: string;
  bio_en: string;
  photo_url: string;
  service_categories: string[];
  service_location_bn: string;
  service_location_en: string;
  experience_years: number;
  is_available: boolean;
  is_approved: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  rating_avg: number;
  reviews_count: number;
  completed_jobs: number;
}

export interface BookingItem {
  id: string;
  customer_id: string;
  provider_id: string | null;
  service_id: string | null;
  category_slug: string;
  service_title_bn: string;
  service_title_en: string;
  provider_name_bn: string;
  provider_name_en: string;
  customer_name: string;
  customer_phone: string;
  service_address: string;
  preferred_date: string;
  preferred_time: string;
  instructions: string;
  amount_inr: number;
  status: 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'completed' | 'cancelled';
  has_review?: boolean;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  title_bn: string;
  title_en: string;
  body_bn: string;
  body_en: string;
  is_read: boolean;
  created_at: string;
}
