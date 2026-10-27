import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { action } = await req.json();

    if (action === 'get-challenge') {
      // Generate a random challenge for registration
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const challengeBase64 = btoa(String.fromCharCode(...challenge));

      return new Response(JSON.stringify({
        challenge: challengeBase64,
        rp: { name: 'CivicAI', id: new URL(req.headers.get('origin') || 'https://localhost').hostname },
        user: {
          id: user.id,
          name: user.email || user.phone || 'CivicAI User',
          displayName: user.email || user.phone || 'CivicAI User',
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'store-credential') {
      const { credentialId, publicKey, deviceName } = await req.json().catch(() => ({}));
      
      // Re-parse since we already consumed the body
      const body = JSON.parse(await req.text().catch(() => '{}'));
      
      return new Response(JSON.stringify({ error: 'Use the body directly' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
