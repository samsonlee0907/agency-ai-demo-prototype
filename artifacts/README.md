# Demo artifacts

The runtime artifacts are committed under `public/assets/` so a clean clone can run every mock scenario without external storage:

- six fictional MAI-generated property images in `public/assets/properties/`;
- one deterministic 25-page fictional lease PDF in `public/assets/documents/`.

`demo-assets.json` records each file's byte length, SHA-256 digest, source, and generator. Verify the checked-in files with:

```powershell
npm run verify:assets
```

Regenerate the deterministic lease PDF with `npm run generate:lease-pdf`. Property-image regeneration requires a configured MAI-Image-2.5 deployment and can produce different pixels, so review new images and deliberately update the manifest before committing them.

Deployment ZIP files are created locally under `artifacts/deploy/` and ignored. They are build outputs, not source artifacts.
