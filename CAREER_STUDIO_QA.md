# Jobtic Career Studio — verification notes

Updated: 17 September 2026.

## Delivered design

- Monochrome light (Ivory) and dark (Obsidian) themes, including companion, waveform, scores, surfaces, controls, and dialogs. The official Google brand icon retains its brand colors.
- Ceramic companion blinks on a repeating three-second cycle. Speaking animation does not replace blinking.
- Navigation uses a 220ms fade-and-rise transition, without remounting practice or resume drafts. Reduced-motion preferences bypass navigation motion and stop repeating decorative animations.
- Responsive sidebar on desktop/tablet and safe-area-aware bottom navigation on mobile. Phone simulation is restricted to an explicit development preview.
- Consistent practice setup, structured/chat rooms, feedback/history, resume workflow, welcome/account forms, settings, accessible confirmation dialogs, and recoverable errors.

## Checks completed

- `npm test`: nine checks passed (eight subtests and the parent test). Covers real-data progress, valid zero scores, partially completed interviews, settings/history preservation, complete paginated report PDFs, monochrome palette, and blink/reduced-motion stylesheet rules.
- Full ESLint, TypeScript, Vite production build, and Capacitor sync passed. Initial JavaScript is approximately 492 KB (142 KB gzip); the resume workspace and PDF engine load separately.
- Final Android `assembleDebug testDebugUnitTest` succeeded after synchronizing the final web assets. Existing app unit-test tasks are up-to-date; most plugin unit-test targets contain no tests. APK signature/package/version verified.
- Browser review at 390×844, 768×1024, and 1280×900 in both themes. Inspected visible layouts and confirmed document scroll width did not exceed client width.
- Companion animation inspected in the browser: `companion-blink`, duration `3s`. Captured both open and closed eyes during layout review.
- Navigation visibly animates and moving Home → Resumes → Home → Resumes retains the resume draft.
- Isolated `localhost` welcome/account forms and guest entry verified. New guests see an honest empty history, not fabricated scores. Existing guest preferences/history on `127.0.0.1` preserved.
- Structured three-question practice generated real questions; typed answer and early finish produced feedback for the evaluated answer only. Real session stored in history: 85/100.
- Custom-role chat practice generated welcome and follow-up messages, evaluated the conversation, and saved real feedback in history: 65/100. Feedback reopened in the final monochrome mobile theme.
- Interview PDF export returned a success status; automated long-report test verifies pagination and inclusion of the final response text.
- Resume TXT upload/extraction, pasted-text analysis, real AI improvement, and improved resume → practice context attachment verified. Analysis remains available alongside the original; improved version remains reviewable.
- Fresh uploaded TXT → real analysis (68/100) → improvement → browser PDF export completed and displayed `Resume downloaded: Alex_Example_Resume.pdf`. The automation backend did not emit a download event, so the final downloaded file location was not independently verified.
- Settings appearance toggles and dialog focus restoration checked. Escape cancels a nested history-clearing confirmation while leaving Settings open; existing sessions remain untouched.

## Device and release limitations

- No Android phone was connected. Native Google account selection, Supabase token exchange on a device, microphone permissions/transcription, native text-to-speech, Android document saving/sharing, and keyboard-open behaviour are not end-to-end device verified.
- Existing native Google sign-in and document plugins remain registered. No Supabase provider settings or database policies were changed by the redesign.
- Email/password submission and new account creation were not tested with live credentials. Guest entry and authentication UI were tested.
- PDF/DOC/DOCX extraction was not exhaustively tested; TXT upload and pasted text were tested. Print dialogs, clipboard/share permissions, and all third-party AI fallbacks were not exhaustively exercised.
- Browser resume export initially failed when the development server stopped. The original/improved content remained visible on that failure. Restarting the development server refreshes the page and discards unsaved component state; this is distinct from switching destinations inside the app. Native APK export uses the existing native document plugin, not that development module URL.
- Native-generated files are now excluded from Vite watching, so APK synchronization/build HTML no longer requests a live studio reload.
- AI output can include unsupported claims despite the existing factual-integrity prompt. The interface explicitly asks users to verify names, dates, and claims before using an improved resume; AI coaching scores are not hiring or ATS guarantees.
- Dependency audit reports 13 findings: 3 moderate, 8 high, 2 critical. No broad dependency upgrades were applied during the UI redesign.
- Existing AI-provider keys are bundled in the frontend. Move privileged provider calls and keys behind a trusted backend before public distribution. This redesign did not expand into that backend migration.
- The APK is a debug-signed development build, not a Play Store release. Android tooling reports existing flat-directory/SDK metadata warnings; the build succeeds. Signature verification also warns about unsigned META-INF metadata entries.

## APK

- Output: `Jobtic-Career-Studio.apk`
- Package: `com.jobtic.interviewer`
- Version: `1.2` / code `3`
- Signing certificate SHA-1: `38:6A:3F:3F:95:9D:CE:8C:C6:A0:B5:5E:8C:11:79:3B:46:4D:B2:7C` (matches the existing Android OAuth configuration).
- Previous APK files were retained. Install as an update over the existing debug-signed app to retain its device data; do not uninstall first.
