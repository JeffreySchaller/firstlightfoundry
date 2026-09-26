# Website V2 — September 25, 2026

This release publishes the reading-led prelaunch website. Amazon purchasing remains gated by launch.config.json. No public launch date is announced.

## Editorial direction

Introduce the reader to an experience before the framework. The home page no longer lists the six function names or promises an under-an-hour shortcut. The table of contents supplies context for each part. The website jacket panel has been removed; the physical jacket and manuscript have not been edited. The two approved excerpts retain their text. The deferred essay is not included.

## Visual direction

Uses Firstlight Foundry Design System v2 tokens, local Lora/Newsreader/Plex fonts, the actual FF mark, cream and ink, editorial rules and one ember primary action. No client-side scripts, animation, tracking libraries, or invented cover image.

Higgsfield studio image: job d38fbc42-9a5c-4e1d-ba9f-93a212419a7b, gpt_image_2_5. Imagined potter’s studio, commissioned for the home and book pages. WebP 1024 x 688; 91 KB. Public image note on About. A second reading-table image was rejected because generated page text looked unconvincing; it is not deployed. Chapter Four uses the existing book illustration.

## Verification

Production and deploy-preview builds pass internal asset/link checks (9 pages). Preview is noindex; production allows indexing. Launched state without a verified Amazon URL is rejected. Prelaunch contains no Amazon buy links or deferred essay. Excerpt source files are unchanged. Desktop and phone layouts reviewed in browser; mobile menu checked.

## Cutover

Verify a real Amazon product page; enter its canonical /dp/ URL and verification fields in launch.config.json. Set state to launched, build, review, and deploy. Do not publish a date or price without verification.

The launch-notice form promises one email when the book is available. The launch owner must export consenting submissions from Netlify and send that notice through the approved email workflow; website deployment itself sends no email.

## Rollback

Previous production Netlify deploy: 6aac1b10b3c24700080ba06f (main 1f469e0). Republish that deployment if needed. Git-linked production builds receive CONTEXT=production automatically; local production builds must set it explicitly.
