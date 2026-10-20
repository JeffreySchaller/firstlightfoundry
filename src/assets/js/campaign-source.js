// Preserve this campaign's source and Google click identifiers through reading
// pages. This link-rewriting script uses no cookies or browser storage.
// Optional Google measurement is handled separately in ads-measurement.js.
(() => {
  const params = new URLSearchParams(location.search);
  if (params.get('utm_source') !== 'google' || params.get('utm_medium') !== 'cpc' ||
      params.get('utm_campaign') !== 'rtc_search_oct2026') return;
  const tags = {
    '/go/amazon-hardcover/': 'https://www.amazon.com/dp/B0HLP618FK?maas=maas_adg_E6B17754A3D37C10A5715C39CA56D299_afap_abs&ref_=aa_maas&tag=maas',
    '/go/amazon-paperback/': 'https://www.amazon.com/dp/B0HLPKTJPF?maas=maas_adg_55BE2A895442F6A3E15381C0EEA0B5BA_afap_abs&ref_=aa_maas&tag=maas',
    '/go/amazon-kindle-ebook/': 'https://www.amazon.com/dp/B0HLPFQF2K?maas=maas_adg_940E9614BE2DEA995CFE862A0EFCF8FB_afap_abs&ref_=aa_maas&tag=maas'
  };
  document.querySelectorAll('a[href]').forEach(link => {
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    if (tags[url.pathname]) { link.href = tags[url.pathname]; return; }
    if (!url.pathname.endsWith('/') || url.pathname.startsWith('/go/')) return;
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'gclid', 'gbraid', 'wbraid']) {
      if (params.has(key)) url.searchParams.set(key, params.get(key));
    }
    link.href = url.href;
  });
})();
