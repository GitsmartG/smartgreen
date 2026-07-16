import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestBody {
  titulo: string;
  mensagem: string;
  categoria: string;
  publico: string; // 'todos' | 'admins' | 'assinantes' | 'free'
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize User Client to verify role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin
    const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Admin Client for DB operations
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Read payload
    const { titulo, mensagem, categoria, publico } = (await req.json()) as RequestBody;
    if (!titulo || !mensagem || !publico) {
      return new Response(JSON.stringify({ error: "Missing required fields: titulo, mensagem, publico" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load Firebase secrets
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID") || "smartgreen-e7de3";
    const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL") || "firebase-adminsdk-fbsvc@smartgreen-e7de3.iam.gserviceaccount.com";
    const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY");

    if (!privateKey) {
      return new Response(
        JSON.stringify({ error: "Firebase Service Account Private Key not set in environment (FIREBASE_PRIVATE_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch target user IDs based on targeted audience
    let targetUserIds: string[] | null = null;

    if (publico === "admins") {
      const { data: roles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      targetUserIds = (roles || []).map((r) => r.user_id);
    } else if (publico === "assinantes") {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .gt("access_expires_at", new Date().toISOString());
      targetUserIds = (profiles || []).map((p) => p.id);
    } else if (publico === "free") {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .or(`access_expires_at.is.null,access_expires_at.lte.${new Date().toISOString()}`);
      targetUserIds = (profiles || []).map((p) => p.id);
    }

    // Query tokens
    let tokenQuery = supabaseAdmin.from("user_fcm_tokens").select("token, user_id");
    if (targetUserIds !== null) {
      if (targetUserIds.length === 0) {
        return new Response(JSON.stringify({ success: true, sent_count: 0, message: "No active devices found for this target audience" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      tokenQuery = tokenQuery.in("user_id", targetUserIds);
    }

    const { data: targetTokens, error: tokensError } = await tokenQuery;
    if (tokensError) {
      return new Response(JSON.stringify({ error: `Database error querying tokens: ${tokensError.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!targetTokens || targetTokens.length === 0) {
      return new Response(JSON.stringify({ success: true, sent_count: 0, message: "No registered FCM tokens found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Obtain Firebase OAuth2 token using Google Auth
    const accessToken = await getFirebaseAccessToken(privateKey, clientEmail);

    // Send notifications to FCM
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const sendPromises = targetTokens.map(async ({ token }) => {
      try {
        const response = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: {
                title: titulo,
                body: mensagem,
              },
              data: {
                category: categoria || "Nova Tip",
              },
            },
          }),
        });

        const resData = await response.json();
        if (!response.ok) {
          // Identify if the token is invalid/unregistered and clean it up
          const isUnregistered =
            response.status === 404 ||
            (resData.error && JSON.stringify(resData.error).includes("UNREGISTERED")) ||
            (resData.error && JSON.stringify(resData.error).includes("not registered"));

          if (isUnregistered) {
            console.log(`FCM Token unregistered/expired. Removing: ${token}`);
            await supabaseAdmin.from("user_fcm_tokens").delete().eq("token", token);
          }
          return { success: false, error: resData.error || "FCM send failed" };
        }
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    });

    const results = await Promise.allSettled(sendPromises);
    let successCount = 0;
    let failCount = 0;

    for (const res of results) {
      if (res.status === "fulfilled") {
        if (res.value.success) {
          successCount++;
        } else {
          failCount++;
        }
      } else {
        failCount++;
      }
    }

    // Log the notification in history
    await supabaseAdmin.from("push_notifications_history").insert({
      title: titulo,
      body: mensagem,
      category: categoria,
      target_audience: publico,
      sent_count: successCount,
      status: failCount > 0 && successCount === 0 ? "falha" : "enviada",
    });

    return new Response(
      JSON.stringify({
        success: true,
        sent_count: successCount,
        failed_count: failCount,
        total_attempted: targetTokens.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("Critical function error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper to sign JWT with RS256 and fetch Google OAuth2 Access Token
async function getFirebaseAccessToken(privateKey: string, clientEmail: string): Promise<string> {
  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";

  let pemContents = privateKey.trim();
  if (pemContents.startsWith(pemHeader)) {
    pemContents = pemContents.substring(pemHeader.length);
  }
  if (pemContents.endsWith(pemFooter)) {
    pemContents = pemContents.substring(0, pemContents.length - pemFooter.length);
  }
  pemContents = pemContents.replace(/\s/g, "");

  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const header = {
    alg: "RS256",
    typ: "JWT",
  };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const base64url = (source: ArrayBuffer) => {
    let binary = "";
    const bytes = new Uint8Array(source);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  };

  const stringToBase64url = (str: string) => {
    const encoder = new TextEncoder();
    return base64url(encoder.encode(str));
  };

  const encodedHeader = stringToBase64url(JSON.stringify(header));
  const encodedClaim = stringToBase64url(JSON.stringify(claim));
  const tokenInput = `${encodedHeader}.${encodedClaim}`;

  const signatureBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(tokenInput)
  );
  const encodedSignature = base64url(signatureBuffer);
  const jwt = `${tokenInput}.${encodedSignature}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google OAuth2 key exchange failed: ${errText}`);
  }

  const data = await response.json();
  return data.access_token;
}
