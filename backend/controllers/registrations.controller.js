import { RegistrationService } from '../services/registration.service.js';

export const RegistrationsController = {
  /**
   * POST /api/events/:id/register
   */
  async register(req, res, next) {
    try {
      const { id } = req.params;
      const result = await RegistrationService.register(id, req.user);
      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/events/:id/register
   */
  async cancel(req, res, next) {
    try {
      const { id } = req.params;
      const result = await RegistrationService.cancel(id, req.user);
      res.json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/me/registrations
   */
  async getMyRegistrations(req, res, next) {
    try {
      const registrations = await RegistrationService.getUserRegistrations(req.user.id);
      res.json({
        success: true,
        data: registrations
      });
    } catch (err) {
      next(err);
    }
  }
};
