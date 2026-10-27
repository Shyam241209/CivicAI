-- Create storage policies for civic-reports bucket
-- Allow anyone to upload images (for AI analysis before authentication)
CREATE POLICY "Public upload access to civic-reports"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'civic-reports');

-- Allow anyone to view images in civic-reports (bucket is already public)
CREATE POLICY "Public read access to civic-reports"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'civic-reports');