# Partial lead capture

All 15 legacy seller pages, `/sell/`, and both contact-page inquiries save unfinished entries to the existing D1 leads dashboard. The first address input starts saving immediately; later keystrokes are grouped over 300 ms. Selecting a suggested address or changing a field saves immediately. General and property inquiries start saving when any inquiry field is entered.

Records start with `Incomplete` status and `not_sent` email status. Finishing the form promotes the same lead to `New` through the existing validated submission handler and sends the existing notifications. Autosaving never sends email or treats partial capture as a marketing conversion. The consent field reflects only the actual checkbox. Each form includes a short explanation that entries are saved before submission.

The browser stores only the random draft ID and revision in session storage. Form values go directly to D1. Failed saves retry, and visibility/page exit triggers a best-effort flush. A browser crash or lost connection can still prevent an unconfirmed update from reaching the server.

## Rollout

1. Deploy `worker.js` to the existing `stonebridge` Cloudflare Worker, with the existing `DB` binding and email secret preserved. For a configured Cloudflare account, run `npx wrangler deploy` from the repository root.
2. Publish the website changes through the repository's normal GitHub Pages process.
3. Enter an address on a seller page and verify it appears under **Incomplete** in the dashboard without clicking Continue. Add fields, then complete the form and verify one **New** lead remains. Repeat for each contact-page form.

The Worker creates its private `form_drafts` table automatically on the first partial save. The existing `leads` table is reused. Deleting a lead also deletes its saved draft snapshot. Internal admin forms and authentication fields are excluded from capture.

## Verification

With Node 24, run `node --test tests/form-autosave.test.mjs` for SQLite-backed endpoint behavior and public-page coverage. Tests cover stale updates, validation, origin restrictions, missing storage, final submission deduplication, and protection against late exit saves.

The optional browser test exercises every public form. Install Playwright and its Chromium browser, then run `RUN_BROWSER_TESTS=1 node --test tests/form-autosave.test.mjs`. Chromium was unavailable in the implementation environment, so that check has not been completed there.
