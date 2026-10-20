/**
 * CampusPulse Frontend Runtime Configuration
 */
export const CONFIG = {
  // Base URL for the Express REST API
  API_BASE_URL: (window.location.hostname === 'localhost' && window.location.port === '5500') 
    ? 'http://localhost:3000/api' 
    : '/api',

  // Supabase Client Settings
  SUPABASE_URL: window.ENV_SUPABASE_URL || 'https://bzuwuroaidbroeshcnzw.supabase.co',
  SUPABASE_ANON_KEY: window.ENV_SUPABASE_ANON_KEY || 'sb_publishable_IMYsA-40KQQK0DNl1elw-Q_YQ0uFvKi',

  // Local Storage Keys
  STORAGE_KEYS: {
    AUTH_TOKEN: 'campuspulse_auth_token',
    USER_PROFILE: 'campuspulse_user_profile',
    THEME: 'campuspulse_theme'
  },

  // Pagination & Display Limits
  DEFAULT_PAGE_SIZE: 12,

  // Event Categories
  CATEGORIES: [
    'All',
    'Technical',
    'Workshop',
    'Hackathon',
    'Cultural',
    'Sports',
    'Entrepreneurship'
  ]
};
