(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const steps = [...document.querySelectorAll('.step')];
  const state = {step:1,timing:'',condition:'',busy:false,complete:false,estimate:null,lookupAddress:''};
  const titles = ['YOUR PROPERTY','SAVE YOUR ESTIMATE','YOUR TIMELINE','PROPERTY CONDITION'];
  const track = (event, extra={}) => { if(typeof window.gtag==='function') window.gtag('event',event,{page_path:location.pathname,form_id:'sell_landing',...extra}); };
  const error = message => { $('error').textContent=message; $('error').hidden=!message; };
  function show(n, focus=true) {
    state.step=n; document.body.classList.toggle('address-editing',n===1 && document.activeElement===$('address')); steps.forEach(s=>s.hidden=Number(s.dataset.step)!==n);
    $('controls').hidden=false; $('back').hidden=n===1;
    $('stepLabel').textContent=`STEP ${n} OF 4`; $('progressLabel').textContent=titles[n-1];
    $('fill').style.width=`${n===4?90:n*25}%`; $('progress').setAttribute('aria-valuenow',n===4?'90':String(n*25));
    $('next').hidden=n===4&&!state.condition;
    $('next').textContent=n===4?'Save my request →':n===1?'Get my instant estimate →':n===2?'Save my estimate →':'Continue →';
    error(''); if(focus) steps[n-1].querySelector('h2').focus();
    track('seller_form_step',{step:n});
  }
  const contactMethod = () => 'phone';
  function syncMessage() {
    const e=state.estimate;
    $('message').value='Preferred contact: phone.\n'+(e?.available?'Preliminary cash estimate shown: $'+e.preliminary_offer+'.\nEstimated property value: $'+e.value+'.\nEstimate calculated at: '+e.checked_at:'Automated estimate unavailable; personalized review requested.');
  }
  function validateContact() {
    for(const id of ['name','phone','email'])$(id).value=$(id).value.trim();
    const phone=$('phone').value.replace(/\D/g,'');
    $('phone').setCustomValidity(!/^(?:1)?[2-9]\d{2}[2-9]\d{6}$/.test(phone)?'Please enter a valid 10-digit US mobile number.':'');
    for(const id of ['name','phone','email','consent']){if(!$(id).checkValidity()){$(id).reportValidity();return false;}}
    return true;
  }
  async function lookup() {
    if(state.busy)return;
    const address=$('address').value.trim();
    if(state.lookupAddress===address){show(2);return;}
    state.busy=true;$('controls').hidden=true;steps.forEach(s=>s.hidden=true);
    $('valuationLoading').hidden=false;$('loadingAddress').textContent=address;
    $('stepLabel').textContent='CHECKING YOUR PROPERTY';$('progressLabel').textContent='ESTIMATE LOOKUP';
    $('valuationLoading').querySelector('h2').setAttribute('tabindex','-1');$('valuationLoading').querySelector('h2').focus();
    state.estimate=null;
    try {
      const response=await fetch('https://stonebridge.psznbzhnps.workers.dev/valuation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address}),signal:AbortSignal.timeout(12000)});
      const result=await response.json();
      if(response.ok&&result.ok===true)state.estimate=result;
    } catch {}
    finally {
      state.busy=false;state.lookupAddress=state.estimate?.available||['no_estimate','not_found','provider_http_404'].includes(state.estimate?.reason)?address:'';$('valuationLoading').hidden=true;
      const e=state.estimate,available=e?.available===true&&Number.isFinite(e.value)&&e.value>0&&Number.isFinite(e.preliminary_offer);
      $('estimateResult').hidden=false;$('estimateAddress').textContent=address;
      $('estimateFigures').hidden=!available;$('estimateFallback').hidden=available;
      if(available){const money=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});$('offerValue').textContent=money.format(e.preliminary_offer);}
      syncMessage();$('message').dispatchEvent(new Event('change',{bubbles:true}));track('seller_valuation_result',{available});show(2,false);$('estimateResult').setAttribute('tabindex','-1');$('estimateResult').focus();
    }
  }
  document.querySelectorAll('.choice').forEach(button=>{
    button.setAttribute('aria-pressed','false');
    button.addEventListener('click',()=>{
      if(state.busy)return;
      const field=button.dataset.field;state[field]=button.dataset.value;
      document.querySelectorAll(`[data-field="${field}"]`).forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
      error('');
      // Selecting the final answer submits immediately; the busy guard prevents duplicates.
      if(field==='timing')show(4);else if(field==='condition')$('sellForm').requestSubmit();
    });
  });
  $('back').addEventListener('click',()=>{if(!state.busy&&state.step>1)show(state.step-1);});
  $('sellForm').addEventListener('submit',async event=>{
    event.preventDefault();if(state.busy||state.complete)return;
    error('');
    if(state.step===1){
      $('address').value=$('address').value.trim();
      if($('address').value.length<8){error('Please enter your property address and city.');$('address').focus();return;}
      track('seller_form_started');await lookup();return;
    }
    if(state.step===2){
      if(!validateContact())return;
      syncMessage(); $('consent').dispatchEvent(new Event('change',{bubbles:true}));
      track('seller_contact_captured');show(3);return;
    }
    if(state.step===3){if(!state.timing){error('Choose your selling timeline.');return;}show(4);return;}
    if(!state.condition){error('Choose the property condition.');return;}
    if(!validateContact()){show(2);validateContact();return;}
    syncMessage();
    state.busy=true;$('next').hidden=false;$('next').disabled=true;$('back').disabled=true;$('next').textContent='Sending your request…';
    const payload={flow_version:'valuation_v2',contact_method:contactMethod(),message:$('message').value,draft_id:window.StoneBridgeDrafts?.id($('sellForm')),address:$('address').value.trim(),timing:state.timing,condition:state.condition,name:$('name').value,phone:$('phone').value,email:$('email').value,consent:$('consent').checked};
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
      // Only a server-confirmed submission may open the conversion page.
      // If storage is unavailable, retain the existing inline confirmation.
      try {
        sessionStorage.setItem('stonebridge:seller-submitted', String(Date.now()));
        location.assign('/sell/thank-you/');
      } catch (_) {}
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
        address.blur();track('seller_form_started');void lookup();
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


