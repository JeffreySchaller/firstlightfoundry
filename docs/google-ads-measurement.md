# Google Ads outbound measurement

Installed October 19, 2026 for account 181-860-9897, existing action 7828312776 (Outbound click). Tag AW-18500379482; event label Ir1KCMil6pQdENrG1fVE. Identifiers were copied from the live account's manual installation and click-event instructions.

Only the three book edition links emit the event. It measures intent, not an Amazon purchase; value is zero. Google action settings use no monetary value and count one conversion per ad interaction. Maximize Clicks bidding remains unchanged.

The Google library loads only after opt-in, on the production hostname. Paid Google visitors see a compact choice; all visitors can open preferences in the footer. Global Privacy Control prevents loading. Rejecting does not stop navigation. Consent choice alone is stored locally. Personalization and analytics storage remain denied; enhanced conversions and Google Analytics are not installed. A same-tab click has a 900ms navigation fallback if tagging is blocked. Other-window and modifier clicks retain native behavior.

Existing Amazon Attribution links remain campaign-specific. Google click identifiers are carried with the campaign through internal reading links; arbitrary query parameters are not forwarded or sent as the configured page URL.

Validated production build/internal link checks, JavaScript syntax, and a jsdom behavioral harness covering no request before consent, reject, accept, GPC, organic links, attribution, unrelated links, duplicate clicks, zero value and navigation fallback. Browser/Google verification is separately recorded in the task report. Local and deploy-preview hosts deliberately cannot send live conversion events.

References: https://support.google.com/google-ads/answer/6331304 and https://developers.google.com/tag-platform/security/guides/consent
