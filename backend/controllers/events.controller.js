import { EventsService } from '../services/events.service.js';

export const EventsController = {
  /**
   * GET /api/events
   * Query params: category, search, status, sortBy
   */
  async listEvents(req, res, next) {
    try {
      const { category, search, status, sortBy } = req.query;
      const events = await EventsService.getAllEvents({ category, search, status, sortBy });
      res.json({
        success: true,
        data: events
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/events/:id
   */
  async getEvent(req, res, next) {
    try {
      const { id } = req.params;
      const event = await EventsService.getEventById(id);
      if (!event) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'EVENT_NOT_FOUND',
            message: `Event with ID '${id}' was not found.`
          }
        });
      }
      res.json({
        success: true,
        data: event
      });
    } catch (err) {
      next(err);
    }
  }
};
