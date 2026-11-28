export type AppLanguage = 'bn' | 'en';
export type UserRole = 'customer' | 'provider' | 'admin';
export type AreaType = 'urban' | 'rural' | '';

export interface WbState {
  code: string;
  name_en: string;
  name_bn: string;
}

export interface WbDistrict {
  id: string;
  code: string;
  lgd_code?: string;
  state_code: string;
  name_en: string;
  name_bn: string;
  latitude?: number | null;
  longitude?: number | null;
  is_active: boolean;
}

export interface WbSubdivision {
  id: string;
  code: string;
  district_id: string;
  district_code?: string;
  name_en: string;
  name_bn: string;
  latitude?: number | null;
  longitude?: number | null;
  is_active: boolean;
}

export interface WbLocalBody {
  id: string;
  code: string;
  lgd_code?: string;
  district_id: string;
  subdivision_id?: string | null;
  area_type: 'urban' | 'rural';
  body_type: 'block' | 'municipality' | 'municipal_corporation' | 'notified_area';
  name_en: string;
  name_bn: string;
  pincodes?: string[];
  latitude?: number | null;
  longitude?: number | null;
  is_active: boolean;
}

export interface WbGpWard {
  id: string;
  code: string;
  lgd_code?: string;
  district_id: string;
  subdivision_id?: string | null;
  local_body_id: string;
  unit_type: 'gp' | 'ward';
  ward_number?: string | null;
  name_en: string;
  name_bn: string;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_active: boolean;
}

export interface WbVillage {
  id: string;
  code: string;
  lgd_code?: string;
  district_id: string;
  subdivision_id?: string | null;
  local_body_id: string;
  gp_ward_id?: string | null;
  locality_type: string;
  name_en: string;
  name_bn: string;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_active: boolean;
}

export interface SelectedWbLocation {
  stateName?: string;
  districtId: string;
  subdivisionId: string;
  areaType: AreaType;
  localBodyId: string;
  gpWardId: string;
  villageId: string;
  villageLocality: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  gpsConsent: boolean;
}

export interface ServiceAreaItem {
  id?: string;
  district_id?: string | null;
  subdivision_id?: string | null;
  local_body_id?: string | null;
  gp_ward_id?: string | null;
  village_id?: string | null;
  districtId?: string | null;
  subdivisionId?: string | null;
  localBodyId?: string | null;
  gpWardId?: string | null;
  villageId?: string | null;
  pincode?: string;
  area_label_en?: string;
  area_label_bn?: string;
  areaLabelEn?: string;
  areaLabelBn?: string;
  latitude?: number | null;
  longitude?: number | null;
  radius_km?: number;
  radiusKm?: number;
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  mobile_number: string;
  mobile_verified?: boolean;
  profile_photo_url?: string;
  full_address: string;
  state_name?: string;
  district_id?: string | null;
  subdivision_id?: string | null;
  area_type?: AreaType;
  local_body_id?: string | null;
  gp_ward_id?: string | null;
  village_id?: string | null;
  village_locality?: string;
  pincode?: string;
  latitude?: number | null;
  longitude?: number | null;
  location_consent?: boolean;
  role: UserRole;
  is_verified: boolean;
  two_factor_enabled?: boolean;
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
  district_id?: string | null;
  subdivision_id?: string | null;
  area_type?: AreaType;
  local_body_id?: string | null;
  gp_ward_id?: string | null;
  village_id?: string | null;
  village_locality?: string;
  latitude?: number | null;
  longitude?: number | null;
  district_name_en?: string;
  district_name_bn?: string;
  local_body_name_en?: string;
  local_body_name_bn?: string;
  gp_ward_name_en?: string;
  gp_ward_name_bn?: string;
  is_default: boolean;
}

export interface ServiceSubcategory {
  slug: string;
  name_bn: string;
  name_en: string;
}

export interface ServiceCategory {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string;
  description_bn: string;
  description_en: string;
  subcategories?: ServiceSubcategory[];
  icon_key: string;
  is_active?: boolean;
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

export interface WorkingHours {
  days: string[];
  start: string;
  end: string;
}

export interface WorkerProfile {
  id: string;
  user_id: string;
  full_name: string;
  bio_bn: string;
  bio_en: string;
  photo_url: string;
  service_categories: string[];
  subcategories?: string[];
  skills?: string[];
  starting_price_inr?: number;
  working_hours?: WorkingHours;
  portfolio_photos?: string[];
  service_location_bn: string;
  service_location_en: string;
  district_id?: string | null;
  subdivision_id?: string | null;
  area_type?: AreaType;
  local_body_id?: string | null;
  gp_ward_id?: string | null;
  village_id?: string | null;
  village_locality?: string;
  pincode?: string;
  district_name_en?: string;
  district_name_bn?: string;
  subdivision_name_en?: string;
  subdivision_name_bn?: string;
  local_body_name_en?: string;
  local_body_name_bn?: string;
  gp_ward_name_en?: string;
  gp_ward_name_bn?: string;
  service_areas?: ServiceAreaItem[];
  services?: ServiceItem[];
  experience_years: number;
  is_available: boolean;
  is_approved: boolean;
  approval_status: 'pending' | 'approved' | 'rejected' | 'suspended';
  is_verified_provider?: boolean;
  id_verification_status?: 'pending' | 'verified' | 'rejected';
  id_verification_note?: string;
  id_doc_type?: string;
  id_doc_number_masked?: string;
  id_doc_urls?: string[];
  rating_avg: number;
  reviews_count: number;
  completed_jobs: number;
  distance_km?: number | null;
  distance_source?: 'gps' | 'location_centroid' | 'none';
  is_favourite?: boolean;
}

export interface ProviderSearchMeta {
  total: number;
  matchedRadiusKm: number | null;
  distanceSource: 'gps' | 'location_centroid' | 'none';
  tiersCheckedKm: number[];
}

export interface ProviderEarningsSummary {
  completed_jobs: number;
  active_jobs: number;
  pending_jobs: number;
  total_earnings_inr: number;
  paid_online_inr: number;
  this_month_inr: number;
}

export type BookingPaymentMethod = 'cash' | 'razorpay';
export type BookingPaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';

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
  district_id?: string | null;
  subdivision_id?: string | null;
  local_body_id?: string | null;
  gp_ward_id?: string | null;
  village_id?: string | null;
  pincode?: string;
  problem_photos?: string[];
  preferred_date: string;
  preferred_time: string;
  instructions: string;
  amount_inr: number;
  status: 'pending' | 'accepted' | 'rejected' | 'in_progress' | 'completed' | 'cancelled';
  payment_method?: BookingPaymentMethod;
  payment_status?: BookingPaymentStatus;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  paid_at?: string | null;
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

export interface AdminLocationSummary {
  districts: number;
  subdivisions: number;
  blocks: number;
  urbanBodies: number;
  gramPanchayats: number;
  wards: number;
  villages: number;
  pincodes: number;
}

export interface DistrictBookingStat {
  id: string;
  name_en: string;
  name_bn: string;
  total_bookings: number;
  completed_bookings: number;
  pending_bookings: number;
  revenue_inr: number;
  active_providers: number;
  registered_users: number;
}
