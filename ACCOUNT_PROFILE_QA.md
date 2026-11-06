# Account/profile fix — v1.4 (versionCode 5)

The phone-tested v1.3 history isolation is retained. v1.4 fixes profile resolution and guards account/profile and history-request races.

## Changes

- Header, home greeting, avatar and settings all resolve names from one current-account profile function. Stored preferences and guest names cannot supply a logged-in user's display name.
- Google sign-in uses the current user's matching Google identity name, not a stale app `full_name`. Missing Google identity names fall back to the current email's local part. Two Google profiles can legitimately have the same real name; current email is shown in the header and home page to make identity unambiguous.
- Explicitly saved custom names carry their owning user ID (display-only metadata, never authorization). A custom name belonging to another ID is ignored.
- Auth fetches fresh user/identity data after sign-in and on startup. Requests run outside the auth callback to avoid SDK lock deadlocks.
- Old profile refreshes, USER_UPDATED/TOKEN_REFRESHED events for another user, and late profile-save responses cannot replace the active account. Older same-account refreshes cannot undo a more recent saved name.
- Auth actions are serialized so delayed profile-save/native-logout operations cannot overlap a new sign-in and clear or replace that session.
- Cloud history operations capture their original owner's authenticated token. An account mismatch pauses synchronization instead of falsely acknowledging a deletion under another account's session.
- Version 1.4/versionCode 5; package and debug signing identity unchanged so this can update the existing test APK without uninstalling.

## Verification

- React integration tests simulate X→Y, delayed X refresh/event, fresh Google Y identity, stale same-user refresh after name edit, overlapping logout, cross-account profile-save response, logout→guest.
- Pure profile tests cover missing names, wrong-owner Google identities, wrong-owner custom names, and guests.
- Existing history/outbox, score, PDF, monochrome and animation checks retained. Final build/lint/test/Android packaging results are recorded after verification below.
- Final source build and lint pass (0 warnings); all 34 test-runner checks pass, including frozen history-token and signed-out rejection checks. npm audit reports 0 known vulnerabilities on 2026-09-18.
- Android debug packaging and unit-test task succeeded. All 12 packaged assets exactly match the final tested frontend build. Version 1.4/versionCode 5, package `com.jobtic.interviewer`, minimum Android API 23, target API 35.
- Verified unchanged debug signing SHA-1: `38:6A:3F:3F:95:9D:CE:8C:C6:A0:B5:5E:8C:11:79:3B:46:4D:B2:7C`.
- Delivery: `Jobtic-Account-Fixes-v1.4.apk`. SHA-256: `003f21501ca6e359bc48ab735f8787d78e850ac3f878835c510927a899df6020`.

## Scope and remaining release blockers

This is an account-fix testing build, not a bug-free production guarantee. AI interviews/resume features remain unavailable because the protected AI endpoint has not been deployed. No API credentials were copied into Supabase Vault; the user's refusal remains in force. Production AI configuration requires a separately authorized approach, plus signing/OAuth certificate verification and actual Android end-to-end testing. See PRODUCTION_READINESS.md for the broader release gate.

Install over the existing app (do not uninstall), then test X→logout→Google Y→logout→X, reopening the app, and editing each account's display name. Check the visible email as well as the name, especially if both Google accounts use the same real name.
