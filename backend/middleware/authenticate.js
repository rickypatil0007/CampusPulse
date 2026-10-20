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
      req.user = {
        id: mockId,
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
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'User profile not found in database.'
        }
      });
    }

    req.user = profile;
    next();
  } catch (err) {
    next(err);
  }
}
