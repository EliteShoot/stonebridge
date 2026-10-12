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
  async fetch(request, env, ctx) {
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
    const recipientEmail = String(data.email || '').trim();
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipientEmail) || /[\r\n,;]/.test(recipientEmail)) {
      return Response.json({error:'Please enter a valid email address'}, {status:400,headers:corsHeaders(origin)});
    }

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
        `StoneBridge Property Submission - ${data.address.trim()}`;

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
    // Send an acknowledgment only once the lead has been saved or delivered internally.
    // A customer-email failure must never make a successful submission look unsuccessful.
    const acknowledge = async () => {
      const task = sendLeadAcknowledgment(env, data, isContact, leadId);
      if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(task);
      else await task;
    };
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
      if (saved) await acknowledge();
      return Response.json(saved?{ok:true,id:leadId}:{error:'Unable to send email'}, {status:saved?200:502,headers:corsHeaders(origin)});
    }
    const result = await resend.json().catch(()=>({}));
    await updateEmailStatus(env,leadId,saved,resend.ok?'sent':'failed');

    if (!resend.ok) {
      if (saved) await acknowledge();
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

    await acknowledge();
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
const ADMIN_HTML="<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"robots\" content=\"noindex,nofollow,noarchive\"><link rel=\"icon\" href=\"https://i.imgur.com/xm9nTpK.png\"><title>StoneBridge · Workspace</title><link href=\"https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600&display=swap\" rel=\"stylesheet\"><style>\n:root{--coal:#25221f;--gold:#ac9773;--cream:#f5f2ed;--line:#e6e0d7;--muted:#82796e}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;background:var(--cream);color:var(--coal);font:14px 'DM Sans',sans-serif}button,input,select,textarea{box-sizing:border-box;font:inherit;border:1px solid var(--line);border-radius:10px;padding:11px 14px;min-height:44px;line-height:1.35;box-shadow:none}input,select,textarea{background:#fff;color:var(--coal)}input:focus,select:focus,textarea:focus,button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}.form input,.form select,.form textarea,.task-form input,.task-form select,.task-form textarea{display:block;width:100%;min-width:0}.form label{display:block;margin:16px 0 8px;font-size:12px;font-weight:600;color:#5d554b}.form textarea{resize:vertical}.remember-row{display:flex!important;align-items:center;gap:10px;margin:14px 0 0!important;font-weight:500!important;color:var(--muted)!important}.remember-row input{width:18px!important;height:18px;min-height:18px;padding:0;margin:0;accent-color:var(--gold)}.remember-row span{font-size:12px}.task-form>*{min-width:0}.toolbar{display:flex;gap:8px;flex-wrap:wrap}.toolbar button{min-height:44px}.price-hint{color:var(--muted);font-size:12px;line-height:1.5;margin:6px 0}button{cursor:pointer;background:var(--coal);color:#fff;font-weight:600}button:hover{filter:brightness(1.12)}button:disabled{opacity:.5;cursor:wait}input,select,textarea{background:white;color:var(--coal);min-width:0}input:focus,textarea:focus,select:focus{outline:2px solid var(--gold);outline-offset:2px}a{color:#8a704b;text-decoration:none}a:hover{text-decoration:underline}h1{font-size:32px;letter-spacing:-1px;margin:6px 0}h2{font-size:17px;margin:0 0 18px}p{line-height:1.65}.muted{color:var(--muted);font-size:12px}.eyebrow{font-size:10px;font-weight:700;letter-spacing:2px;color:#938164}.brand{display:flex;align-items:center;gap:12px}.brand img{width:43px;height:43px;object-fit:contain}.brand b{font:22px 'Cormorant Garamond',serif;letter-spacing:2px}.brand small{display:block;font-size:8px;letter-spacing:2px;margin-top:4px;color:var(--gold)}#login{min-height:100vh;display:grid;grid-template-columns:1.1fr 1fr}.login-art{background:var(--coal);color:white;padding:60px;display:flex;flex-direction:column;justify-content:space-between;background-image:radial-gradient(ellipse at 90% 70%,#ac977329,transparent 65%)}.login-art h1{font:64px/1.05 'Cormorant Garamond',serif;max-width:470px}.login-art p{color:#c9bfb1;max-width:390px}.login-form{display:grid;place-items:center;padding:40px}.login-form form{width:100%;max-width:360px}.login-form h1{margin:15px 0}.login-form label{display:block;margin-top:20px;font-size:12px}.login-form input,.login-form button{width:100%;margin-top:9px}.login-form button{margin-top:24px}#shell{display:grid;grid-template-columns:240px minmax(0,1fr);min-height:100vh}.sidebar{background:var(--coal);color:#eee6db;position:fixed;inset:0 auto 0 0;width:240px;display:flex;flex-direction:column;padding:29px 18px}.sidebar .brand{padding:0 4px 27px;border-bottom:1px solid #ffffff17}.sidebar .brand b{font-size:19px}.sidebar .brand img{width:35px}.nav-label{color:#a59a8d;font-size:9px;letter-spacing:1.5px;margin:26px 14px 10px}.nav button{width:100%;text-align:left;border:0;background:transparent;color:#c9c0b5;padding:13px 15px;margin:3px 0;font-size:13px}.nav button.active{background:#ac977327;color:#e3cba6}.nav button span:first-child{display:inline-block;width:28px;font-size:18px}.sidebar-bottom{margin-top:auto;border-top:1px solid #ffffff17;padding-top:18px}.profile-button{background:transparent;border:0;display:flex;align-items:center;gap:10px;text-align:left;width:100%;padding:8px}.profile-button small{display:block;font-size:10px;color:#ad9f8e;margin-top:4px}.avatar{width:40px;height:40px;border-radius:13px;background:#e8ddcc;display:inline-grid;place-items:center;flex-shrink:0;font-size:27px}.sidebar-bottom>button:last-child{width:100%;margin-top:10px;background:#ffffff09;border-color:#ffffff18;color:#c9c0b5}.content{grid-column:2;padding:0 30px 40px;min-width:0}.topbar{height:78px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line);gap:15px}.topbar .right{display:flex;align-items:center;gap:12px}.secondary{background:white;color:var(--coal)}.heading{display:flex;align-items:center;justify-content:space-between;margin:30px 0 25px;gap:15px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:22px}.panel{background:white;border:1px solid var(--line);border-radius:15px;padding:22px;margin-bottom:20px;box-shadow:0 4px 20px #25221f03}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}.kpi{margin:0;padding:20px}.kpi strong{display:block;font-size:29px;letter-spacing:-1px;margin-top:13px}.kpi span{color:var(--muted);font-size:11px}.split{display:flex;justify-content:space-between;align-items:center;gap:12px}.row{display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid #f1ede7}.row:last-child{border:0}.row .grow{flex:1;min-width:0}.row b{font-size:13px}.row p{margin:4px 0;font-size:12px}.pill{display:inline-block;background:#f0eae0;color:#8b7049;font-size:10px;padding:5px 9px;border-radius:20px;white-space:nowrap}.bars{height:150px;display:flex;align-items:end;gap:14px;margin:25px 0 20px}.bar{flex:1;background:linear-gradient(#baa584,#8b7557);border-radius:5px 5px 0 0;position:relative;min-height:4px}.bar span{position:absolute;bottom:-20px;width:100%;text-align:center;font-size:10px;color:var(--muted)}.filters{display:flex;flex-wrap:wrap;gap:9px;margin-bottom:20px}.filters input{flex:1;min-width:130px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;background:#faf8f5;padding:15px}td{padding:17px 12px;border-bottom:1px solid var(--line);font-size:12px;vertical-align:top}td p{margin:4px 0}.links{display:flex;gap:8px;flex-wrap:wrap;margin-top:7px}.task-form{display:grid;grid-template-columns:1fr 145px 150px auto;gap:10px;margin-bottom:18px}.chat-panel{display:flex;flex-direction:column;height:540px}.chat-select{width:100%;margin-bottom:10px}.messages{flex:1;overflow:auto;min-height:0;padding:5px 2px}.message{display:flex;gap:9px;margin:15px 0}.message .avatar{width:30px;height:30px;font-size:21px;border-radius:10px}.message .bubble{max-width:85%;min-width:0}.message .text{background:#f4f0e9;padding:10px 12px;border-radius:0 12px 12px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.6}.message.mine .text{background:#292521;color:#f4ede2}.message b{font-size:10px}.message small{font-size:9px;color:var(--muted);margin-left:5px}.chat-form{display:flex;gap:8px;margin-top:12px}.chat-form textarea{flex:1;width:100%;min-height:45px;max-height:120px;resize:vertical;padding:10px}.chat-form button{padding:10px}.profile-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.form label{display:block;font-size:12px;margin:16px 0 7px}.form input,.form select{width:100%}.form button{margin-top:20px}.account-list{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.account-card{padding:20px}.account-card .actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:15px}.account-card .actions button{font-size:11px;min-height:34px;padding:7px 10px}.danger{background:#fff3ee;color:#a74d34;border-color:#edd5cb}.alert{background:#fff0e8;border:1px solid #ecd2be;color:#914e2d;padding:12px;border-radius:9px;margin:15px 0}.empty{color:var(--muted);font-size:12px;padding:20px 0}dialog{width:min(650px,calc(100% - 28px));border:1px solid var(--line);border-radius:18px;padding:28px;max-height:90vh;overflow:auto}dialog::backdrop{background:#25221f90}dialog textarea{width:100%}dialog dl{display:grid;grid-template-columns:115px 1fr;gap:12px;font-size:12px}dd{margin:0;overflow-wrap:anywhere}dt{color:var(--muted)}#mobileMenu{display:none}#toast{position:fixed;bottom:25px;left:50%;transform:translateX(-50%);background:var(--coal);color:white;padding:13px 20px;border-radius:10px;z-index:100;max-width:90vw}#chatView .chat-panel{height:calc(100vh - 230px);min-height:430px}#chatView{max-width:950px}.toolbar{display:flex;gap:8px}.unread{background:var(--gold);color:#25221f;border-radius:10px;font-size:10px;padding:2px 6px;margin-left:7px}\n@media(max-width:1200px){.layout{grid-template-columns:1fr}.side-stack{display:grid;grid-template-columns:1fr 1fr;gap:20px}.account-list{grid-template-columns:1fr 1fr}.kpis{grid-template-columns:1fr 1fr}}@media(max-width:760px){#login{grid-template-columns:1fr}.login-art{display:none}.login-form{padding:28px;min-height:100vh}#shell{grid-template-columns:1fr}.sidebar{transform:translateX(-100%);z-index:50;transition:.2s}.sidebar.open{transform:translateX(0);box-shadow:10px 0 80px #0006}.content{grid-column:1;padding:0 16px 30px}.topbar{height:65px}#mobileMenu{display:block}.topbar .muted{display:none}.heading{margin:24px 0}h1{font-size:26px}.side-stack,.profile-grid,.account-list{grid-template-columns:1fr}.task-form{grid-template-columns:1fr 1fr}.task-form input:first-child{grid-column:span 2}.kpi{padding:16px}.panel{padding:18px}.toolbar{flex-wrap:wrap}th,td{min-width:100px}dialog dl{grid-template-columns:1fr}#chatView .chat-panel{height:65vh}}\n .remember{display:flex!important;align-items:center;gap:9px;margin-top:16px!important;color:var(--muted)}.remember input{width:16px!important;height:16px;min-height:0;margin:0!important;accent-color:var(--gold)}.chart{display:grid;grid-template-columns:repeat(7,minmax(30px,1fr));gap:12px;align-items:end;height:185px;margin:20px 0 10px}.chart-day{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:end;gap:7px;min-width:0}.chart-count{font-size:11px;font-weight:700;color:var(--coal)}.chart-track{width:min(100%,36px);height:125px;display:flex;align-items:end;background:#f3f0ea;border-radius:7px;overflow:hidden}.chart-fill{width:100%;min-height:3px;background:linear-gradient(#baa584,#897657);border-radius:6px}.chart-label{font-size:10px;color:var(--muted)}.chat-workspace{display:grid;grid-template-columns:260px minmax(0,1fr);gap:18px}.people-list{display:grid;gap:6px}.person-button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:white;color:var(--coal);border:1px solid var(--line);padding:11px;border-radius:10px}.person-button:hover,.person-button.selected{background:#f8f5ef;filter:none}.presence-dot{width:9px;height:9px;border-radius:50%;background:#b7b1a8;display:inline-block;box-shadow:0 0 0 3px #f0ede8;flex:none}.presence-dot.online{background:#20a464;box-shadow:0 0 0 3px #e2f3e9}.person-info{flex:1;min-width:0}.person-info b{display:block;font-size:12px}.person-info small{color:var(--muted);font-size:10px}.chat-label{font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin:13px 2px 6px}.channel-button{width:100%;background:transparent;color:#61584e;text-align:left;border:0;padding:9px}.price-hint{font-size:11px;color:var(--muted);line-height:1.55}.conversation-card{height:calc(100vh - 185px)!important;min-height:450px!important}.mobile-overlay{display:none}.sidebar{overflow-y:auto}.topbar #quickAddCustomer{white-space:nowrap}.topbar #breadcrumb{font-size:13px}@media(max-width:900px){.chat-workspace{grid-template-columns:205px minmax(0,1fr);gap:12px}.chat-workspace .panel{padding:15px}}@media(max-width:760px){.chat-workspace{grid-template-columns:1fr}.people-list{grid-template-columns:1fr 1fr}.person-button{padding:9px}.chart{gap:5px;height:160px}.chart-track{height:105px}.chart-count{font-size:10px}.chart-label{font-size:9px}.topbar .right>a{display:none}.sidebar{width:min(300px,86vw)}.mobile-overlay.show{display:block;position:fixed;inset:0;background:#16120f80;z-index:40}.content{padding-left:14px;padding-right:14px}.heading{align-items:flex-start}.task-form{gap:8px}.chat-form textarea{min-width:0}}\n/* Consistent controls across the workspace */\nbutton,input,select,textarea{box-sizing:border-box;min-height:44px;border-radius:10px;line-height:1.35;font:inherit}input,select,textarea{background:#fff;color:var(--coal);border:1px solid var(--line);padding:11px 14px}input:not([type=checkbox]),select,textarea{width:100%;min-width:0}input[type=checkbox]{width:18px;height:18px;min-height:18px;padding:0;accent-color:var(--gold)}.form input:not([type=checkbox]),.form select,.form textarea,.task-form input,.task-form select,.task-form textarea{display:block;width:100%;min-width:0}.form textarea{resize:vertical}.form label{display:block;margin:16px 0 8px;font-size:12px;font-weight:600;color:#5d554b}.login-form input:not([type=checkbox]){width:100%;margin-top:9px}.remember-row{display:flex!important;align-items:center;gap:10px;margin:16px 0 0!important;font-weight:500!important;color:var(--muted)!important}.login-form .remember-row input{flex:0 0 18px;width:18px;height:18px;min-height:18px;padding:0;margin:0;accent-color:var(--gold)}.remember-row span{font-size:12px}.filters input,.filters select{width:auto;min-width:145px;flex:1}.task-form>*{min-width:0}.toolbar{display:flex;flex-wrap:wrap;gap:8px}.toolbar button{min-height:44px}.price-hint{color:var(--muted);font-size:12px;line-height:1.5;margin:6px 0}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--gold);outline-offset:2px}\n</style></head><body><section id=\"login\"><div class=\"login-art\"><div class=\"brand\"><img src=\"https://i.imgur.com/xm9nTpK.png\" alt=\"StoneBridge\"><div><b>STONEBRIDGE</b><small>DEVELOPMENT GROUP</small></div></div><div><div class=\"eyebrow\">INTERNAL OPERATIONS</div><h1>Operations,<br>organized.</h1><p>Leads, acquisitions, follow-ups, and team communication in one workspace.</p></div><div class=\"muted\">Private operations · StoneBridge Development Group</div></div><div class=\"login-form\"><form id=\"loginForm\"><div class=\"eyebrow\">AUTHORIZED TEAM ACCESS</div><h1>Welcome back.</h1><p class=\"muted\">Sign in to your StoneBridge workspace.</p><label for=\"username\">Username</label><input id=\"username\" autocomplete=\"username\" required value=\"admin\"><label for=\"password\">Password</label><input id=\"password\" type=\"password\" autocomplete=\"current-password\" required><label class=\"remember\"><input id=\"rememberMe\" type=\"checkbox\"> Stay signed in on this device</label><p class=\"price-hint\">Unchecked keeps you signed in until this browser session ends. Check this to remember this device for 30 days.</p><button id=\"loginButton\">Sign in to workspace →</button><p id=\"loginError\" class=\"alert\" hidden role=\"alert\"></p><p class=\"muted\" style=\"margin-top:30px\">Accounts are managed by the workspace owner.</p></form></div></section>\n<section id=\"shell\" hidden><div id=\"mobileOverlay\" class=\"mobile-overlay\"></div><aside class=\"sidebar\" id=\"sidebar\"><div class=\"brand\"><img src=\"https://i.imgur.com/xm9nTpK.png\" alt=\"StoneBridge\"><div><b>STONEBRIDGE</b><small>DEVELOPMENT GROUP</small></div></div><nav class=\"nav\"><div class=\"nav-label\">WORKSPACE</div><button data-view=\"overview\" class=\"active\"><span>◈</span> Overview</button><button data-view=\"leads\"><span>▤</span> Lead inbox</button><button data-view=\"customers\"><span>♙</span> Customers</button><button data-view=\"acquisitions\"><span>⌂</span> Acquisitions</button><button data-view=\"tasks\"><span>☑</span> Tasks & follow-ups</button><button data-view=\"chat\"><span>◫</span> Team messages <i id=\"unread\" class=\"unread\" hidden></i></button><div class=\"nav-label\">MANAGEMENT</div><button data-view=\"activity\"><span>◷</span> Activity log</button><button data-view=\"accounts\" id=\"accountsNav\"><span>♙</span> Team accounts</button><button data-view=\"profile\"><span>⚙</span> My profile</button></nav><div class=\"sidebar-bottom\"><button class=\"profile-button\" data-view=\"profile\"><span id=\"myAvatar\" class=\"avatar\"></span><span><b id=\"myName\"></b><small id=\"myRole\"></small></span></button><button id=\"logout\">↪ &nbsp; Log out</button></div></aside><main class=\"content\"><div class=\"topbar\"><div class=\"split\"><button id=\"mobileMenu\" class=\"secondary\" aria-label=\"Toggle navigation\">☰</button><b id=\"breadcrumb\">Workspace / Overview</b></div><div class=\"right\"><span id=\"refreshTime\" class=\"muted\">Idle refresh · 5 minutes</span><button id=\"refresh\" class=\"secondary\" title=\"Refresh workspace\">↻</button><button id=\"quickAddCustomer\">+ Add customer</button><a href=\"https://stonebridgedg.com\" target=\"_blank\" rel=\"noopener\">View website ↗</a></div></div><p id=\"error\" class=\"alert\" hidden role=\"alert\"></p><div class=\"heading\"><div><div class=\"eyebrow\" id=\"pageKicker\">OPERATIONS AT A GLANCE</div><h1 id=\"pageTitle\">Your workspace.</h1></div><span id=\"today\" class=\"muted\"></span></div>\n<section id=\"overviewView\"><div class=\"kpis\" id=\"kpis\"></div><div class=\"layout\"><div><div class=\"panel\"><div class=\"split\"><div><h2>New leads</h2><span class=\"muted\">Daily submissions over the last 7 days</span></div><span id=\"chartTotal\" class=\"pill\">0 this week</span></div><div id=\"bars\" class=\"chart\" role=\"img\" aria-label=\"Daily lead counts for the last seven days\"></div></div><div class=\"panel\"><div class=\"split\"><h2>Latest opportunities</h2><button class=\"secondary\" data-view=\"leads\">View all ↗</button></div><div id=\"recent\"></div></div><div class=\"panel\"><h2>Next up</h2><div id=\"dueLeads\"></div></div></div><aside class=\"side-stack\"><div class=\"panel\"><div class=\"split\"><h2>Team activity</h2><span class=\"pill\">Live records</span></div><div id=\"recentActivity\"></div></div><div id=\"quickChatHost\"></div></aside></div></section>\n<section id=\"leadsView\" hidden><div class=\"panel\"><div class=\"filters\"><input id=\"search\" placeholder=\"Search name, email, or property\" aria-label=\"Search\"><select id=\"type\"><option value=\"\">All types</option><option value=\"seller\">Sellers</option><option value=\"contact\">Inquiries</option></select><select id=\"status\"><option value=\"\">All statuses</option><option>New</option><option>Contacted</option><option>In review</option><option>Under contract</option><option>Purchased</option><option>Closed</option></select><select id=\"temperature\"><option value=\"\">All temperatures</option><option>Hot lead</option><option>Warm lead</option><option>Cold lead</option><option>Unmotivated</option><option>Unclassified</option></select><select id=\"due\"><option value=\"\">All follow-ups</option><option value=\"today\">Due today</option><option value=\"overdue\">Overdue</option></select><select id=\"sort\"><option value=\"newest\">Newest first</option><option value=\"oldest\">Oldest first</option><option value=\"followup\">Follow-up first</option></select><button id=\"export\" class=\"secondary\">Export CSV</button></div><div class=\"table-wrap\"><table><thead><tr><th>Seller / inquiry</th><th>Property</th><th>Status</th><th>Contact</th><th>Follow-up</th><th></th></tr></thead><tbody id=\"rows\"></tbody></table></div><p id=\"leadCount\" class=\"muted\"></p></div></section>\n<section id=\"customersView\" hidden><div class=\"panel\"><div class=\"split\"><div><h2>Customer list</h2><p class=\"muted\">Website submissions and customers added by your team.</p></div><button id=\"addCustomer\">+ Add customer</button></div><div class=\"filters\"><input id=\"customerSearch\" placeholder=\"Search name, email, phone, property\"><select id=\"customerInterest\"><option value=\"\">All interests</option><option>Rent Property</option><option>General Inquiry</option><option>Sell Home</option></select></div><div class=\"table-wrap\"><table><thead><tr><th>Customer</th><th>Interest</th><th>Property</th><th>Contact</th><th>Source</th><th>Received</th><th>Actions</th></tr></thead><tbody id=\"customerRows\"></tbody></table></div><p id=\"customerCount\" class=\"muted\"></p></div></section><section id=\"acquisitionsView\" hidden><div class=\"kpis\" id=\"purchaseKpis\"></div><div class=\"panel\"><h2>Contracts & completed purchases</h2><div id=\"purchases\"></div></div></section>\n<section id=\"tasksView\" hidden><div class=\"panel\"><h2>Create a task</h2><form id=\"taskForm\" class=\"task-form\"><input id=\"taskTitle\" placeholder=\"What needs to happen?\" required maxlength=\"200\"><input id=\"taskDate\" type=\"date\" aria-label=\"Due date\"><select id=\"taskAssignee\" aria-label=\"Assign to\"></select><button>Add task</button></form><div id=\"tasks\"></div></div></section>\n<section id=\"chatView\" hidden><div class=\"chat-workspace\"><aside class=\"panel people-card\"><div class=\"split\"><h2>People</h2><span id=\"onlineCount\" class=\"pill\">0 online</span></div><p class=\"muted\">Green means they are here now. Select anyone to start a private chat.</p><div id=\"peopleList\" class=\"people-list\"></div><div class=\"chat-label\">Channels</div><button class=\"channel-button\" data-channel=\"general\"># &nbsp; General</button><button class=\"channel-button\" data-channel=\"acquisitions\"># &nbsp; Acquisitions</button></aside><div id=\"fullChatHost\"></div></div></section><section id=\"activityView\" hidden><div class=\"panel\"><h2>Workspace activity</h2><div id=\"activity\"></div></div></section>\n<section id=\"accountsView\" hidden><div class=\"panel\"><div class=\"split\"><div><h2>Manage your team</h2><p class=\"muted\">Only your master account can create, edit, disable, reset, or remove accounts.</p></div><button id=\"addAccount\">+ Create account</button></div></div><div id=\"accounts\" class=\"account-list\"></div></section>\n<section id=\"profileView\" hidden><div class=\"profile-grid\"><form id=\"profileForm\" class=\"panel form\"><h2>Your profile</h2><div class=\"split\"><span id=\"profileAvatar\" class=\"avatar\"></span><span id=\"profileUsername\" class=\"pill\"></span></div><label for=\"profileName\">Display name</label><input id=\"profileName\" required maxlength=\"80\"><label for=\"profileEmail\">Your reply-to email</label><input id=\"profileEmail\" type=\"email\" maxlength=\"254\" placeholder=\"you@example.com\"><label for=\"profileGender\">Avatar</label><select id=\"profileGender\"><option value=\"male\">Male avatar 👨🏻</option><option value=\"female\">Female avatar 👩🏻</option></select><button>Save profile</button></form><form id=\"passwordForm\" class=\"panel form\"><h2>Password & security</h2><p id=\"ownerPasswordNote\" class=\"muted\" hidden>Your master password stays in your existing ADMIN_TOKEN Worker secret. Update that secret to change it.</p><div id=\"passwordFields\"><label>Current password</label><input id=\"currentPassword\" type=\"password\" autocomplete=\"current-password\" required><label>New password</label><input id=\"newPassword\" type=\"password\" autocomplete=\"new-password\" required minlength=\"10\"><button>Update password</button></div><p class=\"muted\">Sessions expire after 12 hours. Password resets and disabled accounts revoke existing sessions.</p></form></div></section>\n</main></section><dialog id=\"leadDialog\"><div class=\"split\"><h2>Lead details</h2><button data-close=\"leadDialog\" class=\"secondary\">✕</button></div><div class=\"toolbar\" style=\"margin:12px 0\"><button type=\"button\" id=\"emailLead\">Email customer</button><button type=\"button\" id=\"sendContract\" hidden>Send signing email</button></div><div id=\"leadLinks\" class=\"links\"></div><dl id=\"leadFields\"></dl><form id=\"leadForm\" class=\"form\"><label>Status</label><select id=\"leadStatus\"><option>New</option><option>Contacted</option><option>In review</option><option>Under contract</option><option>Purchased</option><option>Closed</option></select><label>Temperature</label><select id=\"leadTemperature\"><option>Unclassified</option><option>Hot lead</option><option>Warm lead</option><option>Cold lead</option><option>Unmotivated</option></select><label>Follow-up</label><input id=\"leadFollow\" type=\"date\"><label>Notes</label><textarea id=\"leadNotes\" rows=\"4\" maxlength=\"10000\"></textarea><div class=\"profile-grid\"><div><label>Purchase price ($)</label><p class=\"price-hint\">Enter the agreed price. Saving the lead stores this value and recalculates acquisition totals automatically.</p><input id=\"leadPrice\" type=\"number\" min=\"0\" max=\"1000000000\" step=\".01\"></div><div><label>Closing date</label><input id=\"leadClosing\" type=\"date\"></div></div><p id=\"leadError\" class=\"alert\" hidden></p><button>Save lead</button></form></dialog>\n<dialog id=\"customerDialog\"><div class=\"split\"><h2>Add customer</h2><button data-close=\"customerDialog\" class=\"secondary\">✕</button></div><form id=\"customerForm\" class=\"form\"><label>Name</label><input id=\"newCustomerName\" maxlength=\"120\" required><label>Personal email</label><input id=\"newCustomerEmail\" type=\"email\" maxlength=\"254\"><label>Phone</label><input id=\"newCustomerPhone\" type=\"tel\" maxlength=\"40\"><label>Interested in</label><select id=\"newCustomerInterest\"><option>Rent Property</option><option>General Inquiry</option><option>Sell Home</option></select><label>Property / address</label><input id=\"newCustomerProperty\" maxlength=\"300\"><label>Notes</label><textarea id=\"newCustomerNotes\" maxlength=\"5000\" rows=\"3\"></textarea><p id=\"customerError\" class=\"alert\" hidden></p><button>Save customer</button></form></dialog><dialog id=\"emailDialog\"><div class=\"split\"><div><div class=\"eyebrow\">STONEBRIDGE EMAIL</div><h2>Write to customer</h2></div><button data-close=\"emailDialog\" class=\"secondary\">✕</button></div><form id=\"emailForm\" class=\"form\"><label>To · customer personal email</label><input id=\"emailTo\" type=\"email\" readonly><label>Subject</label><input id=\"emailSubject\" maxlength=\"180\" required><label>Message</label><textarea id=\"emailBody\" rows=\"8\" maxlength=\"5000\" required></textarea><p id=\"replyToLabel\" class=\"muted\"></p><div class=\"price-hint\">Sent as a StoneBridge HTML email. Replies go to your personal reply-to email from My Profile, or info@stonebridgedg.com if it is blank.</div><p id=\"emailError\" class=\"alert\" hidden></p><div class=\"toolbar\"><button type=\"button\" id=\"copyEmailHtml\" class=\"secondary\">Copy email HTML</button><button type=\"submit\" id=\"sendEmailButton\">Send email</button></div></form></dialog><dialog id=\"accountDialog\"><div class=\"split\"><h2 id=\"accountHeading\">Create account</h2><button data-close=\"accountDialog\" class=\"secondary\">✕</button></div><form id=\"accountForm\" class=\"form\"><label>Username</label><input id=\"accountUsername\" required pattern=\"[a-z0-9._-]{3,40}\" autocomplete=\"off\"><label>Display name</label><input id=\"accountName\" required maxlength=\"80\"><label id=\"accountPasswordLabel\">Password · at least 10 characters</label><input id=\"accountPassword\" type=\"password\" minlength=\"10\" autocomplete=\"new-password\"><label>Avatar</label><select id=\"accountAvatar\"><option value=\"male\">Male 👨🏻</option><option value=\"female\">Female 👩🏻</option></select><p id=\"accountError\" class=\"alert\" hidden></p><button>Save account</button></form></dialog><div id=\"toast\" hidden role=\"status\"></div>\n<script>\nconst $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));const API=location.hostname.endsWith('workers.dev')?location.origin+'/admin/api':'https://stonebridge.psznbzhnps.workers.dev/admin/api';let token=readSessionCookie(),me=null,users=[],presence=[],leads=[],manualCustomers=[],customerTarget=null,tasks=[],activity=[],view='overview',room='general',selectedLead=null,editingAccount=null,lastInteraction=Date.now(),lastRefresh=0,chatBusy=false,messages=[],chatMore=false;const avatar=u=>u.avatar==='female'?'👩🏻':'👨🏻';const date=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Detroit',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n||0);const humanDate=d=>new Date(d).toLocaleString('en-US',{timeZone:'America/Detroit',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});const empty=s=>'<p class=\"empty\">'+esc(s)+'</p>';function notice(s){$('toast').textContent=s;$('toast').hidden=false;clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('toast').hidden=true,4000)}function error(id,s){$(id).textContent=s;$(id).hidden=!s}\nasync function api(path,method='GET',data){const r=await fetch(API+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)})});const d=await r.json();if(!r.ok){if(r.status===401&&path!='/login')lock();throw Error(d.error||'Request failed');}return d}\nfunction setSessionCookie(v,remember){const sec=location.protocol==='https:'?'; Secure':'';const cookiePath=location.pathname.startsWith('/admin')?'/admin':(location.pathname||'/');document.cookie=v?'sb_workspace_session='+encodeURIComponent(v)+'; Path='+cookiePath+'; SameSite=Strict'+(remember?'; Max-Age=2592000':'')+sec:'sb_workspace_session=; Path='+cookiePath+'; Max-Age=0; SameSite=Strict'+sec}function readSessionCookie(){const m=document.cookie.match(/(?:^|; )sb_workspace_session=([^;]+)/);try{return m?decodeURIComponent(m[1]):''}catch{return ''}}function lock(){setSessionCookie('',false);token='';me=null;users=[];leads=[];messages=[];tasks=[];activity=[];$('shell').hidden=true;$('login').hidden=false;document.querySelectorAll('dialog').forEach(d=>d.close());document.querySelectorAll('input[type=password]').forEach(i=>i.value='');$('chatMessages')?.replaceChildren();$('sidebar').classList.remove('open');}\n$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginButton').disabled=true;error('loginError','');try{const remember=$('rememberMe').checked;const d=await api('/login','POST',{username:$('username').value,password:$('password').value,remember});token=d.token;setSessionCookie(token,remember);me=d.user;$('password').value='';$('login').hidden=true;$('shell').hidden=false;show('overview');await refresh();}catch(e){error('loginError',e.message)}finally{$('loginButton').disabled=false}};$('logout').onclick=async()=>{try{await api('/logout','POST',{})}catch{}lock()};if(token){$('login').hidden=true;$('shell').hidden=false;api('/me').then(d=>{me=d.user;show('overview');return refresh()}).catch(()=>lock())};$('mobileMenu').onclick=()=>{$('sidebar').classList.toggle('open');$('mobileOverlay').classList.toggle('show')};$('mobileOverlay').onclick=()=>{$('sidebar').classList.remove('open');$('mobileOverlay').classList.remove('show')};\nconst titles={overview:['OPERATIONS AT A GLANCE','Your workspace.'],leads:['ACQUISITIONS & INQUIRIES','Your opportunities.'],customers:['CUSTOMER RECORDS','People who reached out.'],acquisitions:['PROPERTY PIPELINE','From contract to closing.'],tasks:['KEEP THINGS MOVING','Tasks & follow-ups.'],chat:['THE TEAM WORKSPACE','Keep the conversation going.'],activity:['WORKSPACE HISTORY','Every move, recorded.'],accounts:['OWNER CONTROLS','Your people. Your permissions.'],profile:['PERSONAL SETTINGS','Make yourself at home.']};\nfunction show(v){if(v==='accounts'&&!me?.owner)return;view=v;Object.keys(titles).forEach(x=>$(x+'View').hidden=x!==v);document.querySelectorAll('.nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===v));$('pageKicker').textContent=titles[v][0];$('pageTitle').textContent=titles[v][1];$('breadcrumb').textContent='Workspace / '+({leads:'Lead inbox',chat:'Team messages'}[v]||v[0].toUpperCase()+v.slice(1));$('sidebar').classList.remove('open');mountChat();if(token)refreshChat().catch(e=>error('error',e.message));}\ndocument.addEventListener('click',e=>{const v=e.target.closest('[data-view]');if(v)show(v.dataset.view);const c=e.target.closest('[data-close]');if(c)$(c.dataset.close).close();const l=e.target.closest('[data-lead]');if(l)openLead(l.dataset.lead);});\nasync function refresh(){error('error','');try{const all=[];let off=0;while(true){const d=await api('/leads?offset='+off);all.push(...d.items);if(!d.more)break;off=all.length;}const [uu,tt,aa,mm,pp,cc]=await Promise.all([api('/users'),api('/tasks'),api('/activity'),api('/me'),api('/presence'),api('/customers')]);leads=all;users=uu.items;tasks=tt.items;activity=aa.items;me=mm.user;presence=pp.items;manualCustomers=cc.items;render();lastRefresh=Date.now();$('refreshTime').textContent='Updated '+new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});await heartbeat();await refreshChat();}catch(e){error('error',e.message)}}$('refresh').onclick=refresh;\nfunction propertyLinks(a){const q=encodeURIComponent(a);return '<a href=\"https://app.propstream.com/\" target=\"_blank\" rel=\"noopener\" data-copy=\"'+esc(a)+'\">PropStream</a><a href=\"https://www.zillow.com/homes/'+q+'_rb/\" target=\"_blank\" rel=\"noopener\">Zillow</a><a href=\"https://www.google.com/maps/search/?api=1&query='+q+'\" target=\"_blank\" rel=\"noopener\">Maps</a>'}document.addEventListener('click',e=>{const a=e.target.closest('[data-copy]');if(a)navigator.clipboard?.writeText(a.dataset.copy).then(()=>notice('Address copied for PropStream.')).catch(()=>notice('Paste the property address into PropStream.'))});\nfunction leadRow(l){return '<tr><td><b>'+esc(l.name)+'</b><p class=\"muted\">'+humanDate(l.created_at)+'</p><span class=\"pill\">'+esc(l.type)+'</span></td><td>'+esc(l.address||l.property||l.subject)+'<div class=\"links\">'+(l.address?propertyLinks(l.address):'')+'</div></td><td><span class=\"pill\">'+esc(l.status)+'</span><p class=\"muted\">'+esc(l.temperature)+'</p></td><td><a href=\"mailto:'+esc(encodeURIComponent(l.email))+'\">'+esc(l.email)+'</a><p><a href=\"tel:'+esc(String(l.phone||'').replace(/[^+0-9]/g,''))+'\">'+esc(l.phone)+'</a></p></td><td>'+esc(l.follow_up||'Not scheduled')+'</td><td><button class=\"secondary\" data-lead=\"'+esc(l.id)+'\">Open →</button></td></tr>'}\nfunction filtered(){let rows=leads.filter(l=>(!$('type').value||l.type===$('type').value)&&(!$('status').value||l.status===$('status').value)&&(!$('temperature').value||l.temperature===$('temperature').value)&&(!$('search').value||[l.name,l.email,l.address,l.property,l.subject].join(' ').toLowerCase().includes($('search').value.toLowerCase()))&&(!$('due').value||(l.follow_up&& !['Closed','Purchased'].includes(l.status)&&($('due').value==='today'?l.follow_up===date():l.follow_up<date()))));return rows.sort((a,b)=>$('sort').value==='oldest'?a.created_at.localeCompare(b.created_at):$('sort').value==='followup'?(a.follow_up||'9999').localeCompare(b.follow_up||'9999'):b.created_at.localeCompare(a.created_at))}function renderLeads(){$('rows').innerHTML=filtered().map(leadRow).join('')||'<tr><td colspan=\"6\">No matching opportunities.</td></tr>';$('leadCount').textContent=filtered().length+' of '+leads.length+' records'}['search','type','status','temperature','due','sort'].forEach(id=>$(id).oninput=renderLeads);\nfunction compactLead(l){return '<div class=\"row\"><div class=\"grow\"><b>'+esc(l.name)+'</b><p class=\"muted\">'+esc(l.address||l.subject||l.property)+'</p></div><span class=\"pill\">'+esc(l.status)+'</span><button class=\"secondary\" data-lead=\"'+esc(l.id)+'\">→</button></div>'}function activityRow(a){return '<div class=\"row\"><div class=\"grow\"><b>'+esc(a.actor)+'</b><p>'+esc(a.action)+'</p><p class=\"muted\">'+esc(a.subject)+'</p><span class=\"muted\">'+humanDate(a.created_at)+'</span></div></div>'}\nfunction render(){const due=leads.filter(l=>l.follow_up&&l.follow_up<=date()&&!['Closed','Purchased'].includes(l.status));const bought=leads.filter(l=>l.status==='Purchased');$('kpis').innerHTML=[['Total opportunities',leads.length,'All stored submissions'],['Awaiting contact',leads.filter(l=>l.status==='New').length,'Start the next conversation'],['Follow-ups due',due.length,'Today and overdue'],['Purchase volume',money(bought.reduce((n,l)=>n+(Number(l.purchase_price)||0),0)),bought.length+' completed purchases']].map(([a,b,c])=>'<div class=\"panel kpi\"><span>'+a+'</span><strong>'+b+'</strong><p class=\"muted\">'+c+'</p></div>').join('');const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Detroit',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)});const counts=days.map(d=>leads.filter(l=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Detroit',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(l.created_at))===d).length);$('chartTotal').textContent=counts.reduce((a,b)=>a+b,0)+' this week';$('bars').innerHTML=days.map((d,i)=>'<div class=\"chart-day\" title=\"'+esc(d+': '+counts[i]+' leads')+'\"><b class=\"chart-count\">'+counts[i]+'</b><div class=\"chart-track\"><i class=\"chart-fill\" style=\"height:'+Math.max(3,counts[i]/Math.max(1,...counts)*100)+'%\"></i></div><span class=\"chart-label\">'+new Date(d+'T12:00:00').toLocaleDateString('en-US',{timeZone:'America/Detroit',weekday:'short'})+'</span></div>').join('');$('recent').innerHTML=leads.slice(0,5).map(compactLead).join('')||empty('No leads yet. Website submissions will appear here.');$('dueLeads').innerHTML=due.slice(0,5).map(compactLead).join('')||empty('You’re caught up. No follow-ups are due.');$('recentActivity').innerHTML=activity.slice(0,4).map(activityRow).join('')||empty('Workspace activity will appear here.');$('activity').innerHTML=activity.map(activityRow).join('')||empty('No activity recorded yet.');const priced=bought.filter(l=>l.purchase_price!==null&&l.purchase_price!==undefined&&Number.isFinite(Number(l.purchase_price)));$('purchaseKpis').innerHTML=[['Under contract',leads.filter(l=>l.status==='Under contract').length],['Completed purchases',bought.length],['Saved purchase prices',priced.length+' / '+bought.length],['Total invested · automatic',money(priced.reduce((n,l)=>n+Number(l.purchase_price),0))]].map(([a,b])=>'<div class=\"panel kpi\"><span>'+a+'</span><strong>'+b+'</strong><p class=\"muted\">Calculated from saved lead records</p></div>').join('');$('purchases').innerHTML=leads.filter(l=>['Purchased','Under contract'].includes(l.status)).map(l=>'<div class=\"panel\"><div class=\"split\"><div>'+compactLead(l)+'<span class=\"muted\">Closing · '+esc(l.closing_date||'not set')+'</span></div><div style=\"text-align:right\"><span class=\"muted\">Saved price</span><strong style=\"display:block;font-size:20px\">'+(l.purchase_price==null?'—':money(l.purchase_price))+'</strong></div></div></div>').join('')||empty('Set a lead to Under contract or Purchased, then enter a price to track it here.');$('taskAssignee').innerHTML='<option value=\"\">Unassigned</option>'+users.filter(u=>u.active).map(u=>'<option value=\"'+esc(u.name)+'\">'+esc(u.name)+'</option>').join('');renderTasks();renderLeads();renderAccounts();$('myAvatar').textContent=avatar(me);$('profileAvatar').textContent=avatar(me);$('myName').textContent=me.name;$('myRole').textContent=me.owner?'Workspace owner':'Team member';$('accountsNav').hidden=!me.owner;$('profileName').value=me.name;$('profileEmail').value=me.email||'';$('profileGender').value=me.avatar;$('profileUsername').textContent='@'+me.username;$('ownerPasswordNote').hidden=!me.owner;$('passwordFields').hidden=me.owner;$('currentPassword').required=!me.owner;$('newPassword').required=!me.owner;$('today').textContent=new Date().toLocaleDateString('en-US',{timeZone:'America/Detroit',weekday:'long',month:'long',day:'numeric'});updateChatOptions()}\nfunction renderTasks(){$('tasks').innerHTML=tasks.map(t=>'<div class=\"row\"><div class=\"grow\"><b>'+esc(t.title)+'</b><p class=\"muted\">'+esc(t.assignee||'Unassigned')+' · '+esc(t.due_date||'No due date')+'</p></div><span class=\"pill\">'+(t.done?'Completed':'Open')+'</span><button class=\"secondary\" data-task=\"'+esc(t.id)+'\">'+(t.done?'Reopen':'Complete')+'</button><button class=\"danger\" data-task-delete=\"'+esc(t.id)+'\" aria-label=\"Delete task\">✕</button></div>').join('')||empty('No tasks yet. Create your first task above.')}\n$('taskForm').onsubmit=async e=>{e.preventDefault();try{await api('/tasks','POST',{title:$('taskTitle').value,assignee:$('taskAssignee').value,due_date:$('taskDate').value});$('taskTitle').value='';await refresh();notice('Task added.')}catch(e){error('error',e.message)}};document.addEventListener('click',async e=>{const b=e.target.closest('[data-task],[data-task-delete]');if(!b)return;try{if(b.dataset.taskDelete){if(!confirm('Delete this task?'))return;await api('/tasks/'+b.dataset.taskDelete,'DELETE')}else await api('/tasks/'+b.dataset.task,'PATCH',{done:!tasks.find(t=>t.id===b.dataset.task).done});await refresh()}catch(e){error('error',e.message)}});\nfunction openLead(id){const l=leads.find(l=>l.id===id);if(!l)return;selectedLead=l;$('leadFields').innerHTML=['name','type','email','phone','address','timing','condition','property','subject','message','email_status','created_at'].filter(k=>l[k]).map(k=>'<dt>'+esc(k.replaceAll('_',' '))+'</dt><dd>'+esc(l[k])+'</dd>').join('');$('leadLinks').innerHTML=(l.address?propertyLinks(l.address):'')+'<a href=\"mailto:'+esc(encodeURIComponent(l.email))+'\">Email</a>'+(l.phone?'<a href=\"tel:'+esc(l.phone.replace(/[^+0-9]/g,''))+'\">Call</a>':'');$('leadStatus').value=l.status;$('leadTemperature').value=l.temperature||'Unclassified';$('leadFollow').value=l.follow_up||'';$('leadNotes').value=l.notes||'';$('leadPrice').value=l.purchase_price??'';$('leadClosing').value=l.closing_date||'';$('sendContract').hidden=l.type!=='seller';error('leadError','');$('leadDialog').showModal()}\n$('leadForm').onsubmit=async e=>{e.preventDefault();try{await api('/leads/'+selectedLead.id,'PATCH',{status:$('leadStatus').value,temperature:$('leadTemperature').value,follow_up:$('leadFollow').value,notes:$('leadNotes').value,purchase_price:$('leadPrice').value===''?null:Number($('leadPrice').value),closing_date:$('leadClosing').value});$('leadDialog').close();await refresh();notice('Lead and purchase price saved. Acquisition totals updated.')}catch(e){error('leadError',e.message)}};\n$('export').onclick=()=>{const keys=['created_at','name','type','email','phone','address','status','temperature','follow_up','notes','purchase_price','closing_date'];const cell=v=>'\"'+String(v??'').replace(/^[\\s]*[=+@-]/,\"'$&\").replaceAll('\"','\"\"')+'\"';const blob=new Blob(['\\ufeff'+[keys.join(','),...filtered().map(l=>keys.map(k=>cell(l[k])).join(','))].join('\\r\\n')],{type:'text/csv'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='stonebridge-leads.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};\nfunction renderAccounts(){$('accounts').innerHTML=users.map(u=>'<div class=\"panel account-card\"><div class=\"split\"><span class=\"avatar\">'+avatar(u)+'</span><span class=\"pill\">'+(u.owner?'Owner':u.active?'Active':'Disabled')+'</span></div><h2 style=\"margin:16px 0 4px\">'+esc(u.name)+'</h2><p class=\"muted\">@'+esc(u.username)+'</p><div class=\"actions\">'+(u.owner?'<span class=\"muted\">Protected master account</span>':'<button class=\"secondary\" data-user-edit=\"'+esc(u.id)+'\">Edit / reset</button><button class=\"secondary\" data-user-toggle=\"'+esc(u.id)+'\">'+(u.active?'Disable':'Enable')+'</button><button class=\"danger\" data-user-delete=\"'+esc(u.id)+'\">Remove</button>')+'</div></div>').join('')}\nfunction accountModal(u=null){editingAccount=u;$('accountHeading').textContent=u?'Edit account':'Create account';$('accountUsername').value=u?.username||'';$('accountUsername').disabled=!!u;$('accountName').value=u?.name||'';$('accountPassword').value='';$('accountPassword').required=!u;$('accountPasswordLabel').textContent=u?'Reset password · leave blank to keep current':'Password · at least 10 characters';$('accountAvatar').value=u?.avatar||'male';error('accountError','');$('accountDialog').showModal()}$('addAccount').onclick=()=>accountModal();\n$('accountForm').onsubmit=async e=>{e.preventDefault();try{const d={username:$('accountUsername').value,name:$('accountName').value,avatar:$('accountAvatar').value};if($('accountPassword').value)d.password=$('accountPassword').value;await api(editingAccount?'/users/'+editingAccount.id:'/users',editingAccount?'PATCH':'POST',d);$('accountPassword').value='';$('accountDialog').close();await refresh();notice('Account saved.')}catch(e){error('accountError',e.message)}};\ndocument.addEventListener('click',async e=>{const b=e.target.closest('[data-user-edit],[data-user-toggle],[data-user-delete]');if(!b)return;const u=users.find(u=>u.id===(b.dataset.userEdit||b.dataset.userToggle||b.dataset.userDelete));if(b.dataset.userEdit)return accountModal(u);try{if(b.dataset.userDelete){if(!confirm('Remove '+u.name+'? Their access ends immediately. Saved messages remain in history.'))return;await api('/users/'+u.id,'DELETE')}else await api('/users/'+u.id,'PATCH',{active:!u.active});await refresh();notice('Account updated.')}catch(e){error('error',e.message)}});\n$('profileGender').onchange=()=>$('profileAvatar').textContent=avatar({avatar:$('profileGender').value});$('profileForm').onsubmit=async e=>{e.preventDefault();try{await api('/me','PATCH',{name:$('profileName').value,email:$('profileEmail').value,avatar:$('profileGender').value});await refresh();notice('Profile saved.')}catch(e){error('error',e.message)}};$('passwordForm').onsubmit=async e=>{e.preventDefault();try{await api('/password','POST',{current:$('currentPassword').value,password:$('newPassword').value});$('passwordForm').reset();notice('Password updated. Other sessions were signed out.')}catch(e){error('error',e.message)}};\nfunction mountChat(){if(!$('chatPanel')){const div=document.createElement('div');div.id='chatPanel';div.className='panel chat-panel conversation-card';div.innerHTML='<div class=\"split\"><h2 id=\"chatTitle\"># General</h2><span class=\"pill\">Shared workspace</span></div><select id=\"chatRoom\" class=\"chat-select\" aria-label=\"Conversation\"></select><button id=\"olderMessages\" class=\"secondary\" hidden>Load older messages</button><div id=\"chatMessages\" class=\"messages\" aria-live=\"polite\"></div><p id=\"chatError\" class=\"muted\" role=\"status\"></p><form id=\"chatForm\" class=\"chat-form\"><textarea id=\"chatText\" placeholder=\"Write a message…\" required maxlength=\"4000\" rows=\"1\" aria-label=\"Message\"></textarea><button id=\"sendMessage\" aria-label=\"Send message\">Send ↑</button></form>';$('quickChatHost').append(div);$('chatRoom').onchange=()=>{room=$('chatRoom').value;messages=[];refreshChat(true).catch(e=>$('chatError').textContent=e.message)};$('chatText').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('chatForm').requestSubmit()}});$('olderMessages').onclick=async()=>{try{const d=await api('/messages?room='+encodeURIComponent(room)+'&before='+messages[0].id);messages=d.items.concat(messages);chatMore=d.more;renderMessages(false)}catch(e){$('chatError').textContent=e.message}};$('chatForm').onsubmit=async e=>{e.preventDefault();if(chatBusy)return;chatBusy=true;$('sendMessage').disabled=true;try{await api('/messages','POST',{room,body:$('chatText').value});$('chatText').value='';await refreshChat(true)}catch(e){$('chatError').textContent=e.message}finally{chatBusy=false;$('sendMessage').disabled=false}}}const host=view==='chat'?'fullChatHost':'quickChatHost';$(host).append($('chatPanel'));updateChatOptions()}\nfunction updateChatOptions(){if(!$('chatRoom')||!me)return;const opts=[['general','# General'],['acquisitions','# Acquisitions']];if(!opts.some(o=>o[0]===room)&&!room.startsWith('dm:'))room='general';$('chatRoom').innerHTML=opts.map(([id,name])=>'<option value=\"'+esc(id)+'\">'+esc(name)+'</option>').join('');$('chatRoom').value=room.startsWith('dm:')?'general':room;renderPeople()}\nfunction renderPeople(){const list=$('peopleList');if(!list||!me)return;const active=users.filter(u=>u.active&&u.id!==me.id).sort((a,b)=>Number(isOnline(b.id))-Number(isOnline(a.id))||a.name.localeCompare(b.name));$('onlineCount').textContent=active.filter(u=>isOnline(u.id)).length+' online';list.innerHTML=active.map(u=>{const dm='dm:'+[me.id,u.id].sort().join(':');return '<button class=\"person-button '+(room===dm?'selected':'')+'\" data-dm=\"'+esc(u.id)+'\"><span class=\"avatar\" style=\"width:34px;height:34px;font-size:22px\">'+avatar(u)+'</span><span class=\"person-info\"><b>'+esc(u.name)+'</b><small>'+esc(u.username)+'</small></span><i class=\"presence-dot '+(isOnline(u.id)?'online':'')+'\" title=\"'+(isOnline(u.id)?'Online':'Offline')+'\"></i></button>'}).join('')||empty('Create team accounts to start private conversations.')}function isOnline(id){const p=presence.find(x=>x.user_id===id);return !!p&&Date.now()-Date.parse(p.last_seen)<65000}document.addEventListener('click',e=>{const b=e.target.closest('[data-dm],[data-channel]');if(!b)return;if(b.dataset.dm)room='dm:'+[me.id,b.dataset.dm].sort().join(':');else if(b.dataset.channel)room=b.dataset.channel;messages=[];updateChatOptions();renderMessages();refreshChat(true).catch(err=>{$('chatError').textContent=err.message})});\nfunction renderMessages(bottom=true){if(!$('chatMessages'))return;const title=$('chatTitle');if(title){if(room.startsWith('dm:')){const other=room.slice(3).split(':').find(x=>x!==me.id),person=users.find(x=>x.id===other);title.textContent=(person?person.name:'Direct conversation')+(isOnline(other)?' · Online':' · Offline')}else title.textContent=room==='general'?'# General':'# Acquisitions';}const el=$('chatMessages'),nearBottom=el.scrollHeight-el.scrollTop-el.clientHeight<70;$('chatMessages').innerHTML=messages.map(m=>'<div class=\"message '+(m.sender===me.id?'mine':'')+'\"><span class=\"avatar\">'+avatar(m)+'</span><div class=\"bubble\"><p style=\"margin:0 0 5px\"><b>'+esc(m.name)+'</b><small>'+humanDate(m.created_at)+'</small></p><div class=\"text\">'+esc(m.body)+'</div></div></div>').join('')||empty('No messages here yet. Start the conversation.');$('olderMessages').hidden=!chatMore;if(bottom||nearBottom)el.scrollTop=el.scrollHeight;const picker=$('chatRoom');if(picker)picker.hidden=room.startsWith('dm:');}\nasync function heartbeat(){if(!token||document.hidden)return;try{const live=await api('/presence','POST',{});presence=live.items;renderPeople();if(room.startsWith('dm:'))renderMessages(false)}catch{}}async function refreshChat(force=false){if(!token||document.hidden)return;const visible=['overview','chat'].includes(view),currentRoom=room;if(visible){const d=await api('/messages?room='+encodeURIComponent(room));if(currentRoom!==room)return;const changed=force||JSON.stringify(d.items)!==JSON.stringify(messages.slice(-50));if(changed){messages=d.items;chatMore=d.more;renderMessages(force)}$('chatError').textContent='';const el=$('chatMessages');if(messages.length&&(force||el.scrollHeight-el.scrollTop-el.clientHeight<70))await api('/reads','POST',{room,last_id:messages.at(-1).id});}const unread=await api('/unread');const total=unread.items.reduce((n,r)=>n+r.count,0);$('unread').textContent=total;$('unread').hidden=!total;}\nwindow.addEventListener('pagehide',()=>{if(token)fetch(API+'/presence',{method:'DELETE',headers:{Authorization:'Bearer '+token},keepalive:true}).catch(()=>{})});['pointerdown','keydown','input','scroll'].forEach(ev=>document.addEventListener(ev,()=>lastInteraction=Date.now(),{passive:true}));setInterval(()=>{if(token&&!document.hidden&&!document.querySelector('dialog[open]')&&Date.now()-lastInteraction>=300000&&Date.now()-lastRefresh>=300000)refresh()},15000);setInterval(()=>{if(token)refreshChat().catch(e=>{if($('chatError'))$('chatError').textContent=e.message})},5000);setInterval(heartbeat,20000);\nfunction customerInterest(x){if(x.interest)return x.interest;if(x.type==='seller')return 'Sell Home';const text=[x.property,x.subject,x.message].join(' ').toLowerCase();return /rent|rental|lease/.test(text)?'Rent Property':'General Inquiry'}\nfunction renderCustomers(){if(!$('customerRows'))return;const website=leads.map(x=>({id:x.id,record_type:'lead',name:x.name,email:x.email,phone:x.phone,interest:customerInterest(x),property:x.address||x.property||'',created_at:x.created_at,source:'Website',notes:x.message||x.notes||''}));const rows=[...website,...manualCustomers],q=$('customerSearch').value.toLowerCase(),interest=$('customerInterest').value;const filtered=rows.filter(x=>(!interest||x.interest===interest)&&(!q||[x.name,x.email,x.phone,x.property,x.interest].join(' ').toLowerCase().includes(q))).sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||''));$('customerRows').innerHTML=filtered.map(x=>'<tr><td><b>'+esc(x.name)+'</b><p class=\"muted\">'+esc(x.notes||'')+'</p></td><td><span class=\"pill\">'+esc(x.interest)+'</span></td><td>'+esc(x.property||'—')+'</td><td><a href=\"mailto:'+esc(encodeURIComponent(x.email||''))+'\">'+esc(x.email||'No email')+'</a><p><a href=\"tel:'+esc(String(x.phone||'').replace(/[^+0-9]/g,''))+'\">'+esc(x.phone||'')+'</a></p></td><td>'+esc(x.source||'Team')+'</td><td>'+esc(x.created_at?humanDate(x.created_at):'')+'</td><td><button class=\"secondary\" data-customer-email=\"'+esc(x.id)+'\" data-record-type=\"'+esc(x.record_type||'customer')+'\" '+(x.email?'':'disabled title=\"No email address saved\"')+'>Email</button> '+(x.record_type==='lead'?'<button class=\"secondary\" data-lead=\"'+esc(x.id)+'\">Details</button>':'')+'</td></tr>').join('')||'<tr><td colspan=\"7\">No customer records match.</td></tr>';$('customerCount').textContent=filtered.length+' customers'}\nconst priorRender=render;render=function(){priorRender();renderCustomers()};titles.customers=['CUSTOMER RECORDS','People who reached out.'];\nfunction openCustomer(){error('customerError','');$('customerForm').reset();$('newCustomerInterest').value='Rent Property';$('customerDialog').showModal()}$('quickAddCustomer').onclick=openCustomer;$('addCustomer').onclick=openCustomer;$('customerSearch').oninput=renderCustomers;$('customerInterest').onchange=renderCustomers;\n$('customerForm').onsubmit=async e=>{e.preventDefault();try{await api('/customers','POST',{name:$('newCustomerName').value,email:$('newCustomerEmail').value,phone:$('newCustomerPhone').value,interest:$('newCustomerInterest').value,property:$('newCustomerProperty').value,notes:$('newCustomerNotes').value});$('customerDialog').close();await refresh();notice('Customer added.')}catch(e){error('customerError',e.message)}};\nfunction brandedEmailHtml(subject,body){return '<!doctype html><html><body style=\"margin:0;background:#f5f2ed;font-family:Arial,sans-serif;color:#25221f;padding:28px\"><div style=\"max-width:620px;margin:auto;background:#fff;border:1px solid #e6e0d7\"><header style=\"background:#25221f;color:#fff;text-align:center;padding:24px;border-bottom:3px solid #ac9773\"><img src=\"https://i.imgur.com/xm9nTpK.png\" width=\"48\" alt=\"StoneBridge\"><div style=\"font:22px Georgia;letter-spacing:2px;margin-top:8px\">STONEBRIDGE</div><small style=\"letter-spacing:2px;color:#d8c9b0\">DEVELOPMENT GROUP</small></header><main style=\"padding:30px\"><h1 style=\"font:28px Georgia;font-weight:400\">'+esc(subject)+'</h1><div style=\"font-size:15px;line-height:1.8;white-space:pre-wrap\">'+esc(body)+'</div><p style=\"margin-top:25px;color:#8b7049\">StoneBridge Development Group<br><a href=\"mailto:info@stonebridgedg.com\">info@stonebridgedg.com</a> · 248-800-8100</p></main></div></body></html>'}\nfunction openEmail(record,type){customerTarget={record,type};$('emailTo').value=record.email||'';$('emailSubject').value='Following up with you | StoneBridge Development Group';$('emailBody').value='Hi '+String(record.name||'there').split(' ')[0]+',\\n\\nThank you for reaching out to StoneBridge Development Group. I wanted to follow up and see how we can help.\\n\\nPlease reply to this email or call us at 248-800-8100.\\n\\nStoneBridge Development Group';$('replyToLabel').textContent='Replies go to '+(me.email||'info@stonebridgedg.com');error('emailError','');$('emailDialog').showModal()}\n$('emailLead').onclick=()=>selectedLead&&openEmail(selectedLead,'lead');$('copyEmailHtml').onclick=async()=>{try{await navigator.clipboard.writeText(brandedEmailHtml($('emailSubject').value,$('emailBody').value));notice('Branded HTML email copied.')}catch{error('emailError','Clipboard access is unavailable in this browser.')}};\n$('emailForm').onsubmit=async e=>{e.preventDefault();if(!customerTarget)return;try{await api('/send-email','POST',{record_type:customerTarget.type,record_id:customerTarget.record.id,kind:'custom',subject:$('emailSubject').value,body:$('emailBody').value});$('emailDialog').close();notice('Email sent to '+$('emailTo').value);await refresh()}catch(e){error('emailError',e.message)}};\n$('sendContract').onclick=async()=>{if(!selectedLead||selectedLead.type!=='seller')return;if(!confirm('Send the signing email to '+selectedLead.email+'? The link currently opens the DocuSign homepage placeholder.'))return;try{await api('/send-email','POST',{record_type:'lead',record_id:selectedLead.id,kind:'contract'});notice('Signing email sent to '+selectedLead.email);await refresh()}catch(e){error('leadError',e.message)}};\ndocument.addEventListener('click',e=>{const b=e.target.closest('[data-customer-email]');if(!b)return;const list=b.dataset.recordType==='lead'?leads:manualCustomers,record=list.find(x=>x.id===b.dataset.customerEmail);if(record)openEmail(record,b.dataset.recordType)});\n</script></body></html>\n";
const adminHeaders={'X-Robots-Tag':'noindex, nofollow, noarchive','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; img-src https://i.imgur.com; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; connect-src 'self' https://stonebridge.psznbzhnps.workers.dev; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
async function legacyAdmin(request,env){
 const url=new URL(request.url);
 const origin=request.headers.get('Origin')||'';
 const allowed=ALLOWED_ORIGINS.has(origin);
 const headers={...adminHeaders,...(allowed?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})};
 const reply=(data,status=200)=>Response.json(data,{status,headers});
 if(request.method==='OPTIONS')return new Response(null,{status:allowed?204:403,headers:{...headers,'Access-Control-Allow-Methods':'GET, PATCH, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'}});
 if(origin && !allowed)return reply({error:'Origin not allowed'},403);
 if(url.pathname==='/admin' && request.method==='GET')return new Response(ADMIN_HTML,{headers:{...adminHeaders,'Content-Type':'text/html;charset=utf-8'}});
 if(!env.ADMIN_TOKEN)return reply({error:'Admin access is not configured'},503);
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

// Branded acknowledgment embedded directly in the worker. No Outlook automation needed.
function leadAcknowledgment(data, isContact) {
  const firstName = String(data.name || '').trim().split(/\s+/)[0] || 'there';
  const property = String((isContact ? data.property : data.address) || '').trim();
  const heading = isContact ? 'Your inquiry is in good hands.' : 'Your property. Our next conversation.';
  const intro = isContact
    ? 'Thank you for contacting StoneBridge Development Group. We have received your inquiry and our team will follow up to discuss how we can help.'
    : 'Thank you for submitting your property to StoneBridge Development Group. We have received your information and will reach out to discuss your home and the next steps toward a cash offer.';
  const question = isContact ? 'Is there anything else you would like us to know? Simply reply to this email.' : 'What is the best time to call you? Reply to this email with a convenient time and anything else you would like us to know about your property.';
  const subject = isContact ? 'We received your inquiry | StoneBridge' : 'We received your property submission | StoneBridge';
  const replySubject = 'Re: ' + subject;
  const replyBody = isContact ? 'Hi StoneBridge,\n\n' : 'Hi StoneBridge,\n\nThe best time to call me is: \n\n';
  const replyUrl = 'mailto:info@stonebridgedg.com?subject=' + encodeURIComponent(replySubject) + '&body=' + encodeURIComponent(replyBody);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f0e9;color:#151514;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;font-size:1px;color:#f3f0e9;max-height:0;overflow:hidden;">We have received your ${isContact ? 'inquiry' : 'property details'}. Let us talk about your next steps.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f0e9;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e0d8ca;">
<tr><td align="center" style="padding:32px 24px;background:#1d1c1a;border-bottom:3px solid #a9997b;">
<img src="https://i.imgur.com/xm9nTpK.png" width="60" alt="StoneBridge" style="display:block;border:0;width:60px;height:auto;margin:0 auto 16px;">
<p style="margin:0;color:#ffffff;font-family:Georgia,serif;font-size:27px;letter-spacing:3px;">STONEBRIDGE</p>
<p style="margin:8px 0 0;color:#d4c7b1;font-size:10px;letter-spacing:3px;">DEVELOPMENT GROUP</p></td></tr>
<tr><td style="padding:36px 28px 16px;">
<p style="margin:0 0 16px;color:#8a7452;font-size:10px;font-weight:bold;letter-spacing:2px;">${isContact ? 'INQUIRY RECEIVED' : 'PROPERTY SUBMISSION RECEIVED'}</p>
<h1 style="margin:0 0 26px;color:#151514;font-family:Georgia,serif;font-size:32px;line-height:1.2;font-weight:normal;">${heading}</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.8;">Hi ${escapeHtml(firstName)},</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:#55514b;">${intro}</p>
${property ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:20px;background:#f7f5f0;border-left:3px solid #a9997b;"><p style="margin:0 0 8px;font-size:10px;font-weight:bold;letter-spacing:2px;color:#8a7452;">${isContact ? 'PROPERTY OF INTEREST' : 'YOUR PROPERTY'}</p><p style="margin:0;font-family:Georgia,serif;font-size:20px;line-height:1.5;overflow-wrap:anywhere;">${escapeHtml(property)}</p></td></tr></table>` : ''}
<p style="margin:24px 0;font-size:15px;line-height:1.8;color:#55514b;">${question}</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="#1d1c1a" style="background:#1d1c1a;text-align:center;"><a href="${escapeHtml(replyUrl)}" style="display:inline-block;padding:17px 26px;border:1px solid #1d1c1a;color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold;letter-spacing:1px;">REPLY TO OUR TEAM &rarr;</a></td></tr></table>
<p style="margin:26px 0 12px;font-size:14px;line-height:1.8;">We look forward to speaking with you.<br><strong>StoneBridge Development Group</strong></p>
</td></tr>
<tr><td style="padding:24px 28px;border-top:1px solid #e9e2d7;background:#faf9f6;">
<p style="margin:0 0 10px;font-size:13px;"><a href="mailto:info@stonebridgedg.com" style="color:#6b593e;text-decoration:none;">info@stonebridgedg.com</a></p>
<p style="margin:0;font-size:12px;"><a href="https://stonebridgedg.com" style="color:#6b593e;text-decoration:none;">Visit stonebridgedg.com &rarr;</a></p>
<p style="margin:18px 0 0;font-size:11px;line-height:1.7;color:#8a857b;">You received this acknowledgment because a form was submitted with your email address on our website.${isContact ? '' : ' This confirms receipt of your information and is not a purchase offer or commitment.'}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `Hi ${firstName},\n\n${intro}\n\n${property ? 'Property: ' + property + '\n\n' : ''}${question}\n\nWe look forward to speaking with you.\nStoneBridge Development Group\ninfo@stonebridgedg.com\nhttps://stonebridgedg.com`;
  return {subject, html, text};
}

async function sendLeadAcknowledgment(env, data, isContact, leadId) {
  try {
    const email = leadAcknowledgment(data, isContact);
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'lead-acknowledgment/' + leadId
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        from: 'StoneBridge Development Group <website@stonebridgedg.com>',
        to: [String(data.email).trim()],
        reply_to: 'info@stonebridgedg.com',
        ...email
      })
    });
    // This log tracks provider acceptance, not inbox delivery. Existing admin email_status
    // continues to describe the internal lead notification.
    console.log(JSON.stringify({event:'lead_acknowledgment',lead_id:leadId,status:response.ok?'accepted':'failed',http_status:response.status}));
  } catch {
    console.error(JSON.stringify({event:'lead_acknowledgment',lead_id:leadId,status:'failed'}));
  }
}

const TEAM_SCHEMA = [
`CREATE TABLE IF NOT EXISTS sb_users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,avatar TEXT DEFAULT 'male',active INTEGER DEFAULT 1,created_at TEXT NOT NULL,email TEXT DEFAULT '')`,
`CREATE TABLE IF NOT EXISTS sb_sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL,remember INTEGER NOT NULL DEFAULT 0)`,
`CREATE TABLE IF NOT EXISTS sb_presence(user_id TEXT PRIMARY KEY,last_seen TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS sb_customers(id TEXT PRIMARY KEY,created_at TEXT NOT NULL,name TEXT NOT NULL,email TEXT DEFAULT '',phone TEXT DEFAULT '',interest TEXT NOT NULL,property TEXT DEFAULT '',notes TEXT DEFAULT '',source TEXT DEFAULT 'Team')`,
`CREATE TABLE IF NOT EXISTS sb_email_log(id TEXT PRIMARY KEY,actor TEXT,recipient TEXT,subject TEXT,kind TEXT,created_at TEXT)`,
`CREATE TABLE IF NOT EXISTS sb_login_limits(key TEXT PRIMARY KEY,attempts INTEGER NOT NULL,reset INTEGER NOT NULL)`,
`CREATE TABLE IF NOT EXISTS sb_messages(id INTEGER PRIMARY KEY AUTOINCREMENT,sender TEXT NOT NULL,room TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS sb_reads(user_id TEXT,room TEXT,last_id INTEGER DEFAULT 0,PRIMARY KEY(user_id,room))`,
`CREATE TABLE IF NOT EXISTS sb_tasks(id TEXT PRIMARY KEY,title TEXT NOT NULL,assignee TEXT,due_date TEXT,done INTEGER DEFAULT 0,created_at TEXT)`,
`CREATE TABLE IF NOT EXISTS sb_activity(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT,action TEXT,subject TEXT,created_at TEXT)`,
`CREATE TABLE IF NOT EXISTS lead_followups(lead_id TEXT PRIMARY KEY,notes TEXT DEFAULT '',follow_up TEXT DEFAULT '')`,
`CREATE TABLE IF NOT EXISTS lead_classifications(lead_id TEXT PRIMARY KEY,temperature TEXT DEFAULT 'Unclassified')`,
`CREATE TABLE IF NOT EXISTS sb_acquisitions(lead_id TEXT PRIMARY KEY,purchase_price REAL,closing_date TEXT)`];
async function hashText(s){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function passwordHash(p,salt=crypto.randomUUID()){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);return salt+':'+Array.from(new Uint8Array(bits)).map(b=>b.toString(16).padStart(2,'0')).join('');}
async function same(a,b){const x=await hashText(a),y=await hashText(b);let d=0;for(let i=0;i<x.length;i++)d|=x.charCodeAt(i)^y.charCodeAt(i);return d===0;}
const userPublic=u=>({id:u.id,username:u.username,name:u.name,avatar:u.avatar,active:u.active,owner:u.id==='owner'});
async function admin(request,env){
const url=new URL(request.url),origin=request.headers.get('Origin')||'',workerOrigin=url.origin;
const allowed=!origin||ALLOWED_ORIGINS.has(origin)||origin===workerOrigin;
const headers={...adminHeaders,'Content-Security-Policy':"default-src 'self'; img-src 'self' data: https://i.imgur.com; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; connect-src 'self' https://stonebridge.psznbzhnps.workers.dev; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",...(origin&&allowed?{'Access-Control-Allow-Origin':origin,Vary:'Origin'}:{})};
const reply=(d,status=200)=>Response.json(d,{status,headers});
if(!allowed)return reply({error:'Origin not allowed'},403);
if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'}});
if(['/admin','/admin/'].includes(url.pathname)&&request.method==='GET')return new Response(ADMIN_HTML,{headers:{...headers,'Content-Type':'text/html;charset=utf-8'}});
if(!env.DB)return reply({error:'Database is not configured. Keep your existing DB binding.'},503);
if(!env.ADMIN_TOKEN)return reply({error:'Master login is not configured. Keep your existing ADMIN_TOKEN secret.'},503);
try {
await env.DB.batch(TEAM_SCHEMA.map(s=>env.DB.prepare(s)));
try{await env.DB.prepare('ALTER TABLE sb_sessions ADD COLUMN remember INTEGER NOT NULL DEFAULT 0').run()}catch{}
try{await env.DB.prepare("ALTER TABLE sb_users ADD COLUMN email TEXT DEFAULT ''").run()}catch{}
const path=url.pathname.replace('/admin/api',''),method=request.method;
const body=async()=>{const txt=await request.text();if(txt.length>20000)throw Error('Request too large');return JSON.parse(txt);};
const owner={id:'owner',username:'admin',name:'StoneBridge Admin',avatar:'male',active:1};
await env.DB.prepare('INSERT OR IGNORE INTO sb_users(id,username,name,password,avatar,active,created_at) VALUES (?,?,?,?,?,1,?)').bind('owner','admin',owner.name,'master-secret','male',new Date().toISOString()).run();
const log=async(u,action,subject='')=>env.DB.prepare('INSERT INTO sb_activity(actor,action,subject,created_at) VALUES (?,?,?,?)').bind(u.name,action,subject,new Date().toISOString()).run();
if(path==='/login'&&method==='POST'){
const d=await body(),username=String(d.username||'').trim().toLowerCase(),password=String(d.password||'');
const limitKey=await hashText((request.headers.get('CF-Connecting-IP')||'unknown')+':'+username);const now=Date.now();
const limit=await env.DB.prepare('SELECT * FROM sb_login_limits WHERE key=?').bind(limitKey).first();if(limit&&limit.reset>now&&limit.attempts>=10)return reply({error:'Too many attempts. Try again in 15 minutes.'},429);
let u=await env.DB.prepare('SELECT * FROM sb_users WHERE username=? AND active=1').bind(username).first();let valid=false;
if(u&&u.id==='owner')valid=await same(password,env.ADMIN_TOKEN);else if(u&&password.length<=200){const [salt]=u.password.split(':');valid=await same(await passwordHash(password,salt),u.password);}else await passwordHash('invalid-password');
if(!valid){await env.DB.prepare('INSERT INTO sb_login_limits(key,attempts,reset) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN reset<? THEN 1 ELSE attempts+1 END,reset=CASE WHEN reset<? THEN excluded.reset ELSE reset END').bind(limitKey,now+900000,now,now).run();return reply({error:'Incorrect username or password.'},401);}
await env.DB.prepare('DELETE FROM sb_login_limits WHERE key=?').bind(limitKey).run();await env.DB.prepare('DELETE FROM sb_sessions WHERE expires<?').bind(now).run();
const token=crypto.randomUUID()+crypto.randomUUID(),remember=d.remember===true,life=remember?2592000000:43200000;await env.DB.prepare('INSERT INTO sb_sessions(token,user_id,expires,remember) VALUES (?,?,?,?)').bind(await hashText(token),u.id,now+life,remember?1:0).run();await log(u,'Signed in');return reply({token,user:userPublic(u),remember,expires_in:life});
}
const raw=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');const digest=await hashText(raw);
const u=await env.DB.prepare('SELECT u.*,s.remember session_remember FROM sb_users u JOIN sb_sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.active=1').bind(digest,Date.now()).first();if(!u)return reply({error:'Please sign in again.'},401);
if(path==='/logout'&&method==='POST'){await env.DB.batch([env.DB.prepare('DELETE FROM sb_sessions WHERE token=?').bind(digest),env.DB.prepare('DELETE FROM sb_presence WHERE user_id=?').bind(u.id)]);return reply({ok:true});}
if(path==='/presence'&&method==='POST'){const nowIso=new Date().toISOString(),life=u.session_remember?2592000000:43200000;await env.DB.batch([env.DB.prepare('INSERT INTO sb_presence(user_id,last_seen) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET last_seen=excluded.last_seen').bind(u.id,nowIso),env.DB.prepare('UPDATE sb_sessions SET expires=? WHERE token=?').bind(Date.now()+life,digest)]);const rows=await env.DB.prepare('SELECT p.user_id,p.last_seen,u.name,u.username,u.avatar FROM sb_presence p JOIN sb_users u ON u.id=p.user_id WHERE u.active=1').all();return reply({items:rows.results});}
if(path==='/presence'&&method==='DELETE'){await env.DB.prepare('DELETE FROM sb_presence WHERE user_id=?').bind(u.id).run();return reply({ok:true});}
if(path==='/me'&&method==='GET')return reply({user:{...userPublic(u),email:u.email||''}});
if(path==='/me'&&method==='PATCH'){const d=await body();const email=String(d.email||'').trim();if(typeof d.name!=='string'||!d.name.trim()||d.name.length>80||!['male','female'].includes(d.avatar)||email.length>254||(email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)))return reply({error:'Enter a valid name, reply-to email, and avatar.'},400);await env.DB.prepare('UPDATE sb_users SET name=?,avatar=?,email=? WHERE id=?').bind(d.name.trim(),d.avatar,email,u.id).run();return reply({ok:true});}
if(path==='/password'&&method==='POST'){if(u.id==='owner')return reply({error:'Change the master password in your existing ADMIN_TOKEN Worker secret.'},400);const d=await body();if(typeof d.password!=='string'||d.password.length<10||d.password.length>200)return reply({error:'Use a password with 10–200 characters.'},400);const [salt]=u.password.split(':');if(!await same(await passwordHash(String(d.current||''),salt),u.password))return reply({error:'Current password is incorrect.'},400);await env.DB.batch([env.DB.prepare('UPDATE sb_users SET password=? WHERE id=?').bind(await passwordHash(d.password),u.id),env.DB.prepare('DELETE FROM sb_sessions WHERE user_id=? AND token<>?').bind(u.id,digest)]);return reply({ok:true});}
if(path==='/users'&&method==='GET'){const rows=await env.DB.prepare('SELECT * FROM sb_users ORDER BY created_at').all();return reply({items:rows.results.map(userPublic)});}
if(path==='/users'&&method==='POST'){if(u.id!=='owner')return reply({error:'Only the master account can manage accounts.'},403);const d=await body();if(!/^[a-z0-9._-]{3,40}$/.test(d.username||'')||d.username==='admin'||typeof d.name!=='string'||!d.name.trim()||d.name.length>80||typeof d.password!=='string'||d.password.length<10||d.password.length>200||!['male','female'].includes(d.avatar))return reply({error:'Use a unique lowercase username, name, avatar, and password of at least 10 characters.'},400);if(await env.DB.prepare('SELECT id FROM sb_users WHERE username=?').bind(d.username).first())return reply({error:'Username already exists.'},409);await env.DB.prepare('INSERT INTO sb_users(id,username,name,password,avatar,active,created_at) VALUES (?,?,?,?,?,1,?)').bind(crypto.randomUUID(),d.username,d.name.trim(),await passwordHash(d.password),d.avatar,new Date().toISOString()).run();await log(u,'Created account',d.username);return reply({ok:true});}
const um=path.match(/^\/users\/([^/]+)$/);
if(um&&['PATCH','DELETE'].includes(method)){if(u.id!=='owner')return reply({error:'Only the master account can manage accounts.'},403);if(um[1]==='owner')return reply({error:'The master account cannot be removed or disabled.'},400);const target=await env.DB.prepare('SELECT * FROM sb_users WHERE id=?').bind(um[1]).first();if(!target)return reply({error:'Account not found.'},404);
if(method==='DELETE'){await env.DB.batch([env.DB.prepare('DELETE FROM sb_sessions WHERE user_id=?').bind(target.id),env.DB.prepare('DELETE FROM sb_users WHERE id=?').bind(target.id)]);await log(u,'Removed account',target.username);return reply({ok:true});}
const d=await body();const name=d.name??target.name,avatar=d.avatar??target.avatar,active=d.active===undefined?target.active:d.active?1:0;if(typeof name!=='string'||!name.trim()||name.length>80||!['male','female'].includes(avatar))return reply({error:'Invalid profile.'},400);if(d.password&&(typeof d.password!=='string'||d.password.length<10||d.password.length>200))return reply({error:'Password must have 10–200 characters.'},400);
await env.DB.prepare('UPDATE sb_users SET name=?,avatar=?,active=?,password=? WHERE id=?').bind(name.trim(),avatar,active,d.password?await passwordHash(d.password):target.password,target.id).run();if(!active||d.password)await env.DB.prepare('DELETE FROM sb_sessions WHERE user_id=?').bind(target.id).run();await log(u,'Updated account',target.username);return reply({ok:true});}
const room=url.searchParams.get('room')||'general';const validRoom=async r=>typeof r==='string'&&(['general','acquisitions'].includes(r)||(r.startsWith('dm:')&&r.slice(3).split(':').length===2&&r.slice(3).split(':').includes(u.id)&&!!await env.DB.prepare('SELECT id FROM sb_users WHERE id=? AND active=1').bind(r.slice(3).split(':').find(i=>i!==u.id)||u.id).first()));
if(path==='/messages'&&method==='GET'){if(!await validRoom(room))return reply({error:'Conversation unavailable.'},403);const before=Number(url.searchParams.get('before'))||Number.MAX_SAFE_INTEGER;const rows=await env.DB.prepare("SELECT m.*,COALESCE(u.name,'Former team member') name,COALESCE(u.avatar,'male') avatar FROM sb_messages m LEFT JOIN sb_users u ON u.id=m.sender WHERE room=? AND m.id<? ORDER BY m.id DESC LIMIT 51").bind(room,before).all();const messages=rows.results.slice(0,50).reverse();return reply({items:messages,more:rows.results.length>50});}
if(path==='/messages'&&method==='POST'){const d=await body();if(!await validRoom(d.room)||typeof d.body!=='string'||!d.body.trim()||d.body.length>4000)return reply({error:'Choose a conversation and enter up to 4,000 characters.'},400);await env.DB.prepare('INSERT INTO sb_messages(sender,room,body,created_at) VALUES (?,?,?,?)').bind(u.id,d.room,d.body.trim(),new Date().toISOString()).run();return reply({ok:true});}
if(path==='/reads'&&method==='POST'){const d=await body();if(!await validRoom(d.room)||!Number.isSafeInteger(d.last_id)||d.last_id<0)return reply({error:'Invalid conversation.'},400);await env.DB.prepare('INSERT INTO sb_reads(user_id,room,last_id) VALUES (?,?,?) ON CONFLICT(user_id,room) DO UPDATE SET last_id=MAX(last_id,excluded.last_id)').bind(u.id,d.room,d.last_id).run();return reply({ok:true});}
if(path==='/unread'&&method==='GET'){const rows=await env.DB.prepare("SELECT m.room,COUNT(*) count FROM sb_messages m LEFT JOIN sb_reads r ON r.room=m.room AND r.user_id=? WHERE m.id>COALESCE(r.last_id,0) AND m.sender<>? AND (m.room IN ('general','acquisitions') OR m.room LIKE ? OR m.room LIKE ?) GROUP BY m.room").bind(u.id,u.id,'dm:'+u.id+':%','dm:%:'+u.id).all();return reply({items:rows.results});}
if(path==='/activity'&&method==='GET'){const rows=await env.DB.prepare('SELECT * FROM sb_activity ORDER BY id DESC LIMIT 50').all();return reply({items:rows.results});}
if(path==='/customers'&&method==='GET'){const rows=await env.DB.prepare('SELECT * FROM sb_customers ORDER BY created_at DESC LIMIT 1000').all();return reply({items:rows.results.map(x=>({...x,record_type:'customer'}))});}
if(path==='/customers'&&method==='POST'){const d=await body(),name=String(d.name||'').trim(),email=String(d.email||'').trim(),phone=String(d.phone||'').trim(),interest=String(d.interest||''),property=String(d.property||'').trim(),notes=String(d.notes||'').trim();if(!name||name.length>120||email.length>254||phone.length>40||!['Rent Property','General Inquiry','Sell Home'].includes(interest)||property.length>300||notes.length>5000||(email&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)))return reply({error:'Enter a name and valid customer details.'},400);const id=crypto.randomUUID(),created=new Date().toISOString();await env.DB.prepare('INSERT INTO sb_customers(id,created_at,name,email,phone,interest,property,notes,source) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,created,name,email,phone,interest,property,notes,'Team').run();await log(u,'Added customer',name+' · '+interest);return reply({ok:true,id});}
if(path==='/send-email'&&method==='POST'){const d=await body(),kind=d.kind==='contract'?'contract':'custom',recordType=d.record_type,recordId=String(d.record_id||'');if(!env.RESEND_API_KEY)return reply({error:'Email sending is not configured. Add RESEND_API_KEY to the existing Worker secrets.'},503);if(!['lead','customer'].includes(recordType)||!recordId||recordId.length>80)return reply({error:'Select a valid customer.'},400);let person;if(recordType==='lead')person=await env.DB.prepare('SELECT id,name,email,type,address,property,status FROM leads WHERE id=?').bind(recordId).first();else person=await env.DB.prepare('SELECT id,name,email,interest,property FROM sb_customers WHERE id=?').bind(recordId).first();if(!person)return reply({error:'Customer not found.'},404);const to=String(person.email||'').trim();if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to))return reply({error:'This customer does not have a valid personal email address.'},400);if(kind==='contract'&&(recordType!=='lead'||person.type!=='seller'))return reply({error:'Signing emails are available only for seller property inquiries.'},403);let subject=kind==='contract'?'Your documents are ready to sign | StoneBridge Development Group':String(d.subject||'').trim();let message=kind==='contract'?`Hi ${String(person.name||'there').trim().split(/\s+/)[0]},\n\nYour documents are ready to review and sign so we can begin the closing process for ${person.address||'your property'}.\n\nOpen your signing documents here: https://www.docusign.com/\n\nThis link currently opens the DocuSign homepage. StoneBridge Development Group will provide the transaction-specific signing link separately.\n\nPlease reply if you have questions.\n\nStoneBridge Development Group\ninfo@stonebridgedg.com\n248-800-8100`:String(d.body||'').trim();if(!subject||subject.length>180||!message||message.length>5000)return reply({error:'Enter an email subject and message.'},400);const replyTo=String(u.email||'').trim()||'info@stonebridgedg.com';const html=`<!doctype html><html><body style="margin:0;background:#f5f2ed;font-family:Arial,sans-serif;color:#25221f;padding:28px"><div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e6e0d7"><header style="background:#25221f;color:#fff;text-align:center;padding:24px;border-bottom:3px solid #ac9773"><img src="https://i.imgur.com/xm9nTpK.png" width="48" alt="StoneBridge"><div style="font:22px Georgia;letter-spacing:2px;margin-top:8px">STONEBRIDGE</div><small style="letter-spacing:2px;color:#d8c9b0">DEVELOPMENT GROUP</small></header><main style="padding:30px"><h1 style="font:28px Georgia;font-weight:400">${escapeHtml(subject)}</h1><div style="font-size:15px;line-height:1.8;white-space:pre-wrap">${escapeHtml(message)}</div><p style="margin-top:25px;color:#8b7049">StoneBridge Development Group<br><a href="mailto:info@stonebridgedg.com">info@stonebridgedg.com</a> · 248-800-8100</p></main></div></body></html>`;let sent;try{sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':'dashboard/'+crypto.randomUUID()},signal:AbortSignal.timeout(15000),body:JSON.stringify({from:'StoneBridge Development Group <website@stonebridgedg.com>',to:[to],reply_to:replyTo,subject,html,text:message})})}catch{return reply({error:'Email service could not be reached. The message was not sent.'},502)}const result=await sent.json().catch(()=>({}));if(!sent.ok){console.error('Dashboard email failed',sent.status);return reply({error:'Email provider did not accept this message. Check the Resend domain and sender setup.'},502)}const now=new Date().toISOString();await env.DB.batch([env.DB.prepare('INSERT INTO sb_email_log(id,actor,recipient,subject,kind,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),u.name,to,subject,kind,now),env.DB.prepare('INSERT INTO sb_activity(actor,action,subject,created_at) VALUES (?,?,?,?)').bind(u.name,kind==='contract'?'Sent signing email':'Sent customer email',to,now)]);return reply({ok:true,id:result.id||null,recipient:to,reply_to:replyTo});}
if(path==='/tasks'&&method==='GET')return reply({items:(await env.DB.prepare('SELECT * FROM sb_tasks ORDER BY done,due_date,created_at DESC').all()).results});
if(path==='/tasks'&&method==='POST'){const d=await body();if(typeof d.title!=='string'||!d.title.trim()||d.title.length>200||typeof d.assignee!=='string'||d.assignee.length>100||!/^(\d{4}-\d{2}-\d{2})?$/.test(d.due_date||''))return reply({error:'Invalid task.'},400);await env.DB.prepare('INSERT INTO sb_tasks(id,title,assignee,due_date,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),d.title.trim(),d.assignee,d.due_date||'',new Date().toISOString()).run();await log(u,'Created task',d.title);return reply({ok:true});}
const tm=path.match(/^\/tasks\/([^/]+)$/);if(tm&&['PATCH','DELETE'].includes(method)){if(method==='DELETE')await env.DB.prepare('DELETE FROM sb_tasks WHERE id=?').bind(tm[1]).run();else {const d=await body();await env.DB.prepare('UPDATE sb_tasks SET done=? WHERE id=?').bind(d.done?1:0,tm[1]).run();}await log(u,method==='DELETE'?'Removed task':'Updated task');return reply({ok:true});}
// Reuse the existing, working lead search and update logic after session authorization.
if(path.startsWith('/leads')){
let req=request;let extra;
if(method==='PATCH'){const d=await body();if(!['New','Contacted','In review','Closed','Under contract','Purchased'].includes(d.status))return reply({error:'Invalid status.'},400);if(d.purchase_price!=null&&(!Number.isFinite(d.purchase_price)||d.purchase_price<0||d.purchase_price>1e9))return reply({error:'Invalid purchase price.'},400);if(!/^(\d{4}-\d{2}-\d{2})?$/.test(d.closing_date||''))return reply({error:'Invalid closing date.'},400);extra=d;req=new Request(request.url,{method,headers:request.headers,body:JSON.stringify({...d,status:['Under contract','Purchased'].includes(d.status)?'In review':d.status})});}
const hh=new Headers(req.headers);hh.set('Authorization','Bearer '+env.ADMIN_TOKEN);hh.delete('Origin');req=new Request(req,{headers:hh});const response=await legacyAdmin(req,env);let result=await response.json();
if(response.ok&&method==='PATCH'&&extra){const id=path.split('/').pop();await env.DB.batch([env.DB.prepare('UPDATE leads SET status=? WHERE id=?').bind(extra.status,id),env.DB.prepare('INSERT INTO sb_acquisitions(lead_id,purchase_price,closing_date) VALUES (?,?,?) ON CONFLICT(lead_id) DO UPDATE SET purchase_price=excluded.purchase_price,closing_date=excluded.closing_date').bind(id,extra.purchase_price??null,extra.closing_date||'')]);await log(u,'Updated lead',id);}
if(response.ok&&method==='GET'&&result.items){const a=(await env.DB.prepare('SELECT * FROM sb_acquisitions').all()).results;result.items=result.items.map(l=>({...l,...(a.find(x=>x.lead_id===l.id)||{})}));}
return reply(result,response.status);
}
return reply({error:'Not found.'},404);
}catch(e){console.error('Admin request failed',e.message);return reply({error:'Unable to complete request. Check the database schema and try again.'},500);}
}
