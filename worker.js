const ALLOWED_ORIGINS = new Set([
  "https://stonebridgedg.com",
  "https://www.stonebridgedg.com"
]);

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://stonebridgedg.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[c]);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    // Handle browser CORS preflight
    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    // Only allow POST requests
    if (request.method !== "POST") {
      return Response.json(
        { error: "Method not allowed" },
        {
          status: 405,
          headers: corsHeaders(origin)
        }
      );
    }

    // Only accept submissions from StoneBridge
    if (!ALLOWED_ORIGINS.has(origin)) {
      return Response.json(
        { error: "Origin not allowed" },
        { status: 403 }
      );
    }

    // Make sure Resend is configured
    if (!env.RESEND_API_KEY) {
      return Response.json(
        { error: "Email service is not configured" },
        {
          status: 500,
          headers: corsHeaders(origin)
        }
      );
    }

    let data;

    try {
      data = await request.json();
    } catch {
      return Response.json(
        { error: "Invalid request" },
        {
          status: 400,
          headers: corsHeaders(origin)
        }
      );
    }

    // Required fields
    const fields = [
      "name",
      "phone",
      "email",
      "address",
      "timing",
      "condition"
    ];

    if (
      !fields.every(
        key => String(data[key] || "").trim()
      )
    ) {
      return Response.json(
        { error: "Missing required fields" },
        {
          status: 400,
          headers: corsHeaders(origin)
        }
      );
    }

    // Basic anti-abuse field limits
    if (
      data.name.length > 120 ||
      data.phone.length > 40 ||
      data.email.length > 254 ||
      data.address.length > 300 ||
      data.timing.length > 100 ||
      data.condition.length > 100
    ) {
      return Response.json(
        { error: "Invalid field length" },
        {
          status: 400,
          headers: corsHeaders(origin)
        }
      );
    }

    // Send the lead through Resend
    const resend = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",

        headers: {
          "Authorization": `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          from:
            "StoneBridge Website <website@stonebridgedg.com>",

          to: [
            "info@stonebridgedg.com"
          ],

          reply_to: data.email.trim(),

          subject:
            `New Property Submission — ${data.address.trim()}`,

          html: `
            <div style="
              font-family:Arial,sans-serif;
              max-width:640px;
              margin:auto;
              color:#151514;
            ">

              <div style="
                padding:28px;
                border:1px solid #e6e0d6;
              ">

                <p style="
                  font-size:10px;
                  font-weight:700;
                  letter-spacing:2px;
                  color:#9a835d;
                  margin:0 0 10px;
                ">
                  STONEBRIDGE DEVELOPMENT GROUP
                </p>

                <h1 style="
                  font-family:Georgia,serif;
                  font-size:30px;
                  font-weight:400;
                  margin:0 0 26px;
                ">
                  New Property Submission
                </h1>

                <table style="
                  width:100%;
                  border-collapse:collapse;
                  font-size:14px;
                ">

                  <tr>
                    <td style="
                      padding:11px 0;
                      border-bottom:1px solid #eee;
                    ">
                      <b>Name</b>
                    </td>

                    <td style="
                      padding:11px 0;
                      border-bottom:1px solid #eee;
                    ">
                      ${escapeHtml(data.name)}
                    </td>
                  </tr>

                  <tr>
                    <td style="
                      padding:11px 0;
                      border-bottom:1px solid #eee;
                    ">
                      <b>Phone</b>
                    </td>

                    <td style="
                      padding:11px 0;
                      border-bottom:1px solid #eee;
                    ">
                      ${escapeHtml(data.phone)}
                    </td>
                  </tr>

                  <tr>
                    <td style="
                      padding:11px 0;
                      border-bottom:1px solid #eee;
                    ">
                      <b>Email</b>
                    </td>

                    <td style="
                      padding:11px 0;
                      border-bottom:1px solid #eee;
                    ">
                      ${escapeHtml(data.email)}
                    </td>
                  </tr>

                  <tr>
                    <td style="
                      padding:11px 0;
                      border-bottom:1px solid #eee;
                    ">
                      <b>Property</b>
                    </td>

                    <td style="
                      padding:11px 0;
                      border-bottom:1px solid #eee;
                    ">
                      ${escapeHtml(data.address)}
                    </td>
                  </tr>

                  <tr>
                    <td style="
                      padding:11px 0;
                      border-bottom:1px solid #eee;
                    ">
                      <b>Timeline</b>
                    </td>

                    <td style="
                      padding:11px 0;
                      border-bottom:1px solid #eee;
                    ">
                      ${escapeHtml(data.timing)}
                    </td>
                  </tr>

                  <tr>
                    <td style="
                      padding:11px 0;
                    ">
                      <b>Condition</b>
                    </td>

                    <td style="
                      padding:11px 0;
                    ">
                      ${escapeHtml(data.condition)}
                    </td>
                  </tr>

                </table>

              </div>

            </div>
          `
        })
      }
    );

    const result = await resend.json();

    // Resend rejected the email
    if (!resend.ok) {
      console.error("Resend error", result);

      return Response.json(
        { error: "Unable to send email" },
        {
          status: 502,
          headers: corsHeaders(origin)
        }
      );
    }

    // Success
    return Response.json(
      {
        ok: true,
        id: result.id
      },
      {
        status: 200,
        headers: corsHeaders(origin)
      }
    );
  }
};
