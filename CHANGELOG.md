# PageOne Changelog

## [Unreleased]

### Fixed
- Tab key getting stuck on transition blocks (e.g. "CUT TO:") instead of continuing block cycling
- Opening scripts could render a blank editor after height-based pagination measurement failed during initial load
- Enforced user-scoped script loading, dashboard actions, and local cache access so accounts cannot see or modify another user’s scripts.

### Improved
- Added Playwright coverage for editor pagination, existing-script rendering, and writing stability
- PDF export now follows editor visual pagination more closely.
- Fountain export formatting is cleaner for screenplay block flow.
