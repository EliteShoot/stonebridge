(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const steps = [...document.querySelectorAll('.step')];
  const state = {step:1,timing:'',condition:'',busy:false,complete:false,prepared:false};
  const titles = ['YOUR PROPERTY','YOUR TIMELINE','PROPERTY CONDITION','CONTACT DETAILS'];
  const track = (event, extra={}) => { if(typeof window.gtag==='function') window.gtag('event',event,{page_path:location.pathname,form_id:'sell_landing',...extra}); };
  const error = message => { $('error').textContent=message; $('error').hidden=!message; };
  function show(n, focus=true) {
    state.step=n; document.body.classList.toggle('address-editing',n===1 && document.activeElement===$('address')); steps.forEach(s=>s.hidden=Number(s.dataset.step)!==n);
    $('preparing').hidden=true; $('controls').hidden=false; $('back').hidden=n===1;
    $('stepLabel').textContent=`STEP ${n} OF 4`; $('progressLabel').textContent=titles[n-1];
    $('fill').style.width=`${n===4?90:n*25}%`; $('progress').setAttribute('aria-valuenow',n===4?'90':String(n*25));
    $('next').textContent=n===4?'Request my offer review →':'Continue →';
    error(''); if(focus) steps[n-1].querySelector('h2').focus();
    track('seller_form_step',{step:n});
  }
  async function prepare() {
    if(state.prepared){show(4);return;}
    state.busy=true; steps.forEach(s=>s.hidden=true); $('controls').hidden=true; $('preparing').hidden=false;
    $('preparingTitle').focus();
    requestAnimationFrame(()=>requestAnimationFrame(()=>$('loadingFill').parentElement.classList.add('running')));
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    await new Promise(r=>setTimeout(r,reduced?100:1500));
    $('processingIcon').classList.add('done'); $('preparingTitle').textContent='Your details are ready.';
    $('preparingHint').textContent='Now, let us know how to reach you.';
    await new Promise(r=>setTimeout(r,reduced?100:700));
    state.prepared=true;state.busy=false;show(4);
  }
  document.querySelectorAll('.choice').forEach(button=>{
    button.setAttribute('aria-pressed','false');
    button.addEventListener('click',()=>{
      if(state.busy)return;
      const field=button.dataset.field;state[field]=button.dataset.value;
      document.querySelectorAll(`[data-field="${field}"]`).forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      error('');
      // Advance only once, synchronously locking navigation during preparation.
      if(field==='condition')prepare();else show(3);
    });
  });
  $('back').addEventListener('click',()=>{if(!state.busy&&state.step>1)show(state.step-1);});
  $('sellForm').addEventListener('submit',async event=>{
    event.preventDefault();if(state.busy||state.complete)return;
    error('');
    if(state.step===1){
      $('address').value=$('address').value.trim();
      if($('address').value.length<8){error('Please enter your property address and city.');$('address').focus();return;}
      track('seller_form_started');show(2);return;
    }
    if(state.step===2){if(!state.timing){error('Choose your selling timeline.');return;}show(3);return;}
    if(state.step===3){if(!state.condition){error('Choose the property condition.');return;}prepare();return;}
    for(const id of ['name','phone','email'])$(''+id).value=$(id).value.trim();
    const phone=$('phone').value.replace(/\D/g,'');
    $('phone').setCustomValidity(/^(?:1)?[2-9]\d{2}[2-9]\d{6}$/.test(phone)?'':'Please enter a valid 10-digit US phone number.');
    for(const id of ['name','phone','email','consent']){if(!$(id).checkValidity()){$(id).reportValidity();return;}}
    state.busy=true;$('next').disabled=true;$('back').disabled=true;$('next').textContent='Sending your request…';
    const payload={draft_id:window.StoneBridgeDrafts?.id($('sellForm')),address:$('address').value.trim(),timing:state.timing,condition:state.condition,name:$('name').value,phone:$('phone').value,email:$('email').value,consent:$('consent').checked};
    try {
      const response=await fetch('https://stonebridge.psznbzhnps.workers.dev',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});
      const result=await response.json();
      if(!response.ok||result.ok!==true)throw new Error('submission');
      window.StoneBridgeDrafts?.complete($('sellForm'));
      state.complete=true;$('sellForm').hidden=true;$('success').hidden=false;
      $('fill').style.width='100%';$('progress').setAttribute('aria-valuenow','100');$('stepLabel').textContent='COMPLETE';$('progressLabel').textContent='REQUEST RECEIVED';
      track('seller_lead_submitted',{send_to:'G-89ZXPS62KN',lead_type:'property',transport_type:'beacon'});
      try { if(typeof window.fbq==='function') window.fbq('track','Lead'); } catch (_) {}
      $('success').querySelector('h2').focus();
    } catch {
      error('We couldn’t confirm your request. Your answers are still here. Please try again, or email info@stonebridgedg.com.');
      $('next').textContent='Try again →';
    } finally {state.busy=false;$('next').disabled=false;$('back').disabled=false;}
  });
  document.querySelectorAll('[data-dialog]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.dialog).showModal()));
  // Load the same Google Places integration as the existing seller form.
  const address = $('address');
  const help = $('addressHelp');
  const placesFallback = () => { help.textContent='Enter the full address, city, MI and ZIP. You can continue without suggestions.'; };
  window.gm_authFailure = placesFallback;
  window.initStoneBridgePlaces = () => {
    if(address.dataset.placesReady==='true') return;
    if(!window.google?.maps?.places?.Autocomplete){placesFallback();return;}
    try {
      const autocomplete = new google.maps.places.Autocomplete(address, {
        componentRestrictions:{country:'us'}, types:['address'],
        fields:['formatted_address','address_components'],
        bounds:{south:41.6961,west:-90.4181,north:48.3061,east:-82.1228}, strictBounds:false
      });
      address.dataset.placesReady='true';
      autocomplete.addListener('place_changed',()=>{
        const place=autocomplete.getPlace();
        if(!place?.formatted_address || state.step!==1 || state.busy)return;
        address.value=place.formatted_address;
        address.dispatchEvent(new Event('change',{bubbles:true}));
        document.body.classList.remove('address-editing');
        address.blur();track('seller_form_started');show(2);
      });
    } catch { placesFallback(); }
  };
  address.addEventListener('focus',()=>document.body.classList.add('address-editing'));
  address.addEventListener('input',()=>document.body.classList.add('address-editing'));
  address.addEventListener('keydown',event=>{
    // Let Google select the highlighted suggestion without submitting the form too.
    if(event.key==='Enter' && document.querySelector('.pac-item-selected')) event.preventDefault();
  });
  const mapsUrl=document.querySelector('script[data-places-url]')?.dataset.placesUrl;
  if(window.google?.maps?.places)window.initStoneBridgePlaces();
  else if(mapsUrl){const script=document.createElement('script');script.src=mapsUrl;script.async=true;script.onerror=placesFallback;document.head.appendChild(script);}
  show(1,false);
})();
