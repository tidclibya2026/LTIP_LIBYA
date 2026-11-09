# Map background configuration

`public/map-providers.json` selects the background for the platform map, government portfolio and workspace geometry preview. The default is a local vector background with no external requests. National context comes from `public/data/libya-context.geojson`; site polygons and public layers remain separate overlays.

Natural Earth is public domain: https://www.naturalearthdata.com/about/terms-of-use/ . The Libya context preserves the coordinates of the previously sourced Natural Earth 1:110m feature. Only cartographic name/source/scale properties are projected into this new asset. No site attributes or investment selection are present. This generalized national context is not a surveyed or official legal boundary and is not appropriate for cadastral decisions.

Raster providers require both `enabled: true` and `policy_reviewed: true`, plus URL, attribution, maximum zoom and a reviewed licence/usage policy. The OSM entry remains disabled. Its official policy is https://operations.osmfoundation.org/policies/tiles/ . Production activation requires owner review of capacity, attribution, contact, valid browser Referer and HTTP caching; this software does not certify compliance or lift a network block. Use the documented standard hostname, never rotate hosts or spoof identity to evade a block. No tile prefetch or offline tile download is provided.

For another provider, obtain its licence and any subscription first. Browser keys are public and must be restricted by the provider; secret credentials cannot be placed in this file, JavaScript, Git or static output. A self-hosted licensed tile service is another option. No alternative subscription, key or availability is assumed here.

The shared Leaflet adapter uses browser HTTP caching, idle viewport updates and no retry loop. It validates HTTP success before decoding a raster, aborts outstanding requests after the first failure or an eight-second deadline and switches to local context. Existing GIS layers and map instances remain intact. Failed providers are disabled for that map instance. Choose local explicitly at any time. External availability and provider-side block removal remain separate from this fallback.

The local preview server supplies the app, vectors and public media without Internet access. This is not a service-worker installation: a completely new browser cannot open a remote GitHub Pages site without first obtaining its assets. Referrer policy on the private preview is `strict-origin-when-cross-origin`.
