# StoneBridge search and seller-page review — October 15, 2026

## Outcome

Revised the existing website while preserving the established palette, typography, URL paths, four-step seller forms, Google Places integration, and backend/admin code. This is an evidence-based content revision, not a guarantee of first position.

## Evidence reviewed

- Search Console export dated October 15, covering October 7–13: 14 clicks, 2,168 impressions. October 12 contributes 1,891 impressions with no clicks. The owner reports that spike occurred within one hour while Semrush Site Audit and Position Tracking were running. Correlation does not establish the cause. Excluding the entire day leaves 277 impressions and 14 clicks; that is a sensitivity comparison, not a corrected official total.
- Current public GitHub source and live Macomb page.
- Trinity's Macomb County page, homepage, contact details and testimonials; Cash Buyers Macomb's county page; broader Macomb seller search results. These do not establish a universal search order because results differ by location, device and time.
- Semrush Backlink Analytics, accessed October 15: StoneBridge 33 backlinks / 21 referring domains; Trinity 2,651 backlinks / 1,826 referring domains. Counts are third-party estimates, not Google's ranking metrics. The highest-scoring sample includes many unrelated-looking sources in both profiles. Trinity also has reported links from BBB and Guide to Michigan. Individual linking pages were not independently verified; these are research leads, not recommended purchases or confirmed causes of ranking differences.

## Implemented

- More direct offer CTAs across public seller content; existing destinations retained.
- Revised titles, descriptions and social metadata on the homepage, seller hub, Macomb and Oakland pages. Main seller hub now explicitly targets Metro Detroit.
- County page headings state the fast-sale intent; introductions describe direct as-is purchases in plain language.
- Replaced repetitive county city cards with distinct seller considerations and relevant existing resource links. No new thin city pages were generated.
- Added the inquiry/offer/closing sequence, candid direct-sale versus listing comparison, cost questions and buyer-verification guidance on core seller pages.
- Added county FAQs covering offer evaluation, net proceeds and direct buying; synchronized FAQ structured data to visible answers. FAQ markup does not guarantee a rich result.
- Reconciled WebPage titles/descriptions and breadcrumb names; added missing WebSite definitions to existing graphs where applicable.
- Removed fabricated rotating accepted-offer notifications from the homepage and seller hub. No invented testimonials, transaction counts or case studies were added.
- Added generate_lead after successful property/contact API responses; added phone_click and email_click events. No names, email addresses, phone numbers or property addresses are included in these custom event payloads. Phone/email clicks are intent events, not confirmed leads.
- Added FAQ expanded-state accessibility synchronization and responsive styles for the comparison sections.
- Updated sitemap last-modified dates for revised public HTML pages.

## Validation

All 32 HTML files parsed; public pages have one H1 and no duplicate IDs. Checked syntax for 96 inline JavaScript blocks plus external scripts; parsed JSON-LD; checked internal page and fragment links. No errors or broken internal links found. Confirmed admin.html, worker.js and wrangler.jsonc unchanged. Git whitespace checks passed.

No browser-rendered QA or Lighthouse measurement was available in this environment. No real lead was submitted, avoiding unintended emails and CRM records. Form backend delivery and the new GA events still require observation after deployment. Check GA4 DebugView/Realtime and mark the intended lead event as a key event; do not count a phone click as a completed call. Existing analytics integrations may collect additional data under their own settings.

## Remaining work requiring real business evidence or account access

1. Add genuine project photos and completed-project descriptions after confirming ownership, permissions and accurate details. Existing portfolio images use Unsplash and were not verified as actual StoneBridge properties; verify displayed names, availability and listing destinations before treating them as proof of work. The existing portfolio was retained rather than inventing replacements.
2. Add authentic seller reviews and identified team information with permission. Do not create fake ratings or imply accreditation.
3. Verify the Google Business Profile's identity, category, service area, contact details and genuine reviews. Maps ranking is separate from the organic county-page ranking. No account changes were made.
4. Pursue relevant editorial/local business links and consistent legitimate citations. Do not buy bulk SEO links or copy suspicious competitor links. Investigate acquisition history and Search Console manual actions before considering disavowal; unrelated links alone are not proof of a penalty.
5. Monitor target local queries, page clicks and actual qualified leads over multiple weeks. Preserve the October 12 anomaly in the underlying data and annotate it instead of asserting bots as fact.
6. Review smaller existing city guides for real local substance before expanding the URL count. No further city pages should be added merely to repeat keywords.

## Sources

- https://www.trinitybuysmichigan.com/macomb-county-mi/
- https://www.trinitybuysmichigan.com/contact-us/
- https://www.trinitybuysmichigan.com/testimonials/
- https://www.cashbuyersmacomb.com/sell-my-house-fast-macomb-county-michigan/
- https://www.semrush.com/analytics/backlinks/overview/?q=stonebridgedg.com&searchType=root_domain
- https://www.semrush.com/analytics/backlinks/overview/?q=trinitybuysmichigan.com&searchType=root_domain
- https://developers.google.com/search/docs/appearance/title-link
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- https://developers.google.com/search/docs/crawling-indexing/links-crawlable
- https://developers.google.com/search/docs/essentials/spam-policies
- https://support.google.com/business/answer/7091
- https://support.google.com/google-ads/answer/3097241

Paid ads do not purchase organic ranking. Good design can support credibility and conversion, but it is not a substitute for relevant information, real business evidence and competitive authority.
