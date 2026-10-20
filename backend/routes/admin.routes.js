import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

// Enforce admin privileges across all administrative routes
router.use(authenticate, authorize('admin'));

router.get('/summary', AdminController.getSummary);
router.post('/events', AdminController.createEvent);
router.patch('/events/:id', AdminController.updateEvent);
router.post('/events/:id/publish', AdminController.publishEvent);
router.post('/events/:id/cancel', AdminController.cancelEvent);
router.get('/events/:id/participants', AdminController.getParticipants);

export default router;
