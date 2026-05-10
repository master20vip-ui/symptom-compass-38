
-- Health metrics: per-user daily logs
CREATE TABLE public.health_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recorded_on DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,2),
  height_cm NUMERIC(5,2),
  water_ml INTEGER,
  sleep_hours NUMERIC(4,2),
  steps INTEGER,
  mood SMALLINT CHECK (mood BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_health_metrics_user_date ON public.health_metrics(user_id, recorded_on DESC);

ALTER TABLE public.health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own metrics select" ON public.health_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own metrics insert" ON public.health_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own metrics update" ON public.health_metrics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own metrics delete" ON public.health_metrics FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_health_metrics_updated
BEFORE UPDATE ON public.health_metrics
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Disease pages: shared cache, world-readable, only authenticated users insert
CREATE TABLE public.disease_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  overview TEXT NOT NULL,
  causes TEXT NOT NULL,
  symptoms TEXT NOT NULL,
  home_remedies TEXT NOT NULL,
  when_to_see_doctor TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_disease_pages_name ON public.disease_pages USING GIN (to_tsvector('english', name));

ALTER TABLE public.disease_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disease pages public read" ON public.disease_pages FOR SELECT USING (true);
CREATE POLICY "auth users can create disease pages" ON public.disease_pages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE TRIGGER trg_disease_pages_updated
BEFORE UPDATE ON public.disease_pages
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
