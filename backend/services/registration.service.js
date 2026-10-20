import { supabase } from '../middleware/authenticate.js';
import { HashTable } from '../dsa/HashTable.js';
import { Queue } from '../dsa/Queue.js';
import { EventsService } from './events.service.js';

// Global In-Memory DSA Instances
// 1. Hash Table for O(1) duplicate checks (composite key eventId:userId)
const duplicateHashTable = new HashTable(256);

// 2. Queues mapped by eventId
const eventQueues = new Map();

// Local Memory Store for Registrations (fallback for local dev)
let registrationsMemory = [
  // Seed with initial waitlist and confirmed attendees matching seed events
  {
    id: 'reg_01',
    event_id: 'e0a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b01',
    user_id: 'usr_student_01',
    full_name: 'Priya Sharma',
    email: 'priya.sharma@college.edu',
    status: 'CONFIRMED',
    registered_at: '2026-10-18T10:00:00Z',
    confirmed_at: '2026-10-18T10:00:00Z'
  },
  {
    id: 'reg_02',
    event_id: 'e0a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b01',
    user_id: 'usr_student_02',
    full_name: 'Alex Mercer',
    email: 'alex.mercer@college.edu',
    status: 'WAITLISTED',
    waitlist_number: 1,
    registered_at: '2026-10-18T12:00:00Z',
    waitlisted_at: '2026-10-18T12:00:00Z'
  }
];

// Prime Hash Table with seed registrations
registrationsMemory.forEach(r => {
  duplicateHashTable.set(`${r.event_id}:${r.user_id}`, { status: r.status, id: r.id });
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const RegistrationService = {
  /**
   * Register a student for an event
   */
  async register(eventId, user) {
    const compositeKey = `${eventId}:${user.id}`;

    // 1. In-Memory Hash Table Pre-flight Duplicate Check (O(1))
    if (duplicateHashTable.has(compositeKey)) {
      const existing = duplicateHashTable.get(compositeKey);
      if (existing.status === 'CONFIRMED' || existing.status === 'WAITLISTED') {
        const error = new Error('You already hold an active confirmed or waitlisted seat for this event.');
        error.status = 409;
        error.code = 'DUPLICATE_REGISTRATION';
        throw error;
      }
    }

    // 2. Execute Registration via Supabase if UUIDs are present
    if (supabase && UUID_REGEX.test(eventId) && UUID_REGEX.test(user.id)) {
      try {
        const { data, error } = await supabase.rpc('register_for_event', {
          p_event_id: eventId,
          p_user_id: user.id
        });

        if (!error && data) {
          if (!data.success) {
            const err = new Error(data.message || 'Registration failed.');
            err.status = data.error === 'DUPLICATE_REGISTRATION' ? 409 : 400;
            err.code = data.error;
            throw err;
          }

          // Update Hash Table cache
          duplicateHashTable.set(compositeKey, { status: data.status });
          return data;
        }
      } catch (err) {
        if (err.status) throw err;
        console.warn('Supabase register_for_event error, executing local ACID fallback:', err.message);
      }
    }

    // Local In-Memory ACID Simulation
    const event = await EventsService.getEventById(eventId);
    if (!event) {
      const err = new Error('Event not found.');
      err.status = 404;
      err.code = 'EVENT_NOT_FOUND';
      throw err;
    }

    // Active confirmed registrations count
    const activeConfirmed = registrationsMemory.filter(
      r => r.event_id === eventId && r.status === 'CONFIRMED'
    );

    if (activeConfirmed.length < event.capacity) {
      // Confirmed Registration
      const reg = {
        id: 'reg_' + Math.random().toString(36).substr(2, 9),
        event_id: eventId,
        user_id: user.id,
        full_name: user.full_name || 'Student',
        email: user.email,
        status: 'CONFIRMED',
        registered_at: new Date().toISOString(),
        confirmed_at: new Date().toISOString()
      };

      registrationsMemory.push(reg);
      duplicateHashTable.set(compositeKey, { status: 'CONFIRMED', id: reg.id });

      return {
        success: true,
        status: 'CONFIRMED',
        waitlistPosition: null,
        message: 'Seat confirmed! You are registered.'
      };
    } else {
      // Enqueue into FIFO Waitlist
      const activeWaitlist = registrationsMemory.filter(
        r => r.event_id === eventId && r.status === 'WAITLISTED'
      );

      const nextNum = activeWaitlist.length + 1;
      const reg = {
        id: 'reg_' + Math.random().toString(36).substr(2, 9),
        event_id: eventId,
        user_id: user.id,
        full_name: user.full_name || 'Student',
        email: user.email,
        status: 'WAITLISTED',
        waitlist_number: nextNum,
        registered_at: new Date().toISOString(),
        waitlisted_at: new Date().toISOString()
      };

      registrationsMemory.push(reg);
      duplicateHashTable.set(compositeKey, { status: 'WAITLISTED', id: reg.id });

      // Maintain in Queue data structure
      if (!eventQueues.has(eventId)) {
        eventQueues.set(eventId, new Queue());
      }
      eventQueues.get(eventId).enqueue(reg);

      return {
        success: true,
        status: 'WAITLISTED',
        waitlistPosition: nextNum,
        message: `Event is full. You are #${nextNum} on the waiting list.`
      };
    }
  },

  /**
   * Cancel an active registration and atomically promote earliest waitlist peer
   */
  async cancel(eventId, user) {
    const compositeKey = `${eventId}:${user.id}`;

    if (supabase && UUID_REGEX.test(eventId) && UUID_REGEX.test(user.id)) {
      try {
        const { data, error } = await supabase.rpc('cancel_registration', {
          p_event_id: eventId,
          p_user_id: user.id
        });
        if (!error && data) {
          if (!data.success) {
            const err = new Error(data.message || 'Cancellation failed.');
            err.status = 400;
            err.code = data.error;
            throw err;
          }

          duplicateHashTable.delete(compositeKey);
          return data;
        }
      } catch (err) {
        if (err.status) throw err;
        console.warn('Supabase cancel_registration error, executing local fallback:', err.message);
      }
    }

    const index = registrationsMemory.findIndex(
      r => r.event_id === eventId && r.user_id === user.id && r.status !== 'CANCELLED'
    );

    if (index === -1) {
      const err = new Error('No active registration found to cancel.');
      err.status = 404;
      err.code = 'NOT_REGISTERED';
      throw err;
    }

    const existingReg = registrationsMemory[index];
    const wasConfirmed = existingReg.status === 'CONFIRMED';

    existingReg.status = 'CANCELLED';
    existingReg.cancelled_at = new Date().toISOString();
    duplicateHashTable.delete(compositeKey);

    let promotedUser = null;

    // If attendee was confirmed, promote first person in FIFO waitlist
    if (wasConfirmed) {
      const waitlist = registrationsMemory
        .filter(r => r.event_id === eventId && r.status === 'WAITLISTED')
        .sort((a, b) => a.waitlist_number - b.waitlist_number);

      if (waitlist.length > 0) {
        const toPromote = waitlist[0];
        toPromote.status = 'CONFIRMED';
        toPromote.confirmed_at = new Date().toISOString();
        promotedUser = toPromote.user_id;

        // Update hash table cache for promoted student
        duplicateHashTable.set(`${eventId}:${toPromote.user_id}`, { status: 'CONFIRMED', id: toPromote.id });
      }
    }

    return {
      success: true,
      status: 'CANCELLED',
      promotedUserId: promotedUser,
      message: 'Registration cancelled successfully.'
    };
  },

  /**
   * Retrieve registrations for the active student
   */
  async getUserRegistrations(userId) {
    if (supabase && UUID_REGEX.test(userId)) {
      try {
        const { data, error } = await supabase
          .from('registrations')
          .select('*, events(*)')
          .eq('user_id', userId)
          .order('registered_at', { ascending: false });
        if (!error && Array.isArray(data)) return data;
      } catch (err) {
        console.warn('Supabase getUserRegistrations error, checking memory store:', err.message);
      }
    }

    const userRegs = registrationsMemory.filter(r => r.user_id === userId);
    const results = [];

    for (const reg of userRegs) {
      const event = await EventsService.getEventById(reg.event_id);
      let queueRank = null;

      if (reg.status === 'WAITLISTED') {
        const waitlist = registrationsMemory
          .filter(r => r.event_id === reg.event_id && r.status === 'WAITLISTED' && r.waitlist_number <= reg.waitlist_number);
        queueRank = waitlist.length;
      }

      results.push({
        ...reg,
        events: event,
        queueRank
      });
    }

    return results;
  },

  /**
   * Retrieve participant rosters for an event (Admin action)
   */
  async getEventParticipants(eventId) {
    if (supabase && UUID_REGEX.test(eventId)) {
      try {
        const { data, error } = await supabase
          .from('registrations')
          .select('*, profiles(full_name, email)')
          .eq('event_id', eventId);
        if (!error && Array.isArray(data)) return data;
      } catch (err) {
        console.warn('Supabase getEventParticipants error, checking memory store:', err.message);
      }
    }

    return registrationsMemory.filter(r => r.event_id === eventId);
  }
};
