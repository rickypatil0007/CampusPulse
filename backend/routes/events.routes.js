import { Router } from 'express';
import { EventsController } from '../controllers/events.controller.js';

const router = Router();

router.get('/', EventsController.listEvents);
router.get('/:id', EventsController.getEvent);

export default router;
