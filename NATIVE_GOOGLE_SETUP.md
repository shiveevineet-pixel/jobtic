# Native Google login setup for Jobtic 1.1

The Android APK uses Google Credential Manager's account chooser, then sends the
Google ID token and nonce directly to Supabase Auth. It does not open a browser or
use a localhost redirect for Google login.

## Required Google Cloud registration

Completed and verified in Google Cloud on 2026-09-16:

Android client ID: `237511348320-k4a00b95680fg7llpvqocqq69cijtitv.apps.googleusercontent.com`

The following registration is already created; do not create a duplicate.

In project `sanguine-era-508508-u8`, open Google Auth Platform → Clients → Create
client. Select **Android** and enter:

- Name: `Jobtic Android Debug`
- Package name: `com.jobtic.interviewer`
- SHA-1 certificate fingerprint: `38:6A:3F:3F:95:9D:CE:8C:C6:A0:B5:5E:8C:11:79:3B:46:4D:B2:7C`

Create this client in the **same project** as the existing Web OAuth client:

`237511348320-4gl13th13g91d95nanfgj40anunm8t9f.apps.googleusercontent.com`

The Android client ID does not need to be pasted into the APK. The native SDK
uses the existing Web client ID as the audience for the ID token. No Firebase
project or `google-services.json` file is required for this integration.

## Supabase

In project `cxadjgwtpvonntssohzj`, keep Google enabled and retain the existing
Web client ID and its secret in the Google provider settings. Do not replace
the Web ID with only the Android ID. Keep nonce verification enabled.

The Google client secret must never be added to app source or the APK.

Google Cloud's audience is currently in Testing mode. Basic Sign in with Google
requests only name, email and profile identity scopes. Google documents an
exception allowing this without listing accounts as test users. If additional
OAuth data scopes are introduced later, configure test users or the appropriate
production audience/verification before enabling them.

Reference: https://support.google.com/cloud/answer/15549945

## Test on a phone

1. Install the new `Jobtic.apk` (version 1.1, version code 2).
2. Ensure the phone has Google Play Services and a signed-in Google account.
3. Tap Continue with Google. The native account chooser should appear.
4. Select an account and approve any required Google consent.
5. Confirm Jobtic shows the signed-in profile and Supabase Authentication → Users
   contains the user.
6. Sign out, choose another account, and confirm cancellation allows retry.
7. Restart Jobtic and confirm the session remains signed in.

If sign-in reports an OAuth/developer configuration error, check that the Android
client's package name and SHA-1 match exactly. This file's SHA-1 applies only to
the current debug signing certificate. Release and Google Play builds need their
own Android clients for their signing certificates.

Build/signature verification is not the same as an end-to-end account login test.
No phone was connected during this rebuild. Google Cloud Android-client
registration is now created and verified, but a real account login on a phone
still needs to be tested.
