// Human-readable snapshots stay with the lead, including incomplete inquiries.
export function extractOfferDetails(message) {
  const text=String(message||'');
  const amount=text.match(/(?:Preliminary cash estimate shown|(?:80|85)% preliminary figure):\s*\$([0-9,]+(?:\.[0-9]+)?)/i);
  const value=text.match(/(?:Estimated property value|Preliminary value shown):\s*\$([0-9,]+(?:\.[0-9]+)?)/i);
  const method=text.match(/Preferred contact:\s*(phone|text|email)/i);
  const checked=text.match(/Estimate calculated at:\s*([^\n]+)/i);
  return {amount:amount?Number(amount[1].replaceAll(',','')):null,property_value:value?Number(value[1].replaceAll(',','')):null,contact_method:method?method[1].toLowerCase():'',checked_at:checked?checked[1].trim():''};
}

export async function offerSnapshot(env,address) {
  const normalized=String(address).trim().replace(/,?\s+(?:USA|U\.?S\.?A\.?|United States(?: of America)?)\s*$/i,'').replace(/,\s*$/,'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  let estimate;
  if(env.DB)try{const row=await env.DB.prepare('SELECT payload FROM sb_valuation_cache WHERE id=?').bind(hash).first();estimate=row?JSON.parse(row.payload):null;}catch{}
  const prefix='Preferred contact: phone.\n';
  return prefix+(estimate?.available&&Number.isFinite(estimate.value)&&estimate.value>0?'Preliminary cash estimate shown: $'+Math.round(estimate.value*.85)+'.\nEstimated property value: $'+estimate.value+'.\nEstimate calculated at: '+estimate.checked_at:'Automated estimate unavailable; personalized review requested.');
}
