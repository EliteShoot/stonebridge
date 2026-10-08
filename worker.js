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
    const url = new URL(request.url);
    if(url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return admin(request, env);
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

    if (!data || typeof data !== 'object' || Array.isArray(data)) return Response.json({error:'Invalid request'}, {status:400,headers:corsHeaders(origin)});
    for (const key of ['name','phone','email','address','timing','condition','message','property','subject']) {
      if (data[key] != null && typeof data[key] !== 'string') return Response.json({error:'Invalid field type'}, {status:400,headers:corsHeaders(origin)});
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

    const leadId=crypto.randomUUID();
    let saved=false;
    if(env.DB) try {
      await env.DB.prepare('INSERT INTO leads (id,created_at,type,name,email,phone,address,timing,condition,property,subject,message,consent) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(leadId,new Date().toISOString(),isContact?'contact':'seller',data.name.trim(),data.email.trim(),data.phone||'',data.address||'',data.timing||'',data.condition||'',data.property||'',subject,data.message||'',data.consent===true?1:0).run();
      saved=true;
    } catch { console.error('Lead database write failed; continuing with email delivery.'); }
    let resend;
    try { resend = await fetch(
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

    } catch {
      await updateEmailStatus(env,leadId,saved,'failed');
      return Response.json(saved?{ok:true,id:leadId}:{error:'Unable to send email'}, {status:saved?200:502,headers:corsHeaders(origin)});
    }
    const result = await resend.json().catch(()=>({}));
    await updateEmailStatus(env,leadId,saved,resend.ok?'sent':'failed');

    if (!resend.ok) {
      console.error(
        "Resend error",
        result
      );

      return Response.json(
        saved?{ok:true,id:leadId}:{error:'Unable to send email'},
        {
          status: saved?200:502,
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
const ADMIN_HTML="<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow,noarchive\"><meta name=\"googlebot\" content=\"noindex,nofollow,noarchive\"><meta name=\"theme-color\" content=\"#151514\"><link rel=\"icon\" href=\"https://i.imgur.com/xm9nTpK.png\"><title>StoneBridge | Admin</title><link href=\"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap\" rel=\"stylesheet\"><style>\n*{box-sizing:border-box}body{margin:0;background:#f4f4f2;color:#202423;font:16px system-ui}header{background:#172724;color:white;padding:26px 5%;display:flex;justify-content:space-between;align-items:center}small{display:block;font-size:12px;letter-spacing:.18em;margin-top:5px;color:#b9c9c2}main{max-width:1250px;margin:40px auto;padding:0 24px}h1{font:36px Georgia;margin:0 0 24px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:28px}.card{background:white;border:1px solid #d8dfdb;padding:24px}.card b{display:block;font-size:32px;margin-top:8px}.tools{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}input,select,button{font:inherit;padding:12px;border:1px solid #c6d0ca;border-radius:4px}button{cursor:pointer;background:#234b3e;color:white}input{flex:1;min-width:180px}.table{overflow:auto;background:white}table{width:100%;border-collapse:collapse;white-space:nowrap}th,td{text-align:left;padding:16px;border-bottom:1px solid #e2e6e3}th{font-size:14px;color:#59675f}td button{background:transparent;color:#234b3e;padding:6px 10px}#login{max-width:460px;background:white;padding:32px;margin:80px auto}#login input{width:100%;margin:12px 0}#notice{min-height:28px;color:#8d331f}dialog{border:1px solid #b9c9c2;max-width:650px;width:90%;padding:30px}dialog::backdrop{background:#13251db3}dl{display:grid;grid-template-columns:120px 1fr;gap:12px}dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}dt{color:#59675f}#more{margin-top:20px}@media(max-width:600px){.cards{grid-template-columns:1fr}.card{padding:16px}header{padding:22px}dl{grid-template-columns:1fr}h1{font-size:30px}}\n\nbody{background:#f7f5f0;color:#151514;font-family:\"DM Sans\",Arial,sans-serif}header{background:#1d1c1a;border-bottom:1px solid #3a3732;padding:26px 5%}header>div{font-size:18px;letter-spacing:.15em;font-weight:600}small{font-size:12px;color:#c9bda9;letter-spacing:.22em}h1{font-family:\"Cormorant Garamond\",Georgia,serif;font-size:48px;font-weight:400;letter-spacing:-.025em}.card{border-color:#d8d1c5;padding:26px;background:#fff}.card b{font-family:\"Cormorant Garamond\",Georgia,serif;font-size:46px;font-weight:500}button{background:#151514;color:white;border-color:#151514;border-radius:0}input,select{border-color:#d8d1c5;border-radius:0;background:#fff;color:#151514}th,dt{color:#68655f}th{background:#ebe6dc}td,th{border-color:#e4ded3}td button{color:#151514;border-color:#d8d1c5}dialog{background:#f7f5f0;border-color:#d8d1c5}dialog::backdrop{background:#151514b3}#login{border:1px solid #d8d1c5;box-shadow:0 20px 60px #1515140d}#notice{color:#8d331f}button:hover{opacity:.85}input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid #786447;outline-offset:3px}\ntextarea{width:100%;font:inherit;padding:12px;margin:10px 0 20px;border:1px solid #d8d1c5;background:white;resize:vertical}#quick a{display:inline-block;padding:10px 16px;border:1px solid #d8d1c5;color:#151514;text-decoration:none}.overdue{color:#a03220;font-weight:600}.tools label{font-size:14px;display:flex;align-items:center;gap:6px}.tools label input{min-width:130px}.tools input[type=date]{font-size:14px}dialog{max-height:90vh;overflow:auto}#detailNotice{color:#8d331f}\n\n[hidden]{display:none!important}main{max-width:1440px;padding:0 48px;margin:0 auto 70px}header{height:100px;padding:0 48px;gap:24px}header .site-link{margin-left:auto;color:#ddd5c7;font-size:14px;text-decoration:none;border-bottom:1px solid #9e927e;padding-bottom:6px}.workspace-nav{display:flex;align-items:center;gap:30px;border-bottom:1px solid #d8d1c5;padding:26px 0}.workspace-nav button{background:none;color:#68655f;border:0;padding:12px 0}.workspace-nav button[aria-current=page]{color:#151514;border-bottom:2px solid #151514}.workspace-nav span{margin-left:auto;color:#68655f;font-size:13px}.page-heading{display:flex;justify-content:space-between;align-items:end;padding:48px 0 32px;gap:30px}.page-heading h1{font-size:clamp(44px,5vw,72px);line-height:.95;margin:16px 0 0}.page-heading h1 span{color:#a9997d}.page-heading>p{color:#68655f;line-height:1.8}.eyebrow{font-size:12px;letter-spacing:.18em;font-weight:600;color:#68655f}.cards{gap:24px;margin-bottom:32px}.card{padding:30px;border-top:2px solid #a9997d}.filters{background:#ebe6dc;padding:24px;gap:16px;border:1px solid #d8d1c5;margin-bottom:28px}.filters #search{flex-basis:100%;width:100%}input,select,button{min-height:46px}th,td{padding:24px 20px;white-space:normal;vertical-align:top}th{font-size:13px}td{font-size:14px;line-height:1.65}td:first-child{min-width:140px}td:nth-child(3){min-width:220px}td a{color:#5f5036;text-decoration:none}td a:hover{text-decoration:underline}.row-links{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;font-size:13px}.contact-links{display:grid;gap:6px;overflow-wrap:anywhere}.badge{display:inline-flex;align-items:center;gap:7px;padding:5px 10px;background:#f0eee8;color:#514d45;font-size:13px}.badge:before{content:'';width:7px;height:7px;border-radius:50%;background:#ae7830}.badge.closed:before{background:#777}.badge.open:before{background:#35725a}.heat{display:block;margin-top:9px;color:#68655f;font-size:13px}.table{border:1px solid #d8d1c5}dialog{max-width:800px;padding:40px}dialog label{display:block;margin:20px 0 8px}dialog select{display:block;width:100%;margin-top:8px}dialog #follow{width:100%}dialog h1{font-size:44px}#quick{padding:18px 0;border-bottom:1px solid #d8d1c5}#fields{margin:28px 0;gap:18px}dd a{color:#5f5036}.team-layout{display:grid;grid-template-columns:240px 1fr;border:1px solid #d8d1c5;background:white}.team-layout aside{padding:30px;border-right:1px solid #d8d1c5;background:#ebe6dc}.team-layout aside button{display:block;background:none;color:#68655f;border:0}.team-empty{padding:48px;max-width:850px}.team-empty>span{font-size:32px}.team-empty h2,.team-layout h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:34px;font-weight:500}.team-empty p{line-height:1.8;color:#68655f}.team-empty label{display:block;margin-top:28px}button:disabled{opacity:.5;cursor:default}.muted{font-size:13px}#notice:empty{min-height:0;margin:0}#login{margin-top:70px;padding:40px}\n@media(max-width:1000px){main{padding:0 24px}header{padding:20px 24px;height:auto}.page-heading>p{display:none}.workspace-nav{gap:20px}.workspace-nav span{font-size:12px}.filters select{flex:1;min-width:150px}.cards{gap:14px}}\n@media(max-width:700px){header{flex-wrap:wrap;gap:16px}header>div{font-size:15px}header small{font-size:10px}header .site-link{font-size:12px}header button{padding:10px;font-size:13px}main{padding:0 16px}.workspace-nav{flex-wrap:wrap;gap:18px;padding:15px 0}.workspace-nav span{width:100%;margin:0}.page-heading{padding:32px 0 24px}.cards{grid-template-columns:repeat(3,1fr);gap:8px}.card{padding:16px 10px;font-size:12px}.card b{font-size:32px}.filters{padding:16px;gap:12px}.filters label{width:100%}.filters label input{flex:1}.table{background:none;border:0;overflow:visible}table,tbody{display:block;width:100%}thead{display:none}tr{display:block;background:white;border:1px solid #d8d1c5;margin-bottom:16px;padding:20px}td{display:block;padding:8px 0;border:0;min-width:0!important}td:first-child{color:#68655f;font-size:12px}td:nth-child(2){font-size:20px;font-weight:600}td:nth-child(4){color:#68655f}td:last-child button{width:100%;margin-top:12px}dialog{padding:24px;width:calc(100% - 24px)}dl{grid-template-columns:1fr;gap:7px}dd{margin-bottom:12px}.team-layout{grid-template-columns:1fr}.team-layout aside{border-right:0;border-bottom:1px solid #d8d1c5}.team-empty{padding:24px}#login{padding:28px}#login h1{font-size:40px}}\n</style><header><div>STONEBRIDGE<small>DEVELOPMENT GROUP / ADMIN</small></div><a class=\"site-link\" href=\"https://stonebridgedg.com/\" target=\"_blank\" rel=\"noopener noreferrer\">View website</a><button id=\"logout\" hidden>Lock dashboard</button></header><main><div id=\"login\"><h1>Admin access</h1><form id=\"auth\"><label for=\"key\">Admin access key</label><input id=\"key\" type=\"password\" autocomplete=\"off\" required><button>Unlock dashboard</button></form></div><p id=\"notice\" role=\"status\"></p><section id=\"app\" hidden><nav class=\"workspace-nav\" aria-label=\"Admin sections\"><button id=\"inboxTab\" aria-current=\"page\">01 \u00b7 Lead inbox</button><button id=\"teamTab\">02 \u00b7 Team messages</button><span id=\"refreshed\">Idle refresh \u00b7 5 minutes</span></nav><div id=\"inboxView\"><div class=\"page-heading\"><div><p class=\"eyebrow\">PRIVATE ACQUISITIONS & INQUIRIES</p><h1>Your opportunities<span>.</span></h1></div><p>Review the property.<br>Plan the next conversation.</p></div><div class=\"cards\"><div class=\"card\">Total submissions<b id=\"total\">\u2014</b></div><div class=\"card\">New leads<b id=\"new\">\u2014</b></div><div class=\"card\">Email failures<b id=\"failed\">\u2014</b></div></div><div class=\"tools filters\"><input id=\"search\" placeholder=\"Search name, email, or property\" aria-label=\"Search submissions\"><select id=\"type\" aria-label=\"Submission type\"><option value=\"\">All submissions</option><option value=\"seller\">Property sellers</option><option value=\"contact\">Contact inquiries</option></select><select id=\"status\" aria-label=\"Lead status\"><option value=\"\">All statuses</option><option>New</option><option>Contacted</option><option>In review</option><option>Closed</option></select><select id=\"temperature\" aria-label=\"Lead temperature\"><option value=\"\">All lead temperatures</option><option>Hot lead</option><option>Warm lead</option><option>Cold lead</option><option>Unmotivated</option><option>Unclassified</option></select><select id=\"sort\" aria-label=\"Sort leads\"><option value=\"newest\">Newest first</option><option value=\"oldest\">Oldest first</option><option value=\"followup\">Follow-up date</option></select><select id=\"due\" aria-label=\"Follow-up filter\"><option value=\"\">All follow-ups</option><option value=\"overdue\">Overdue</option><option value=\"today\">Due today</option></select><label>From <input id=\"from\" type=\"date\"></label><label>To <input id=\"to\" type=\"date\"></label><button id=\"refresh\">Refresh</button><button id=\"export\">Export filtered CSV</button></div><div class=\"table\"><table><thead><tr><th>Received</th><th>Name</th><th>Property / inquiry</th><th>Type</th><th>Status</th><th>Follow-up</th><th>Contact & delivery</th><th></th></tr></thead><tbody id=\"rows\"></tbody></table></div><button id=\"more\" hidden>Load more</button></div><section id=\"teamView\" hidden><div class=\"page-heading\"><div><p class=\"eyebrow\">TEAM WORKSPACE</p><h1>Keep the team<br><em>in the loop.</em></h1></div></div><div class=\"team-layout\"><aside><h2>Channels</h2><button disabled># acquisitions</button><button disabled># general</button><p>Accounts coming next</p></aside><div class=\"team-empty\"><span aria-hidden=\"true\">\ud83d\udcac</span><h2>A place for every conversation.</h2><p>Team messaging will connect here once individual accounts and permissions are added. No messages are sent or stored from this page yet.</p><label for=\"draft\">Plan a team update</label><textarea id=\"draft\" placeholder=\"Draft an update for your future team\u2026\"></textarea><p class=\"muted\">Draft stays in this tab and clears when you lock or refresh.</p><button disabled>Send \u00b7 requires team accounts</button></div></div></section></section></main><dialog id=\"detail\"><h1>Lead details</h1><div id=\"quick\" class=\"tools\"></div><dl id=\"fields\"></dl><label for=\"notes\">Your notes</label><textarea id=\"notes\" rows=\"5\" maxlength=\"10000\" placeholder=\"Property details, conversations, and next steps\"></textarea><label for=\"follow\">Follow-up date</label><input id=\"follow\" type=\"date\"><p id=\"detailNotice\" role=\"status\"></p><label>Lead temperature <select id=\"editTemperature\"><option>Unclassified</option><option>Hot lead</option><option>Warm lead</option><option>Cold lead</option><option>Unmotivated</option></select></label><label>Status <select id=\"edit\"><option>New</option><option>Contacted</option><option>In review</option><option>Closed</option></select></label><p><button id=\"save\">Save lead</button> <button id=\"close\">Close</button></p></dialog><script>\nlet token='',items=[],offset=0,selected,loading=false,lastActivity=Date.now(),lastRefresh=Date.now();const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nasync function api(path,options={}){const r=await fetch('https://stonebridge.psznbzhnps.workers.dev/admin/api'+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}});if(r.status===401){lock();throw Error('Access key is invalid.');}const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load records.');return d;}\nfunction lock(){token='';items=[];$('app').hidden=true;$('login').hidden=false;$('logout').hidden=true;$('rows').innerHTML='';$('detail').close();$('draft').value='';$('inboxView').hidden=false;$('teamView').hidden=true;}\nfunction params(){return new URLSearchParams({q:$('search').value,type:$('type').value,status:$('status').value,sort:$('sort').value,due:$('due').value,from:$('from').value,to:$('to').value,today:localDate(),temperature:$('temperature').value});}\nfunction localDate(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}\nasync function load(append=false){if(loading)return;loading=true;try{$('notice').textContent='Loading\u2026';offset=append?items.length:0;const q=params();q.set('offset',offset);const d=await api('/leads?'+q);items=append?items.concat(d.items):d.items;$('total').textContent=d.stats.total;$('new').textContent=d.stats.fresh;$('failed').textContent=d.stats.failed;$('rows').innerHTML=items.map(renderLead).join('');lastRefresh=Date.now();$('refreshed').textContent='Updated '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+' \u00b7 idle refresh 5 min';$('more').hidden=!d.more;$('notice').textContent=items.length?'':'No submissions match these filters.';}catch(e){$('notice').textContent=e.message;}finally{loading=false;}}\n$('auth').onsubmit=async e=>{e.preventDefault();token=$('key').value;$('key').value='';await load();if(token){$('login').hidden=true;$('app').hidden=false;$('logout').hidden=false;}};$('logout').onclick=lock;$('refresh').onclick=()=>load();$('more').onclick=()=>load(true);let timer;$('search').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>load(),300)};['type','status','sort','due','from','to','temperature'].forEach(id=>$(id).onchange=()=>load());\n$('rows').onclick=e=>{const b=e.target.closest('[data-id]');if(!b)return;selected=items.find(x=>x.id===b.dataset.id);$('fields').innerHTML=Object.entries(selected).filter(([k])=>!['id','notes','follow_up'].includes(k)).map(([k,v])=>'<dt>'+esc(k.replaceAll('_',' '))+'</dt><dd>'+detailValue(k,v)+'</dd>').join('');$('edit').value=selected.status;$('editTemperature').value=selected.temperature||'Unclassified';$('notes').value=selected.notes||'';$('follow').value=selected.follow_up||'';$('detailNotice').textContent='';$('quick').innerHTML='<a href=\"mailto:'+esc(encodeURIComponent(selected.email))+'\">Email</a>'+(selected.phone?'<a href=\"tel:'+esc(selected.phone.replace(/[^+0-9]/g,''))+'\">Call</a>':'');if(selected.address)$('quick').innerHTML+=propertyLinks(selected.address);$('detail').showModal();};$('close').onclick=()=>$('detail').close();$('save').onclick=async()=>{try{await api('/leads/'+selected.id,{method:'PATCH',body:JSON.stringify({status:$('edit').value,notes:$('notes').value,follow_up:$('follow').value,temperature:$('editTemperature').value})});$('detail').close();await load();}catch(e){$('detailNotice').textContent=e.message;}};\n$('export').onclick=async()=>{try{let all=[],off=0;while(true){const q=params();q.set('offset',off);const d=await api('/leads?'+q);all.push(...d.items);if(!d.more)break;off=all.length;}const keys=['created_at','type','name','email','phone','address','timing','condition','property','subject','message','consent','status','email_status','notes','follow_up','temperature'];const cell=v=>'\"'+String(v??'').replace(/^[=+@-]/,\"'$&\").replaceAll('\"','\"\"')+'\"';const csv=[keys.join(','),...all.map(x=>keys.map(k=>cell(x[k])).join(','))].join('\\r\\n');const u=URL.createObjectURL(new Blob(['\\ufeff'+csv],{type:'text/csv'}));const a=document.createElement('a');a.href=u;a.download='stonebridge-submissions.csv';a.click();URL.revokeObjectURL(u);}catch(e){$('notice').textContent=e.message;}};\n\nfunction propertyLinks(address){const q=encodeURIComponent(address);return '<div class=\"row-links\"><a href=\"https://app.propstream.com/\" target=\"_blank\" rel=\"noopener noreferrer\" data-prop=\"'+esc(address)+'\" title=\"Copies address and opens PropStream\">PropStream</a><a href=\"https://www.zillow.com/homes/'+q+'_rb/\" target=\"_blank\" rel=\"noopener noreferrer\">Zillow</a><a href=\"https://www.google.com/maps/search/?api=1&query='+q+'\" target=\"_blank\" rel=\"noopener noreferrer\">Google Maps</a></div>';}\nfunction detailValue(k,v){if(k==='email')return '<a href=\"mailto:'+esc(encodeURIComponent(v))+'\">'+esc(v)+'</a>';if(k==='phone'&&v)return '<a href=\"tel:'+esc(String(v).replace(/[^+0-9]/g,''))+'\">'+esc(v)+'</a>';return esc(v);}\nfunction renderLead(x){const closed=x.status==='Closed',heat=x.temperature||'Unclassified';const icon={'Hot lead':'\ud83d\udd25','Warm lead':'\u2600\ufe0f','Cold lead':'\u2744\ufe0f','Unmotivated':'\ud83d\udca4','Unclassified':'\u25cb'}[heat]||'\u25cb';return '<tr><td>'+esc(new Date(x.created_at).toLocaleString())+'</td><td>'+esc(x.name)+'</td><td>'+esc(x.address||x.property||x.subject)+(x.address?propertyLinks(x.address):'')+'</td><td>'+esc(x.type==='seller'?'Property seller':'Contact inquiry')+'</td><td><span class=\"badge '+(closed?'closed':'open')+'\">'+esc(x.status)+'</span><span class=\"heat\">'+icon+' '+esc(heat)+'</span></td><td class=\"'+(x.follow_up&&x.follow_up<localDate()&&!closed?'overdue':'')+'\">'+esc(x.follow_up||'No follow-up set')+'</td><td><div class=\"contact-links\">'+detailValue('email',x.email)+(x.phone?detailValue('phone',x.phone):'')+'</div><span class=\"heat\">Email '+esc(x.email_status)+'</span></td><td><button data-id=\"'+esc(x.id)+'\">Open lead</button></td></tr>';}\ndocument.addEventListener('click',e=>{const a=e.target.closest('[data-prop]');if(a){if(navigator.clipboard)navigator.clipboard.writeText(a.dataset.prop).then(()=>{$('notice').textContent='Address copied. Paste it into PropStream search.'}).catch(()=>{$('notice').textContent='Copy the property address and paste it into PropStream search.'});}});\nfunction tab(team){$('inboxView').hidden=team;$('teamView').hidden=!team;$('inboxTab').setAttribute('aria-current',team?'false':'page');$('teamTab').setAttribute('aria-current',team?'page':'false');}\n$('inboxTab').onclick=()=>tab(false);$('teamTab').onclick=()=>tab(true);\n['pointerdown','keydown','input','scroll'].forEach(event=>document.addEventListener(event,()=>lastActivity=Date.now(),{passive:true}));\nsetInterval(()=>{const now=Date.now();if(token&&!document.hidden&&!$('detail').open&&!$('inboxView').hidden&&now-lastActivity>=300000&&now-lastRefresh>=300000)load();},15000);\n</script></html>";

const adminHeaders={'X-Robots-Tag':'noindex, nofollow, noarchive','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; img-src https://i.imgur.com; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; connect-src 'self' https://stonebridge.psznbzhnps.workers.dev; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
async function admin(request,env){
 const url=new URL(request.url);
 const origin=request.headers.get('Origin')||'';
 const allowed=ALLOWED_ORIGINS.has(origin);
 const headers={...adminHeaders,...(allowed?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})};
 const reply=(data,status=200)=>Response.json(data,{status,headers});
 if(request.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers:{...headers,'Access-Control-Allow-Methods':'GET, PATCH, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'}});
 if(origin && !allowed)return reply({error:'Origin not allowed'},403);
 if(url.pathname==='/admin' && request.method==='GET')return new Response(ADMIN_HTML,{headers:{...adminHeaders,'Content-Type':'text/html;charset=utf-8'}});
 if(!env.ADMIN_TOKEN||env.ADMIN_TOKEN.length<32)return reply({error:'Admin access is not configured'},503);
 const incoming=request.headers.get('Authorization')||'';
 const digest=async s=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const a=await digest(incoming),b=await digest('Bearer '+env.ADMIN_TOKEN);let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];if(diff)return reply({error:'Unauthorized'},401);
 if(!env.DB)return reply({error:'Database is not configured'},503);
 try{
 if(url.pathname==='/admin/api/leads' && request.method==='GET'){
 const clauses=[],args=[];const q=(url.searchParams.get('q')||'').slice(0,300);if(q){clauses.push('(name LIKE ? OR email LIKE ? OR address LIKE ? OR property LIKE ? OR subject LIKE ?)');for(let i=0;i<5;i++)args.push('%'+q+'%');}
 for(const k of ['type','status']){const v=url.searchParams.get(k);if(v){clauses.push('l.'+k+'=?');args.push(v);}}
 const datePattern=/^\d{4}-\d{2}-\d{2}$/;
 for(const [key,op] of [['from','>='],['to','<=']]){const v=url.searchParams.get(key);if(v&&datePattern.test(v)){clauses.push('substr(l.created_at,1,10) '+op+' ?');args.push(v);}}
 const today=url.searchParams.get('today');const due=url.searchParams.get('due');if(datePattern.test(today||'')&&['today','overdue'].includes(due)){clauses.push("f.follow_up <> '' AND f.follow_up "+(due==='today'?'=':'<')+" ? AND l.status <> 'Closed'");args.push(today);}
 const sort=url.searchParams.get('sort');const order=sort==='oldest'?'l.created_at ASC,l.id ASC':sort==='followup'?"CASE WHEN COALESCE(f.follow_up,'')='' THEN 1 ELSE 0 END,f.follow_up ASC,l.created_at DESC,l.id DESC":'l.created_at DESC,l.id DESC';
 const temperature=url.searchParams.get('temperature');if(temperature){clauses.push("COALESCE(c.temperature,'Unclassified')=?");args.push(temperature);}
 const where=clauses.length?' WHERE '+clauses.join(' AND '):'';const offset=Math.max(0,parseInt(url.searchParams.get('offset'))||0);
 const rows=await env.DB.prepare("SELECT l.*,COALESCE(f.notes,'') AS notes,COALESCE(f.follow_up,'') AS follow_up,COALESCE(c.temperature,'Unclassified') AS temperature FROM leads l LEFT JOIN lead_followups f ON f.lead_id=l.id LEFT JOIN lead_classifications c ON c.lead_id=l.id"+where+' ORDER BY '+order+' LIMIT 101 OFFSET ?').bind(...args,offset).all();
 const stats=await env.DB.prepare("SELECT COUNT(*) AS total,COALESCE(SUM(status='New'),0) AS fresh,COALESCE(SUM(email_status='failed'),0) AS failed FROM leads").first();
 return reply({items:rows.results.slice(0,100),more:rows.results.length>100,stats});
 }
 const match=url.pathname.match(/^\/admin\/api\/leads\/([a-f0-9-]{36})$/);
 if(match && request.method==='PATCH'){const data=await request.json();if(!['New','Contacted','In review','Closed'].includes(data.status))return reply({error:'Invalid status'},400);if(typeof data.notes!=='string'||data.notes.length>10000||typeof data.follow_up!=='string'||(data.follow_up&&!/^\d{4}-\d{2}-\d{2}$/.test(data.follow_up)))return reply({error:'Invalid notes or follow-up date'},400);
 if(!['Unclassified','Hot lead','Warm lead','Cold lead','Unmotivated'].includes(data.temperature))return reply({error:'Invalid lead temperature'},400);
 const lead=await env.DB.prepare('SELECT id FROM leads WHERE id=?').bind(match[1]).first();if(!lead)return reply({error:'Lead not found'},404);
 await env.DB.batch([env.DB.prepare('UPDATE leads SET status=? WHERE id=?').bind(data.status,match[1]),env.DB.prepare('INSERT INTO lead_followups (lead_id,notes,follow_up) VALUES (?,?,?) ON CONFLICT(lead_id) DO UPDATE SET notes=excluded.notes,follow_up=excluded.follow_up').bind(match[1],data.notes,data.follow_up),env.DB.prepare('INSERT INTO lead_classifications (lead_id,temperature) VALUES (?,?) ON CONFLICT(lead_id) DO UPDATE SET temperature=excluded.temperature').bind(match[1],data.temperature)]);return reply({ok:true});}
 return reply({error:'Not found'},404);
 }catch{return reply({error:'Unable to access records. Check the database binding and schema.'},500);}
}

async function updateEmailStatus(env,id,saved,status){
 if(!saved)return;
 try{await env.DB.prepare('UPDATE leads SET email_status=? WHERE id=?').bind(status,id).run();}
 catch{console.error('Email status update failed.');}
}
