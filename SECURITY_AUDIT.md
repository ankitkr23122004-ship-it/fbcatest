# FBCA Examination Portal — Security Audit and Remediation

## Original confirmed findings

- Student passwords were stored in plaintext in a shared `system_config/students` document.
- Student login checked local browser data.
- Students, exams and results were bulk-written as shared client-controlled arrays.
- Exam scoring and result creation ran in client-side JavaScript.
- Admin UI state was being treated as a security control.
- Right-click/inspect blocking was not security.

## Remediations included in this package

- Student password hashes use bcrypt; plaintext is returned only once during registration or admin password reset.
- Student authentication and status checks run in callable Cloud Functions.
- Admin authorization is checked server-side against `admins/{uid}` on every admin endpoint.
- The client no longer directly reads/writes Firestore shared arrays for portal flows.
- Exam attempts and answer keys are stored server-side; only sanitized questions are returned before submission.
- Server-side scoring, duplicate-submission protection, active-attempt locks, deadline enforcement, and admin retake reset are implemented.
- Student approval/deletion/password reset are trusted server operations.
- Registration/login/password-reset rate limits are enforced server-side.
- Public endpoints return limited public configuration/leaderboard fields; they do not return student phone numbers, photos, password hashes, or answer keys.
- Firestore and Storage rules deny all direct browser access.
- Legacy migration hashes old passwords and removes legacy shared student/exam/result list documents after successful atomic migration.

## Remaining launch risks / work

- App Check is not enforced yet (`enforceAppCheck: false`). Configure it and enable enforcement before a public launch.
- Photo data URLs remain in Firestore documents with a 350,000-character limit; move photos to Firebase Storage for scale.
- Password reset is admin-issued; there is no self-service email reset flow.
- Static syntax checks are not a substitute for emulator and browser end-to-end testing.
- Public leaderboard currently displays the original portal's names, IDs and scores; confirm that publication policy is acceptable.

## Verdict

The code addresses the major client-side trust failures, but the package is **not yet production-verified**. Complete `PRE_DEPLOY_CHECKLIST.md` before deployment.
