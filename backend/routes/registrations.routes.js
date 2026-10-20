import { Router } from 'express';
import { RegistrationsController } from '../controllers/registrations.controller.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();

// Student registration and cancellation
router.post('/events/:id/register', authenticate, RegistrationsController.register);
router.delete('/events/:id/register', authenticate, RegistrationsController.cancel);
router.post('/events/:id/cancel', authenticate, RegistrationsController.cancel);

// Student registration history & rank retrieval
router.get('/me/registrations', authenticate, RegistrationsController.getMyRegistrations);

export default router;
