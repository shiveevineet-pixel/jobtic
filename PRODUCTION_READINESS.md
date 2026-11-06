# Account isolation repair — release gate

Status: NOT approved for public production release.

2026-09-18 update: the user explicitly requested provider keys in the APK for now. v1.5 restores direct Gemini/Groq AI without Vault or Edge Function deployment and retains account fixes; see FULL_APP_TEST_QA.md for current verification. The AI-unavailable descriptions below document the earlier protected-backend v1.3/v1.4 configuration, not v1.5. Embedded provider keys make v1.5 private-testing only, not suitable for public production distribution. No privileged Supabase keys were embedded.

## Implemented

- Real Supabase authentication remains the source of identity. Successful password login requires a real session. Existing registrations live under Authentication → Users, not public application tables.
- Every authenticated user uses an immutable user-ID storage namespace. Guests and signed-out state use different namespaces. Account changes remount the complete workspace, discarding previous drafts, reports, timers, settings and late interview responses.
- Existing unowned legacy history/settings are preserved unchanged and are never automatically assigned to the next signed-in user. Recovering these requires an explicit owner decision.
- `public.interview_sessions` stores cloud interview reports with a foreign key to Auth users. SELECT/INSERT/UPDATE/DELETE policies enforce ownership. Account reassignment is prohibited. Local durable outboxes retain offline saves/deletions and clear operations until sync succeeds.
- History sync restores cloud data on sign-in, retries on network recovery and exposes failures/retry in the interface. Account-specific synchronization is serialized across provider instances. Failed logout does not pretend the provider session was cleared.
- Client AI code now uses `jobtic-ai`, with no provider key environment references in the bundle. The proposed endpoint verifies the user with Supabase Auth, restricts origins/providers/models, bounds request/output size, enforces atomic 30/minute and 150/day limits, and does not return upstream errors containing personal data or credentials.
- Android backup and cleartext traffic are disabled. Version 1.3, versionCode 4. The package identity and existing debug signing identity are retained.
- Security dependency upgrades: jsPDF 4.2.1, Vite 6.4.3, esbuild 0.28.2, Capacitor CLI 8.4.3. Supabase JS is pinned to 2.78.0 with a lockfile.

## Verified

- Cloud database transaction tested SELECT isolation for two existing users, own-account UPDATE, blocked cross-account INSERT/DELETE and blocked owner reassignment. All security fixtures were rolled back; no real history was overwritten.
- Anonymous and authenticated users cannot execute the server-only credential RPC.
- Repository regressions cover separate users/guests, fresh-device cloud restore, durable offline saves, deletion without resurrection, clear followed by new work, immutable ownership of in-flight saves, concurrent same-owner clear serialization, and untouched legacy data.
- Existing score/PDF/monochrome/blink regressions retained.
- npm audit after dependency upgrades: 0 known vulnerabilities (2026-09-17). This is not a guarantee against all security problems.
- Frontend build, lint and 21 test-runner checks passed. Eight local provider credentials were checked against generated client JavaScript; none were present.
- Debug APK v1.3/versionCode 4 built and signature-verified with the unchanged debug SHA-1 `38:6A:3F:3F:95:9D:CE:8C:C6:A0:B5:5E:8C:11:79:3B:46:4D:B2:7C`. The APK's main frontend asset exactly matches the generated source build. `Jobtic-Account-Isolation-TEST-v1.3.apk` is a validation artifact, NOT a production release; AI deployment is still blocked.
- Supabase performance advisor: no findings. Security advisor reports only an intentional private-table deny-by-default RLS INFO and the password-protection setting below.

## Blocking release

1. **Explicit approval for server AI deployment and credential transfer.** Automated approval refused copying existing Gemini/Groq keys from the local environment to the connected project's encrypted Vault and refused deployment of a persistent server endpoint forwarding interview/resume content to those providers. Do not bypass these refusals. The SQL infrastructure is applied, but Vault keys were NOT transferred and `jobtic-ai` was NOT deployed. Therefore AI features in the new build are not operational until this approval and deployment complete. There is deliberately no insecure client-key fallback.
2. **Rotate previously exposed provider keys.** Earlier APKs contained provider keys. Moving them server-side does not revoke copies already distributed. New keys should replace the old ones before public release. The proposed Vault names are `jobtic_gemini_keys` and `jobtic_groq_keys`, each containing a JSON array of keys. Server-only `jobtic_provider_keys` reads them; no secrets are committed in SQL or function source.
3. **Production signing identity / Google OAuth.** Only a debug keystore exists. A real release signing/upload key must be chosen, kept safely and configured. Its SHA-1 (and Play App Signing SHA-1 if distributing through Play) needs an Android OAuth client matching `com.jobtic.interviewer`. Do not assume the debug Google client covers a release build. Unsigned release output is not installable or publish-ready.
4. **Real-device end-to-end verification.** Native Google account selection, email registration/confirmation, logout/relaunch, X→Y→X isolation, cloud restoration on another device, failed/offline sync and deletion need tests with authorized test accounts on Android. Database/repository tests do not substitute for these tests.
5. **Supabase Auth security and public distribution requirements.** Leaked-password protection is disabled according to the advisor. Enable it if the account plan supports it; configure password policy, production email delivery, redirect allowlists and signup abuse protection. Review user-facing AI data-processing consent/privacy policy and account-deletion requirements before store distribution. No paid-plan change, CAPTCHA credential provisioning or legal-policy claims have been made automatically.

Release resource note: the first unsigned release attempt failed with missing AppCompat animation resources. Re-running `:app:mergeReleaseResources :app:processReleaseResources --rerun-tasks` regenerated fresh outputs and successfully linked the release resources. No library resource stubs or source workarounds were added. Full unsigned release packaging still requires successful completion; signing and real-device gates remain independent.

Relevant checks: [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Applied remote migrations

- `account_storage_and_private_ai`
- `require_session_payload_identity`

`supabase/account-storage.sql` documents the resulting schema; it must not be blindly re-applied to the already updated project.
