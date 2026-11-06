# Complete private-testing APK — v1.5

The user explicitly requested provider keys inside the APK on 2026-09-18. Direct Gemini/Groq transport is restored; no Supabase Vault secret transfer or Edge Function deployment was performed. This supersedes the v1.4 AI-unavailable testing configuration, not the public-production security gate.

## Included

- All v1.4 account/profile/history isolation and stale-response guards retained.
- AI interviews, generated questions, answer evaluation, conversational practice, resume analysis/enhancement and existing report/export/UI features retained.
- Direct AI transport rotates configured provider keys on authentication/quota/server errors, avoids showing upstream error bodies, and uses bounded native Capacitor HTTP on Android.
- Scanned-PDF resume analysis can use Gemini vision; NVIDIA remains an optional fallback and has no configured key.
- Existing package/debug signing identity retained. Version 1.5/versionCode 6 installs over the existing testing app.

## Security and verification limits

Provider keys are extractable from this APK. Do not distribute publicly; use restricted keys and rotate them before a public release. The previous protected-backend approach remains preferable for public distribution. Supabase privileged keys are not added to the APK.

Live validation uses synthetic/fictional fixtures, not user resumes. Automated checks and successful upstream requests do not prove all Android device flows are bug-free. Native Google login/account switching, permissions, voice capture, scanned PDF uploads and exports still need real-phone verification.

## Final verification — 2026-09-18

- Lint, TypeScript/frontend build, all 37 automated checks, Android debug packaging and Android unit-test task passed.
- Live configured Gemini and Groq requests passed. Actual service flows passed: interview question generation, answer evaluation, conversational interview, resume rating and resume enhancement. Fixtures were fictional; PDF parsing/native UI were not exercised by these live service checks.
- All 12 packaged frontend assets exactly match the final tested source build.
- Package `com.jobtic.interviewer`, version 1.5/versionCode 6, unchanged debug signing SHA-1 `38:6A:3F:3F:95:9D:CE:8C:C6:A0:B5:5E:8C:11:79:3B:46:4D:B2:7C`.
- Artifact: `Jobtic-Full-App-v1.5.apk`.
- SHA-256: `81dec8a8b09dc9c24ef07c534b03625c2d3b924dc72ad25d460c132ace8a48e3`.

Install over the existing app; do not uninstall. Test Google X→logout→Y, interview completion/history, resume upload/enhancement/export and voice permissions on the phone before distribution.
