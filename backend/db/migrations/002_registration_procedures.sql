-- ============================================================================
-- CampusPulse Atomic Concurrency Procedures (Stored RPCs)
-- Prevents race conditions during final-seat claims and simultaneous cancellations
-- Authoritative Reference: docs/DATABASE_AND_API.md
-- ============================================================================

-- 1. ATOMIC REGISTRATION RPC
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

    -- Calculate dynamic 1-based queue rank
    SELECT COUNT(*) INTO v_confirmed_count FROM public.registrations
    WHERE event_id = p_event_id AND status = 'WAITLISTED' AND waitlist_number <= v_assigned_waitlist_num;

    RETURN jsonb_build_object('success', true, 'status', 'WAITLISTED', 'waitlistPosition', v_confirmed_count);
  END IF;
END;
$$;

-- 2. ATOMIC CANCELLATION RPC
CREATE OR REPLACE FUNCTION public.cancel_registration(p_event_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg RECORD;
  v_next_waitlist RECORD;
BEGIN
  -- Acquire row lock on event to serialize seat transfers
  PERFORM 1 FROM public.events WHERE id = p_event_id FOR UPDATE;

  SELECT * INTO v_reg FROM public.registrations 
  WHERE event_id = p_event_id AND user_id = p_user_id AND status IN ('CONFIRMED', 'WAITLISTED');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NOT_REGISTERED', 'message', 'No active registration found to cancel.');
  END IF;

  -- Mark current as cancelled
  UPDATE public.registrations 
  SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
  WHERE id = v_reg.id;

  -- If attendee was CONFIRMED, promote earliest waitlisted peer
  IF v_reg.status = 'CONFIRMED' THEN
    SELECT * INTO v_next_waitlist FROM public.registrations 
    WHERE event_id = p_event_id AND status = 'WAITLISTED'
    ORDER BY waitlist_number ASC
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.registrations 
      SET status = 'CONFIRMED', confirmed_at = NOW(), updated_at = NOW()
      WHERE id = v_next_waitlist.id;

      RETURN jsonb_build_object('success', true, 'status', 'CANCELLED', 'promotedUserId', v_next_waitlist.user_id);
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'status', 'CANCELLED', 'promotedUserId', null);
END;
$$;
