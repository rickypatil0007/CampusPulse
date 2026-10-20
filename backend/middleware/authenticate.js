import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const isSupabaseConfigured = supabaseUrl && 
  !supabaseUrl.includes('placeholder') && 
  supabaseServiceKey && 
  !supabaseServiceKey.includes('placeholder');

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

/**
 * JWT Authentication Middleware
 * Validates Bearer tokens and attaches verified user profile to req.user.
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication token required. Bearer header missing.'
        }
      });
    }

    const token = authHeader.split(' ')[1];

    // Development Mock Token Handler
    if (token.startsWith('mock_jwt_token_')) {
      const mockId = token.replace('mock_jwt_token_', '');
      const isAdmin = mockId.includes('admin');
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const realId = UUID_REGEX.test(mockId) 
        ? mockId 
        : (isAdmin ? '0101e9c0-1df6-4418-b34c-85788f15a24b' : 'f09933af-ebef-4b75-8b76-5983c9056f23');

      req.user = {
        id: realId,
        email: isAdmin ? 'faculty.admin@college.edu' : 'alex.mercer@college.edu',
        full_name: isAdmin ? 'Faculty Coordinator' : 'Alex Mercer',
        role: isAdmin ? 'admin' : 'student'
      };
      return next();
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'AUTH_SERVICE_UNAVAILABLE',
          message: 'Supabase authentication service is not configured in backend environment.'
        }
      });
    }

    // Verify token with Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Session has expired or token is invalid.'
        }
      });
    }

    // Retrieve verified profile role from database
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      // Auto-upsert profile if not yet existing
      const newProfile = {
        id: user.id,
        full_name: user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'Student'),
        email: user.email || 'student@college.edu',
        role: (user.user_metadata?.role || (user.email?.includes('admin') ? 'admin' : 'student'))
      };
      await supabase.from('profiles').upsert(newProfile);
      profile = newProfile;
    }

    req.user = profile;
    next();
  } catch (err) {
    next(err);
  }
}
