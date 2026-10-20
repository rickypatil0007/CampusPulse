/**
 * Role-Based Access Control (RBAC) Middleware
 * Verifies that the authenticated user possesses the required role.
 */
export function authorize(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required before checking permissions.'
        }
      });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. This endpoint requires '${requiredRole}' privileges.`
        }
      });
    }

    next();
  };
}
