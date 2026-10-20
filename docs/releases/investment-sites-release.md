# Investment sites release

This release integrates source metadata and original images for the 32 desk-confirmed investment sites. The 19 provisional, conflicting, or unmatched source sites remain excluded. Every published site uses its unique existing GeoJSON zone ID.

The separate `public/data/investment_site_enrichment.json` record preserves source areas, source labels, image types, filenames, and provenance. Source area is displayed separately from the GeoJSON area. All 128 original image files required by these records are included under `public/images/investment-sites/`.

The gallery includes a main image, up to four original thumbnails, type labels, gold selection borders, lazy loading, navigation, and enlargement. Existing, completed visual changes use cover for photographs and contain for reference images, retain a 300px desktop main image, sort by image type, and allow original-size and scrollable zoom inspection. This publication introduces no additional gallery development.

The individual-card adapter shows the actual displayed count of one while preserving the independent total of 141 zones. V8 printing, A4 styling, GIS geometry, original image bytes, government identity assets, and readiness counts of 103/35/3 are unchanged.

## Release verification

- Production build passed using `npm.cmd run build`.
- Verified 141 unique zone IDs, exactly 32 confirmed metadata records, 128 original image hashes and paths, and exclusion of the remaining 19 source sites.
- Verified source hashes and protected GIS, printing, and identity files. The individual-card adapter is the authorized exception to the earlier protected-file baseline.
- Browser checks passed for zones 26, 57, and 48 at widths 390, 768, and 1440: thumbnails, selection, image type and order, source metadata, switching sites, enlargement, native dimensions, scrollable zoom, and no horizontal page overflow.
- Individual cards for zones 26, 57, and 48 displayed only the requested card with displayed count one and total 141. Print-handler invocation was checked; this does not certify a physical printout.
- Checked release files for local Windows/file URLs and obvious credential material. Image URLs are relative to the deployed application base.

Only runtime source files, the metadata record, the 128 original images, and this release note are included. Browser profiles, local scripts and test captures, source inventories containing machine-local paths, temporary files, and unused analysis exports remain outside this release.

GitHub Actions and the deployed Pages site are verified separately after pushing; their eventual status is not asserted by this pre-publication note.
