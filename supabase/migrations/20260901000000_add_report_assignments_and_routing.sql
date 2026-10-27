-- Create report_assignments table for tracking department assignments
CREATE TABLE IF NOT EXISTS public.report_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.civic_reports(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  
  -- Assignment metadata
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id), -- null if auto-assigned
  
  -- Assignment status
  assignment_status TEXT DEFAULT 'assigned' CHECK (assignment_status IN (
    'assigned',           -- Initially assigned to department
    'accepted',          -- Department accepted the report
    'in_progress',       -- Work started
    'resolved',          -- Work completed
    'transferred',       -- Transferred to another department
    'rejected'           -- Department rejected assignment
  )),
  
  -- Timestamps
  accepted_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  transferred_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.report_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for report_assignments
CREATE POLICY "Anyone can view assignments"
  ON public.report_assignments
  FOR SELECT
  USING (true);

CREATE POLICY "Only assigned department can update their assignment"
  ON public.report_assignments
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.department_users WHERE department_id = report_assignments.department_id
    )
    OR EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'super_admin')
  );

-- Create indexes
CREATE INDEX idx_report_assignments_report_id ON public.report_assignments(report_id);
CREATE INDEX idx_report_assignments_department_id ON public.report_assignments(department_id);
CREATE INDEX idx_report_assignments_status ON public.report_assignments(assignment_status);
CREATE INDEX idx_report_assignments_created_at ON public.report_assignments(created_at DESC);

-- Create report_history table for audit trail
CREATE TABLE IF NOT EXISTS public.report_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.civic_reports(id) ON DELETE CASCADE,
  
  -- Action details
  action TEXT NOT NULL, -- 'created', 'analyzed', 'assigned', 'accepted', 'progressed', 'resolved', etc
  previous_value JSONB,
  new_value JSONB,
  
  -- Actor info
  actor_id UUID REFERENCES auth.users(id),
  actor_type TEXT DEFAULT 'citizen', -- 'citizen', 'admin', 'system'
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.report_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view report history"
  ON public.report_history
  FOR SELECT
  USING (true);

CREATE POLICY "System can insert history"
  ON public.report_history
  FOR INSERT
  WITH CHECK (true);

-- Create index
CREATE INDEX idx_report_history_report_id ON public.report_history(report_id);
CREATE INDEX idx_report_history_created_at ON public.report_history(created_at DESC);

-- Update civic_reports table to include assignment tracking
ALTER TABLE public.civic_reports ADD COLUMN IF NOT EXISTS assigned_department_id UUID REFERENCES public.departments(id);
ALTER TABLE public.civic_reports ADD COLUMN IF NOT EXISTS is_auto_assigned BOOLEAN DEFAULT false;
ALTER TABLE public.civic_reports ADD COLUMN IF NOT EXISTS needs_admin_review BOOLEAN DEFAULT false;
ALTER TABLE public.civic_reports ADD COLUMN IF NOT EXISTS department_assignment_method TEXT;
ALTER TABLE public.civic_reports ADD COLUMN IF NOT EXISTS department_assignment_confidence DECIMAL(3,2);

-- Create index for department queries
CREATE INDEX IF NOT EXISTS idx_civic_reports_assigned_department ON public.civic_reports(assigned_department_id);
CREATE INDEX IF NOT EXISTS idx_civic_reports_needs_review ON public.civic_reports(needs_admin_review);

-- Create trigger for report_assignments update timestamp
CREATE OR REPLACE FUNCTION public.update_report_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_report_assignments_updated_at
  BEFORE UPDATE ON public.report_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_report_assignments_updated_at();
