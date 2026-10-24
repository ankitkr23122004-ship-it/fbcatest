# Pre-deployment checklist — FBCA Examination Portal

The original visual layout and CSS are preserved. Core browser data flows have been moved to callable Cloud Functions, but this package is not production-verified until tests pass against your Firebase project.

## Must do before production

1. Back up/export Firestore.
2. Verify Firebase Auth admin UID and `admins/{uid}` role/active fields.
3. Install Functions dependencies and run Firebase emulators.
4. Test all cases listed in `README_SECURITY_REBUILD.md`.
5. Configure Firebase App Check for Hosting and Functions, initialize the client with the correct site key, test, then enable `enforceAppCheck` on callable endpoints.
6. Verify Firestore and Storage deny-by-default rules do not break any feature.
7. Test student registration, admin approval, password reset, exam scoring, retake reset, certificates, leaderboard, audio, branding, contact settings, and mobile layout.
8. If using the legacy migration, take a backup first. The migration removes the legacy shared `system_config/{students,exams,results}` documents after successful copy because those documents may contain plaintext passwords.
9. Deploy Hosting/Functions/rules together only after the emulator and staging checks pass.

## Not a security boundary

Client-side anti-inspect restrictions are not security. This package removes those blockers; actual protection is provided by Firebase Auth, callable authorization checks, server-side password hashing/scoring, rate limiting, and Firestore rules.

## Current known limitations

- App Check is not yet enforced.
- Photos remain bounded data URLs in Firestore; migrate to Firebase Storage for scale.
- Full end-to-end browser/emulator tests have not been run in this build environment.
