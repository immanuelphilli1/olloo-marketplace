---
name: admin-auth-ziggy-reload
description: Fix or avoid "Ziggy error: route 'admin.*' is not in the route list" after staff login/logout. Use when editing AdminAuthController, admin auth redirects, or Ziggy sharing in HandleInertiaRequests.
---

## Goal
Staff routes resolve in `route('admin.*')` right after crossing the auth boundary.

## Steps
1. Login and logout controllers return `Inertia::location(route(...))` (see `app/Http/Controllers/Admin/Auth/AdminAuthController.php`), forcing a full navigation so the blade rebuilds `window.Ziggy` for the new session.
2. No regression test exists yet. Verify by logging in as `admin@handco.test` and opening any admin page whose sidebar calls `route('admin.*')`; the console must show no Ziggy error.

## Gotchas
- A plain `redirect()` after an Inertia POST is followed as an XHR visit, so `window.Ziggy` keeps the guest map.
- Non-Inertia test posts still get a normal redirect from `Inertia::location()`, so `assertRedirect` works.

## What didn't work
- Re-syncing `globalThis.Ziggy` from Inertia props on every render: heavier than one full reload at the auth boundary.
