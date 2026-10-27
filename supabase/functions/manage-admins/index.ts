import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const caller = { id: claimsData.claims.sub as string, email: claimsData.claims.email as string | undefined };

    // Check caller is admin
    const { data: callerRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .single();

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, email, userId } = await req.json();

    // Helper to log activity
    const logActivity = async (actionType: string, targetType: string, targetId: string | null, details: string) => {
      await supabaseAdmin.from("admin_activity_logs").insert({
        admin_id: caller.id,
        action: actionType,
        target_type: targetType,
        target_id: targetId,
        details,
      });
    };

    if (action === "list") {
      const { data: adminRoles, error: rolesError } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, created_at")
        .eq("role", "admin");

      if (rolesError) throw rolesError;

      const admins = [];
      for (const role of adminRoles || []) {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(role.user_id);
        if (user) {
          admins.push({
            id: user.id,
            email: user.email,
            created_at: role.created_at,
            last_sign_in: user.last_sign_in_at,
          });
        }
      }

      return new Response(JSON.stringify({ admins }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "invite") {
      if (!email) {
        return new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data } = await supabaseAdmin.auth.admin.listUsers();
      const users = (data?.users ?? []) as Array<{ id: string; email?: string }>;
      const existingUser = users.find((u) => u.email === email);

      if (existingUser) {
        const { data: existingRole } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", existingUser.id)
          .eq("role", "admin")
          .single();

        if (existingRole) {
          return new Response(
            JSON.stringify({ error: "User is already an admin" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: insertError } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: existingUser.id, role: "admin" });

        if (insertError) throw insertError;

        await logActivity("admin_invite", "user", existingUser.id, `Promoted existing user ${email} to admin`);

        return new Response(
          JSON.stringify({ message: "Admin role added to existing user" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: inviteData, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          data: { role: "admin" },
        });

      if (inviteError) throw inviteError;

      if (inviteData.user) {
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: inviteData.user.id, role: "admin" });

        await logActivity("admin_invite", "user", inviteData.user.id, `Invited new admin: ${email}`);
      }

      return new Response(
        JSON.stringify({ message: "Invitation sent successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "remove") {
      if (!userId) {
        return new Response(JSON.stringify({ error: "User ID is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (userId === caller.id) {
        return new Response(
          JSON.stringify({ error: "Cannot remove your own admin role" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get email for logging
      const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(userId);

      const { error: deleteError } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");

      if (deleteError) throw deleteError;

      await logActivity("admin_remove", "user", userId, `Removed admin access for ${targetUser?.email || userId}`);

      return new Response(
        JSON.stringify({ message: "Admin role removed successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify_admin_email") {
      // Forgot access code: verify email is a registered admin
      if (!email) {
        return new Response(JSON.stringify({ error: "Email is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data } = await supabaseAdmin.auth.admin.listUsers();
      const users = (data?.users ?? []) as Array<{ id: string; email?: string }>;
      const foundUser = users.find((u) => u.email === email);

      if (!foundUser) {
        return new Response(
          JSON.stringify({ error: "No admin account found with this email" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: adminRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", foundUser.id)
        .eq("role", "admin")
        .single();

      if (!adminRole) {
        return new Response(
          JSON.stringify({ error: "This email is not registered as an admin" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ verified: true, message: "Admin email verified. You may reset the access code." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
