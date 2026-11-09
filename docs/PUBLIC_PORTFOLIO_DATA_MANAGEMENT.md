# Public portfolio aggregate publication

The public home page and `#/portfolio` show approved aggregate counts. `#/government` remains a compatible route: the public build shows the same public portfolio; the private government build uses its separately managed local selection. Even in the government build, `#/portfolio` is a public view and does not request the private API.

`public/data/portfolio-summary.json` is an independent public record. Its only fields are `schema_version`, `total_sites`, `targeted_sites`, `other_sites`, `updated_at` (ISO calendar date), and `publication_status` (`APPROVED_AGGREGATES_ONLY`). This status approves publication of aggregate counts only; it does not approve sites, readiness, procurement or contracting.

The national GIS supplies unique site identifiers for the total. The targeted count is an independently approved scalar. The other count is derived as total minus targeted. The UI rejects missing, unapproved, malformed or inconsistent summaries, extra fields and invalid GIS identities; it displays an unavailable state rather than fallback counts. CI validates the same schema against national GIS before emitting the allowlisted asset.

## Explicit update procedure

1. Obtain approval for the new aggregate count and update date. Keep the approval record in the organization's private records. Do not export membership or copy the selection store.
2. From the application directory, preview the approved scalar-only update:

   ```text
   node scripts/approve-portfolio-summary.mjs --targeted 55 --updated-at 2026-11-08 --approve-aggregates-only --dry-run
   ```

3. After confirming the separately approved count, run the same command without `--dry-run`. The script reads only public national GIS and explicit scalar arguments, derives the complement, validates the schema and writes only the aggregate JSON file. It accepts no private file, source selection or session argument. The flag is an explicit operator confirmation; it is not an institutional approval system.
4. Review the JSON diff and confirm there are no additional fields. Run `npm run test:portfolio`, `npm run build`, preservation/release/park checks and the public browser checks. Approve the exact source and artifact hashes through the normal release process.
5. Upload or publication requires the owner's separate final authorization and the existing manual main-branch release gate. No build, private edit, API request or management save performs this update automatically.

Changing a private selection from55 to56 updates the private indicators to141/56/85. The existing public JSON remains141/55/86 until a new aggregate has been separately approved and explicitly updated. This remains true even if membership changes while its count stays55. No membership classification, filter, table column or map styling is enabled in the public view by the published counts.

The public summary can be retrieved from `/LTIP_LIBYA/data/portfolio-summary.json`; it must contain no site identifiers, names, coordinates, membership arrays, assessments, review records or credentials. Private services and records remain outside this repository. The public home, portfolio, map and card routes must not fetch the private API.
