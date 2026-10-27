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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { action, credentialId, email } = await req.json();

    if (action === 'get-challenge') {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const challengeBase64 = btoa(String.fromCharCode(...challenge));

      // If email provided, look up credentials for that user
      let allowCredentials: string[] = [];
      if (email) {
        // Look up user by email
        const { data } = await supabaseAdmin.auth.admin.listUsers();
        const users = (data?.users ?? []) as Array<{ id: string; email?: string }>;
        const user = users.find(u => u.email === email);
        if (user) {
          const { data: creds } = await supabaseAdmin
            .from('webauthn_credentials')
            .select('credential_id')
            .eq('user_id', user.id);
          allowCredentials = creds?.map(c => c.credential_id) || [];
        }
      }

      return new Response(JSON.stringify({
        challenge: challengeBase64,
        allowCredentials,
        rpId: new URL(req.headers.get('origin') || 'https://localhost').hostname,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'verify') {
      if (!credentialId) {
        return new Response(JSON.stringify({ error: 'Missing credential ID' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Look up credential
      const { data: cred, error: credError } = await supabaseAdmin
        .from('webauthn_credentials')
        .select('*')
        .eq('credential_id', credentialId)
        .single();

      if (credError || !cred) {
        return new Response(JSON.stringify({ error: 'Credential not found. Please register biometrics first.' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update last used and counter
      await supabaseAdmin
        .from('webauthn_credentials')
        .update({ last_used_at: new Date().toISOString(), counter: cred.counter + 1 })
        .eq('id', cred.id);

      // Generate a session token for the user
      // Note: We use admin API to create a magic link or sign in on behalf
      // For simplicity, we'll generate a one-time token
      const { data: tokenData, error: tokenError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: '', // We need the email
      }).catch(() => ({ data: null, error: { message: 'Token generation not supported' } }));

      // Get user email for session creation
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(cred.user_id);
      
      if (!userData?.user?.email) {
        return new Response(JSON.stringify({ 
          error: 'User account not found',
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Generate a magic link for passwordless sign-in
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: userData.user.email,
      });

      if (linkError) {
        return new Response(JSON.stringify({ error: 'Failed to create session' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        token_hash: linkData?.properties?.hashed_token,
        email: userData.user.email,
        user_id: cred.user_id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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
