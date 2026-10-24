# Integration Status — FBCA Examination Portal

## Completed in source package
- Original `public/index.html` layout and original `public/style.css` are preserved; the Firebase Functions SDK was added and Firestore client SDK was removed because the browser no longer needs direct Firestore access.
- Student registration and login use callable backend functions; student passwords are bcrypt-hashed server-side.
- Admin login uses server-side membership verification.
- Student portal configuration, exams, results, public leaderboard and streak data load through callable endpoints.
- Admin dashboard data loads through `adminGetDashboard`.
- Exam CRUD, student approval/deletion, password reset, registration enable/close, settings, branding, audio settings, result reset, and legacy migration use trusted endpoints.
- Exam attempts and scoring are server-side, with deadline and duplicate-submission checks.
- Direct `db.collection(...)` calls and legacy shared-document listeners have been removed from the browser code.
- Firestore and Storage client rules deny direct access.
- Legacy data migration is available from Admin → Contact & Footer settings; backup first.

## Verification completed here
- `node --check public/script.js` passed.
- `node --check functions/index.js` passed.
- `firebase.json` and `functions/package.json` parse as JSON.
- All callable names referenced by the frontend have matching backend exports.
- Original stylesheet is byte-identical to the supplied original stylesheet.

## Not verified yet
- Firebase deployment, emulator tests, browser end-to-end testing, App Check enforcement, and Storage photo migration.
- Therefore the package is a completed integration candidate, not yet production-verified. Follow `PRE_DEPLOY_CHECKLIST.md` before public launch.
