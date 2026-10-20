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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveUserId(user) {
  if (!user) return null;
  const id = typeof user === 'string' ? user : user.id;
  if (UUID_REGEX.test(id)) return id;
  // Map known demo accounts to their database UUIDs
  const email = typeof user === 'object' ? user.email : '';
  if (email === 'alex.mercer@college.edu' || id === 'usr_student_01' || id === 'usr_student_02') {
    return 'f09933af-ebef-4b75-8b76-5983c9056f23';
  }
  if (email === 'faculty.admin@college.edu' || id === 'usr_admin_01') {
    return '0101e9c0-1df6-4418-b34c-85788f15a24b';
  }
  return id;
}

export const RegistrationService = {
  /**
   * Register a student for an event
   */
  async register(eventId, user) {
    const effectiveUserId = resolveUserId(user);
    const compositeKey = `${eventId}:${effectiveUserId}`;
    const legacyKey = `${eventId}:${user.id}`;

    // 1. In-Memory Hash Table Pre-flight Duplicate Check (O(1))
    if (duplicateHashTable.has(compositeKey) || duplicateHashTable.has(legacyKey)) {
      const existing = duplicateHashTable.get(compositeKey) || duplicateHashTable.get(legacyKey);
      if (existing.status === 'CONFIRMED' || existing.status === 'WAITLISTED') {
        const error = new Error('You already hold an active confirmed or waitlisted seat for this event.');
        error.status = 409;
        error.code = 'DUPLICATE_REGISTRATION';
        throw error;
      }
    }

    // 2. Execute Registration via Supabase if UUIDs are present
    if (supabase && UUID_REGEX.test(eventId) && UUID_REGEX.test(effectiveUserId)) {
      try {
        const { data, error } = await supabase.rpc('register_for_event', {
          p_event_id: eventId,
          p_user_id: effectiveUserId
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
          duplicateHashTable.set(legacyKey, { status: data.status });

          // Also mirror in local memory store for instant responsiveness
          registrationsMemory = registrationsMemory.filter(r => !(r.event_id === eventId && (r.user_id === effectiveUserId || r.user_id === user.id)));
          registrationsMemory.push({
            id: 'reg_db_' + Math.random().toString(36).substr(2, 9),
            event_id: eventId,
            user_id: effectiveUserId,
            full_name: user.full_name || 'Student',
            email: user.email,
            status: data.status,
            waitlist_number: data.waitlistPosition || null,
            registered_at: new Date().toISOString(),
            confirmed_at: data.status === 'CONFIRMED' ? new Date().toISOString() : null,
            waitlisted_at: data.status === 'WAITLISTED' ? new Date().toISOString() : null
          });

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
    const effectiveUserId = resolveUserId(user);
    const compositeKey = `${eventId}:${effectiveUserId}`;
    const legacyKey = `${eventId}:${user.id}`;

    if (supabase && UUID_REGEX.test(eventId) && UUID_REGEX.test(effectiveUserId)) {
      try {
        const { data, error } = await supabase.rpc('cancel_registration', {
          p_event_id: eventId,
          p_user_id: effectiveUserId
        });
        if (!error && data) {
          if (!data.success) {
            const err = new Error(data.message || 'Cancellation failed.');
            err.status = 400;
            err.code = data.error;
            throw err;
          }

          duplicateHashTable.delete(compositeKey);
          duplicateHashTable.delete(legacyKey);
          registrationsMemory = registrationsMemory.filter(r => !(r.event_id === eventId && (r.user_id === effectiveUserId || r.user_id === user.id)));
          return data;
        }
      } catch (err) {
        if (err.status) throw err;
        console.warn('Supabase cancel_registration error, executing local fallback:', err.message);
      }
    }

    const index = registrationsMemory.findIndex(
      r => r.event_id === eventId && (r.user_id === effectiveUserId || r.user_id === user.id) && r.status !== 'CANCELLED'
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
    duplicateHashTable.delete(legacyKey);

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
    const effectiveUserId = resolveUserId(userId);
    let dbResults = [];

    if (supabase && UUID_REGEX.test(effectiveUserId)) {
      try {
        const { data, error } = await supabase
          .from('registrations')
          .select('*, events(*)')
          .eq('user_id', effectiveUserId)
          .neq('status', 'CANCELLED')
          .order('registered_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          dbResults = data.map(r => ({
            ...r,
            queueRank: r.waitlist_number || (r.status === 'WAITLISTED' ? 1 : null)
          }));
        }
      } catch (err) {
        console.warn('Supabase getUserRegistrations error, checking memory store:', err.message);
      }
    }

    // Combine with memory registrations
    const memoryRegs = registrationsMemory.filter(
      r => (r.user_id === effectiveUserId || r.user_id === userId) && r.status !== 'CANCELLED'
    );

    const combined = [...dbResults];
    for (const reg of memoryRegs) {
      if (!combined.some(c => c.event_id === reg.event_id)) {
        const event = await EventsService.getEventById(reg.event_id);
        let queueRank = null;

        if (reg.status === 'WAITLISTED') {
          const waitlist = registrationsMemory
            .filter(r => r.event_id === reg.event_id && r.status === 'WAITLISTED' && r.waitlist_number <= reg.waitlist_number);
          queueRank = waitlist.length;
        }

        combined.push({
          ...reg,
          events: event,
          queueRank
        });
      }
    }

    return combined;
  },

  /**
   * Retrieve participant rosters for an event (Admin action)
   */
  async getEventParticipants(eventId) {
    let dbParticipants = [];
    if (supabase && UUID_REGEX.test(eventId)) {
      try {
        const { data, error } = await supabase
          .from('registrations')
          .select('*, profiles(full_name, email)')
          .eq('event_id', eventId)
          .neq('status', 'CANCELLED');

        if (!error && Array.isArray(data)) {
          dbParticipants = data;
        }
      } catch (err) {
        console.warn('Supabase getEventParticipants error, checking memory store:', err.message);
      }
    }

    const memParticipants = registrationsMemory.filter(r => r.event_id === eventId && r.status !== 'CANCELLED');
    const combined = [...dbParticipants];
    for (const mem of memParticipants) {
      if (!combined.some(c => c.user_id === mem.user_id)) {
        combined.push(mem);
      }
    }

    return combined;
  }
};
