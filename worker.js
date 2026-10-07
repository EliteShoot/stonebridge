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

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin)
      });
    }

    // Only allow POST
    if (request.method !== "POST") {
      return Response.json(
        { error: "Method not allowed" },
        {
          status: 405,
          headers: corsHeaders(origin)
        }
      );
    }

    // Only allow StoneBridge website
    if (!ALLOWED_ORIGINS.has(origin)) {
      return Response.json(
        { error: "Origin not allowed" },
        { status: 403 }
      );
    }

    // Make sure Resend secret exists
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

    const isContact = data.type === "contact";

    let subject;
    let html;

    // =========================================================
    // CONTACT PAGE FORMS
    // Rent / Buy Property + General Inquiry
    // =========================================================

    if (isContact) {
      const name = String(data.name || "").trim();
      const email = String(data.email || "").trim();
      const message = String(data.message || "").trim();
      const property = String(data.property || "").trim();
      const inquirySubject = String(
        data.subject || "StoneBridge Website Inquiry"
      ).trim();

      if (!name || !email || !message) {
        return Response.json(
          { error: "Missing required fields" },
          {
            status: 400,
            headers: corsHeaders(origin)
          }
        );
      }

      if (
        name.length > 120 ||
        email.length > 254 ||
        message.length > 5000 ||
        property.length > 300 ||
        inquirySubject.length > 160
      ) {
        return Response.json(
          { error: "Invalid field length" },
          {
            status: 400,
            headers: corsHeaders(origin)
          }
        );
      }

      subject = inquirySubject;

      html = `
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
              ${escapeHtml(inquirySubject)}
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
                  ${escapeHtml(name)}
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
                  ${escapeHtml(email)}
                </td>
              </tr>

              ${
                property
                  ? `
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
                        ${escapeHtml(property)}
                      </td>
                    </tr>
                  `
                  : ""
              }

              <tr>
                <td style="
                  padding:11px 0;
                  vertical-align:top;
                ">
                  <b>Message</b>
                </td>

                <td style="
                  padding:11px 0;
                  white-space:pre-wrap;
                ">
                  ${escapeHtml(message)}
                </td>
              </tr>

            </table>

          </div>
        </div>
      `;
    }

    // =========================================================
    // SELL YOUR HOME FORM
    // =========================================================

    else {
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

      subject =
        `New Property Submission — ${data.address.trim()}`;

      html = `
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
                <td style="padding:11px 0;">
                  <b>Condition</b>
                </td>

                <td style="padding:11px 0;">
                  ${escapeHtml(data.condition)}
                </td>
              </tr>

            </table>

          </div>
        </div>
      `;
    }

    // =========================================================
    // SEND THROUGH RESEND
    // =========================================================

    const resend = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",

        headers: {
          "Authorization":
            `Bearer ${env.RESEND_API_KEY}`,

          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          from:
            "StoneBridge Website <website@stonebridgedg.com>",

          to: [
            "info@stonebridgedg.com"
          ],

          reply_to:
            String(data.email || "").trim(),

          subject,

          html
        })
      }
    );

    const result = await resend.json();

    if (!resend.ok) {
      console.error(
        "Resend error",
        result
      );

      return Response.json(
        { error: "Unable to send email" },
        {
          status: 502,
          headers: corsHeaders(origin)
        }
      );
    }

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
