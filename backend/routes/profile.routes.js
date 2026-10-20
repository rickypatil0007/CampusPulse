import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

/**
 * GET /api/me
 * Retrieves current authenticated user profile and permissions
 */
router.get('/', authenticate, (req, res) => {
  res.json({
    success: true,
    data: req.user
  });
});

export default router;
