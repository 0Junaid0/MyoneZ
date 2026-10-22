# MyOneZ – UI update

Design reference: "PRM Mobile App UI v2" (M01–M18).

## Removed (not in the design / duplicated)
- Home: "Draft a message" and "Add person" buttons, and the "Recently added" list.
  Add contact stays on the Contacts tab; drafting starts from a contact's "Message" button.
- The second AI draft form (`components/ComposeSheet.tsx`).
- Review draft: the extra "Save changes / Preview / Delete" row. Edits still auto-save.
  Copy and Delete are now in the ⋯ menu (top right), as in the design.
- The "Send by …" preview sheet (`components/SendSheet.tsx`) that showed the message a second time.

## Messenger
- "Send via Messenger" now copies the message and opens the chat straight away (no extra sheet).
- Accepts a username, an m.me / messenger.com / facebook.com link, or a
  `facebook.com/profile.php?id=…` link. A number id opens the Messenger app directly.
- Waits for any open sheet to close before opening (iOS ignored the link while a sheet was closing),
  then falls back to messenger.com if m.me cannot open.
- Same parsing on the backend (`apps/integrations/handoff.py`).

## Design match
- All text uses Plus Jakarta Sans (was the system font on many screens).
- Header bar: 60px, 44px back button, centered 18px title. Large titles 28px extra bold.
- Tab bar: the design's line icons, 11px labels.
- Home: date above the greeting, navy card with "N drafts are waiting", overdue line,
  light-blue health ring and white "Review drafts" button.
- Review draft: Regenerate next to the "Message" label, design label sizes.
- Write my own (kept): "Write to <name>" title, person row, colored idea chips,
  "Write it for me instead" link.

## Name and logo
- App name "MyOneZ" everywhere (app.json name/slug/scheme, texts). Saved login keys are unchanged.
- New logo: a "Z" joining two people, on a blue tile (`components/Logo.tsx`), used on Log in.
- New app icon, Android adaptive icon, splash and favicon in `Frontend/assets`.

## Not changed
- Verification code (OTP) screens and flow.
