import { EventsService } from './events.service.js';
import { RegistrationService } from './registration.service.js';

export const AdminService = {
  /**
   * Aggregate executive statistics
   */
  async getSummaryMetrics() {
    const events = await EventsService.getAllEvents({ status: 'ALL' });
    let totalCapacity = 0;
    let totalConfirmed = 0;
    let totalWaitlisted = 0;

    events.forEach(e => {
      totalCapacity += (e.capacity || 0);
      totalConfirmed += (e.confirmed_count || 0);
      totalWaitlisted += (e.waitlist_count || 0);
    });

    const utilizationRate = totalCapacity > 0 
      ? Math.round((totalConfirmed / totalCapacity) * 100) 
      : 0;

    return {
      totalEvents: events.length,
      publishedEvents: events.filter(e => e.status === 'PUBLISHED').length,
      totalCapacity,
      totalConfirmed,
      totalWaitlisted,
      utilizationRate
    };
  },

  /**
   * Create an event with administrative privileges
   */
  async createEvent(eventData, adminUserId) {
    return EventsService.createEvent(eventData, adminUserId);
  },

  /**
   * Update event details and capacity
   */
  async updateEvent(id, updateData) {
    const existing = await EventsService.getEventById(id);
    if (!existing) {
      const err = new Error('Event not found.');
      err.status = 404;
      err.code = 'EVENT_NOT_FOUND';
      throw err;
    }

    if (updateData.capacity !== undefined) {
      const newCap = parseInt(updateData.capacity, 10);
      if (newCap < existing.confirmed_count) {
        const err = new Error(`Cannot reduce capacity to ${newCap}. There are currently ${existing.confirmed_count} confirmed attendees.`);
        err.status = 400;
        err.code = 'CAPACITY_TOO_LOW';
        throw err;
      }
    }

    return EventsService.updateEvent(id, updateData);
  },

  /**
   * Publish a draft event
   */
  async publishEvent(id) {
    return EventsService.updateEvent(id, { status: 'PUBLISHED' });
  },

  /**
   * Cancel an event
   */
  async cancelEvent(id) {
    return EventsService.updateEvent(id, { status: 'CANCELLED' });
  },

  /**
   * Retrieve participant rosters for an event
   */
  async getEventParticipants(eventId) {
    const event = await EventsService.getEventById(eventId);
    if (!event) {
      const err = new Error('Event not found.');
      err.status = 404;
      err.code = 'EVENT_NOT_FOUND';
      throw err;
    }

    const allRegistrations = await RegistrationService.getEventParticipants(eventId);

    const confirmed = allRegistrations
      .filter(r => r.status === 'CONFIRMED')
      .map(r => ({
        id: r.id,
        userId: r.user_id,
        fullName: r.full_name || r.profiles?.full_name || 'Student',
        email: r.email || r.profiles?.email,
        confirmedAt: r.confirmed_at || r.registered_at,
        status: r.status
      }));

    const waitlist = allRegistrations
      .filter(r => r.status === 'WAITLISTED')
      .sort((a, b) => a.waitlist_number - b.waitlist_number)
      .map((r, index) => ({
        id: r.id,
        userId: r.user_id,
        fullName: r.full_name || r.profiles?.full_name || 'Student',
        email: r.email || r.profiles?.email,
        waitlistNumber: r.waitlist_number,
        queueRank: index + 1,
        waitlistedAt: r.waitlisted_at || r.registered_at,
        status: r.status
      }));

    return {
      event: {
        id: event.id,
        title: event.title,
        capacity: event.capacity,
        status: event.status
      },
      confirmed,
      waitlist
    };
  }
};
