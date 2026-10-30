-- Run in the Supabase SQL editor after reviewing the target project.
-- Never replace an existing, incompatible table or discard historical data.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.attendance_records') IS NOT NULL AND (
    (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'attendance_records') <> 6
    OR EXISTS (
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'attendance_records'
      AND column_name NOT IN ('id', 'session_id', 'student_name', 'status', 'attendance_date', 'published_at')
    )
  ) THEN
    RAISE EXCEPTION 'Existing attendance_records has a different schema. Review a data-preserving migration before proceeding.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.attendance_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id UUID NOT NULL,
  student_name TEXT NOT NULL CHECK (length(btrim(student_name)) BETWEEN 1 AND 200),
  status TEXT NOT NULL CHECK (status IN ('Present', 'Absent')),
  attendance_date DATE NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_name)
);
CREATE INDEX IF NOT EXISTS attendance_history_student_date_idx
  ON public.attendance_records (student_name, attendance_date DESC, published_at DESC);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
-- No browser role gets direct table access, even if old policies exist.
REVOKE ALL ON public.attendance_records FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.attendance_records_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.attendance_records_id_seq TO service_role;

-- One transaction replaces a whole session; concurrent retries are serialized.
-- Invoker security: only the protected server may execute this function.
CREATE OR REPLACE FUNCTION public.publish_attendance_session(
  p_session_id UUID, p_attendance_date DATE, p_records JSONB
) RETURNS TABLE (saved_count BIGINT, publication_time TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  stamp TIMESTAMPTZ;
BEGIN
  IF p_session_id IS NULL OR p_attendance_date IS NULL
    OR jsonb_typeof(p_records) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid attendance session' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_records) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Invalid attendance record count' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(p_records) AS r(student_name TEXT, status TEXT)
    WHERE student_name IS NULL OR length(btrim(student_name)) NOT BETWEEN 1 AND 200
      OR status IS NULL OR status NOT IN ('Present', 'Absent'))
    OR EXISTS (SELECT 1 FROM jsonb_to_recordset(p_records) AS r(student_name TEXT)
      GROUP BY btrim(student_name) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Invalid or duplicate attendance records' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_session_id::TEXT, 0));
  stamp := clock_timestamp();
  INSERT INTO public.attendance_records (session_id, student_name, status, attendance_date, published_at)
    SELECT p_session_id, btrim(r.student_name), r.status, p_attendance_date, stamp
    FROM jsonb_to_recordset(p_records) AS r(student_name TEXT, status TEXT)
    ON CONFLICT (session_id, student_name) DO UPDATE SET
      status = EXCLUDED.status, attendance_date = EXCLUDED.attendance_date,
      published_at = EXCLUDED.published_at;
  DELETE FROM public.attendance_records AS a
    WHERE a.session_id = p_session_id AND NOT EXISTS (
      SELECT 1 FROM jsonb_to_recordset(p_records) AS r(student_name TEXT)
      WHERE btrim(r.student_name) = a.student_name
    );
  RETURN QUERY SELECT count(*), stamp FROM public.attendance_records a
    WHERE a.session_id = p_session_id;
END $$;
REVOKE ALL ON FUNCTION public.publish_attendance_session(UUID, DATE, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_attendance_session(UUID, DATE, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.attendance_student_names()
RETURNS TABLE (student_name TEXT)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp AS $$
  SELECT DISTINCT a.student_name FROM public.attendance_records a ORDER BY a.student_name;
$$;
REVOKE ALL ON FUNCTION public.attendance_student_names() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_student_names() TO service_role;
COMMIT;
