import { supabase } from '../middleware/authenticate.js';
import { mergeSort, Comparators } from '../dsa/mergeSort.js';

// Realistic Academic Seed Events
const SEED_EVENTS = [
  {
    id: 'e0a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b01',
    title: 'Autonomous Robotics Hackathon 2026',
    description: 'Build and race autonomous line-following and obstacle-navigating robots in our 24-hour hardware hackathon. Materials and microcontrollers provided.',
    category: 'Hackathon',
    venue: 'Campus Innovation Lab A & B',
    starts_at: '2026-11-14T09:00:00Z',
    ends_at: '2026-11-15T09:00:00Z',
    capacity: 4, // Intentionally small to easily demonstrate waitlist overflow!
    confirmed_count: 4,
    waitlist_count: 2,
    status: 'PUBLISHED',
    created_by: 'usr_admin_01'
  },
  {
    id: 'e0a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b02',
    title: 'Generative AI & LLM Systems Workshop',
    description: 'Deep dive into transformer architectures, local model quantization with llama.cpp, and building agentic workflows with Antigravity.',
    category: 'Workshop',
    venue: 'Turing Auditorium (Room 402)',
    starts_at: '2026-11-18T14:00:00Z',
    ends_at: '2026-11-18T17:30:00Z',
    capacity: 40,
    confirmed_count: 28,
    waitlist_count: 0,
    status: 'PUBLISHED',
    created_by: 'usr_admin_01'
  },
  {
    id: 'e0a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b03',
    title: 'PulseFest: Annual Battle of the Bands',
    description: 'The premier college musical competition featuring live indie, rock, and fusion performances from 12 university bands.',
    category: 'Cultural',
    venue: 'Open Air Amphitheatre',
    starts_at: '2026-11-21T18:00:00Z',
    ends_at: '2026-11-21T23:00:00Z',
    capacity: 250,
    confirmed_count: 215,
    waitlist_count: 0,
    status: 'PUBLISHED',
    created_by: 'usr_admin_01'
  },
  {
    id: 'e0a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b04',
    title: 'Inter-College Rapid Chess Championship',
    description: 'FIDE-rated blitz and rapid tournament with live digital board broadcasts. Open to all registered students.',
    category: 'Sports',
    venue: 'Student Recreation Complex',
    starts_at: '2026-11-25T10:00:00Z',
    ends_at: '2026-11-25T16:00:00Z',
    capacity: 32,
    confirmed_count: 32,
    waitlist_count: 5,
    status: 'PUBLISHED',
    created_by: 'usr_admin_01'
  },
  {
    id: 'e0a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b05',
    title: 'Campus Shark Tank: Venture Pitch 2026',
    description: 'Pitch your startup prototype to prominent venture capitalists and alumni angel investors. Seed grant funding pool of $25,000.',
    category: 'Entrepreneurship',
    venue: 'Executive Seminar Hall',
    starts_at: '2026-12-02T11:00:00Z',
    ends_at: '2026-12-02T15:00:00Z',
    capacity: 60,
    confirmed_count: 42,
    waitlist_count: 0,
    status: 'PUBLISHED',
    created_by: 'usr_admin_01'
  },
  {
    id: 'e0a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b06',
    title: 'Quantum Computing Fundamentals & Qiskit',
    description: 'Introductory hands-on laboratory exploring superposition, entanglement, and quantum gate circuits using IBM Quantum Composer.',
    category: 'Technical',
    venue: 'Physics Computing Lab 3',
    starts_at: '2026-12-08T15:00:00Z',
    ends_at: '2026-12-08T18:00:00Z',
    capacity: 25,
    confirmed_count: 12,
    waitlist_count: 0,
    status: 'PUBLISHED',
    created_by: 'usr_admin_01'
  }
];

// Persistent Memory Store for Local Dev
let eventsMemory = [...SEED_EVENTS];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const EventsService = {
  /**
   * Retrieve all events with optional category and keyword filters
   */
  async getAllEvents({ category, search, status = 'PUBLISHED', sortBy = 'byDateAscending' } = {}) {
    if (supabase) {
      try {
        let query = supabase.from('events').select('*, registrations(status)');
        if (status && status !== 'ALL') query = query.eq('status', status);
        if (category && category !== 'All') query = query.eq('category', category);
        if (search) query = query.ilike('title', `%${search}%`);

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          // Calculate live counts
          const events = data.map(evt => {
            const confirmed = (evt.registrations || []).filter(r => r.status === 'CONFIRMED').length;
            const waitlist = (evt.registrations || []).filter(r => r.status === 'WAITLISTED').length;
            return {
              ...evt,
              confirmed_count: confirmed,
              waitlist_count: waitlist
            };
          });

          const comparator = Comparators[sortBy] || Comparators.byDateAscending;
          return mergeSort(events, comparator);
        }
      } catch (err) {
        console.warn('Supabase query error, falling back to local store:', err.message);
      }
    }

    // In-Memory fallback store
    let filtered = [...eventsMemory];
    if (status && status !== 'ALL') {
      filtered = filtered.filter(e => e.status === status);
    }
    if (category && category !== 'All') {
      filtered = filtered.filter(e => e.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(e => 
        e.title.toLowerCase().includes(q) || 
        e.description.toLowerCase().includes(q) || 
        e.venue.toLowerCase().includes(q)
      );
    }

    const comparator = Comparators[sortBy] || Comparators.byDateAscending;
    return mergeSort(filtered, comparator);
  },

  /**
   * Retrieve single event by UUID
   */
  async getEventById(id) {
    if (supabase && UUID_REGEX.test(id)) {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*, registrations(id, user_id, status, waitlist_number)')
          .eq('id', id)
          .single();
        if (!error && data) {
          const confirmed = (data.registrations || []).filter(r => r.status === 'CONFIRMED').length;
          const waitlist = (data.registrations || []).filter(r => r.status === 'WAITLISTED').length;

          return {
            ...data,
            confirmed_count: confirmed,
            waitlist_count: waitlist
          };
        }
      } catch (err) {
        console.warn('Supabase getEventById error, checking memory store:', err.message);
      }
    }

    const event = eventsMemory.find(e => e.id === id);
    if (!event) return null;
    return { ...event };
  },

  /**
   * Create a new event (Administrator action)
   */
  async createEvent(eventData, adminUserId) {
    const memoryId = eventData.id || 'evt_' + Math.random().toString(36).substr(2, 9);
    const newEvent = {
      id: memoryId,
      title: eventData.title,
      description: eventData.description || '',
      category: eventData.category || 'General',
      venue: eventData.venue,
      starts_at: eventData.starts_at,
      ends_at: eventData.ends_at || null,
      capacity: parseInt(eventData.capacity, 10),
      status: eventData.status || 'PUBLISHED',
      confirmed_count: 0,
      waitlist_count: 0,
      created_by: adminUserId,
      created_at: new Date().toISOString()
    };

    if (supabase) {
      try {
        const payload = {
          title: newEvent.title,
          description: newEvent.description,
          category: newEvent.category,
          venue: newEvent.venue,
          starts_at: newEvent.starts_at,
          ends_at: newEvent.ends_at,
          capacity: newEvent.capacity,
          status: newEvent.status
        };
        if (adminUserId && UUID_REGEX.test(adminUserId)) {
          payload.created_by = adminUserId;
        }
        if (eventData.id && UUID_REGEX.test(eventData.id)) {
          payload.id = eventData.id;
        }

        const { data, error } = await supabase.from('events').insert([payload]).select().single();
        if (!error && data) {
          return { ...data, confirmed_count: 0, waitlist_count: 0 };
        }
      } catch (err) {
        console.warn('Supabase createEvent failed, using memory store:', err.message);
      }
    }

    eventsMemory.unshift(newEvent);
    return newEvent;
  },

  /**
   * Update an event's details and capacity
   */
  async updateEvent(id, updateData) {
    if (supabase && UUID_REGEX.test(id)) {
      try {
        const { data, error } = await supabase
          .from('events')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Supabase updateEvent error, updating memory store:', err.message);
      }
    }

    const index = eventsMemory.findIndex(e => e.id === id);
    if (index === -1) return null;
    eventsMemory[index] = { ...eventsMemory[index], ...updateData };
    return eventsMemory[index];
  }
};
