-- ============================================================================
-- CAMPUSPULSE: COMPLETE DATABASE INITIALIZATION SCRIPT
-- Paste this entire script into your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/bzuwuroaidbroeshcnzw/sql
-- ============================================================================

-- 1. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- 2. EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  venue TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED')),
  registration_deadline TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  next_waitlist_number BIGINT NOT NULL DEFAULT 1 CHECK (next_waitlist_number >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT valid_event_time CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

-- 3. REGISTRATIONS TABLE
CREATE TABLE IF NOT EXISTS public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('CONFIRMED', 'WAITLISTED', 'CANCELLED')),
  registered_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  confirmed_at TIMESTAMPTZ,
  waitlisted_at TIMESTAMPTZ,
  waitlist_number BIGINT,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  CONSTRAINT unique_event_user_registration UNIQUE (event_id, user_id)
);

-- 4. PERFORMANCE & CONCURRENCY INDEXES
CREATE INDEX IF NOT EXISTS idx_registrations_event_status ON public.registrations(event_id, status);
CREATE INDEX IF NOT EXISTS idx_registrations_user_status ON public.registrations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_registrations_waitlist ON public.registrations(event_id, waitlist_number) WHERE status = 'WAITLISTED';
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON public.events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events(status);

-- 5. NEW USER TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Student'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. ATOMIC REGISTRATION RPC
CREATE OR REPLACE FUNCTION public.register_for_event(p_event_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event RECORD;
  v_confirmed_count INTEGER;
  v_assigned_waitlist_num BIGINT;
  v_existing RECORD;
BEGIN
  -- Acquire exclusive row lock on target event
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'EVENT_NOT_FOUND', 'message', 'Event does not exist.');
  END IF;

  IF v_event.status <> 'PUBLISHED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'EVENT_NOT_OPEN', 'message', 'Event is not accepting registrations.');
  END IF;

  -- Check existing active registration
  SELECT * INTO v_existing FROM public.registrations WHERE event_id = p_event_id AND user_id = p_user_id;
  
  IF FOUND AND v_existing.status IN ('CONFIRMED', 'WAITLISTED') THEN
    RETURN jsonb_build_object('success', false, 'error', 'DUPLICATE_REGISTRATION', 'message', 'You are already registered for this event.');
  END IF;

  -- Count confirmed attendees
  SELECT COUNT(*) INTO v_confirmed_count FROM public.registrations 
  WHERE event_id = p_event_id AND status = 'CONFIRMED';

  IF v_confirmed_count < v_event.capacity THEN
    -- Allocate Confirmed Seat
    IF FOUND AND v_existing.status = 'CANCELLED' THEN
      UPDATE public.registrations 
      SET status = 'CONFIRMED', confirmed_at = NOW(), cancelled_at = NULL, updated_at = NOW()
      WHERE id = v_existing.id;
    ELSE
      INSERT INTO public.registrations (event_id, user_id, status, confirmed_at)
      VALUES (p_event_id, p_user_id, 'CONFIRMED', NOW());
    END IF;

    RETURN jsonb_build_object('success', true, 'status', 'CONFIRMED', 'waitlistPosition', null);
  ELSE
    -- Place in FIFO Waiting List
    v_assigned_waitlist_num := v_event.next_waitlist_number;
    
    UPDATE public.events 
    SET next_waitlist_number = next_waitlist_number + 1, updated_at = NOW()
    WHERE id = p_event_id;

    IF FOUND AND v_existing.status = 'CANCELLED' THEN
      UPDATE public.registrations 
      SET status = 'WAITLISTED', waitlist_number = v_assigned_waitlist_num, waitlisted_at = NOW(), cancelled_at = NULL, updated_at = NOW()
      WHERE id = v_existing.id;
    ELSE
      INSERT INTO public.registrations (event_id, user_id, status, waitlist_number, waitlisted_at)
      VALUES (p_event_id, p_user_id, 'WAITLISTED', v_assigned_waitlist_num, NOW());
    END IF;

    RETURN jsonb_build_object('success', true, 'status', 'WAITLISTED', 'waitlistPosition', v_assigned_waitlist_num);
  END IF;
END;
$$;

-- 7. ATOMIC CANCELLATION & PROMOTION RPC
CREATE OR REPLACE FUNCTION public.cancel_registration(p_event_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg RECORD;
  v_next_waitlisted RECORD;
BEGIN
  -- Locate active registration
  SELECT * INTO v_reg FROM public.registrations 
  WHERE event_id = p_event_id AND user_id = p_user_id AND status IN ('CONFIRMED', 'WAITLISTED')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_REGISTERED', 'message', 'No active registration found to cancel.');
  END IF;

  -- Cancel the seat
  UPDATE public.registrations 
  SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
  WHERE id = v_reg.id;

  -- If attendee was confirmed, promote earliest waitlist candidate in FIFO order
  IF v_reg.status = 'CONFIRMED' THEN
    SELECT * INTO v_next_waitlisted FROM public.registrations
    WHERE event_id = p_event_id AND status = 'WAITLISTED'
    ORDER BY waitlist_number ASC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.registrations
      SET status = 'CONFIRMED', confirmed_at = NOW(), updated_at = NOW()
      WHERE id = v_next_waitlisted.id;

      RETURN jsonb_build_object(
        'success', true, 
        'status', 'CANCELLED',
        'promotedUserId', v_next_waitlisted.user_id,
        'message', 'Registration cancelled and earliest waitlist candidate promoted.'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'CANCELLED', 'promotedUserId', null, 'message', 'Registration cancelled.');
END;
$$;

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can view names/roles; users can update their own
CREATE POLICY "Public profiles are viewable by all authenticated users"
ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Events: Everyone can view published events
CREATE POLICY "Anyone can view published events"
ON public.events FOR SELECT USING (true);

CREATE POLICY "Admins can insert events"
ON public.events FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update events"
ON public.events FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Registrations: Users can view their own; Admins can view all
CREATE POLICY "Users can view own registrations"
ON public.registrations FOR SELECT TO authenticated
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 9. SEED REALISTIC EVENTS
INSERT INTO public.events (id, title, description, category, venue, starts_at, ends_at, capacity, status)
VALUES
  ('e0a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b01', 'Autonomous Robotics Hackathon 2026', 'Build and race autonomous line-following and obstacle-navigating robots in our 24-hour hardware hackathon. Materials and microcontrollers provided.', 'Hackathon', 'Campus Innovation Lab A & B', NOW() + INTERVAL '10 days', NOW() + INTERVAL '11 days', 4, 'PUBLISHED'),
  ('e0a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b02', 'Generative AI & LLM Systems Workshop', 'Deep dive into transformer architectures, local model quantization with llama.cpp, and building agentic workflows with Antigravity.', 'Workshop', 'Turing Auditorium (Room 402)', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days 3 hours', 40, 'PUBLISHED'),
  ('e0a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b03', 'PulseFest: Annual Battle of the Bands', 'The premier college musical competition featuring live indie, rock, and fusion performances from 12 university bands.', 'Cultural', 'Open Air Amphitheatre', NOW() + INTERVAL '17 days', NOW() + INTERVAL '17 days 5 hours', 250, 'PUBLISHED'),
  ('e0a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b04', 'Inter-College Rapid Chess Championship', 'FIDE-rated blitz and rapid tournament with live digital board broadcasts. Open to all registered students.', 'Sports', 'Student Recreation Complex', NOW() + INTERVAL '21 days', NOW() + INTERVAL '21 days 6 hours', 32, 'PUBLISHED'),
  ('e0a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b05', 'Campus Startup Pitch & Venture Showcase', 'Present early-stage tech ideas to angel investors and venture alumni. Up to $10,000 in non-dilutive grant prizes.', 'Entrepreneurship', 'Business School Boardroom', NOW() + INTERVAL '25 days', NOW() + INTERVAL '25 days 4 hours', 60, 'PUBLISHED'),
  ('e0a1b2c3-4d5e-6f7a-8b9c-0d1e2f3a4b06', 'High-Performance Web & Cloud Architecture', 'Master distributed caching with Redis, reverse proxies with Nginx, and cloud event streams with PostgreSQL CDC.', 'Technical', 'Lecture Hall 101', NOW() + INTERVAL '28 days', NOW() + INTERVAL '28 days 2 hours', 80, 'PUBLISHED')
ON CONFLICT (id) DO NOTHING;
