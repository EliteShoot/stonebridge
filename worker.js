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
const ADMIN_HTML="<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>StoneBridge | Admin</title><link href=\"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=DM+Sans:wght@400;500;600;700&display=swap\" rel=\"stylesheet\"><style>\n*{box-sizing:border-box}body{margin:0;background:#f4f4f2;color:#202423;font:16px system-ui}header{background:#172724;color:white;padding:26px 5%;display:flex;justify-content:space-between;align-items:center}small{display:block;font-size:12px;letter-spacing:.18em;margin-top:5px;color:#b9c9c2}main{max-width:1250px;margin:40px auto;padding:0 24px}h1{font:36px Georgia;margin:0 0 24px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:28px}.card{background:white;border:1px solid #d8dfdb;padding:24px}.card b{display:block;font-size:32px;margin-top:8px}.tools{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}input,select,button{font:inherit;padding:12px;border:1px solid #c6d0ca;border-radius:4px}button{cursor:pointer;background:#234b3e;color:white}input{flex:1;min-width:180px}.table{overflow:auto;background:white}table{width:100%;border-collapse:collapse;white-space:nowrap}th,td{text-align:left;padding:16px;border-bottom:1px solid #e2e6e3}th{font-size:14px;color:#59675f}td button{background:transparent;color:#234b3e;padding:6px 10px}#login{max-width:460px;background:white;padding:32px;margin:80px auto}#login input{width:100%;margin:12px 0}#notice{min-height:28px;color:#8d331f}dialog{border:1px solid #b9c9c2;max-width:650px;width:90%;padding:30px}dialog::backdrop{background:#13251db3}dl{display:grid;grid-template-columns:120px 1fr;gap:12px}dd{margin:0;overflow-wrap:anywhere;white-space:pre-wrap}dt{color:#59675f}#more{margin-top:20px}@media(max-width:600px){.cards{grid-template-columns:1fr}.card{padding:16px}header{padding:22px}dl{grid-template-columns:1fr}h1{font-size:30px}}\n\nbody{background:#f7f5f0;color:#151514;font-family:\"DM Sans\",Arial,sans-serif}header{background:#1d1c1a;border-bottom:1px solid #3a3732;padding:26px 5%}header>div{font-size:18px;letter-spacing:.15em;font-weight:600}small{font-size:12px;color:#c9bda9;letter-spacing:.22em}h1{font-family:\"Cormorant Garamond\",Georgia,serif;font-size:48px;font-weight:400;letter-spacing:-.025em}.card{border-color:#d8d1c5;padding:26px;background:#fff}.card b{font-family:\"Cormorant Garamond\",Georgia,serif;font-size:46px;font-weight:500}button{background:#151514;color:white;border-color:#151514;border-radius:0}input,select{border-color:#d8d1c5;border-radius:0;background:#fff;color:#151514}th,dt{color:#68655f}th{background:#ebe6dc}td,th{border-color:#e4ded3}td button{color:#151514;border-color:#d8d1c5}dialog{background:#f7f5f0;border-color:#d8d1c5}dialog::backdrop{background:#151514b3}#login{border:1px solid #d8d1c5;box-shadow:0 20px 60px #1515140d}#notice{color:#8d331f}button:hover{opacity:.85}input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid #786447;outline-offset:3px}\n</style><header><div>STONEBRIDGE<small>DEVELOPMENT GROUP / ADMIN</small></div><button id=\"logout\" hidden>Lock dashboard</button></header><main><div id=\"login\"><h1>Admin access</h1><form id=\"auth\"><label for=\"key\">Admin access key</label><input id=\"key\" type=\"password\" autocomplete=\"off\" required><button>Unlock dashboard</button></form></div><p id=\"notice\" role=\"status\"></p><section id=\"app\" hidden><h1>Submission inbox</h1><div class=\"cards\"><div class=\"card\">Total submissions<b id=\"total\">\u2014</b></div><div class=\"card\">New leads<b id=\"new\">\u2014</b></div><div class=\"card\">Email failures<b id=\"failed\">\u2014</b></div></div><div class=\"tools\"><input id=\"search\" placeholder=\"Search name, email, or property\" aria-label=\"Search submissions\"><select id=\"type\" aria-label=\"Submission type\"><option value=\"\">All submissions</option><option value=\"seller\">Property sellers</option><option value=\"contact\">Contact inquiries</option></select><select id=\"status\" aria-label=\"Lead status\"><option value=\"\">All statuses</option><option>New</option><option>Contacted</option><option>In review</option><option>Closed</option></select><button id=\"refresh\">Refresh</button><button id=\"export\">Export filtered CSV</button></div><div class=\"table\"><table><thead><tr><th>Received</th><th>Name</th><th>Property / inquiry</th><th>Type</th><th>Status</th><th>Email</th><th></th></tr></thead><tbody id=\"rows\"></tbody></table></div><button id=\"more\" hidden>Load more</button></section></main><dialog id=\"detail\"><h1>Lead details</h1><dl id=\"fields\"></dl><label>Status <select id=\"edit\"><option>New</option><option>Contacted</option><option>In review</option><option>Closed</option></select></label><p><button id=\"save\">Save status</button> <button id=\"close\">Close</button></p></dialog><script>\nlet token='',items=[],offset=0,selected;const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nasync function api(path,options={}){const r=await fetch('https://stonebridge.psznbzhnps.workers.dev/admin/api'+path,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}});if(r.status===401){lock();throw Error('Access key is invalid.');}const d=await r.json();if(!r.ok)throw Error(d.error||'Unable to load records.');return d;}\nfunction lock(){token='';items=[];$('app').hidden=true;$('login').hidden=false;$('logout').hidden=true;$('rows').innerHTML='';$('detail').close();}\nfunction params(){return new URLSearchParams({q:$('search').value,type:$('type').value,status:$('status').value});}\nasync function load(append=false){try{$('notice').textContent='Loading\u2026';offset=append?items.length:0;const q=params();q.set('offset',offset);const d=await api('/leads?'+q);items=append?items.concat(d.items):d.items;$('total').textContent=d.stats.total;$('new').textContent=d.stats.fresh;$('failed').textContent=d.stats.failed;$('rows').innerHTML=items.map(x=>'<tr><td>'+esc(new Date(x.created_at).toLocaleString())+'</td><td>'+esc(x.name)+'</td><td>'+esc(x.address||x.property||x.subject)+'</td><td>'+esc(x.type)+'</td><td>'+esc(x.status)+'</td><td>'+esc(x.email_status)+'</td><td><button data-id=\"'+esc(x.id)+'\">View</button></td></tr>').join('');$('more').hidden=!d.more;$('notice').textContent=items.length?'':'No submissions match these filters.';}catch(e){$('notice').textContent=e.message;}}\n$('auth').onsubmit=async e=>{e.preventDefault();token=$('key').value;$('key').value='';await load();if(token){$('login').hidden=true;$('app').hidden=false;$('logout').hidden=false;}};$('logout').onclick=lock;$('refresh').onclick=()=>load();$('more').onclick=()=>load(true);let timer;$('search').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>load(),300)};['type','status'].forEach(id=>$(id).onchange=()=>load());\n$('rows').onclick=e=>{const b=e.target.closest('[data-id]');if(!b)return;selected=items.find(x=>x.id===b.dataset.id);$('fields').innerHTML=Object.entries(selected).filter(([k])=>k!=='id').map(([k,v])=>'<dt>'+esc(k.replaceAll('_',' '))+'</dt><dd>'+esc(v)+'</dd>').join('');$('edit').value=selected.status;$('detail').showModal();};$('close').onclick=()=>$('detail').close();$('save').onclick=async()=>{try{await api('/leads/'+selected.id,{method:'PATCH',body:JSON.stringify({status:$('edit').value})});$('detail').close();await load();}catch(e){$('notice').textContent=e.message;}};\n$('export').onclick=async()=>{try{let all=[],off=0;while(true){const q=params();q.set('offset',off);const d=await api('/leads?'+q);all.push(...d.items);if(!d.more)break;off=all.length;}const keys=['created_at','type','name','email','phone','address','timing','condition','property','subject','message','consent','status','email_status'];const cell=v=>'\"'+String(v??'').replace(/^[=+@-]/,\"'$&\").replaceAll('\"','\"\"')+'\"';const csv=[keys.join(','),...all.map(x=>keys.map(k=>cell(x[k])).join(','))].join('\\r\\n');const u=URL.createObjectURL(new Blob(['\\ufeff'+csv],{type:'text/csv'}));const a=document.createElement('a');a.href=u;a.download='stonebridge-submissions.csv';a.click();URL.revokeObjectURL(u);}catch(e){$('notice').textContent=e.message;}};\n</script></html>";

const adminHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'; connect-src 'self' https://stonebridge.psznbzhnps.workers.dev; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
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
 for(const k of ['type','status']){const v=url.searchParams.get(k);if(v){clauses.push(k+'=?');args.push(v);}}
 const where=clauses.length?' WHERE '+clauses.join(' AND '):'';const offset=Math.max(0,parseInt(url.searchParams.get('offset'))||0);
 const rows=await env.DB.prepare('SELECT * FROM leads'+where+' ORDER BY created_at DESC,id DESC LIMIT 101 OFFSET ?').bind(...args,offset).all();
 const stats=await env.DB.prepare("SELECT COUNT(*) AS total,COALESCE(SUM(status='New'),0) AS fresh,COALESCE(SUM(email_status='failed'),0) AS failed FROM leads").first();
 return reply({items:rows.results.slice(0,100),more:rows.results.length>100,stats});
 }
 const match=url.pathname.match(/^\/admin\/api\/leads\/([a-f0-9-]{36})$/);
 if(match && request.method==='PATCH'){const data=await request.json();if(!['New','Contacted','In review','Closed'].includes(data.status))return reply({error:'Invalid status'},400);const r=await env.DB.prepare('UPDATE leads SET status=? WHERE id=?').bind(data.status,match[1]).run();return r.meta.changes?reply({ok:true}):reply({error:'Lead not found'},404);}
 return reply({error:'Not found'},404);
 }catch{return reply({error:'Unable to access records. Check the database binding and schema.'},500);}
}

async function updateEmailStatus(env,id,saved,status){
 if(!saved)return;
 try{await env.DB.prepare('UPDATE leads SET email_status=? WHERE id=?').bind(status,id).run();}
 catch{console.error('Email status update failed.');}
}
