-- Add civic departments relevant to municipal issue reporting while preserving existing seeded rows.
-- The existing schema is public.departments(name, officer_name, contact_email, phone, description).

INSERT INTO public.departments (name, officer_name, contact_email, phone, description)
VALUES
  ('Drainage & Stormwater', 'Demo Officer', 'drainage.demo@civic.local', '+91-1800-000-006', 'Flooding, blocked drains, and stormwater management issues'),
  ('Public Health', 'Demo Officer', 'publichealth.demo@civic.local', '+91-1800-000-007', 'Sanitation, hygiene, and public health hazards'),
  ('Traffic & Transportation', 'Demo Officer', 'traffic.demo@civic.local', '+91-1800-000-008', 'Traffic congestion, signage, road safety, and transport issues'),
  ('Parks & Public Spaces', 'Demo Officer', 'parks.demo@civic.local', '+91-1800-000-009', 'Park maintenance, public spaces, and open-area safety'),
  ('Street Cleaning', 'Demo Officer', 'streetcleaning.demo@civic.local', '+91-1800-000-010', 'Street litter, debris, and cleaning-related complaints'),
  ('Waste Management', 'Demo Officer', 'waste.demo@civic.local', '+91-1800-000-011', 'Waste collection, illegal dumping, and disposal issues'),
  ('Building & Town Planning', 'Demo Officer', 'planning.demo@civic.local', '+91-1800-000-012', 'Unsafe buildings, encroachment, zoning, and town planning concerns'),
  ('Environmental Services', 'Demo Officer', 'environment.demo@civic.local', '+91-1800-000-013', 'Air, noise, and environmental quality concerns'),
  ('Animal Control', 'Demo Officer', 'animalcontrol.demo@civic.local', '+91-1800-000-014', 'Stray animals and animal welfare issues'),
  ('Emergency Services', 'Demo Officer', 'emergency.demo@civic.local', '+91-1800-000-015', 'Critical emergency, rescue, and urgent public safety incidents')
ON CONFLICT (name) DO NOTHING;
