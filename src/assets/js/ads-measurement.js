// Google Ads outbound-click measurement; no Google Analytics or remarketing.
// Basic consent mode: no Google request until the visitor opts in.
(() => {
  if (location.hostname !== 'firstlightfoundry.com' && location.hostname !== 'www.firstlightfoundry.com') return;
  const tagId = 'AW-18500379482';
  const conversion = tagId + '/Ir1KCMil6pQdENrG1fVE';
  const key = 'ff-ad-measurement-v1';
  const params = new URLSearchParams(location.search);
  const campaign = params.get('utm_source') === 'google' && params.get('utm_medium') === 'cpc';
  const optedOut = navigator.globalPrivacyControl === true;
  let consent = null;
  try { consent = localStorage.getItem(key); } catch (_) { /* Choice remains page-local. */ }
  if (optedOut) consent = 'denied';
  let started = false;
  let sent = false;
  const gtag = function () { window.dataLayer.push(arguments); };
  function start() {
    if (started || consent !== 'granted') return;
    started = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = gtag;
    gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    gtag('consent', 'update', { ad_storage: 'granted', ad_user_data: 'granted' });
    gtag('js', new Date());
    // Only known advertising parameters are sent, never arbitrary query strings.
    const clean = new URL(location.pathname, location.origin);
    for (const name of ['utm_source', 'utm_medium', 'utm_campaign', 'gclid', 'gbraid', 'wbraid']) {
      if (params.has(name)) clean.searchParams.set(name, params.get(name));
    }
    gtag('config', tagId, { allow_ad_personalization_signals: false, allow_google_signals: false, page_location: clean.href, page_referrer: '', send_page_view: false });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + tagId;
    document.head.appendChild(script);
  }
  const panel = document.createElement('section');
  panel.className = 'measurement-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Ad measurement preferences');
  panel.innerHTML = '<p><strong>Help us understand what brings readers here.</strong> Allow Google Ads measurement cookies and sharing of your ad interaction and Amazon-link clicks with Google? This measures interest in the book, not purchases. We do not enable personalized advertising. <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">How Google uses this information</a>. Your choice is saved in this browser and can be changed in the footer.</p><div><button type="button" data-choice="granted">Allow measurement</button><button type="button" data-choice="denied">No thanks</button></div>';
  document.body.appendChild(panel);
  const settings = document.querySelector('[data-measurement-settings]');
  if (settings) {
    settings.hidden = false;
    settings.addEventListener('click', () => { panel.hidden = false; panel.querySelector('button').focus(); });
  }
  if (optedOut) {
    panel.querySelector('p').textContent = 'Your browser’s Global Privacy Control is enabled. Google Ads measurement is off. Amazon links still work.';
    panel.querySelector('[data-choice="granted"]').hidden = true;
    panel.querySelector('[data-choice="denied"]').textContent = 'Close';
  }
  panel.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => {
    consent = optedOut ? 'denied' : button.dataset.choice;
    try { localStorage.setItem(key, consent); } catch (_) { /* No persistent storage available. */ }
    panel.hidden = true;
    if (consent === 'granted') start();
    else if (started) {
      gtag('consent', 'update', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
      // Reload to unload the Google library. It will not be loaded on the next page.
      location.reload();
    }
    if (settings) settings.focus();
  }));
  if (consent === 'granted') start();
  else if (!consent && campaign) panel.hidden = false;

  const routes = new Set(['/go/amazon-hardcover/', '/go/amazon-paperback/', '/go/amazon-kindle-ebook/']);
  const products = new Set(['/dp/B0HLP618FK', '/dp/B0HLPKTJPF', '/dp/B0HLPFQF2K']);
  function track(event) {
    if (consent !== 'granted' || !started || sent || event.defaultPrevented || (event.type === 'auxclick' && event.button !== 1)) return;
    const link = event.target.closest && event.target.closest('a[href]');
    if (!link) return;
    const url = new URL(link.href, location.href);
    if (!(url.origin === location.origin && routes.has(url.pathname)) && !(url.hostname === 'www.amazon.com' && products.has(url.pathname.replace(/\/$/, '')))) return;
    sent = true; // One interest signal per page, even if a reader compares formats.
    const sameTab = event.type === 'click' && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && (!link.target || link.target === '_self');
    let navigated = false;
    const proceed = () => { if (sameTab && !navigated) { navigated = true; location.assign(url.href); } };
    if (sameTab) { event.preventDefault(); setTimeout(proceed, 900); }
    gtag('event', 'conversion', { send_to: conversion, value: 0, currency: 'USD', event_callback: proceed, event_timeout: 800 });
  }
  document.addEventListener('click', track);
  document.addEventListener('auxclick', track);
})();
