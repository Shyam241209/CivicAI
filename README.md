Civic Connect AI

## Supabase Configuration

The frontend uses these Supabase environment variables for auth, database queries, storage, reports, maps, and existing user/admin functionality:

- `VITE_SUPABASE_URL=`
  - Your Supabase project URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY=`
  - Your Supabase publishable/anon key.
- `VITE_SUPABASE_PROJECT_ID=`
  - Your Supabase project ID.

These values must be configured in `.env` and remain frontend-safe. Do not expose any service-role keys in frontend code.

## AI Configuration

This project uses a Supabase Edge Function for AI-powered issue analysis. The frontend calls the function at `supabase/functions/analyze-civic-issue`, and that function communicates with the configured AI provider.

### Required server-side environment variables

The following variables must be configured by the project administrator before deployment:

- `AI_API_URL=`
  - URL of the compatible AI provider.
  - This must be configured server-side and should not be exposed in frontend code.

- `AI_API_KEY=`
  - Secret API key for the configured AI provider.
  - Must remain server-side only.
  - Must never be committed to GitHub or included in browser JavaScript.

- `AI_MODEL=`
  - Model name supported by the configured AI provider.
  - The Edge Function sends this value as the `model` field in AI requests.

### How AI analysis works

The CivicAI frontend does not call the AI provider directly. Instead, it sends an image URL, description, and optional location data to the Supabase Edge Function:

- `supabase/functions/analyze-civic-issue`

That Edge Function is responsible for communicating with the configured AI provider using the server-side environment variables above.

### Deployment notes

- The AI issue-analysis feature requires a valid compatible AI provider to be configured before deployment.
- Do not place any AI provider credentials in frontend or client-side environment variables.
- Do not commit secrets to source control.

### Local setup example

In `.env` or your local environment configuration, use empty placeholders:

```
AI_API_URL=
AI_API_KEY=
AI_MODEL=
```

Keep these values private and server-side only.
