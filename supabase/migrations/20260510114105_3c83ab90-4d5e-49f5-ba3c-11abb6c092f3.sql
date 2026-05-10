
-- Enums
CREATE TYPE public.profile_relation AS ENUM ('self', 'child', 'parent', 'partner', 'other');
CREATE TYPE public.profile_sex AS ENUM ('male', 'female', 'other', 'unspecified');
CREATE TYPE public.medication_kind AS ENUM ('prescription', 'otc', 'supplement');

-- profiles_dependents
CREATE TABLE public.profiles_dependents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  relation profile_relation NOT NULL DEFAULT 'self',
  date_of_birth date,
  sex profile_sex NOT NULL DEFAULT 'unspecified',
  notes text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles_dependents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own dependents select" ON public.profiles_dependents FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "own dependents insert" ON public.profiles_dependents FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own dependents update" ON public.profiles_dependents FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "own dependents delete" ON public.profiles_dependents FOR DELETE USING (auth.uid() = owner_id);
CREATE TRIGGER trg_profiles_dependents_updated BEFORE UPDATE ON public.profiles_dependents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_profiles_dependents_owner ON public.profiles_dependents(owner_id);

-- medications
CREATE TABLE public.medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles_dependents(id) ON DELETE CASCADE,
  name text NOT NULL,
  dosage text,
  frequency text,
  kind medication_kind NOT NULL DEFAULT 'prescription',
  started_on date,
  ended_on date,
  notes text,
  common_side_effects text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own meds select" ON public.medications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own meds insert" ON public.medications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own meds update" ON public.medications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own meds delete" ON public.medications FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_medications_updated BEFORE UPDATE ON public.medications FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_medications_user_profile ON public.medications(user_id, profile_id);

-- symptom_logs
CREATE TABLE public.symptom_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles_dependents(id) ON DELETE CASCADE,
  symptom text NOT NULL,
  severity smallint NOT NULL DEFAULT 3,
  notes text,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.symptom_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own symptoms select" ON public.symptom_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own symptoms insert" ON public.symptom_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own symptoms update" ON public.symptom_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own symptoms delete" ON public.symptom_logs FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_symptom_logs_profile_symptom ON public.symptom_logs(profile_id, symptom, logged_at DESC);
