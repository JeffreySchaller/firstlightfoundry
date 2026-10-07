#!/usr/bin/env node
// firstlightfoundry.com static build. Zero dependencies (Node 18+).
// Reads launch.config.json + src/, writes dist/. Refuses unverifiable launch states.
//   node scripts/build.mjs                 (local; CONTEXT defaults to "dev")
//   CONTEXT=production node scripts/build.mjs
// Netlify sets CONTEXT to production | deploy-preview | branch-deploy.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const CONTEXT = process.env.CONTEXT || 'dev';
const PROD = CONTEXT === 'production';
const SITE = 'https://firstlightfoundry.com';
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'launch.config.json'), 'utf8'));
const errors = [], warnings = [];

// ------------------------------------------------------------------ validation (the launch gate)
const AMAZON = /^https:\/\/www\.amazon\.(com|co\.uk|de|fr|es|it|nl|ie|com\.be|pl|se|ca|com\.au)\/dp\/[A-Z0-9]{10}\/?$/;
if (!['prelaunch', 'launched'].includes(cfg.state)) errors.push(`state must be "prelaunch" or "launched", got "${cfg.state}"`);
const liveFormats = [];
for (const f of cfg.book.formats) {
  if (f.amazonUrl == null) continue;
  if (!AMAZON.test(f.amazonUrl)) errors.push(`${f.format}: amazonUrl must be a canonical https://www.amazon.<tld>/dp/<10-char ASIN> link, got ${f.amazonUrl}`);
  else if (!f.asinVerifiedBy || !/^\d{4}-\d{2}-\d{2}$/.test(f.asinVerifiedOn || '')) errors.push(`${f.format}: amazonUrl set but asinVerifiedBy / asinVerifiedOn (YYYY-MM-DD) missing. Open the live page yourself, then record who checked and when.`);
  else liveFormats.push(f);
}
if (cfg.state === 'launched' && liveFormats.length === 0) errors.push('state is "launched" but no format has a verified Amazon URL. Stay in "prelaunch" until one does.');
if (cfg.state === 'prelaunch' && liveFormats.length) warnings.push('Verified Amazon URLs are present but state is "prelaunch": buy links stay hidden until cutover.');
const ld = cfg.launchDate || {};
if (ld.value && !/^\d{4}-\d{2}-\d{2}$/.test(ld.value)) errors.push('launchDate.value must be YYYY-MM-DD');
const showDate = !!(ld.value && ld.confirmedBy);
if (ld.value && !ld.confirmedBy) warnings.push('launchDate set but not confirmedBy: the date is NOT shown on the site.');
if (cfg.book.coverImage && !fs.existsSync(path.join(SRC, cfg.book.coverImage))) errors.push(`coverImage ${cfg.book.coverImage} not found under src/`);
const channels = Object.values(cfg.channels).filter(c => c.url && c.verifiedOn);
for (const c of Object.values(cfg.channels)) if (c.url && !c.verifiedOn) warnings.push(`${c.label}: url set but not verifiedOn, so it is hidden.`);
const launched = cfg.state === 'launched' && liveFormats.length > 0;

// ------------------------------------------------------------------ content
const readFile = p => fs.readFileSync(p, 'utf8');
const pieces = [];
for (const r of cfg.reading) {
  const file = path.join(SRC, 'content/reading', r.slug + '.html');
  if (!fs.existsSync(file)) { errors.push(`reading piece ${r.slug} missing`); continue; }
  const raw = readFile(file);
  const m = raw.match(/<!--META ([\s\S]*?) META-->/);
  if (!m) { errors.push(`${r.slug}: META block missing`); continue; }
  const meta = JSON.parse(m[1]);
  const body = raw.slice(m.index + m[0].length).trim();
  if (!r.approved && PROD) { warnings.push(`${r.slug}: not approved, excluded from the production build.`); continue; }
  const words = body.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  if (meta.image && !fs.existsSync(path.join(SRC, meta.image))) { errors.push(`${r.slug}: image ${meta.image} not found under src/`); continue; }
  if (meta.image && !meta.imageAlt) { errors.push(`${r.slug}: image needs imageAlt`); continue; }
  pieces.push({ ...meta, slug: r.slug, approved: !!r.approved, body, words, minutes: Math.max(1, Math.round(words / 230)) });
}
pieces.sort((a, b) => a.order - b.order);
if (!pieces.find(p => p.kind === 'excerpt')) errors.push('At least one approved excerpt is required: it is the primary call to action.');

if (errors.length) { console.error('BUILD REFUSED\n  - ' + errors.join('\n  - ')); process.exit(1); }

// ------------------------------------------------------------------ helpers
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const B = cfg.book;
const firstExcerpt = pieces.find(p => p.kind === 'excerpt');
const slugOf = f => f.format.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-+$/, '');

// FF recut, display master paths from Firstlight_Mark_handoff.zip (ff-display-two-color.svg).
const FF_PATHS = '<path d="M18 18 L52 18 L52 27 C40 27 33 26.5 29.5 30 L29.5 45 L44 45 L44 53 C37 53 32.5 52.8 29.5 56 L29.5 74 C29.5 78 32 78.6 37 79.6 L37 82 L10 82 L10 79.6 C15 78.6 18 78 18 74 Z"/><path d="M52 18 L85 18 L85 27 C73 27 67 26.5 63.5 30 L63.5 45 L77 45 L77 53 C70 53 66.5 52.8 63.5 56 L63.5 74 C63.5 78 66 78.6 71 79.6 L71 82 L44 82 L44 79.6 C49 78.6 52 78 52 74 Z"/>';
const colophon = (ember = true) => `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g fill="currentColor">${FF_PATHS}</g><rect x="75" y="75" width="7" height="7" fill="${ember ? '#B8472A' : 'currentColor'}"/></svg>`;
const businessQuestions = `<aside class="business-questions" aria-label="Questions the book helps you work through"><p class="eyebrow">The decisions in front of you</p><p>Where is the work getting stuck?</p><p>What needs your attention first?</p><p>What would make the next effort count?</p><span class="meta">Returning to Craft · ${esc(B.seriesNumber)}</span></aside>`;

const NAV = [
  { label: 'Reading Room', href: '/reading/' },
  { label: 'The book', href: '/returning-to-craft/' },
  { label: 'About', href: '/about/' },
  { label: 'Start a conversation', href: '/about/#send-word' },
];

function layout({ title, description, pathname, body, ogType = 'website', jsonld = null }) {
  const nav = NAV.map(n => `<a href="${n.href}"${pathname.startsWith(n.href) ? ' aria-current="page"' : ''}>${n.label}</a>`).join('');
  const navM = NAV.map(n => `<a href="${n.href}"${pathname.startsWith(n.href) ? ' aria-current="page"' : ''}>${n.label}</a>`).join('');
  const full = title === 'Firstlight Foundry' ? title : `${title} · Firstlight Foundry`;
  const elsewhere = channels.map(c => `<li><a href="${esc(c.url)}" rel="me noopener">${esc(c.label)}</a></li>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description)}">
${PROD ? '' : '<meta name="robots" content="noindex, nofollow">\n'}<link rel="canonical" href="${SITE}${pathname}">
<meta name="theme-color" content="#F4EEE2">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="Firstlight Foundry">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${SITE}${pathname}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/Lora-Variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/Newsreader-Variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/tokens.css">
<link rel="stylesheet" href="/assets/css/components.css">
<link rel="stylesheet" href="/assets/css/site.css">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body class="ff-root">
<a class="skip" href="#main">Skip to the text</a>
<header class="ff-header">
  <div class="ff-header__in">
    <a class="ff-lockup" href="/" aria-label="Firstlight Foundry, home">${colophon(true)}<span class="ff-lockup__word">Firstlight Foundry</span></a>
    <nav class="ff-nav" aria-label="Primary">${nav}</nav>
    <details class="ff-menu"><summary>Menu</summary><nav class="ff-nav-mobile" aria-label="Primary">${navM}</nav></details>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="ff-footer">
  <div class="ff-footer__in">
    <div>
      <a class="ff-lockup" href="/" aria-label="Firstlight Foundry, home">${colophon(false)}<span class="ff-lockup__word">Firstlight Foundry</span></a>
      <p class="ff-footer__motto">Made in conversation. Made to last.</p>
    </div>
    <div class="ff-footer__cols">
      <div><h2>Read</h2><ul><li><a href="/reading/">Reading Room</a></li><li><a href="/reading/${firstExcerpt.slug}/">${esc(firstExcerpt.title)}</a></li></ul></div>
      <div><h2>The house</h2><ul><li><a href="/returning-to-craft/">${esc(B.title)}</a></li><li><a href="/about/">About</a></li><li><a href="/about/#send-word">Send word</a></li></ul></div>
      ${elsewhere ? `<div><h2>Elsewhere</h2><ul>${elsewhere}</ul></div>` : ''}
    </div>
    <div class="ff-footer__legal"><span class="meta">Firstlight Foundry LLC · MMXXVI</span><span class="meta">Books, made well.</span></div>
  </div>
</footer>
</body>
</html>
`;
}

// ------------------------------------------------------------------ shared blocks
function notifyForm(id) {
  if (!cfg.notify.enabled || launched) return '';
  return `<form class="notice" name="${esc(cfg.notify.formName)}" method="POST" action="/noted/" data-netlify="true" netlify-honeypot="company">
  <input type="hidden" name="form-name" value="${esc(cfg.notify.formName)}">
  <p class="hp" aria-hidden="true"><label>Leave this empty <input name="company" tabindex="-1" autocomplete="off"></label></p>
  <div class="notice__row">
    <div class="ff-field"><label class="ff-field__label" for="${id}">Email address</label>
      <input class="ff-field__input" id="${id}" name="email" type="email" autocomplete="email" required aria-describedby="${id}-hint"></div>
    <button class="ff-btn ff-btn--secondary" type="submit">Tell me when it is out</button>
  </div>
  <p class="small" id="${id}-hint">${esc(cfg.notify.promise)}</p>
</form>`;
}

function buyBlock(primary = true) {
  if (!launched) return '';
  return liveFormats.map((f, i) => `<a class="ff-btn ${i === 0 && primary ? 'ff-btn--primary' : 'ff-btn--secondary'}" href="/go/amazon-${slugOf(f)}/">${esc(f.format)} on Amazon</a>`).join('\n');
}

function statusLine() {
  if (launched) return 'Available on Amazon';
  return showDate ? `${B.prelaunchStatus} · On Amazon ${new Date(ld.value + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}` : `${B.prelaunchStatus} · Coming to Amazon`;
}

function rrList(list) {
  return `<ul class="rr">${list.map(p => `<li><a href="/reading/${p.slug}/"><span class="kind">${p.kind === 'excerpt' ? 'Excerpt' : 'Adapted'}<small>${esc(p.eyebrow.split('·')[1]?.trim() || '')} · ${p.minutes} min</small></span><span><span class="rr__title">${esc(p.title)}</span>${p.approved ? '' : ' <span class="meta">(draft, not in production)</span>'}<p class="rr__sf">${esc(p.standfirst)}</p></span></a></li>`).join('')}</ul>`;
}

function readingCards(level = 2) {
  return `<div class="reading-cards">${pieces.map((p, i) => `<a class="reading-card" href="/reading/${p.slug}/">
    <div class="reading-card__art">${p.image ? `<img src="/${esc(p.image)}" alt="" width="900" height="1200" loading="lazy" decoding="async">` : `<span class="reading-card__quote">“You have been<br>in this room.”</span><span class="reading-card__mark" aria-hidden="true">${colophon(false)}</span>`}</div>
    <div class="reading-card__body"><p class="eyebrow">${esc(p.eyebrow)} · ${p.minutes} min</p><h${level}>${esc(p.title)}</h${level}><p>${esc(p.standfirst)}</p><span class="reading-card__link">Read the ${i === 0 ? 'Preface' : 'chapter'} <span aria-hidden="true">↗</span></span></div>
  </a>`).join('')}</div>`;
}

const bookLD = {
  '@context': 'https://schema.org', '@type': 'Book', name: B.title, alternativeHeadline: B.subtitle,
  author: { '@type': 'Person', name: B.author }, publisher: { '@type': 'Organization', name: B.imprint, url: SITE },
  isPartOf: { '@type': 'BookSeries', name: B.series }, url: `${SITE}/returning-to-craft/`,
  workExample: B.formats.filter(f => f.isbnVerified).map(f => ({ '@type': 'Book', bookFormat: f.format === 'Hardcover' ? 'https://schema.org/Hardcover' : f.format === 'Paperback' ? 'https://schema.org/Paperback' : 'https://schema.org/EBook', isbn: f.isbn })),
  ...(launched ? { sameAs: liveFormats.map(f => f.amazonUrl) } : {}),
};

// ------------------------------------------------------------------ pages
const pages = {};

pages['/'] = layout({
  title: 'Firstlight Foundry', pathname: '/',
  description: `Firstlight Foundry is a small studio shaping voices into form. We work with one author at a time to make books from ideas, experience and a voice worth hearing. Meet the studio and explore our first title, ${B.title}.`,
  jsonld: { '@context': 'https://schema.org', '@type': 'Organization', name: 'Firstlight Foundry', url: SITE, logo: `${SITE}/favicon.svg`, sameAs: channels.map(c => c.url) },
  body: `
<section class="hero company-opening"><div class="wrap">
  <div class="edition-line"><span>Firstlight Foundry · A small studio</span><span>Est. MMXXVI</span></div>
  <div class="company-intro">
    <div><p class="eyebrow">Voices that deserve form.</p><h1>A small studio<br>shaping voices<br>into <em>form.</em></h1></div>
    <div class="company-intro__text"><p class="lead">You have something worth saying. A lifetime of practice. An idea you keep returning to. A way of seeing that could help someone else.</p><p>Firstlight Foundry works with one author at a time to bring that thinking into a book. We help develop the ideas, shape the manuscript and hold it to the standard of a lasting work.</p><p class="company-promise">The author owns the voice.<br><em>We hold the form.</em></p><div class="actions"><a class="ff-btn ff-btn--primary" href="/about/#send-word">Start a conversation</a><a class="ff-btn ff-btn--quiet" href="/about/">Meet the studio <span aria-hidden="true">↗</span></a></div></div>
  </div>
  <div class="opening-foot"><span>Made in conversation. Made to last.</span><a href="#from-the-press">Explore our first book <span aria-hidden="true">↓</span></a></div>
</div></section>

<section class="section company-work"><div class="wrap slow-reading"><div><p class="eyebrow">The work</p><p class="company-folio" aria-hidden="true">01</p></div><div><h2 class="h-section">What you know deserves<br>the time to take shape.</h2><p class="lead">Some people think best in conversation. Others have spent years doing the work, with little time to write about it.</p><p>We begin with what you know and what you want a reader to understand. Together, we question it, find its structure and work on the language until the book carries your thinking in your voice.</p><p>Whether you have a manuscript, an idea that is ready to become one, or an interest in what we are building, we would like to hear from you.</p><a class="text-link" href="/about/#send-word">Tell us what you are working on <span aria-hidden="true">↗</span></a></div></div></section>

<section class="section home-opening" id="from-the-press"><div class="wrap">
  <div class="edition-line"><span>From the press</span><span>Our first title / No. 001</span></div>
  <div class="opening-grid">
    <div class="opening-copy">
      <p class="eyebrow">A book by ${esc(B.author)}</p>
      <h2 class="opening-title">Returning<br>to <em>Craft.</em></h2>
      <p class="lead">Your business is growing. Why does moving it forward keep getting harder?</p>
      <p class="opening-intro">More decisions come back to you. Priorities compete. Your team works hard, yet the same problems return. <cite>Returning to Craft</cite> helps you understand how the work fits together, recognize what is holding progress back, and decide where your next effort belongs.</p>
      <div class="actions"><a class="ff-btn ff-btn--primary" href="/reading/${firstExcerpt.slug}/">Begin reading</a><a class="ff-btn ff-btn--quiet" href="/returning-to-craft/">Explore the book <span aria-hidden="true">↗</span></a></div>
    </div>
    ${businessQuestions}
  </div>
  <div class="opening-foot"><span>${esc(statusLine())}</span><a href="#reading-room">Read an excerpt <span aria-hidden="true">↓</span></a></div>
</div></section>

<section class="section recognition" data-theme="ink"><div class="wrap recognition-grid">
  <div><p class="eyebrow">The book begins here</p><h2 class="recognition__quote">“You have been<br>in this room.”</h2><p class="meta">The opening line · ${esc(B.title)}</p></div>
  <div class="recognition__text"><p>A quarterly review where every slide agrees and someone at the table goes quiet. The work is familiar. The feeling that something is wrong is familiar, too.</p><p>You need to understand why the effort is not translating into progress. The book builds a way to see the relationships behind the results, distinguish a symptom from a constraint, and choose where to direct your attention.</p><a class="text-link" href="/reading/${firstExcerpt.slug}/">Read the Preface <span aria-hidden="true">↗</span></a></div>
</div></section>

<section class="section" id="reading-room"><div class="wrap">
  <div class="section-heading"><div><p class="eyebrow">The Reading Room</p><h2 class="h-section">A few pages.<br>A different way of seeing.</h2></div><p class="lead">Understanding takes time with an idea. Start here, with two passages from the book. No sign-up needed.</p></div>
  ${readingCards(3)}
</div></section>

<section class="section section--cream"><div class="wrap slow-reading">
  <p class="eyebrow">Why a book</p><div><h2 class="h-section">Some ideas need<br>room to become yours.</h2><p class="lead">A name means little until you understand what it names.</p><p>In <cite>Returning to Craft</cite>, you watch the work happen before the language arrives. One scene builds on another. The connections become visible. By the time you have a name for what is happening, you have a reason to use it.</p><p>That is what the book asks of your time, and what it hopes to give back: understanding you can carry into your own work.</p></div>
</div></section>

<section class="section section--cream"><div class="wrap">
  <div class="book">
    <div>
      <p class="eyebrow">${esc(B.imprint)} · ${esc(B.catalogNumber)}</p>
      <h2 class="book__title">${esc(B.title)}</h2>
      <p class="book__sub">${esc(B.subtitle)}</p>
      <p class="book__author">${esc(B.author)}</p>
    </div>
    <div>
      <dl class="facts"><dt>Status</dt><dd>${esc(statusLine())}</dd>${B.formats.filter(f => f.isbnVerified).map(f => `<dt>${esc(f.format)}</dt><dd>ISBN ${esc(f.isbn)}</dd>`).join('')}<dt>Series</dt><dd>${esc(B.series)}, ${esc(B.seriesNumber)}</dd></dl>
      <div class="actions">${launched ? buyBlock(false) : ''}<a class="ff-btn ff-btn--secondary" href="/returning-to-craft/">About the book</a></div>
      ${launched ? '' : `<div style="margin-top: var(--space-7)">${notifyForm('email-home')}</div>`}
    </div>
  </div>
</div></section>

<section class="section"><div class="wrap">
  <p class="eyebrow">How this house works</p>
  <div class="measure">
    <p>The best tools open new doorways into authorship. They can hold the patterns that good books and stories run on, so people with something true to say can work where it matters, whether or not they have trained as writers. The aim is a book that helps people in the work and lives they actually have.</p>
    <p>The roles are fixed. A person authors, directs and signs for every book the house publishes. Intelligent systems help develop the ideas, argue with them and draft, and a person decides what ships.</p>
    <p><a href="/about/">How a book is made here</a></p>
  </div>
</div></section>`,
});

// Book page
const TOC = [
  ['Part I · The Inheritance', 'Why the structures we inherit can feel like the only way to work.', 'The Inheritance · The Inflection · The Systems Integrator'],
  ['Part II · The Six Functions', 'Understand the work every business must perform, and why each part matters.', 'The Six Functions · Value Creation · Value Delivery · Value Capture · Demand Generation · Coordination · Adaptation'],
  ['Part III · The Circulation', 'See the relationships between the functions, and how one can limit the rest.', 'The Circulation · The Two Triads · The Constraint'],
  ['Part IV · The Human Layer', 'Consider the people doing the work, and what each is suited to see.', 'Six Archetypes for Six Functions · The Founder’s Blind Spot · Triangulation · The Fourth Satellite'],
  ['Part V · The Diagnostic', 'Bring the understanding you have built to the business in front of you.', 'The Constraint Audit · The Pattern at Every Scale'],
  ['Appendix', 'The traditions that meet in the framework.', 'The Convergence Table'],
];
pages['/returning-to-craft/'] = layout({
  title: B.title, pathname: '/returning-to-craft/', ogType: 'book', jsonld: bookLD,
  description: `Your business is growing. Why does moving it forward keep getting harder? ${B.title} helps you understand how the work fits together, recognize what is holding progress back, and decide where your next effort belongs. By ${B.author}.`,
  body: `
<section class="hero"><div class="wrap">
  <div class="book">
    <div>
      <p class="eyebrow">${esc(B.series)} · ${esc(B.seriesNumber)}</p>
      <h1 class="book__title">${esc(B.title)}</h1>
      <p class="book__sub">${esc(B.subtitle)}</p>
      <p class="book__author">${esc(B.author)}</p>
      <div class="actions">${launched ? buyBlock(true) : `<a class="ff-btn ff-btn--primary" href="/reading/${firstExcerpt.slug}/">Read an excerpt</a>`}</div>
    </div>
    <div>
      ${B.coverImage ? `<img src="/${esc(B.coverImage)}" alt="Front cover of ${esc(B.title)} by ${esc(B.author)}" width="600" height="900">` : businessQuestions}
      <dl class="facts"><dt>Status</dt><dd>${esc(statusLine())}</dd><dt>Publisher</dt><dd>${esc(B.imprint)}</dd>${B.formats.filter(f => f.isbnVerified).map(f => `<dt>${esc(f.format)}</dt><dd>ISBN ${esc(f.isbn)}</dd>`).join('')}</dl>
    </div>
  </div>
</div></section>

<section class="section section--cream"><div class="wrap">
  <p class="eyebrow">Who it is for</p>
  <div class="measure">
    <p class="lead">Your business is growing. Why does moving it forward keep getting harder? More decisions come back to you. Priorities compete. Your team works hard, yet the same problems return.</p>
    <p><cite>Returning to Craft</cite> helps you understand how the work fits together, recognize what is holding progress back, and decide where your next effort belongs. It develops that understanding step by step, through situations you can examine and carry back to your own work. For people building a business, and people responsible for making one work.</p>
  </div>
</div></section>

<section class="section section--cream"><div class="wrap">
  <p class="eyebrow">What is inside</p>
  <h2 class="h-section">Five parts, nineteen chapters.</h2>
  <ul class="toc">${TOC.map(([k, why, v]) => `<li><h3>${esc(k)}</h3><div><p>${esc(why)}</p><p class="toc__chapters">${esc(v)}</p></div></li>`).join('')}</ul>
</div></section>

<section class="section"><div class="wrap">
  <p class="eyebrow">Read before you decide</p>
  ${readingCards()}
  ${launched ? '' : `<div style="margin-top: var(--space-8)"><h2 class="h-section" style="font-size: 27px">Hear when it is on Amazon</h2>${notifyForm('email-book')}</div>`}
</div></section>`,
});

// Reading Room index
pages['/reading/'] = layout({
  title: 'The Reading Room', pathname: '/reading/',
  description: `Passages from ${B.title} by ${B.author}, set for reading on a screen.`,
  body: `
<section class="hero"><div class="wrap">
  <p class="eyebrow">The Reading Room</p>
  <h1 class="h-section">Sit down with the book.</h1>
  <p class="lead narrow">A place to spend time with an idea. These two passages are the book’s own text, unchanged. Begin with a familiar problem in the Preface, or see the business at its simplest in Chapter Four.</p>
  ${readingCards()}
</div></section>`,
});

// Articles
for (const [i, p] of pieces.entries()) {
  const next = pieces[(i + 1) % pieces.length];
  const byline = p.kind === 'excerpt' ? `By ${B.author} · From <cite>${esc(B.title)}</cite> · ${p.minutes} min read` : `Adapted by Firstlight Foundry from <cite>${esc(B.title)}</cite> by ${esc(B.author)} · ${p.minutes} min read`;
  const bodyWithEnd = p.body.replace(/<\/p>\s*$/, '<span class="ff-endmark" aria-hidden="true"></span></p>');
  pages[`/reading/${p.slug}/`] = layout({
    title: p.title, pathname: `/reading/${p.slug}/`, ogType: 'article',
    description: p.standfirst,
    jsonld: { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.standfirst, author: { '@type': 'Person', name: B.author }, publisher: { '@type': 'Organization', name: 'Firstlight Foundry' }, isPartOf: { '@type': 'Book', name: B.title } },
    body: `
<article class="ff-article">
  ${p.approved ? '' : '<p class="draft">Draft adaptation, awaiting the author’s review. This page is excluded from production builds until it is approved in launch.config.json.</p>'}
  <header class="ff-article__head">
    <p class="ff-eyebrow">${esc(p.eyebrow)}</p>
    <h1 class="ff-article__title">${esc(p.title)}</h1>
    <p class="ff-article__lead">${esc(p.standfirst)}</p>
    <p class="ff-article__byline ff-meta">${byline}</p>
  </header>
  ${p.image ? `<figure class="ff-figure${p.imagePortrait ? ' ff-figure--portrait' : ''}"><div class="ff-figure__frame"><img src="/${esc(p.image)}" alt="${esc(p.imageAlt || '')}" width="${p.imageWidth || 1600}" height="${p.imageHeight || 1067}" loading="lazy" decoding="async"></div>${p.imageCaption ? `<figcaption>${esc(p.imageCaption)}</figcaption>` : ''}</figure>` : ''}
  <div class="ff-article__body">
${bodyWithEnd}
  </div>
  <p class="source small">${esc(p.source)}</p>
  <nav class="next" aria-label="Keep reading">
    <p class="eyebrow">Keep reading</p>
    <p><a href="/reading/${next.slug}/">${esc(next.title)}</a> <span class="meta">· ${next.kind === 'excerpt' ? 'Excerpt' : 'Adapted'} · ${next.minutes} min</span></p>
    <div class="actions">${launched ? buyBlock(true) : `<a class="ff-btn ff-btn--secondary" href="/returning-to-craft/">About the book</a>`}</div>
  </nav>
</article>`,
  });
}

// About
pages['/about/'] = layout({
  title: 'About', pathname: '/about/',
  description: 'Firstlight Foundry is a small independent press. A person authors, directs and signs for every book; intelligent systems help develop, challenge and draft.',
  body: `
<section class="hero"><div class="wrap measure">
  <p class="eyebrow">About the house</p>
  <h1 class="h-section">A small studio shaping voices into form.</h1>
  <p class="lead">We work with one author at a time to bring ideas and experience into books. The author owns the voice. We hold the form.</p><p>Our work begins with what you want someone else to understand. We help develop the thinking, shape the manuscript and prepare a book that can carry it. Our first title is <cite>${esc(B.title)}</cite>.</p><div class="actions"><a class="ff-btn ff-btn--primary" href="#send-word">Start a conversation</a></div>
</div></section>

<section class="section section--cream"><div class="wrap measure">
  <p class="eyebrow">How a book is made here</p>
  <p>The best tools open new doorways into authorship. Every lasting book and story runs on patterns: how an argument builds, how a scene turns, how an idea earns its place. Those patterns were often easier to access for people with writing training, formal or self-taught, so much of what other people knew never reached a page.</p>
  <p>The best tools now hold those patterns too. That lets an author begin from what they know, a lifetime building a business, a way of seeing people, a story carried for years, and spend their effort where the truth of it lives, at the depth where a reader feels it. A writer’s mind is one way to think about life. There are many others, and they deserve books too.</p>
  <p>What matters is the artifact: a book that helps someone see the business in front of them, a story that moves someone and stays with them. Made well, tested hard, built to last.</p>
  <p>The roles are fixed. A person originates the idea, directs the work, decides what stays and signs for the result. Intelligent systems help develop the idea, argue with it from several sides and draft prose that the author redirects until it sounds like the author.</p>
  <p>Nothing ships until a person has read it and decided it deserves to exist in physical form. The copyright page of <cite>${esc(B.title)}</cite> carries a disclosure for its illustrations: “Illustrations created with AI image tools under the author’s direction.” That line covers the artwork only. The prose was developed in the way described above.</p>
  <p>The house line says it in six words: <em>Made in conversation. Made to last.</em></p>
</div></section>

<section class="section"><div class="wrap measure">
  <p class="eyebrow">What counts as a book</p>
  <p>A book is “a bounded vessel that allows one mind to receive the structured thinking of another mind, across distance and time, in solitude.” Every title the house publishes has to meet that test: bounded, persistent, readable by one person alone, pattern-carrying and solitude-enabling. A manuscript that does not meet it is not published, however good the prose.</p>
  <p class="small">From the house’s founding note, <cite>What Is a Book?</cite></p>
  <p class="small" id="image-note">The Chapter Four illustration is from the book. Illustrations were created with AI image tools under the author’s direction.</p>
</div></section>

<section class="section section--cream" id="send-word"><div class="wrap">
  <div class="measure">
    <p class="eyebrow">Send word</p>
    <h2 class="h-section">What are you working on?</h2>
    <p>Have an idea for a book, a manuscript in progress, or a question about working with Firstlight Foundry? Tell us a little about it and what you would like to explore together. If you are simply interested in what we are building, you are welcome here too. A person reads every note.</p>
  </div>
  <form name="send-word" method="POST" action="/thank-you/" data-netlify="true" netlify-honeypot="bot-field" style="display:grid; gap: var(--space-5); max-width: 560px; margin-top: var(--space-6)">
    <input type="hidden" name="form-name" value="send-word">
    <p class="hp" aria-hidden="true"><label>Leave this empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
    <div class="ff-field" style="max-width:none"><label class="ff-field__label" for="sw-message">Your message <span class="ff-field__req">(required)</span></label>
      <textarea class="ff-field__input" id="sw-message" name="message" rows="6" required></textarea></div>
    <div class="ff-field"><label class="ff-field__label" for="sw-name">Your name <span class="ff-field__req">(required)</span></label>
      <input class="ff-field__input" id="sw-name" name="name" type="text" autocomplete="name" required></div>
    <div class="ff-field"><label class="ff-field__label" for="sw-contact">How we can reach you <span class="ff-field__req">(required)</span></label>
      <input class="ff-field__input" id="sw-contact" name="contact" type="text" autocomplete="email" required aria-describedby="sw-contact-hint">
      <p class="ff-field__hint" id="sw-contact-hint">An email address, or whatever you prefer.</p></div>
    <div><button class="ff-btn ff-btn--primary" type="submit">Send</button></div>
  </form>
</div></section>`,
});

const simple = (t, pth, h, text) => layout({ title: t, pathname: pth, description: text, body: `
<section class="hero"><div class="wrap measure">
  <h1 class="h-section">${h}</h1><p class="lead">${text}</p>
  <div class="actions"><a class="ff-btn ff-btn--secondary" href="/reading/">Go to the Reading Room</a><a class="ff-btn ff-btn--quiet" href="/">Home</a></div>
</div></section>` });
pages['/thank-you/'] = simple('Thank you', '/thank-you/', 'Your note has arrived.', 'A person reads every message that comes in. Thank you for writing.');
pages['/noted/'] = simple('Noted', '/noted/', 'Noted.', `We will write once, when ${B.title} is on Amazon.`);
pages['/404.html'] = simple('Not found', '/404.html', 'This page is not here.', 'It may have moved when the site was rebuilt.');

// ------------------------------------------------------------------ write
fs.rmSync(DIST, { recursive: true, force: true });
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (p.startsWith(path.join(SRC, 'content'))) continue;
    e.isDirectory() ? walk(p) : copy(p, path.join(DIST, path.relative(SRC, p)));
  }
})(SRC);
for (const [route, html] of Object.entries(pages)) {
  const out = route.endsWith('.html') ? path.join(DIST, route) : path.join(DIST, route, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
}
const redirects = ['/thank-you.html  /thank-you/  301'];
if (launched) for (const f of liveFormats) redirects.push(`/go/amazon-${slugOf(f)}/  ${f.amazonUrl}  302`);
fs.writeFileSync(path.join(DIST, '_redirects'), redirects.join('\n') + '\n');
fs.writeFileSync(path.join(DIST, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
  X-Frame-Options: DENY
/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable
`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), PROD ? `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');
const urls = Object.keys(pages).filter(r => !r.endsWith('.html') && !['/thank-you/', '/noted/'].includes(r));
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${SITE}${u}</loc></url>`).join('\n')}\n</urlset>\n`);

// ------------------------------------------------------------------ internal link check
const bad = [];
for (const [route, html] of Object.entries(pages)) {
  for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)(#[^"]*)?"/g)) {
    const u = m[1];
    if (u.startsWith('/go/')) { if (!launched) bad.push(`${route} -> ${u} (buy link in prelaunch)`); continue; }
    const f = u.endsWith('/') ? path.join(DIST, u, 'index.html') : path.join(DIST, u);
    if (!fs.existsSync(f)) bad.push(`${route} -> ${u}`);
    if (m[2] && m[2].length > 1) {
      const target = u.endsWith('/') ? pages[u] : null;
      if (target && !target.includes(`id="${m[2].slice(1)}"`)) bad.push(`${route} -> ${u}${m[2]} (missing anchor)`);
    }
  }
}
if (bad.length) { console.error('BROKEN INTERNAL LINKS\n  - ' + bad.join('\n  - ')); process.exit(1); }

console.log(`built ${Object.keys(pages).length} pages · context=${CONTEXT} · state=${cfg.state}${launched ? ' (buy links live)' : ''} · reading=${pieces.map(p => p.slug + (p.approved ? '' : '*')).join(', ')}`);
for (const w of warnings) console.log('WARN ' + w);
