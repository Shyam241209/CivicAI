
CREATE TABLE public.webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  device_name text,
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own credentials"
  ON public.webauthn_credentials FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own credentials"
  ON public.webauthn_credentials FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own credentials"
  ON public.webauthn_credentials FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own credentials"
  ON public.webauthn_credentials FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());
