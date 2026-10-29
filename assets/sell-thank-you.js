(() => {
  'use strict';
  // Consume a short-lived, tab-local receipt before loading any tracking.
  // Direct visits and reloads return to the form without a conversion pageview.
  let submittedAt = 0;
  try {
    submittedAt = Number(sessionStorage.getItem('stonebridge:seller-submitted'));
    sessionStorage.removeItem('stonebridge:seller-submitted');
  } catch (_) {}
  const age = Date.now() - submittedAt;
  if (!submittedAt || !Number.isFinite(submittedAt) || age < 0 || age > 600000) {
    location.replace('/sell/');
    return;
  }
  document.body.hidden = false;
  document.querySelectorAll('[data-dialog]').forEach(button => {
    button.addEventListener('click', () => document.getElementById(button.dataset.dialog).showModal());
  });
  const loadScript = src => {
    const script = document.createElement('script');
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  };
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', 'G-89ZXPS62KN');
  loadScript('https://www.googletagmanager.com/gtag/js?id=G-89ZXPS62KN');
  if (!window.fbq) {
    const fbq = window.fbq = function () {
      fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments);
    };
    window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
  }
  window.fbq('init', '1909947260369701');
  window.fbq('track', 'PageView');
  loadScript('https://connect.facebook.net/en_US/fbevents.js');
})();
