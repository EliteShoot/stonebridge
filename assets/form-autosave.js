(() => {
  'use strict';
  const endpoint = 'https://stonebridge.psznbzhnps.workers.dev/draft';
  const records = new Map();
  function record(root) {
    if (!root) return null;
    if (!records.has(root)) {
      const key = 'sb-draft:' + location.pathname + ':' + (root.dataset.subject || root.id || 'seller');
      let saved;
      try { saved = JSON.parse(sessionStorage.getItem(key)); } catch (_) {}
      const id = /^[a-f0-9-]{36}$/.test(saved?.id || '') ? saved.id : crypto.randomUUID();
      records.set(root, {id, key, revision: Number(saved?.revision) || 0, done:false, last:'', timer:null, retry:null});
    }
    return records.get(root);
  }
  function snapshot(root) {
    const contact = root.matches('form.form-grid');
    const value = name => {
      const el = root.querySelector('#' + name + ',[name="' + name[0].toUpperCase() + name.slice(1) + '"]');
      return el?.value?.trim() || '';
    };
    const choice = name => root.querySelector('[data-field="' + name + '"].selected,[data-field="' + name + '"][aria-pressed="true"]')?.dataset.value || '';
    return {
      type:contact?'contact':'seller', subject:root.dataset.subject || '',
      name:value('name'), email:value('email'), phone:value('phone'),
      address:value('address'), property:value('property'), message:value('message'),
      timing:choice('timing'), condition:choice('condition'),
      consent:!!root.querySelector('input[type="checkbox"][name="Consent"],#consent,#sellerConsent')?.checked,
      source_page:location.pathname
    };
  }
  function eligible(data) {
    return data.type === 'seller' ? !!data.address : !!(data.name || data.email || data.phone || data.property || data.message);
  }
  async function save(root, leaving = false) {
    const r = record(root);
    if (!r || r.done) return;
    clearTimeout(r.timer);
    const data = snapshot(root), signature = JSON.stringify(data);
    if (!eligible(data) || r.last === signature) return;
    const revision = ++r.revision;
    try { sessionStorage.setItem(r.key, JSON.stringify({id:r.id,revision})); } catch (_) {}
    const body = JSON.stringify({...data,draft_id:r.id,revision});
    // Beacon is an extra exit flush; ordinary saves require a confirmed server response.
    if (leaving && navigator.sendBeacon) {
      if (navigator.sendBeacon(endpoint, new Blob([body], {type:'application/json'}))) return;
    }
    try {
      const response = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true,signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error('save');
      if (r.revision === revision) r.last = signature;
    } catch (_) {
      if (!r.done && !leaving) {
        clearTimeout(r.retry);
        r.retry = setTimeout(() => save(root), 5000);
      }
    }
  }
  function init() {
    document.querySelectorAll('.submission-card, #sellForm, form.form-grid').forEach(root => {
      if (!root.querySelector('#address') && !root.matches('form.form-grid')) return;
      record(root);
      const notice = document.createElement('p');
      notice.className = 'autosave-notice';
      notice.style.cssText = 'font-size:11px;line-height:1.6;color:#82796e;grid-column:1/-1';
      notice.textContent = 'Information you enter is saved as you go, even if you do not submit this form.';
      const first = root.querySelector('input');
      (first?.closest('label,.field') || first)?.insertAdjacentElement('beforebegin', notice);
      root.addEventListener('input', () => {
        const r=record(root);clearTimeout(r.timer);
        // Save the first address immediately; coalesce subsequent keystrokes.
        if (!r.revision && snapshot(root).address) save(root);
        else r.timer=setTimeout(() => save(root), 300);
      });
      root.addEventListener('reset', () => {
        if (record(root).done) records.delete(root);
      });
      root.addEventListener('change', () => save(root));
      root.addEventListener('focusout', () => save(root));
      root.addEventListener('click', e => {
        if (e.target.closest('[data-field]')) queueMicrotask(() => save(root));
      });
    });
  }
  window.StoneBridgeDrafts = {
    id(root) { return record(root)?.id; },
    complete(root) {
      const r=record(root);if(!r)return;
      r.done=true;clearTimeout(r.timer);clearTimeout(r.retry);
      try { sessionStorage.removeItem(r.key); } catch (_) {}
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') records.forEach((_,root) => save(root,true));
  });
  window.addEventListener('pagehide', () => records.forEach((_,root) => save(root,true)));
  window.addEventListener('online', () => records.forEach((_,root) => save(root)));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
