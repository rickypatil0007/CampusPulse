import { AdminService } from '../services/admin.service.js';

export const AdminController = {
  async getSummary(req, res, next) {
    try {
      const summary = await AdminService.getSummaryMetrics();
      res.json({
        success: true,
        data: summary
      });
    } catch (err) {
      next(err);
    }
  },

  async createEvent(req, res, next) {
    try {
      const event = await AdminService.createEvent(req.body, req.user.id);
      res.status(201).json({
        success: true,
        data: event
      });
    } catch (err) {
      next(err);
    }
  },

  async updateEvent(req, res, next) {
    try {
      const { id } = req.params;
      const event = await AdminService.updateEvent(id, req.body);
      res.json({
        success: true,
        data: event
      });
    } catch (err) {
      next(err);
    }
  },

  async publishEvent(req, res, next) {
    try {
      const { id } = req.params;
      const event = await AdminService.publishEvent(id);
      res.json({
        success: true,
        data: event
      });
    } catch (err) {
      next(err);
    }
  },

  async cancelEvent(req, res, next) {
    try {
      const { id } = req.params;
      const event = await AdminService.cancelEvent(id);
      res.json({
        success: true,
        data: event
      });
    } catch (err) {
      next(err);
    }
  },

  async getParticipants(req, res, next) {
    try {
      const { id } = req.params;
      const participants = await AdminService.getEventParticipants(id);
      res.json({
        success: true,
        data: participants
      });
    } catch (err) {
      next(err);
    }
  }
};
