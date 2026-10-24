# FBCA Online Examination Portal — Secure Integration Package

This package keeps the original portal's HTML layout, Tailwind classes, fonts, colors, and `style.css`. The security work is in `public/script.js`, the callable Cloud Functions in `functions/index.js`, and the database rules. No page redesign or separate-page rebuild is included.

## What is integrated

- Student registration is handled by `registerStudent`; generated passwords are returned once and only bcrypt hashes are stored.
- Student login is verified by `studentLogin`; the frontend signs in using a Firebase custom token.
- Registration can be opened/closed from Admin → Contact & Footer settings.
- Admin login checks `admins/{Firebase Auth UID}` through `verifyAdminAccess`; required fields are `role: "admin"` and `active: true`.
- Admin data loads through `adminGetDashboard`; the browser no longer reads/writes shared student/exam/result arrays directly.
- Exam creation, activation, editing, and deletion are sent to `adminReplaceExams` with server-side validation.
- Exams are started through `startExam`; answer keys stay server-side and attempts are tracked in Firestore.
- `submitExam` scores answers on the server, stores results, and prevents duplicate submissions.
- Admin can approve/reject students, delete student records, reset exam results for retakes, and reset a student's password. The password reset returns the new temporary password once so it can be sent via WhatsApp.
- Public configuration, public leaderboard, and streak data use narrow callable responses rather than direct Firestore access.
- A one-time legacy data migration button is provided under Admin → Contact & Footer settings. It copies legacy shared student/exam/result lists into the new collections, hashes legacy plaintext passwords, and deletes the old shared-list documents in the same batch. **Back up/export Firestore before using it.** It refuses to run if the new collections already contain records.
- Firestore and Storage client rules deny direct access. Trusted Cloud Functions use the Admin SDK. Required composite Firestore indexes are included in `firestore.indexes.json`.

## Important limitations before public production

This package has passed JavaScript syntax checks and callable-name cross-checks only. It has **not** been deployed to your Firebase project and has **not** passed a full browser/emulator end-to-end test in this environment. Do not describe it as production-verified until the checklist below is completed.

- Firebase App Check is not enforced in this code yet (`enforceAppCheck: false`). Basic server-side rate limits cover registration, login, and password reset, but App Check should be configured and enforced before a public launch.
- Student photos are currently stored as bounded image data URLs in Firestore documents (maximum 350,000 characters). For a large production rollout, migrate photos to Firebase Storage with strict authenticated rules.
- Password recovery is an admin-issued reset, not email-based self-service recovery.
- Legacy migration handles the old `system_config/{students,exams,results}` list format only. It may reject malformed exam answer keys rather than guessing.
- Public leaderboard shows the name, student ID, course/batch, exam, and score fields that the original portal displayed. Confirm that your institute is comfortable publishing these fields.
- Do not put service-account JSON files, private keys, or admin passwords into the website or this ZIP.

## Firebase setup

Requirements: Node.js 20, Firebase CLI, access to Firebase project `fbca-examination-portal`.

1. Export/back up Firestore before changing rules or migrating legacy records.
2. Confirm Firebase Authentication has Email/Password enabled and the admin user exists.
3. In Firestore, create `admins/{ADMIN_AUTH_UID}` with `{ "role": "admin", "active": true }`. Use the UID from Firebase Authentication, not the email address.
4. Open a terminal in this folder and run:

   ```bash
   cd functions
   npm install
   cd ..
   firebase login
   firebase use fbca-examination-portal
   ```

5. Test locally first:

   ```bash
   firebase emulators:start --only functions,firestore,auth,hosting
   ```

6. Run the test checklist below. Only after it passes, deploy:

   ```bash
   firebase deploy --only functions,firestore:rules,firestore:indexes,storage,hosting
   ```

   Deploying deny-all rules before the callable backend is deployed will block browser-side Firestore access. This package's migrated frontend no longer relies on direct Firestore access for the portal's main flows.

## Required end-to-end test checklist

- [ ] Admin with correct UID document can sign in; non-admin Firebase user is denied.
- [ ] Public registration creates a PENDING student; password is not stored as plaintext.
- [ ] Duplicate mobile registration is rejected; registration rate limit works.
- [ ] Pending/rejected student cannot sign in; approved student can sign in.
- [ ] Admin can approve/reject, reset password, send the new temporary password, and delete a student.
- [ ] Admin can create an exam from the provided Excel template, edit allocations, deactivate/reactivate, and delete an exam.
- [ ] Student sees only active exams assigned to their course/batch and never receives answer keys before submission.
- [ ] Start exam, navigate questions, submit once, verify server score and result; tampered client score is ignored.
- [ ] Duplicate submission is rejected; expired attempt behavior and admin retake reset work.
- [ ] Results, leaderboard, certificate/scorecard, contact info, branding, and audio settings render correctly.
- [ ] Registration open/close control works from Admin settings.
- [ ] If migrating old demo data, back up first, run the one-time migration, verify counts and login, and confirm old shared student data is removed.
- [ ] App Check is configured and enforced before public launch.

## File layout

- `public/index.html` — original portal markup with Firebase Functions SDK added.
- `public/style.css` — original stylesheet, unchanged.
- `public/script.js` — original portal behavior with secure callable API integration.
- `functions/index.js` — trusted backend and authorization checks.
- `firestore.rules`, `storage.rules` — deny-by-default client rules.
- `firebase.json` — Hosting, Functions, Firestore rules and Storage rules configuration.
- `SECURITY_AUDIT.md` — security findings and remediations.
- `PRE_DEPLOY_CHECKLIST.md` — deployment gates and known limitations.
