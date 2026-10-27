-- Create civic_reports table
CREATE TABLE public.civic_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  image_url TEXT,
  user_description TEXT,
  location_data JSONB,
  
  -- AI-generated fields
  issue_category TEXT,
  severity TEXT CHECK (severity IN ('minor', 'moderate', 'critical')),
  priority_level TEXT CHECK (priority_level IN ('low', 'medium', 'high')),
  short_description TEXT,
  suggested_department TEXT,
  context_analysis TEXT,
  estimated_resolution_time TEXT,
  recommended_action TEXT,
  ai_confidence_score DECIMAL(3,2),
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved', 'rejected')),
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.civic_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for civic_reports
CREATE POLICY "Anyone can view all reports"
  ON public.civic_reports
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create reports"
  ON public.civic_reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reports"
  ON public.civic_reports
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_civic_reports_updated_at
  BEFORE UPDATE ON public.civic_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for report images
INSERT INTO storage.buckets (id, name, public)
VALUES ('civic-reports', 'civic-reports', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for report images
CREATE POLICY "Anyone can view report images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'civic-reports');

CREATE POLICY "Authenticated users can upload report images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'civic-reports' 
    AND auth.role() = 'authenticated'
  );

-- Create index for better query performance
CREATE INDEX idx_civic_reports_status ON public.civic_reports(status);
CREATE INDEX idx_civic_reports_created_at ON public.civic_reports(created_at DESC);