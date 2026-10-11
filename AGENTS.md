<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Data is local-first: all leads, lists, history and settings live in one localStorage-backed store (`src/lib/store.ts`, useSyncExternalStore) — no backend is required for core features.
- Business discovery runs in the browser against OpenStreetMap (Nominatim geocoding throttled to 1 req/s, Overpass for listings) — free public services, no paid APIs.
- Website audits run only in a server function (`src/lib/audit.functions.ts`) with SSRF guards (DoH resolution + private-IP blocking, manual re-validated redirects, timeout, size cap) — never fetch arbitrary URLs from elsewhere.
- Opportunity scoring is deterministic and evidence-based (`src/lib/scoring.ts`); points are only awarded with supporting data.
- The shared app frame (sidebar, local-mode banner, lead drawer) lives in `src/components/app-shell.tsx`, mounted from `__root.tsx`.
