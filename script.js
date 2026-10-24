// Candidate Admission Button ko Direct Active & Scroll karne ke liye
function openCandidateAdmissionScreen() {
  activateStudentPortal();
  switchStudentAuthMode('registration');
  setTimeout(() => {
    const regCard = document.getElementById('registration-panel-card');
    if (regCard) {
      regCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
}

const STORAGE_KEY_STUDENTS = 'fbca_students_db';
const STORAGE_KEY_EXAMS = 'fbca_exams_db';
const STORAGE_KEY_RESULTS = 'fbca_results_db';
const STORAGE_KEY_MASTERS = 'fbca_masters_db';
const STORAGE_KEY_SETTINGS = 'fbca_settings_db';
const STORAGE_KEY_BRANDING = 'fbca_branding_db';
const STORAGE_KEY_AUDIO = 'fbca_audio_config';
let liveQuizTickInterval = null;

// Firebase Credentials
const firebaseConfig = {
  apiKey: "AIzaSyAnu6eQtOWhMKoTuBW0oabCdQgW8jBnUS4",
  authDomain: "fbca-examination-portal.firebaseapp.com",
  projectId: "fbca-examination-portal",
  storageBucket: "fbca-examination-portal.firebasestorage.app",
  messagingSenderId: "752724966856",
  appId: "1:752724966856:web:e4b4bf6372273a3e7b14fd"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

let currentPortal = 'student';
let isAdminAuthenticated = false;
let currentStudentUser = null;
let currentExamSession = null;
let examSpeedTimerInterval = null;
let questionTimeRemaining = 15;
const PER_QUESTION_SECONDS = 15;
const circ = 132;
let pendingExamQuestions = [];
let antiCheatStrikes = 0;
const MAX_ANTI_CHEAT_STRIKES = 3;
let studentUploadedPhotoBase64 = null;
let lastExamResultId = null;

const AudioEngine = {
  ctx: null,
  customAudios: {},
  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
  },
  playTone(freq, type, duration, gainVal = 0.1) {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  },
  play(soundType) {
    const cfg = getAudioConfig();
    if (cfg.mode === 'custom_mp3' && cfg[soundType]) {
      try {
        if (!this.customAudios[soundType] || this.customAudios[soundType].src !== cfg[soundType]) {
          this.customAudios[soundType] = new Audio(cfg[soundType]);
        }
        this.customAudios[soundType].currentTime = 0;
        this.customAudios[soundType].play().catch(() => {});
        return;
      } catch (e) {}
    }
    if (soundType === 'tick') this.playTone(1050, 'sine', 0.05, 0.03);
    if (soundType === 'click') this.playTone(600, 'sine', 0.08, 0.05);
    if (soundType === 'warn') {
      this.playTone(180, 'sawtooth', 0.35, 0.25);
      setTimeout(() => this.playTone(140, 'sawtooth', 0.3, 0.2), 150);
    }
    if (soundType === 'success') {
      this.playTone(523.25, 'triangle', 0.18, 0.15);
      setTimeout(() => this.playTone(659.25, 'triangle', 0.18, 0.15), 100);
      setTimeout(() => this.playTone(783.99, 'triangle', 0.3, 0.15), 200);
    }
  },
  tick() { this.play('tick'); },
  click() { this.play('click'); },
  warn() { this.play('warn'); },
  success() { this.play('success'); }
};

function initializeStorage() {
  if (!localStorage.getItem(STORAGE_KEY_MASTERS)) {
    const defaultMasters = {
      branches: ['Patna', 'Kurthaul', 'Punpun'],
      courses: ['ADCA', 'DCA', 'Tally Prime with GST', 'Python Programming', 'Web Development'],
      batches: ['10', '11', '12', '14', '16', '18', '20'],
      qualifications: ['10th Matriculation', '12th Intermediate', 'Graduation (BA/B.Sc/B.Com)', 'B.Tech / BCA / IT', 'Post Graduation']
    };
    localStorage.setItem(STORAGE_KEY_MASTERS, JSON.stringify(defaultMasters));
  }
  if (!localStorage.getItem(STORAGE_KEY_STUDENTS)) localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify([]));
  if (!localStorage.getItem(STORAGE_KEY_EXAMS)) localStorage.setItem(STORAGE_KEY_EXAMS, JSON.stringify([]));
  if (!localStorage.getItem(STORAGE_KEY_RESULTS)) localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify([]));
  if (!localStorage.getItem(STORAGE_KEY_AUDIO)) localStorage.setItem(STORAGE_KEY_AUDIO, JSON.stringify({ mode: 'synthesizer', tick: '', click: '', warn: '', success: '' }));
  if (!localStorage.getItem(STORAGE_KEY_SETTINGS)) {
    const defaultSettings = {
      address: "Patna Main Hub, Bihar, India",
      phone: "+91 91234 56789",
      email: "support@fbca.co.in",
      timing: "Monday - Saturday: 08:00 AM - 07:00 PM",
      website: "https://fbca.co.in/"
    };
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(defaultSettings));
  }
  if (!localStorage.getItem(STORAGE_KEY_BRANDING)) {
    const defaultBranding = { logo: "logo.png", sk: "Sir.jpg", ak: "Ankit.jpeg" };
    localStorage.setItem(STORAGE_KEY_BRANDING, JSON.stringify(defaultBranding));
  }
}

function getMasters() { return JSON.parse(localStorage.getItem(STORAGE_KEY_MASTERS) || '{}'); }
function getStudents() { return JSON.parse(localStorage.getItem(STORAGE_KEY_STUDENTS) || '[]'); }
function getExams() { return JSON.parse(localStorage.getItem(STORAGE_KEY_EXAMS) || '[]'); }
function getResults() { return JSON.parse(localStorage.getItem(STORAGE_KEY_RESULTS) || '[]'); }
function getAudioConfig() { return JSON.parse(localStorage.getItem(STORAGE_KEY_AUDIO) || '{"mode":"synthesizer","tick":"","click":"","warn":"","success":""}'); }
function getSettings() { return JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || '{}'); }
function getBranding() { return JSON.parse(localStorage.getItem(STORAGE_KEY_BRANDING) || '{}'); }

function saveAudioConfig(cfg) {
  localStorage.setItem(STORAGE_KEY_AUDIO, JSON.stringify(cfg));
  if (isAdminAuthenticated) {
    db.collection('system_config').doc('audio').set(cfg, { merge: true }).catch(() => {});
  }
}

function saveMasters(m) {
  localStorage.setItem(STORAGE_KEY_MASTERS, JSON.stringify(m));
  populateDynamicDropdowns();
  if (isAdminAuthenticated) {
    db.collection('system_config').doc('masters').set(m, { merge: true }).catch(() => {});
  }
}

function saveStudents(d) {
  localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(d));
  updateGlobalBadges();
}

async function saveExams(d) {
  localStorage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(d));
  updateGlobalBadges();
  if (isAdminAuthenticated) {
    const batch = db.batch();
    const existingSnap = await db.collection('exams').get();
    existingSnap.docs.forEach(doc => batch.delete(doc.ref));
    d.forEach(exam => {
      const ref = db.collection('exams').doc(exam.id);
      batch.set(ref, exam);
    });
    await batch.commit();
  }
}

function saveResults(d) { 
  localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(d)); 
}

function saveSettings(s) {
  localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(s));
  renderContactFooter();
  if (isAdminAuthenticated) {
    db.collection('system_config').doc('settings').set(s, { merge: true }).catch(() => {});
  }
}

function saveBranding(b) {
  localStorage.setItem(STORAGE_KEY_BRANDING, JSON.stringify(b));
  renderBrandingImages();
  if (isAdminAuthenticated) {
    db.collection('system_config').doc('branding').set(b, { merge: true }).catch(() => {});
  }
}

async function refreshAdminData() {
  try {
    const [studentsSnap, examsSnap, resultsSnap, mastersDoc, settingsDoc, brandingDoc, audioDoc] = await Promise.all([
      db.collection('students').get(),
      db.collection('exams').get(),
      db.collection('results').get(),
      db.collection('system_config').doc('masters').get(),
      db.collection('system_config').doc('settings').get(),
      db.collection('system_config').doc('branding').get(),
      db.collection('system_config').doc('audio').get()
    ]);

    const students = studentsSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
    const exams = examsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const results = resultsSnap.docs.map(d => ({ id: d.id, resultId: d.id, ...d.data() }));

    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));
    localStorage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(exams));
    localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(results));

    if (mastersDoc.exists) localStorage.setItem(STORAGE_KEY_MASTERS, JSON.stringify(mastersDoc.data()));
    if (settingsDoc.exists) localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settingsDoc.data()));
    if (brandingDoc.exists) localStorage.setItem(STORAGE_KEY_BRANDING, JSON.stringify(brandingDoc.data()));
    if (audioDoc.exists) localStorage.setItem(STORAGE_KEY_AUDIO, JSON.stringify(audioDoc.data()));

    populateDynamicDropdowns();
    renderBrandingImages();
    renderContactFooter();
    loadSoundConfigInAdmin();
    updateGlobalBadges();
  } catch (err) {
    console.warn("Could not load full admin data from Firestore:", err);
  }
}

async function refreshStudentData() {
  if (!currentStudentUser) return;
  try {
    const [examsSnap, resultsSnap] = await Promise.all([
      db.collection('exams').where('active', '==', true).get(),
      db.collection('results').where('studentId', '==', currentStudentUser.id).get()
    ]);

    const rawExams = examsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    localStorage.setItem(STORAGE_KEY_EXAMS, JSON.stringify(rawExams));

    const results = resultsSnap.docs.map(d => ({ id: d.id, resultId: d.id, ...d.data() }));
    localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(results));

    renderContactFooter();
    renderBrandingImages();
    populateDynamicDropdowns();
    updateGlobalBadges();
    renderLeaderboardTable();
  } catch (err) {
    console.warn("Student data refresh warning:", err);
  }
}

function renderBrandingImages() {
  const b = getBranding();
  if (!b) return;
  const setSrc = (id, src) => {
    const el = document.getElementById(id);
    if (el && src) el.src = src;
  };
  setSrc('header-inst-logo', b.logo || 'logo.png');
  setSrc('footer-inst-logo', b.logo || 'logo.png');
  setSrc('admin-preview-logo', b.logo || 'logo.png');
  setSrc('sidebar-sk-img', b.sk || 'Sir.jpg');
  setSrc('dash-sk-img', b.sk || 'Sir.jpg');
  setSrc('quiz-sk-img', b.sk || 'Sir.jpg');
  setSrc('admin-preview-sk', b.sk || 'Sir.jpg');
  setSrc('sidebar-ak-img', b.ak || 'Ankit.jpeg');
  setSrc('dash-ak-img', b.ak || 'Ankit.jpeg');
  setSrc('quiz-ak-img', b.ak || 'Ankit.jpeg');
  setSrc('admin-preview-ak', b.ak || 'Ankit.jpeg');
}

function handleBrandingImageUpload(event, type) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    const b = getBranding();
    b[type] = base64;
    saveBranding(b);
    showToast(`${type.toUpperCase()} image updated and synced!`, true);
  };
  reader.readAsDataURL(file);
}

function renderContactFooter() {
  const s = getSettings();
  if (!s) return;
  if (document.getElementById('footer-address')) document.getElementById('footer-address').innerText = s.address || "Patna Main Hub, Bihar, India";
  if (document.getElementById('footer-phone')) document.getElementById('footer-phone').innerText = s.phone || "+91 98765 43210";
  if (document.getElementById('footer-email')) document.getElementById('footer-email').innerText = s.email || "support@fbca.co.in";
  if (document.getElementById('footer-timing')) document.getElementById('footer-timing').innerText = s.timing || "Mon - Sat: 08:00 AM - 07:00 PM";
  if (document.getElementById('footer-website-link')) {
    document.getElementById('footer-website-link').href = s.website || "https://fbca.co.in/";
  }
  if (document.getElementById('set-inst-address')) document.getElementById('set-inst-address').value = s.address || "";
  if (document.getElementById('set-inst-phone')) document.getElementById('set-inst-phone').value = s.phone || "";
  if (document.getElementById('set-inst-email')) document.getElementById('set-inst-email').value = s.email || "";
  if (document.getElementById('set-inst-timing')) document.getElementById('set-inst-timing').value = s.timing || "";
  if (document.getElementById('set-inst-website')) document.getElementById('set-inst-website').value = s.website || "";
}

function saveInstituteContactSettings(e) {
  e.preventDefault();
  const s = {
    address: document.getElementById('set-inst-address').value.trim(),
    phone: document.getElementById('set-inst-phone').value.trim(),
    email: document.getElementById('set-inst-email').value.trim(),
    timing: document.getElementById('set-inst-timing').value.trim(),
    website: document.getElementById('set-inst-website').value.trim()
  };
  saveSettings(s);
  showToast("Contact settings updated!");
}

function populateDynamicDropdowns() {
  const masters = getMasters();

  const courseSelect = document.getElementById('reg-course');
  if (courseSelect) {
    courseSelect.innerHTML = '<option value="">-- Course --</option>' + 
      (masters.courses || []).map(c => `<option value="${c}">${c}</option>`).join('');
  }

  const batchSelect = document.getElementById('reg-batch');
  if (batchSelect) {
    batchSelect.innerHTML = '<option value="">-- Batch --</option>' + 
      (masters.batches || []).map(b => `<option value="${b}">Batch ${b}</option>`).join('');
  }

  const branchSelect = document.getElementById('reg-branch');
  if (branchSelect) {
    branchSelect.innerHTML = '<option value="">-- Branch --</option>' + 
      (masters.branches || []).map(b => `<option value="${b}">${b}</option>`).join('');
  }

  const qualSelect = document.getElementById('reg-qualification');
  if (qualSelect) {
    qualSelect.innerHTML = '<option value="">-- Choose Qualification --</option>' + 
      (masters.qualifications || []).map(q => `<option value="${q}">${q}</option>`).join('');
  }

  const filterSelect = document.getElementById('leaderboard-filter-select');
  if (filterSelect) {
    filterSelect.innerHTML = '<option value="ALL">-- ALL TESTS --</option>' + 
      (masters.courses || []).map(c => `<option value="${c}">${c}</option>`).join('');
  }

  const adminFilterCourse = document.getElementById('admin-filter-course');
  if (adminFilterCourse) {
    const cur = adminFilterCourse.value;
    adminFilterCourse.innerHTML = '<option value="ALL">All Courses</option>' + 
      (masters.courses || []).map(c => `<option value="${c}">${c}</option>`).join('');
    if (cur) adminFilterCourse.value = cur;
  }

  const adminFilterBatch = document.getElementById('admin-filter-batch');
  if (adminFilterBatch) {
    const cur = adminFilterBatch.value;
    adminFilterBatch.innerHTML = '<option value="ALL">All Batches</option>' + 
      (masters.batches || []).map(b => `<option value="${b}">Batch ${b}</option>`).join('');
    if (cur) adminFilterBatch.value = cur;
  }

  const targetCoursesWrap = document.getElementById('exam-target-courses-wrap');
  if (targetCoursesWrap) {
    targetCoursesWrap.innerHTML = (masters.courses || []).map(c => `
      <label class="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg cursor-pointer hover:border-blue-500 font-semibold text-xs interactive-btn">
        <input type="checkbox" name="target-courses" value="${c}" class="rounded text-blue-600">
        <span>${c}</span>
      </label>
    `).join('');
  }

  const targetBatchesWrap = document.getElementById('exam-target-batches-wrap');
  if (targetBatchesWrap) {
    targetBatchesWrap.innerHTML = (masters.batches || []).map(b => `
      <label class="flex items-center gap-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg cursor-pointer hover:border-amber-500 font-semibold text-xs interactive-btn">
        <input type="checkbox" name="target-batches" value="${b}" class="rounded text-amber-600">
        <span>Batch ${b}</span>
      </label>
    `).join('');
  }

  const branchCountEl = document.getElementById('stat-total-branches');
  if (branchCountEl) branchCountEl.innerText = String((masters.branches || []).length).padStart(2, '0');
  renderMastersAdminCards();
}

function switchStudentAuthMode(mode) {
  const loginCard = document.getElementById('login-panel-card');
  const regCard = document.getElementById('registration-panel-card');
  const pillLogin = document.getElementById('tab-pill-login');
  const pillReg = document.getElementById('tab-pill-reg');
  if (!loginCard || !regCard) return;
  const isReg = mode === 'registration';
  loginCard.classList.toggle('hidden', isReg);
  regCard.classList.toggle('hidden', !isReg);
  if (pillLogin) pillLogin.className = !isReg ? "flex-1 py-2 px-3 rounded-xl text-xs font-orbitron font-bold transition-all text-white bg-blue-600 shadow-md flex items-center justify-center gap-2 interactive-btn" : "flex-1 py-2 px-3 rounded-xl text-xs font-orbitron font-bold transition-all text-slate-400 hover:text-white flex items-center justify-center gap-2 interactive-btn";
  if (pillReg) pillReg.className = isReg ? "flex-1 py-2 px-3 rounded-xl text-xs font-orbitron font-bold transition-all text-white bg-blue-600 shadow-md flex items-center justify-center gap-2 interactive-btn" : "flex-1 py-2 px-3 rounded-xl text-xs font-orbitron font-bold transition-all text-slate-400 hover:text-white flex items-center justify-center gap-2 interactive-btn";
  const authEl = document.getElementById('student-auth-view');
  if (authEl) setTimeout(() => authEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}

function handleStudentPhotoSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const maxDim = 250;
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxDim) { height *= maxDim / width; width = maxDim; }
      } else {
        if (height > maxDim) { width *= maxDim / height; height = maxDim; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      studentUploadedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.6);
      const preview = document.getElementById('reg-photo-preview');
      const placeholder = document.getElementById('reg-photo-placeholder');
      preview.src = studentUploadedPhotoBase64;
      preview.classList.remove('hidden');
      placeholder.classList.add('hidden');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function generateLocalId(batch, name) {
  const cleanName = (name || "STUD").replace(/[^a-zA-Z]/g, '').toUpperCase().padEnd(4, 'X').slice(0, 4);
  const cleanBatch = (batch || "01").replace(/[^a-zA-Z0-9]/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FBCA${cleanBatch}${cleanName}${rand}`;
}

async function handleStudentRegistration(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim().toUpperCase();
  const father = document.getElementById('reg-father').value.trim().toUpperCase();
  const branch = document.getElementById('reg-branch').value;
  const course = document.getElementById('reg-course').value;
  const batch = document.getElementById('reg-batch').value;
  const qualification = document.getElementById('reg-qualification').value;
  const mobile = document.getElementById('reg-mobile').value.trim();

  if (!studentUploadedPhotoBase64) {
    showToast("Please upload a passport photo.", false, "PHOTO REQUIRED");
    return;
  }

  try {
    const duplicateCheck = await db.collection('students').where('mobile', '==', mobile).limit(1).get();
    if (!duplicateCheck.empty) {
      showToast("This mobile number is already registered.", false);
      return;
    }

    const studentId = generateLocalId(batch, name);
    const password = Math.random().toString(36).slice(-8);
    const uid = 'student_' + studentId;

    const profile = {
      id: studentId,
      uid: uid,
      name,
      father,
      branch,
      course,
      batch,
      qualification,
      mobile,
      photo: studentUploadedPhotoBase64,
      photoDataUrl: studentUploadedPhotoBase64,
      password: password,
      status: "PENDING",
      registeredAt: new Date().toLocaleDateString(),
      loginStreak: 0,
      lastLoginDay: null,
      streakBest: 0
    };

    await db.collection('students').doc(uid).set(profile);

    const students = getStudents();
    students.unshift(profile);
    saveStudents(students);

    document.getElementById('modal-student-id').innerText = studentId;
    document.getElementById('modal-student-pass').innerText = password;
    document.getElementById('cred-modal').classList.remove('hidden');

    document.getElementById('student-reg-form').reset();
    studentUploadedPhotoBase64 = null;
    document.getElementById('reg-photo-preview').classList.add('hidden');
    document.getElementById('reg-photo-placeholder').classList.remove('hidden');

    showToast("Registration submitted. Wait for admin approval.", true);
  } catch (error) {
    showToast(error.message || 'Registration could not be completed.', false);
  }
}

function closeCredModalAndFillLogin() {
  const id = document.getElementById('modal-student-id').innerText;
  const pass = document.getElementById('modal-student-pass').innerText;
  document.getElementById('cred-modal').classList.add('hidden');
  switchStudentAuthMode('login');
  document.getElementById('login-id').value = id;
  document.getElementById('login-password').value = pass;
}

function localDayKey(date = new Date()) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
function dayDifference(a, b) {
  const [ay,am,ad]=a.split('-').map(Number), [by,bm,bd]=b.split('-').map(Number);
  return Math.round((Date.UTC(by,bm-1,bd)-Date.UTC(ay,am-1,ad))/86400000);
}

function recordStudentDailyStreak(student) {
  const today = localDayKey();
  const last = student.lastLoginDay || '';
  if (last !== today) {
    if (!last) student.loginStreak = 1;
    else student.loginStreak = dayDifference(last, today) === 1 ? (Number(student.loginStreak)||0)+1 : 1;
    student.lastLoginDay = today;
    student.streakBest = Math.max(Number(student.streakBest)||0, Number(student.loginStreak)||1);
    const all = getStudents();
    const i = all.findIndex(x => x.id === student.id);
    if (i >= 0) { 
      all[i] = { ...all[i], loginStreak: student.loginStreak, lastLoginDay: today, streakBest: student.streakBest }; 
      saveStudents(all); 
    }
    if (student.uid) {
      db.collection('students').doc(student.uid).update({
        loginStreak: student.loginStreak,
        streakBest: student.streakBest,
        lastLoginDay: today
      }).catch(() => {});
    }
  }
  const el = document.getElementById('student-streak-count');
  if (el) el.innerText = Number(student.loginStreak)||0;
}

function openStreakLeaderboard() {
  const modal = document.getElementById('streak-leaderboard-modal');
  const list = document.getElementById('streak-leaderboard-list');
  if (!modal || !list) return;
  const ranked = getStudents().filter(s => s.status !== 'DELETED').sort((a,b)=>(Number(b.loginStreak)||0)-(Number(a.loginStreak)||0) || (Number(b.streakBest)||0)-(Number(a.streakBest)||0) || String(a.name||'').localeCompare(String(b.name||'')));
  list.innerHTML = ranked.length ? ranked.map((s,i)=>`<div class="flex items-center gap-3 rounded-xl border border-slate-200 p-3 ${currentStudentUser && s.id===currentStudentUser.id?'bg-amber-50 border-amber-300':''}"><span class="w-8 h-8 rounded-full flex items-center justify-center font-black ${i===0?'bg-amber-400 text-white':'bg-slate-100 text-slate-600'}">${i+1}</span><div class="flex-1 min-w-0"><strong class="block text-sm text-slate-800 truncate">${escapeStreakText(s.name||'Student')}</strong><small class="text-[10px] text-slate-500">${escapeStreakText(s.id||'')}</small></div><div class="text-right"><strong class="text-orange-600">🔥 ${Number(s.loginStreak)||0}</strong><small class="block text-[9px] text-slate-500">days</small></div></div>`).join('') : '<p class="text-sm text-slate-500 text-center py-8">No streaks yet. Log in daily to start one!</p>';
  modal.classList.remove('hidden'); modal.classList.add('flex');
}
function closeStreakLeaderboard() { const m=document.getElementById('streak-leaderboard-modal'); if(m){m.classList.add('hidden');m.classList.remove('flex');} }
function escapeStreakText(value) { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function handleStudentLogin(e) {
  e.preventDefault();
  const id = document.getElementById('login-id').value.trim().toUpperCase();
  const pass = document.getElementById('login-password').value.trim();

  try {
    const snap = await db.collection('students').where('id', '==', id).limit(1).get();
    if (snap.empty) {
      showToast('Student ID not found.', false);
      return;
    }
    const student = snap.docs[0].data();
    if (student.password !== pass) {
      showToast('Invalid password.', false);
      return;
    }
    if (student.status !== 'APPROVED') {
      showToast('Your admission is pending approval.', false);
      return;
    }

    currentStudentUser = student;
    await refreshStudentData();
    recordStudentDailyStreak(currentStudentUser);
    loadStudentDashboard();
    showToast(`Welcome back, ${currentStudentUser.name}!`, true);
  } catch (error) {
    showToast(error.message || 'Login failed.', false);
  }
}

function loadStudentDashboard() {
  if (!currentStudentUser) return;

  const sidebar = document.getElementById('main-sidebar');
  if (sidebar) sidebar.classList.add('hidden');
  const heroBanner = document.getElementById('main-hero-banner');
  if (heroBanner) heroBanner.classList.add('hidden');
  const stats = document.getElementById('main-metric-stats');
  if (stats) stats.classList.add('hidden');
  const authTabs = document.getElementById('student-auth-tabs-pill');
  if (authTabs) authTabs.classList.add('hidden');
  const authView = document.getElementById('student-auth-view');
  if (authView) authView.classList.add('hidden');
  const leaderboard = document.getElementById('leaderboard-section-wrapper');
  if (leaderboard) leaderboard.classList.add('hidden');

  const mainCol = document.getElementById('main-content-column');
  if (mainCol) {
    mainCol.classList.remove('lg:col-span-9');
    mainCol.classList.add('lg:col-span-12');
  }

  const dashView = document.getElementById('student-dashboard-view');
  if (dashView) dashView.classList.remove('hidden');

  const streakCountEl = document.getElementById('student-streak-count');
  if (streakCountEl) streakCountEl.innerText = Number(currentStudentUser.loginStreak)||0;
  document.getElementById('dash-student-name').innerText = currentStudentUser.name;
  document.getElementById('dash-father-name').innerText = currentStudentUser.father;
  document.getElementById('dash-branch').innerText = currentStudentUser.branch || 'Patna';
  document.getElementById('dash-course').innerText = currentStudentUser.course;
  document.getElementById('dash-batch').innerText = currentStudentUser.batch;
  document.getElementById('dash-student-id').innerText = currentStudentUser.id;

  const avatarImg = document.getElementById('dash-avatar-img');
  const avatarText = document.getElementById('dash-avatar-text');
  if (avatarImg && avatarText) {
    if (currentStudentUser.photo) {
      avatarImg.src = currentStudentUser.photo;
      avatarImg.classList.remove('hidden');
      avatarText.classList.add('hidden');
    } else {
      avatarImg.classList.add('hidden');
      avatarText.classList.remove('hidden');
      avatarText.innerText = currentStudentUser.name.substring(0, 2);
    }
  }

  switchStudentPanelTab('exams');
  renderEligibleTestsForStudent();
  renderStudentResults();
}

function switchStudentPanelTab(tab) {
  const examsWrap = document.getElementById('student-subtab-exams');
  const transcriptsWrap = document.getElementById('student-subtab-transcripts');
  const btnExams = document.getElementById('student-tab-btn-exams');
  const btnTranscripts = document.getElementById('student-tab-btn-transcripts');

  if (!examsWrap || !transcriptsWrap) return;

  if (tab === 'exams') {
    examsWrap.classList.remove('hidden');
    transcriptsWrap.classList.add('hidden');
    if (btnExams) btnExams.className = "flex-1 py-2 px-3 rounded-lg text-xs font-orbitron font-bold text-white bg-blue-600 transition shadow-sm flex items-center justify-center gap-2 interactive-btn";
    if (btnTranscripts) btnTranscripts.className = "flex-1 py-2 px-3 rounded-lg text-xs font-orbitron font-bold text-slate-400 hover:text-white transition flex items-center justify-center gap-2 interactive-btn";
  } else {
    transcriptsWrap.classList.remove('hidden');
    examsWrap.classList.add('hidden');
    if (btnTranscripts) btnTranscripts.className = "flex-1 py-2 px-3 rounded-lg text-xs font-orbitron font-bold text-white bg-blue-600 transition shadow-sm flex items-center justify-center gap-2 interactive-btn";
    if (btnExams) btnExams.className = "flex-1 py-2 px-3 rounded-lg text-xs font-orbitron font-bold text-slate-400 hover:text-white transition flex items-center justify-center gap-2 interactive-btn";
  }
}

async function logoutStudent() {
  currentStudentUser = null;
  const sidebar = document.getElementById('main-sidebar');
  if (sidebar) sidebar.classList.remove('hidden');
  const heroBanner = document.getElementById('main-hero-banner');
  if (heroBanner) heroBanner.classList.remove('hidden');
  const stats = document.getElementById('main-metric-stats');
  if (stats) stats.classList.remove('hidden');
  const authTabs = document.getElementById('student-auth-tabs-pill');
  if (authTabs) authTabs.classList.remove('hidden');
  const mainCol = document.getElementById('main-content-column');
  if (mainCol) {
    mainCol.classList.remove('lg:col-span-12');
    mainCol.classList.add('lg:col-span-9');
  }

  document.getElementById('student-dashboard-view').classList.add('hidden');
  document.getElementById('student-auth-view').classList.remove('hidden');

  const leaderboard = document.getElementById('leaderboard-section-wrapper');
  if (leaderboard) leaderboard.classList.remove('hidden');

  switchStudentAuthMode('login');
  showToast("Candidate logged out.");
}

function renderEligibleTestsForStudent() {
  const container = document.getElementById('student-tests-list');
  const allExams = getExams();
  const allResults = getResults();

  const eligibleExams = allExams.filter(exam => {
    if (exam.active === false) return false;
    const courseMatch = Array.isArray(exam.courses) 
      ? exam.courses.includes(currentStudentUser.course)
      : exam.course === currentStudentUser.course;
    const batchMatch = Array.isArray(exam.batches)
      ? exam.batches.includes(String(currentStudentUser.batch))
      : String(exam.batch) === String(currentStudentUser.batch);
    return courseMatch && batchMatch;
  });

  document.getElementById('active-test-count').innerText = `${eligibleExams.length} Available`;

  if (eligibleExams.length === 0) {
    container.innerHTML = `<div class="bg-white p-4 rounded-xl border text-center text-xs text-slate-500">No active tests scheduled for your batch.</div>`;
    return;
  }

  container.innerHTML = eligibleExams.map(exam => {
    const resultRecord = allResults.find(r => r.studentId === currentStudentUser.id && r.examId === exam.id);
    const isAttempted = !!resultRecord && !resultRecord.retestAllowed;
    const courseLabels = Array.isArray(exam.courses) ? exam.courses.join(', ') : exam.course;
    const batchLabels = Array.isArray(exam.batches) ? exam.batches.join(', ') : exam.batch;

    return `
      <div class="bg-white p-3.5 rounded-xl border flex justify-between items-center gap-2">
        <div>
          <span class="text-[9px] font-orbitron font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">${courseLabels} (B-${batchLabels})</span>
          <h4 class="font-orbitron font-bold text-xs sm:text-sm text-slate-900 mt-1">${exam.title}</h4>
          <div class="text-[10px] text-slate-500">${exam.duration} Mins &bull; ${exam.questions.length} Questions</div>
        </div>
        ${isAttempted ? `
          <div class="flex items-center gap-1.5">
            <button onclick="viewGrandScorecardReview('${resultRecord.resultId}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-orbitron font-bold text-[10px] rounded-lg interactive-btn">Review</button>
            <span class="px-2.5 py-1 bg-slate-100 text-slate-400 font-orbitron font-bold text-[10px] rounded-lg">Submitted</span>
          </div>
        ` : `
          <button onclick="startCBTExam('${exam.id}')" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-orbitron font-bold text-xs rounded-xl shadow interactive-btn">Attempt</button>
        `}
      </div>
    `;
  }).join('');
}

function renderStudentResults() {
  const container = document.getElementById('student-results-list');
  const allResults = getResults();
  const myResults = allResults.filter(r => r.studentId === currentStudentUser.id);

  if (myResults.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">No transcripts recorded yet.</div>`;
    return;
  }

  container.innerHTML = myResults.map(res => {
    const examCandidates = allResults
      .filter(r => r.examId === res.examId)
      .sort((a, b) => b.percentage - a.percentage);

    const totalExamTakers = examCandidates.length;
    const currentRankIndex = examCandidates.findIndex(r => r.studentId === res.studentId);
    const myRank = currentRankIndex !== -1 ? currentRankIndex + 1 : 1;

    return `
      <div class="p-3.5 hover:bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
        <div>
          <h5 class="font-orbitron font-bold text-slate-900 text-xs sm:text-sm">${res.examTitle}</h5>
          <div class="text-[10px] text-slate-400">${res.date} &bull; ${totalExamTakers} Candidates</div>
          <div class="mt-1.5 flex items-center gap-2">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg font-orbitron font-bold text-[10px]">
              🏆 Rank #${myRank} of ${totalExamTakers}
            </span>
            <button onclick="viewGrandScorecardReview('${res.resultId}')" class="text-blue-600 font-bold hover:underline">Review</button>
            <button onclick="viewCertificate('${res.resultId}')" class="text-emerald-700 font-bold hover:underline">Certificate</button>
          </div>
        </div>
        <div class="text-right sm:self-center">
          <span class="font-orbitron font-bold text-slate-900">${res.score}/${res.totalMarks} (${res.percentage}%)</span>
          <span class="block text-[9px] font-bold ${res.status === 'PASSED' ? 'text-emerald-600' : 'text-rose-600'}">${res.status}</span>
        </div>
      </div>
    `;
  }).join('');
}

function openStudentProfileModal(studentId) {
  const students = getStudents();
  const st = students.find(s => s.id === studentId);
  if (!st) return;

  const allResults = getResults();
  const results = allResults.filter(r => r.studentId === studentId);

  document.getElementById('modal-sp-img').src = st.photo || 'https://placehold.co/150x150/2563eb/ffffff?text=User';
  document.getElementById('modal-sp-name').innerText = st.name;
  document.getElementById('modal-sp-id').innerText = st.id;
  document.getElementById('modal-sp-status').innerText = st.status;
  document.getElementById('modal-sp-father').innerText = st.father;
  document.getElementById('modal-sp-branch').innerText = `${st.branch || 'Patna'} Hub`;
  document.getElementById('modal-sp-course-batch').innerText = `${st.course} (Batch ${st.batch})`;
  document.getElementById('modal-sp-mobile').innerText = st.mobile;

  const container = document.getElementById('modal-sp-exams-list');
  if (results.length === 0) {
    container.innerHTML = `<div class="p-3 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">No test attempts registered yet.</div>`;
  } else {
    container.innerHTML = results.map(r => {
      const testTakers = allResults.filter(x => x.examId === r.examId).sort((a,b) => b.percentage - a.percentage);
      const rank = testTakers.findIndex(x => x.studentId === r.studentId) + 1;

      return `
        <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex justify-between items-center text-xs">
          <div>
            <span class="font-bold text-slate-800">${r.examTitle}</span>
            <div class="text-[9px] text-slate-500">${r.date} &bull; <strong>Rank #${rank || 1}</strong> of ${testTakers.length}</div>
          </div>
          <div class="text-right flex items-center gap-2">
            <div>
              <span class="font-mono font-bold text-slate-900">${r.score} / ${r.totalMarks} (${r.percentage}%)</span>
              <span class="block text-[9px] font-bold ${r.status === 'PASSED' ? 'text-emerald-600' : 'text-rose-600'}">${r.status}</span>
            </div>
            <button onclick="unlockSpecificExamRetest('${r.studentId}', '${r.examId}')" class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-orbitron font-bold rounded text-[9px] shadow transition interactive-btn">
              Reset
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  document.getElementById('student-profile-modal').classList.remove('hidden');
}

function closeStudentProfileModal() {
  document.getElementById('student-profile-modal').classList.add('hidden');
}

async function unlockSpecificExamRetest(studentId, examId) {
  let results = getResults();
  const initialCount = results.length;
  results = results.filter(r => !(r.studentId === studentId && r.examId === examId));

  if (results.length < initialCount) {
    try {
      const snap = await db.collection('results').where('studentId', '==', studentId).where('examId', '==', examId).get();
      snap.docs.forEach(doc => doc.ref.delete());

      saveResults(results); 
      openStudentProfileModal(studentId); 
      renderLeaderboardTable();
      if (currentStudentUser && currentStudentUser.id === studentId) { 
        await refreshStudentData(); 
        renderEligibleTestsForStudent(); 
        renderStudentResults(); 
      }
      showToast("Test reset. Student can re-attempt.", true, "RESET SUCCESSFUL");
    } catch (error) { 
      showToast(error.message || 'Could not reset this result.', false); 
    }
  } else {
    showToast("Test record not found.", false, "NOT FOUND");
  }
}

function enlargeStudentPhoto(photoSrc, name, id) {
  const modal = document.getElementById('photo-enlarge-modal');
  const img = document.getElementById('enlarged-student-img');
  const nameEl = document.getElementById('enlarged-student-name');
  const idEl = document.getElementById('enlarged-student-id');
  img.src = photoSrc || 'https://placehold.co/200x200/2563eb/ffffff?text=No+Photo';
  nameEl.innerText = name;
  idEl.innerText = `Roll ID: ${id}`;
  modal.classList.remove('hidden');
}

function closePhotoEnlargeModal() {
  document.getElementById('photo-enlarge-modal').classList.add('hidden');
}

async function sendStudentCredentialsOnWhatsApp(studentId) {
  const students = getStudents();
  const student = students.find(s => s.id === studentId);
  if (!student) { showToast("Student details not found!", false); return; }
  
  const newPass = Math.random().toString(36).slice(-8);
  student.password = newPass;

  try {
    await db.collection('students').doc(student.uid || 'student_' + student.id).update({
      password: newPass
    });
    saveStudents(students);

    let phone = String(student.mobile || '').replace(/[^0-9]/g, '');
    if (phone.length === 10) phone = '91' + phone;
    const portalUrl = window.location.origin + window.location.pathname;
    const message = `*FUTURE BOOST COMPUTER ACADEMY (FBCA)*%0A` +
      `_Computer Education & Examination Portal_%0A%0A` +
      `Hello *${student.name}*,%0A` +
      `Your portal password has been reset by the institute.%0A%0A` +
      `*Login Credentials:*%0A` +
      `• *Roll ID:* ${student.id}%0A` +
      `• *Temporary Password:* ${newPass}%0A` +
      `• *Course:* ${student.course} (Batch ${student.batch})%0A%0A` +
      `*Login Portal:*%0A${portalUrl}%0A%0A` +
      `_Please keep these credentials private._`;
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    showToast('Password reset. WhatsApp opened!', true);
  } catch (error) {
    showToast(error.message || 'Could not reset password.', false);
  }
}

function renderAdminStudentsTable() {
  const tbody = document.getElementById('admin-students-tbody');
  const query = (document.getElementById('admin-search-student').value || '').trim().toLowerCase();
  const courseFilter = document.getElementById('admin-filter-course').value;
  const batchFilter = document.getElementById('admin-filter-batch').value;
  
  let students = getStudents();
  if (courseFilter !== 'ALL') students = students.filter(s => s.course === courseFilter);
  if (batchFilter !== 'ALL') students = students.filter(s => String(s.batch) === String(batchFilter));
  if (query) {
    students = students.filter(s => s.id.toLowerCase().includes(query) || s.name.toLowerCase().includes(query) || s.mobile.includes(query));
  }

  if (students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-slate-400">No candidate records found in Cloud.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(s => `
    <tr class="hover:bg-blue-50/40 transition border-b border-slate-100">
      <td class="p-3">
        <div onclick="enlargeStudentPhoto('${s.photo}', '${s.name}', '${s.id}')" class="w-9 h-9 rounded-xl overflow-hidden border border-blue-400 bg-slate-100 cursor-pointer shadow-sm hover:scale-110 transition shrink-0">
          ${s.photo ? `<img src="${s.photo}" alt="${s.name}" class="w-full h-full object-cover">` : `<span class="w-full h-full flex items-center justify-center font-bold text-xs text-slate-400">No</span>`}
        </div>
      </td>
      <td class="p-3 font-mono font-bold text-blue-700">${s.id}</td>
      <td class="p-3 font-bold text-slate-900 cursor-pointer hover:text-blue-600 transition" onclick="openStudentProfileModal('${s.id}')">
        ${s.name} <i class="fa-solid fa-arrow-up-right-from-square text-[9px] text-blue-500 ml-1"></i>
        <br><span class="text-[10px] text-slate-500 font-normal">Father: ${s.father}</span>
      </td>
      <td class="p-3 text-emerald-700 font-bold">${s.branch || 'Patna'}</td>
      <td class="p-3 font-semibold text-slate-700">${s.course} <span class="text-amber-600 text-[10px]">(B-${s.batch})</span></td>
      <td class="p-3 font-mono text-slate-600">
        <div class="flex items-center gap-1.5">
          <span>${s.mobile}</span>
          <button onclick="sendStudentCredentialsOnWhatsApp('${s.id}')" title="Reset password and send login details on WhatsApp" class="w-6 h-6 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow transition hover:scale-110 interactive-btn">
            <i class="fa-brands fa-whatsapp text-xs"></i>
          </button>
        </div>
      </td>
      <td class="p-3 font-mono text-slate-500">${s.password || '******'}</td>
      <td class="p-3">
        <span class="px-2 py-0.5 rounded-full text-[9px] font-orbitron font-bold ${s.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
          ${s.status}
        </span>
      </td>
      <td class="p-3 text-right whitespace-nowrap space-x-1">
        <button onclick="sendStudentCredentialsOnWhatsApp('${s.id}')" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-orbitron font-bold rounded-lg text-[9px] interactive-btn">
          <i class="fa-brands fa-whatsapp mr-0.5"></i> RESET & SEND
        </button>
        ${s.status === 'PENDING' ? `
          <button onclick="updateStudentStatus('${s.id}', 'APPROVED')" class="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-orbitron font-bold rounded-lg text-[9px] interactive-btn">APPROVE</button>
          <button onclick="updateStudentStatus('${s.id}', 'REJECTED')" class="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white font-orbitron font-bold rounded-lg text-[9px] interactive-btn">REJECT</button>
        ` : `
          <button onclick="toggleStudentApproval('${s.id}')" class="text-[11px] font-orbitron text-amber-600 hover:underline">Toggle</button>
        `}
      <button onclick="deleteStudentPermanently('${s.id}')" title="Delete Student" class="ml-1.5 px-2 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"><i class="fa-regular fa-trash-can"></i></button>
      </td>
    </tr>
  `).join('');
}

async function updateStudentStatus(id, newStatus) {
  const students = getStudents();
  const st = students.find(s => s.id === id);
  if (st) {
    try {
      await db.collection('students').doc(st.uid || 'student_' + st.id).update({ status: newStatus });
      st.status = newStatus;
      saveStudents(students);
      renderAdminStudentsTable();
      showToast(`Candidate marked as ${newStatus}.`, true);
    } catch (error) { 
      showToast(error.message || 'Could not update student status.', false); 
    }
  }
}

async function toggleStudentApproval(id) {
  const students = getStudents();
  const st = students.find(s => s.id === id);
  if (st) await updateStudentStatus(id, st.status === 'APPROVED' ? 'PENDING' : 'APPROVED');
}

function getLiveQuizCurrentState(exam) {
  if (!exam || !exam.isLiveQuiz || !exam.liveStartTime) return null;
  const startTime = new Date(exam.liveStartTime).getTime();
  const perQSec = Number(exam.perQuestionSeconds) || 30;
  const totalQuestions = exam.questions.length;
  const endTime = startTime + (totalQuestions * perQSec * 1000);
  const now = Date.now();
  if (now < startTime) return { status: 'UPCOMING', diffSeconds: Math.ceil((startTime - now) / 1000), startTime };
  if (now >= endTime) return { status: 'ENDED' };
  const elapsedMs = now - startTime;
  const currentQIndex = Math.floor(elapsedMs / (perQSec * 1000));
  const remainingQSeconds = perQSec - Math.floor((elapsedMs % (perQSec * 1000)) / 1000);
  return { status: 'RUNNING', currentQIndex: Math.min(currentQIndex, totalQuestions - 1), remainingQSeconds, perQSec };
}

function startLiveSynchronizedEngine() {
  clearInterval(liveQuizTickInterval);
  clearInterval(examSpeedTimerInterval);
  liveQuizTickInterval = setInterval(() => {
    if (!currentExamSession) return;
    if (currentExamSession.isLiveQuiz) {
      const state = getLiveQuizCurrentState(currentExamSession.examMeta);
      if (!state || state.status === 'ENDED') { finalizeExamSubmission(); return; }
      if (state.status === 'RUNNING') {
        if (currentExamSession.currentIndex !== state.currentQIndex) { currentExamSession.currentIndex = state.currentQIndex; loadTargetQuestionData(); }
        questionTimeRemaining = state.remainingQSeconds;
        updateCountdownTimerUI();
        AudioEngine.tick();
      }
    } else {
      questionTimeRemaining--;
      if (questionTimeRemaining < 0) questionTimeRemaining = 0;
      updateCountdownTimerUI();
      AudioEngine.tick();
      if (questionTimeRemaining <= 0) {
        if (currentExamSession.currentIndex < currentExamSession.questions.length - 1) {
          currentExamSession.currentIndex++;
          questionTimeRemaining = PER_QUESTION_SECONDS;
          loadTargetQuestionData();
          updateCountdownTimerUI();
        } else {
          finalizeExamSubmission();
        }
      }
    }
  }, 1000);
}

function toggleScheduledLiveFields() {
  const checkbox = document.getElementById('exam-is-live-quiz');
  const panel = document.getElementById('live-quiz-time-config');
  if (checkbox && panel) panel.classList.toggle('hidden', !checkbox.checked);
}

async function deleteStudentPermanently(studentId) {
  const students = getStudents();
  const student = students.find(s => s.id === studentId);
  if (!student || !confirm(`Permanently delete candidate ${student.name} (${student.id}) and all results?`)) return;
  try {
    await db.collection('students').doc(student.uid || 'student_' + student.id).delete();
    const resultsSnap = await db.collection('results').where('studentId', '==', studentId).get();
    resultsSnap.docs.forEach(doc => doc.ref.delete());

    saveStudents(students.filter(s => s.id !== studentId));
    saveResults(getResults().filter(r => r.studentId !== studentId));
    renderAdminStudentsTable();
    renderLeaderboardTable();
    updateGlobalBadges();
    showToast(`Student ${student.name} deleted.`, true);
  } catch (error) { 
    showToast(error.message || 'Could not delete student.', false); 
  }
}

function loadSoundConfigInAdmin() {
  const c = getAudioConfig();
  document.getElementById('audio-mode-select').value = c.mode || 'synthesizer';
  document.getElementById('snd-tick').value = c.tick || '';
  document.getElementById('snd-click').value = c.click || '';
  document.getElementById('snd-warn').value = c.warn || '';
  document.getElementById('snd-success').value = c.success || '';
}

function saveCustomSoundSettings(e) {
  e.preventDefault();
  saveAudioConfig({
    mode: document.getElementById('audio-mode-select').value,
    tick: document.getElementById('snd-tick').value.trim(),
    click: document.getElementById('snd-click').value.trim(),
    warn: document.getElementById('snd-warn').value.trim(),
    success: document.getElementById('snd-success').value.trim()
  });
  showToast('Audio configuration saved!');
}

function testCurrentAudio() { AudioEngine.click(); setTimeout(() => AudioEngine.success(), 300); }

// SECURE BROWSER-SIDE START (Answer Keys Stripped from Client Session)
async function startCBTExam(examId) {
  const exams = getExams();
  const exam = exams.find(e => e.id === examId);
  if (!exam) return;

  if (exam.isLiveQuiz) {
    const liveState = getLiveQuizCurrentState(exam);
    if (liveState && liveState.status === 'UPCOMING') {
      showToast(`This Live Quiz begins at ${new Date(exam.liveStartTime).toLocaleTimeString()}`, false);
      return;
    }
    if (liveState && liveState.status === 'ENDED') {
      showToast("This scheduled live quiz has already ended.", false);
      return;
    }
  }

  // Request Fullscreen for Anti-Cheat at home
  try {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  } catch (e) {}

  antiCheatStrikes = 0;
  questionTimeRemaining = Number(exam.perQuestionSeconds) || PER_QUESTION_SECONDS;

  // STRIP CORRECT ANSWERS FROM MEMORY DURING THE EXAM
  const sanitizedQuestions = (exam.questions || []).map((q, idx) => ({
    id: q.id || idx,
    question: q.question,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    marks: Number(q.marks) || 1
  }));

  currentExamSession = {
    attemptId: 'ATT_' + Date.now(),
    examId: exam.id, 
    examTitle: exam.title,
    courses: exam.courses || [exam.course], 
    batches: exam.batches || [exam.batch],
    passingMarks: exam.passingMarks, 
    questions: sanitizedQuestions,
    answers: {}, 
    timePerQuestion: {}, 
    questionOpenTimestamp: Date.now(),
    examSessionStartTimestamp: Date.now(), 
    currentIndex: 0,
    isLiveQuiz: !!exam.isLiveQuiz, 
    examMeta: exam
  };

  const mainHeader = document.querySelector('header');
  if (mainHeader) mainHeader.style.display = 'none';

  document.getElementById('platform-main-layout-view').style.display = 'none';
  const quizView = document.getElementById('platform-quiz-interface-view');
  quizView.classList.remove('hidden');
  quizView.style.display = 'flex';

  const pauseControl = document.getElementById('ctrl-pause');
  if (pauseControl) pauseControl.style.display = exam.isLiveQuiz ? 'none' : 'block';

  if (exam.isLiveQuiz) {
    const state = getLiveQuizCurrentState(exam);
    if (state && state.status === 'RUNNING') {
      currentExamSession.currentIndex = state.currentQIndex;
    }
  }

  window.scrollTo({ top: 0, behavior: 'instant' });
  loadTargetQuestionData();
  updateCountdownTimerUI();
  if (currentExamSession.isLiveQuiz) {
    startLiveSynchronizedEngine();
  } else {
    startCountdownTimerLoop();
  }
}

function loadTargetQuestionData() {
  const idx = currentExamSession.currentIndex;
  const q = currentExamSession.questions[idx];
  currentExamSession.questionOpenTimestamp = Date.now();

  document.getElementById('quiz-question-text-field').innerHTML = `
    <span class="text-cyan-400 font-mono font-black text-base sm:text-lg mr-2">Q${idx + 1}.</span>
    <span class="text-white">${q.question ?? q.text ?? q.questionText ?? 'Question unavailable'}</span>
  `;
  
  const answeredCount = Object.keys(currentExamSession.answers).length;
  document.getElementById('score-status-label').innerText = `Question: ${idx + 1}/${currentExamSession.questions.length} | Answered: ${answeredCount}`;

  const options = [
    { label: 'A', text: q.optionA ?? q.options?.[0] ?? q.option1 ?? '', index: 0 },
    { label: 'B', text: q.optionB ?? q.options?.[1] ?? q.option2 ?? '', index: 1 },
    { label: 'C', text: q.optionC ?? q.options?.[2] ?? q.option3 ?? '', index: 2 },
    { label: 'D', text: q.optionD ?? q.options?.[3] ?? q.option4 ?? '', index: 3 }
  ];

  const container = document.getElementById('quiz-options-grid-container');
  container.innerHTML = options.map(opt => {
    const isSelected = currentExamSession.answers[idx] === opt.label;
    return `
      <div onclick="selectOptionIndex(${opt.index}, '${opt.label}')" class="cbt-option-card ${isSelected ? 'selected' : ''}">
        <span class="option-badge w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-orbitron font-bold text-xs shrink-0 transition-colors">${opt.label}</span>
        <span class="flex-1 text-xs sm:text-sm leading-snug">${opt.text}</span>
        ${isSelected ? '<i class="fa-solid fa-circle-check text-emerald-600 text-sm sm:text-base shrink-0"></i>' : ''}
      </div>
    `;
  }).join('');

  renderQuestionPalette();
}

function renderQuestionPalette() {
  const mobileGrid = document.getElementById('mobile-question-palette-grid');
  if (!mobileGrid || !currentExamSession) return;

  let answeredCount = 0;
  const buttonsHtml = currentExamSession.questions.map((_, i) => {
    const isAnswered = currentExamSession.answers[i] !== undefined;
    if (isAnswered) answeredCount++;
    const isCurrent = currentExamSession.currentIndex === i;

    let cls = 'bg-slate-700 text-slate-300 hover:bg-slate-600';
    if (isAnswered) cls = 'bg-emerald-600 text-white font-bold';
    if (isCurrent) cls += ' ring-2 ring-cyan-400 ring-offset-1 ring-offset-slate-900';

    return `<button onclick="jumpToPaletteQuestion(${i})" class="w-full h-9 rounded-lg font-orbitron text-xs transition flex items-center justify-center ${cls}">${i + 1}</button>`;
  }).join('');

  mobileGrid.innerHTML = buttonsHtml;

  const launcherCount = document.getElementById('palette-launcher-count');
  if (launcherCount) {
    launcherCount.innerText = `${answeredCount}/${currentExamSession.questions.length}`;
  }
}

function jumpToPaletteQuestion(targetIdx) {
  if (!currentExamSession) return;
  currentExamSession.currentIndex = targetIdx;
  loadTargetQuestionData();
  toggleMobileQuestionPalette(false);
}

function toggleMobileQuestionPalette(show) {
  const modal = document.getElementById('mobile-question-palette-modal');
  if (!modal) return;
  modal.classList.toggle('hidden', !show);
  modal.classList.toggle('flex', !!show);
}

function updateCountdownTimerUI() {
  document.getElementById('timer-text').innerText = questionTimeRemaining;
  const bar = document.getElementById('timer-bar');
  if (bar) {
    bar.style.strokeDashoffset = circ - (questionTimeRemaining / PER_QUESTION_SECONDS) * circ;
  }
}

function startCountdownTimerLoop() {
  clearInterval(examSpeedTimerInterval);
  examSpeedTimerInterval = setInterval(() => {
    if (!currentExamSession) return;
    questionTimeRemaining--;
    if (questionTimeRemaining < 0) questionTimeRemaining = 0;
    updateCountdownTimerUI();

    AudioEngine.tick();

    if (questionTimeRemaining <= 0) {
      clearInterval(examSpeedTimerInterval);
      navigateToNextQuestion(true);
    }
  }, 1000);
}

function toggleTimerPauseContextState() {
  const btn = document.getElementById('ctrl-pause');
  if (btn.innerText === "PAUSE") {
    clearInterval(examSpeedTimerInterval);
    btn.innerText = "RESUME";
  } else {
    startCountdownTimerLoop();
    btn.innerText = "PAUSE";
  }
}

function reloadCountdownTimerContextValue() {
  questionTimeRemaining = PER_QUESTION_SECONDS;
  updateCountdownTimerUI();
  startCountdownTimerLoop();
}

function selectOptionIndex(idx, label) {
  if (!currentExamSession) return;
  currentExamSession.answers[currentExamSession.currentIndex] = label;
  AudioEngine.playTone(600, 'sine', 0.08, 0.05);
  loadTargetQuestionData();
}

function navigateToPreviousQuestion() {
  if (!currentExamSession || currentExamSession.currentIndex <= 0) return;
  currentExamSession.currentIndex--;
  loadTargetQuestionData();
}

function navigateToNextQuestion(autoAdvance = false) {
  if (!currentExamSession) return;
  if (currentExamSession.currentIndex < currentExamSession.questions.length - 1) {
    currentExamSession.currentIndex++;
    if (!currentExamSession.isLiveQuiz) questionTimeRemaining = Number(currentExamSession.examMeta?.perQuestionSeconds) || PER_QUESTION_SECONDS;
    loadTargetQuestionData();
    updateCountdownTimerUI();
    if (!currentExamSession.isLiveQuiz) startCountdownTimerLoop();
  } else {
    finalizeExamSubmission();
  }
}

function triggerHomeRedirectionButton() {
  toggleMobileQuestionPalette(false);
  if (confirm("Are you sure you want to finish and submit your exam now?")) finalizeExamSubmission();
}

async function finalizeExamSubmission() {
  clearInterval(examSpeedTimerInterval);
  clearInterval(liveQuizTickInterval);
  if (!currentExamSession || !currentStudentUser) { activateStudentPortal(); return; }

  const session = currentExamSession;
  
  // Exit Fullscreen
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  } catch (e) {}

  // Fetch real master questions to calculate score securely
  let masterQuestions = session.examMeta?.questions || [];
  if (!masterQuestions.length) {
    const freshExamSnap = await db.collection('exams').doc(session.examId).get();
    if (freshExamSnap.exists) masterQuestions = freshExamSnap.data().questions || [];
  }

  let score = 0;
  let totalMarks = 0;

  const breakdown = masterQuestions.map((q, idx) => {
    const studentAns = session.answers[idx] || null;
    const correctAns = String(q.correct || 'A').toUpperCase();
    const marks = Number(q.marks) || 1;
    totalMarks += marks;
    const isCorrect = studentAns === correctAns;
    if (isCorrect) score += marks;

    return {
      question: q.question,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      studentAns: studentAns,
      correct: correctAns,
      marks: marks,
      isCorrect: isCorrect,
      explanation: q.explanation || ''
    };
  });

  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const isPassed = percentage >= (session.passingMarks || 40);
  const resultId = 'RES_' + Date.now();

  const newResult = {
    id: resultId,
    resultId: resultId,
    studentId: currentStudentUser.id,
    studentName: currentStudentUser.name,
    fatherName: currentStudentUser.father,
    branch: currentStudentUser.branch || 'Patna',
    examId: session.examId,
    examTitle: session.examTitle,
    course: currentStudentUser.course,
    batch: currentStudentUser.batch,
    score: score,
    totalMarks: totalMarks,
    percentage: percentage,
    passingMarks: session.passingMarks || 40,
    isPassed: isPassed,
    status: isPassed ? 'PASSED' : 'FAILED',
    date: new Date().toLocaleDateString(),
    breakdown: breakdown
  };

  try {
    // Database me result save karein
    await db.collection('results').doc(resultId).set(newResult);

    const results = getResults().filter(r => !(r.studentId === newResult.studentId && r.examId === newResult.examId));
    results.unshift(newResult);
    saveResults(results);
    lastExamResultId = resultId;

    // UI Reset
    const quizView = document.getElementById('platform-quiz-interface-view');
    if (quizView) { quizView.classList.add('hidden'); quizView.style.display = 'none'; }
    const mainHeader = document.querySelector('header');
    if (mainHeader) mainHeader.style.display = '';

    activateStudentPortal();
    loadStudentDashboard();
    renderLeaderboardTable();

    // LIVE QUIZ vs NORMAL EXAM LOGIC
    if (session.isLiveQuiz) {
      const perQSec = Number(session.examMeta?.perQuestionSeconds) || 15;
      const totalExamSeconds = session.questions.length * perQSec;
      const elapsedSeconds = Math.floor((Date.now() - session.examSessionStartTimestamp) / 1000);
      const remainingWaitSeconds = Math.max(0, totalExamSeconds - elapsedSeconds);

      currentExamSession = null;

      if (remainingWaitSeconds > 0) {
        showToast(`Live Quiz Submitted! Answers & Scorecard unlock in ${remainingWaitSeconds} seconds.`, true, "SUBMISSION RECORDED");

        // Automatic Unlock after official time completes
        setTimeout(() => {
          showToast("Official Quiz Time Ended! Here is your Scorecard.", true, "QUIZ COMPLETE");
          viewGrandScorecardReview(resultId);
        }, remainingWaitSeconds * 1000);
      } else {
        // Time already over
        viewGrandScorecardReview(resultId);
      }
    } else {
      // Normal Exam: Instant Scorecard and Review
      currentExamSession = null;
      viewGrandScorecardReview(resultId);
      showToast(`Exam submitted! Score: ${score}/${totalMarks} (${percentage}%)`, isPassed);
    }

  } catch (error) {
    showToast('Submission error: ' + error.message, false);
  }
}

function viewGrandScorecardReview(resultId) {
  const results = getResults();
  const res = results.find(r => r.resultId === resultId);
  if (!res) return;

  lastExamResultId = res.resultId;

  document.getElementById('gr-exam-title').innerText = res.examTitle;
  document.getElementById('gr-student-name').innerText = res.studentName;
  document.getElementById('gr-student-id').innerText = res.studentId;
  document.getElementById('gr-score').innerText = `${res.score} / ${res.totalMarks}`;
  document.getElementById('gr-percentage').innerText = `${res.percentage}%`;

  const statusEl = document.getElementById('gr-status');
  statusEl.innerText = res.status;
  statusEl.className = res.status === 'PASSED' ? 'font-orbitron text-xs sm:text-base font-black text-emerald-600 mt-1' : 'font-orbitron text-xs sm:text-base font-black text-rose-600 mt-1';

  let grade = res.percentage >= 80 ? 'Distinction' : (res.percentage >= 60 ? 'First Class' : 'Pass Class');
  document.getElementById('gr-grade').innerText = grade;

  const allForExam = results.filter(r => r.examId === res.examId).sort((a,b) => b.percentage - a.percentage);
  const myRank = allForExam.findIndex(r => r.studentId === res.studentId) + 1;
  document.getElementById('gr-rank-badge').innerText = `Rank #${myRank || 1}`;
  document.getElementById('gr-total-takers').innerText = `Out of ${allForExam.length}`;

  const container = document.getElementById('gr-solutions-container');
  const breakdown = res.breakdown || [];

  if (breakdown.length === 0) {
    container.innerHTML = `<div class="p-3 text-center text-xs text-slate-400">Detailed question log not saved for this record.</div>`;
  } else {
    container.innerHTML = breakdown.map((item, i) => {
      const getFullText = (optKey) => {
        if (!optKey) return 'Skipped';
        const k = String(optKey).trim().toUpperCase();
        if (k === 'A') return `(A) ${item.optionA}`;
        if (k === 'B') return `(B) ${item.optionB}`;
        if (k === 'C') return `(C) ${item.optionC}`;
        if (k === 'D') return `(D) ${item.optionD}`;
        return optKey;
      };

      const userText = getFullText(item.studentAns);
      const correctText = getFullText(item.correct);

      return `
        <div class="p-3 rounded-xl border ${item.isCorrect ? 'bg-emerald-50/70 border-emerald-300' : 'bg-rose-50/70 border-rose-300'} text-xs space-y-1.5">
          <div class="flex justify-between items-start gap-2">
            <span class="font-bold text-slate-900 leading-snug">Q${i + 1}: ${item.question}</span>
            <span class="px-2 py-0.5 rounded text-[9px] font-bold ${item.isCorrect ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'} shrink-0">
              ${item.isCorrect ? '+ ' + item.marks + ' Mark' : '0 Mark'}
            </span>
          </div>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-600 bg-white/80 p-2 rounded-lg border border-slate-200">
            <div class="${item.correct === 'A' ? 'font-bold text-emerald-700' : ''}">A. ${item.optionA}</div>
            <div class="${item.correct === 'B' ? 'font-bold text-emerald-700' : ''}">B. ${item.optionB}</div>
            <div class="${item.correct === 'C' ? 'font-bold text-emerald-700' : ''}">C. ${item.optionC}</div>
            <div class="${item.correct === 'D' ? 'font-bold text-emerald-700' : ''}">D. ${item.optionD}</div>
          </div>

          <div class="pt-1.5 border-t border-slate-200 flex flex-col sm:flex-row justify-between gap-0.5 text-[11px]">
            <span>Your Selection: <strong class="${item.isCorrect ? 'text-emerald-700' : 'text-rose-700 font-bold'}">${userText}</strong></span>
            <span>Correct: <strong class="text-emerald-700 font-bold">${correctText}</strong></span>
          </div>

          ${item.explanation ? `
            <div class="p-2 bg-blue-50/90 border border-blue-200 rounded-lg text-[10px] sm:text-[11px] text-blue-900 leading-relaxed">
              <strong class="font-orbitron text-blue-700 uppercase text-[9px] block mb-0.5">
                <i class="fa-solid fa-lightbulb text-amber-500 mr-1"></i> Explanation:
              </strong>
              ${item.explanation}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  document.getElementById('grand-result-modal').classList.remove('hidden');
}

function closeGrandResultModal() {
  document.getElementById('grand-result-modal').classList.add('hidden');
}

function openGrandCertificate() {
  closeGrandResultModal();
  if (lastExamResultId) viewCertificate(lastExamResultId);
}

function renderLeaderboardTable() {
  const tbody = document.getElementById('leaderboard-tbody');
  const filterVal = document.getElementById('leaderboard-filter-select').value;
  const allResults = getResults();

  let filtered = [...allResults];
  if (filterVal !== 'ALL') filtered = filtered.filter(r => r.course === filterVal);
  filtered.sort((a, b) => b.percentage - a.percentage);

  if (filtered.length > 0) {
    document.getElementById('podium-rank1-name').innerText = filtered[0].studentName;
    document.getElementById('podium-rank1-score').innerText = `${filtered[0].percentage}%`;
  } else {
    document.getElementById('podium-rank1-name').innerText = "--";
    document.getElementById('podium-rank1-score').innerText = "--";
  }
  if (filtered.length > 1) {
    document.getElementById('podium-rank2-name').innerText = filtered[1].studentName;
    document.getElementById('podium-rank2-score').innerText = `${filtered[1].percentage}%`;
  } else {
    document.getElementById('podium-rank2-name').innerText = "--";
    document.getElementById('podium-rank2-score').innerText = "--";
  }
  if (filtered.length > 2) {
    document.getElementById('podium-rank3-name').innerText = filtered[2].studentName;
    document.getElementById('podium-rank3-score').innerText = `${filtered[2].percentage}%`;
  } else {
    document.getElementById('podium-rank3-name').innerText = "--";
    document.getElementById('podium-rank3-score').innerText = "--";
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-slate-400">No results recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((r, i) => `
    <tr class="hover:bg-slate-50 transition">
      <td class="p-3 font-orbitron font-bold">#${i + 1}</td>
      <td class="p-3 font-bold text-slate-900">${r.studentName}</td>
      <td class="p-3 font-mono text-blue-700 font-bold">${r.studentId}</td>
      <td class="p-3 text-emerald-700 font-bold">${r.branch || 'Patna'}</td>
      <td class="p-3 font-bold">${r.course} <span class="text-amber-600 text-[10px]">(B-${r.batch})</span></td>
      <td class="p-3 text-slate-600">${r.examTitle}</td>
      <td class="p-3 font-mono font-bold">${r.score} / ${r.totalMarks}</td>
      <td class="p-3 font-orbitron font-bold text-blue-700">${r.percentage}%</td>
      <td class="p-3 text-right">
        <span class="px-2 py-0.5 rounded-full text-[9px] font-orbitron font-bold ${r.status === 'PASSED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
          ${r.status}
        </span>
      </td>
    </tr>
  `).join('');
}

function viewCertificate(resultId) {
  const results = getResults();
  const res = results.find(r => r.resultId === resultId);
  if (!res) return;

  document.getElementById('cert-student-name').innerText = res.studentName;
  document.getElementById('cert-father-name').innerText = res.fatherName || 'Guardian';
  document.getElementById('cert-student-id').innerText = res.studentId;
  document.getElementById('cert-course-name').innerText = `${res.course} (BATCH ${res.batch})`;
  document.getElementById('cert-batch-no').innerText = res.batch;
  document.getElementById('cert-score-marks').innerText = `${res.score} / ${res.totalMarks}`;
  document.getElementById('cert-percentage').innerText = `${res.percentage}%`;
  document.getElementById('cert-issue-date').innerText = `Date: ${res.date}`;

  let grade = res.percentage >= 80 ? 'A+ (Distinction)' : (res.percentage >= 60 ? 'A (First Class)' : 'B (Pass)');
  document.getElementById('cert-grade').innerText = grade;

  const qrContainer = document.getElementById('cert-qr-code');
  qrContainer.innerHTML = '';
  try {
    new QRCode(qrContainer, {
      text: `https://fbca.co.in/verify?roll=${res.studentId}&score=${res.percentage}%`,
      width: 48,
      height: 48
    });
  } catch (e) {}

  document.getElementById('certificate-modal').classList.remove('hidden');
}
function closeCertificateModal() { document.getElementById('certificate-modal').classList.add('hidden'); }

function activateStudentPortal() {
  currentPortal = 'student';
  const mainLayout = document.getElementById('platform-main-layout-view');
  if (mainLayout) {
    mainLayout.classList.remove('hidden');
    mainLayout.style.display = '';
  }
  const adminPortal = document.getElementById('admin-portal');
  if (adminPortal) {
    adminPortal.classList.add('hidden');
    adminPortal.style.display = 'none';
  }
  const quizView = document.getElementById('platform-quiz-interface-view');
  if (quizView) {
    quizView.classList.add('hidden');
    quizView.style.display = 'none';
  }
  const mainHeader = document.querySelector('header');
  if (mainHeader) mainHeader.style.display = '';

  document.getElementById('nav-student-btn').className = "px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-orbitron font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md flex items-center gap-2 interactive-btn";
  document.getElementById('nav-admin-btn').className = "px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-orbitron font-bold rounded-xl text-slate-200 bg-slate-900 border border-slate-700/80 hover:border-amber-500 hover:text-white flex items-center gap-2 relative interactive-btn";
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function requestAdminPortalAccess() {
  if (isAdminAuthenticated) openAdminDashboardDirect();
  else {
    document.getElementById('admin-auth-error').classList.add('hidden');
    document.getElementById('admin-auth-modal').classList.remove('hidden');
  }
}
function closeAdminAuthModal() { document.getElementById('admin-auth-modal').classList.add('hidden'); }

async function handleAdminLogin(e) {
  e.preventDefault();
  const emailInput = document.getElementById('admin-email-input');
  const passwordInput = document.getElementById('admin-pass-input');
  const errorBox = document.getElementById('admin-auth-error');
  const submitButton = document.getElementById('admin-login-submit');
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  errorBox.classList.add('hidden');
  submitButton.disabled = true;
  submitButton.textContent = 'VERIFYING...';

  try {
    const credential = await auth.signInWithEmailAndPassword(email, password);
    const user = credential.user;
    if (!user) throw new Error('Firebase did not return an authenticated user.');

    isAdminAuthenticated = true;
    await refreshAdminData();
    passwordInput.value = '';
    closeAdminAuthModal();
    openAdminDashboardDirect();
    showToast('Admin sign-in successful.', true);
  } catch (error) {
    isAdminAuthenticated = false;
    errorBox.textContent = error.message || 'Could not sign in as admin.';
    errorBox.classList.remove('hidden');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'SIGN IN SECURELY';
  }
}

function openAdminDashboardDirect() {
  currentPortal = 'admin';
  const mainLayout = document.getElementById('platform-main-layout-view');
  if (mainLayout) {
    mainLayout.classList.add('hidden');
    mainLayout.style.display = 'none';
  }
  const adminPortal = document.getElementById('admin-portal');
  if (adminPortal) {
    adminPortal.classList.remove('hidden');
    adminPortal.style.display = 'block';
  }
  const lockBtn = document.getElementById('admin-logout-quick-btn');
  if (lockBtn) {
    lockBtn.classList.remove('hidden');
    lockBtn.classList.add('flex');
  }
  document.getElementById('nav-student-btn').className = "px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-orbitron font-bold rounded-xl text-slate-200 bg-slate-900 border border-slate-700 hover:text-white flex items-center gap-2 interactive-btn";
  document.getElementById('nav-admin-btn').className = "px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs font-orbitron font-bold rounded-xl text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md flex items-center gap-2 relative interactive-btn";

  renderAdminStudentsTable();
  renderAdminExamsList();
  populateDynamicDropdowns();
  renderBrandingImages();
  renderContactFooter();
  updateGlobalBadges();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

async function logoutAdmin() {
  isAdminAuthenticated = false;
  const lockButton = document.getElementById('admin-logout-quick-btn');
  if (lockButton) {
    lockButton.classList.add('hidden');
    lockButton.classList.remove('flex');
  }
  activateStudentPortal();
  try {
    await auth.signOut();
  } catch (error) {}
  showToast('Admin session locked.');
}

function switchAdminTab(tab) {
  document.getElementById('admin-tab-approvals').classList.toggle('hidden', tab !== 'approvals');
  document.getElementById('admin-tab-exams').classList.toggle('hidden', tab !== 'exams');
  document.getElementById('admin-tab-masters').classList.toggle('hidden', tab !== 'masters');
  document.getElementById('admin-tab-branding').classList.toggle('hidden', tab !== 'branding');
  document.getElementById('admin-tab-contact').classList.toggle('hidden', tab !== 'contact');
  document.getElementById('admin-tab-sounds').classList.toggle('hidden', tab !== 'sounds');
  if (tab === 'sounds') loadSoundConfigInAdmin();

  const tabs = ['approvals', 'exams', 'sounds', 'masters', 'branding', 'contact'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    if (btn) {
      btn.className = (tab === t) 
        ? "pb-2 text-xs font-orbitron font-bold border-b-2 border-blue-600 text-blue-600 flex items-center gap-1.5"
        : "pb-2 text-xs font-orbitron font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-900 flex items-center gap-1.5";
    }
  });
}

function updateGlobalBadges() {
  const students = getStudents();
  const pendingCount = students.filter(s => s.status === 'PENDING').length;
  const navBadge = document.getElementById('nav-pending-badge');
  if (navBadge) navBadge.innerText = pendingCount;
  const adminBadge = document.getElementById('admin-pending-tab-badge');
  if (adminBadge) adminBadge.innerText = pendingCount;
  const totalStudents = document.getElementById('stat-total-students');
  if (totalStudents) totalStudents.innerText = String(students.length).padStart(2, '0');
  const activeTests = document.getElementById('stat-active-tests');
  if (activeTests) activeTests.innerText = String(getExams().length).padStart(2, '0');
}

function renderAdminExamsList() {
  const container = document.getElementById('admin-exams-list');
  if (!container) return;
  const exams = getExams();
  if (exams.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">No exams published yet in Cloud.</div>`;
    return;
  }
  container.innerHTML = exams.map(exam => {
    const cLabels = Array.isArray(exam.courses) ? exam.courses.join(', ') : exam.course;
    const bLabels = Array.isArray(exam.batches) ? exam.batches.join(', ') : exam.batch;
    const isActive = exam.active !== false;

    return `
      <div class="bg-white p-3.5 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 text-xs shadow-sm">
        <div>
          <div class="flex items-center gap-1.5 mb-1">
            <span class="font-bold text-blue-700">${cLabels}</span>
            <span class="text-amber-600 font-bold">&bull; [B-${bLabels}]</span>
            <span class="px-1.5 py-0.2 rounded text-[9px] font-bold ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}">
              ${isActive ? 'LIVE' : 'OFF'}
            </span>
          </div>
          <h4 class="font-bold text-slate-900 text-xs sm:text-sm">${exam.title}</h4>
          <div class="text-[10px] text-slate-500">${exam.questions.length} Questions &bull; ${exam.duration} Mins</div>
        </div>

        <div class="flex items-center gap-1.5 self-end sm:self-center">
          <button onclick="toggleExamActiveStatus('${exam.id}')" class="px-2.5 py-1 rounded-lg font-orbitron font-bold text-[10px] transition interactive-btn ${isActive ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}">
            ${isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button onclick="openEditExamModal('${exam.id}')" class="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-orbitron font-bold text-[10px] border border-blue-200 interactive-btn">
            Edit
          </button>
          <button onclick="deleteTargetExam('${exam.id}')" class="text-rose-500 hover:text-rose-700 p-1.5"><i class="fa-regular fa-trash-can"></i></button>
        </div>
      </div>
    `;
  }).join('');
}

async function toggleExamActiveStatus(examId) {
  const exams = getExams();
  const exam = exams.find(e => e.id === examId);
  if (!exam) return;
  const previous = exam.active;
  exam.active = exam.active === false ? true : false;
  try { 
    await saveExams(exams); 
    renderAdminExamsList(); 
    showToast(`Exam marked as ${exam.active ? 'ACTIVE' : 'DEACTIVATED'}.`, true); 
  } catch (error) { 
    exam.active = previous; 
    showToast(error.message || 'Could not update exam.', false); 
  }
}

function openEditExamModal(examId) {
  const exams = getExams();
  const exam = exams.find(e => e.id === examId);
  if (!exam) return;

  const masters = getMasters();
  document.getElementById('edit-exam-id').value = exam.id;
  document.getElementById('edit-modal-exam-title').innerText = exam.title;

  const curCourses = Array.isArray(exam.courses) ? exam.courses : [exam.course];
  const curBatches = Array.isArray(exam.batches) ? exam.batches : [String(exam.batch)];

  const cWrap = document.getElementById('edit-exam-courses-wrap');
  cWrap.innerHTML = (masters.courses || []).map(c => `
    <label class="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-lg cursor-pointer hover:border-blue-500 font-semibold text-xs interactive-btn">
      <input type="checkbox" name="edit-courses" value="${c}" ${curCourses.includes(c) ? 'checked' : ''} class="rounded text-blue-600">
      <span>${c}</span>
    </label>
  `).join('');

  const bWrap = document.getElementById('edit-exam-batches-wrap');
  bWrap.innerHTML = (masters.batches || []).map(b => `
    <label class="flex items-center gap-1.5 bg-white border border-slate-200 px-2 py-1 rounded-lg cursor-pointer hover:border-amber-500 font-semibold text-xs interactive-btn">
      <input type="checkbox" name="edit-batches" value="${b}" ${curBatches.includes(String(b)) ? 'checked' : ''} class="rounded text-amber-600">
      <span>Batch ${b}</span>
    </label>
  `).join('');

  document.getElementById('edit-exam-modal').classList.remove('hidden');
}

function closeEditExamModal() {
  document.getElementById('edit-exam-modal').classList.add('hidden');
}

async function saveEditedExamConfig(e) {
  e.preventDefault();
  const examId = document.getElementById('edit-exam-id').value;
  const selectedCourses = Array.from(document.querySelectorAll('input[name="edit-courses"]:checked')).map(cb => cb.value);
  const selectedBatches = Array.from(document.querySelectorAll('input[name="edit-batches"]:checked')).map(cb => cb.value);

  if (selectedCourses.length === 0 || selectedBatches.length === 0) {
    showToast("Please select at least 1 course and 1 batch.", false);
    return;
  }

  let exams = getExams();
  const exam = exams.find(e => e.id === examId);
  if (exam) {
    exam.courses = selectedCourses;
    exam.batches = selectedBatches;
    try { 
      await saveExams(exams); 
      closeEditExamModal(); 
      renderAdminExamsList(); 
      showToast("Exam allocations updated.", true); 
    } catch (error) { 
      showToast(error.message || 'Could not save exam allocation.', false); 
    }
  }
}

async function deleteTargetExam(examId) {
  if (!confirm('Delete this exam? Existing result records will remain in the results archive.')) return;
  const exams = getExams().filter(e => e.id !== examId);
  try { 
    await saveExams(exams); 
    renderAdminExamsList(); 
    showToast("Exam deleted.", true); 
  } catch (error) { 
    showToast(error.message || 'Could not delete exam.', false); 
  }
}

async function handleCreateExam(e) {
  e.preventDefault();
  const title = document.getElementById('exam-title').value.trim();
  const duration = Number(document.getElementById('exam-duration').value) || 15;
  const passing = Number(document.getElementById('exam-passing').value) || 40;
  const isLiveQuiz = document.getElementById('exam-is-live-quiz').checked;

  const selectedCourses = Array.from(document.querySelectorAll('input[name="target-courses"]:checked')).map(cb => cb.value);
  const selectedBatches = Array.from(document.querySelectorAll('input[name="target-batches"]:checked')).map(cb => cb.value);

  if (selectedCourses.length === 0 || selectedBatches.length === 0) {
    showToast("Please select at least 1 course and 1 batch.", false);
    return;
  }
  if (pendingExamQuestions.length === 0) {
    showToast("Upload an Excel file with questions!", false);
    return;
  }

  let liveStartTime = null;
  let perQuestionSeconds = 30;
  if (isLiveQuiz) {
    liveStartTime = document.getElementById('exam-live-start-time').value;
    perQuestionSeconds = Number(document.getElementById('exam-per-q-seconds').value) || 30;
    if (!liveStartTime) {
      showToast("Set the exact Live Quiz date & time!", false);
      return;
    }
  }

  const newExam = {
    id: 'EXAM_' + Date.now(),
    title,
    courses: selectedCourses,
    batches: selectedBatches,
    duration,
    passingMarks: passing,
    isLiveQuiz,
    liveStartTime,
    perQuestionSeconds,
    active: true,
    questions: [...pendingExamQuestions],
    createdAt: new Date().toISOString()
  };

  const exams = getExams();
  exams.unshift(newExam);
  try { 
    await saveExams(exams); 
  } catch (error) { 
    showToast(error.message || 'Exam could not be published.', false); 
    return; 
  }

  document.getElementById('create-exam-form').reset();
  pendingExamQuestions = [];
  document.getElementById('parsed-status-box').classList.add('hidden');
  toggleScheduledLiveFields();
  renderAdminExamsList();
  showToast(isLiveQuiz ? "Scheduled Live Quiz Published to Batches!" : "Exam published successfully!", true);
}

function handleExcelUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const raw = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      
      pendingExamQuestions = raw.map(row => {
        const findKey = (candidates) => {
          for (let k of Object.keys(row)) {
            if (candidates.includes(k.trim().toLowerCase())) return row[k];
          }
          return null;
        };

        const qText = findKey(['questiontext', 'question', 'qtext', 'ques']) || "Question";
        const opA = findKey(['optiona', 'a', 'opta', 'opt_a']) || "Option A";
        const opB = findKey(['optionb', 'b', 'optb', 'opt_b']) || "Option B";
        const opC = findKey(['optionc', 'c', 'optc', 'opt_c']) || "Option C";
        const opD = findKey(['optiond', 'd', 'optd', 'opt_d']) || "Option D";
        const corr = String(findKey(['correctoption', 'correct', 'answer', 'ans', 'corroption']) || "A").trim().toUpperCase();
        const mrk = Number(findKey(['marks', 'mark', 'points']) || 1);
        const exp = findKey(['explanation', 'explain', 'desc', 'solution']) || "";

        return {
          question: String(qText),
          optionA: String(opA),
          optionB: String(opB),
          optionC: String(opC),
          optionD: String(opD),
          correct: corr,
          marks: mrk,
          explanation: String(exp)
        };
      }).filter(q => q.question && q.question !== "Question");

      if (pendingExamQuestions.length > 0) {
        document.getElementById('parsed-status-box').classList.remove('hidden');
        document.getElementById('parsed-count').innerText = pendingExamQuestions.length;
        showToast(`Loaded ${pendingExamQuestions.length} Questions!`, true);
      } else {
        showToast("No valid question rows found.", false);
      }
    } catch (err) {
      showToast("Failed to parse Excel file.", false);
    }
  };
  reader.readAsArrayBuffer(file);
}

function downloadSampleExcel() {
  const sample = [
    ["QuestionText", "OptionA", "OptionB", "OptionC", "OptionD", "CorrectOption", "Marks", "Explanation"],
    ["What is the shortcut key to save in MS Word?", "Ctrl + S", "Ctrl + P", "Ctrl + C", "Ctrl + V", "A", 1, "Ctrl + S is used to save documents in Microsoft Office."],
    ["RAM stands for what?", "Read Access Memory", "Random Access Memory", "Real Action Memory", "Rapid Audio Module", "B", 1, "RAM stands for Random Access Memory."]
  ];
  const ws = XLSX.utils.aoa_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ExamQuestions");
  XLSX.writeFile(wb, "FBCA_Question_Upload_Template.xlsx");
}

function exportResultsToExcel() {
  const results = getResults();
  if (results.length === 0) {
    showToast("No results available to export.", false);
    return;
  }
  const ws = XLSX.utils.json_to_sheet(results);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Results");
  XLSX.writeFile(wb, `FBCA_Results_${Date.now()}.xlsx`);
  showToast("Results exported to Excel!");
}

function addMasterItem(type) {
  const masters = getMasters();
  let inputId = '';
  if (type === 'branches') inputId = 'new-branch-input';
  if (type === 'courses') inputId = 'new-course-input';
  if (type === 'batches') inputId = 'new-batch-input';
  if (type === 'qualifications') inputId = 'new-qual-input';

  const input = document.getElementById(inputId);
  const val = input.value.trim();
  if (!val) return;
  if (!masters[type].includes(val)) {
    masters[type].push(val);
    saveMasters(masters);
    input.value = '';
    showToast(`Added to ${type}!`);
  }
}

function deleteMasterItem(type, item) {
  const masters = getMasters();
  masters[type] = masters[type].filter(i => i !== item);
  saveMasters(masters);
  showToast(`Removed from ${type}.`);
}

function renderMastersAdminCards() {
  const masters = getMasters();
  const renderList = (id, list, type) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = (list || []).map(item => `
      <div class="flex justify-between items-center bg-slate-50 px-2.5 py-1 rounded-lg border text-xs">
        <span class="font-bold text-slate-800">${item}</span>
        <button onclick="deleteMasterItem('${type}', '${item}')" class="text-rose-500 hover:text-rose-700"><i class="fa-regular fa-trash-can"></i></button>
      </div>
    `).join('');
  };
  
  renderList('branches-list-wrap', masters.branches, 'branches');
  renderList('courses-list-wrap', masters.courses, 'courses');
  renderList('batches-list-wrap', masters.batches, 'batches');
  renderList('quals-list-wrap', masters.qualifications, 'qualifications');

  if (document.getElementById('m-count-branch')) document.getElementById('m-count-branch').innerText = (masters.branches || []).length;
  if (document.getElementById('m-count-course')) document.getElementById('m-count-course').innerText = (masters.courses || []).length;
  if (document.getElementById('m-count-batch')) document.getElementById('m-count-batch').innerText = (masters.batches || []).length;
  if (document.getElementById('m-count-qual')) document.getElementById('m-count-qual').innerText = (masters.qualifications || []).length;
}

function showToast(msg, isSuccess = true, title = "NOTIFICATION") {
  const toast = document.getElementById('toast');
  document.getElementById('toast-title').innerText = title;
  document.getElementById('toast-msg').innerText = msg;
  toast.classList.remove('translate-y-[-160%]', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-[-160%]', 'opacity-0');
  }, 3000);
}

function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  input.type = input.type === 'password' ? 'text' : 'password';
}

function openRulesModal() { document.getElementById('rules-modal').classList.remove('hidden'); }
function closeRulesModal() { document.getElementById('rules-modal').classList.add('hidden'); }
function scrollToLeaderboard() { document.getElementById('leaderboard-section-wrapper').scrollIntoView({ behavior: 'smooth' }); }
function dismissAntiCheatBanner() { document.getElementById('anti-cheat-alert').classList.add('hidden'); }
function dismissWelcomeModal() { document.getElementById('welcome-readiness-modal').classList.add('hidden'); }

// ANTI-CHEAT MONITORING FOR AT-HOME LIVE QUIZ
window.addEventListener('visibilitychange', () => {
  if (currentExamSession && document.hidden) {
    antiCheatStrikes++;
    AudioEngine.warn();
    const alertEl = document.getElementById('anti-cheat-alert');
    if (alertEl) {
      alertEl.classList.remove('hidden');
      document.getElementById('anti-cheat-text').innerText = `WARNING: Tab switch strike ${antiCheatStrikes}/${MAX_ANTI_CHEAT_STRIKES} detected!`;
    }
    if (antiCheatStrikes >= MAX_ANTI_CHEAT_STRIKES) {
      showToast("Maximum penalty strikes reached! Submitting exam...", false);
      finalizeExamSubmission();
    }
  }
});

async function refreshPublicConfig() {
  try {
    const [mastersDoc, settingsDoc, brandingDoc, audioDoc, resultsSnap, studentsSnap] = await Promise.all([
      db.collection('system_config').doc('masters').get(),
      db.collection('system_config').doc('settings').get(),
      db.collection('system_config').doc('branding').get(),
      db.collection('system_config').doc('audio').get(),
      db.collection('results').limit(100).get(),
      db.collection('students').limit(100).get()
    ]);

    if (mastersDoc.exists) localStorage.setItem(STORAGE_KEY_MASTERS, JSON.stringify(mastersDoc.data()));
    if (settingsDoc.exists) localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settingsDoc.data()));
    if (brandingDoc.exists) localStorage.setItem(STORAGE_KEY_BRANDING, JSON.stringify(brandingDoc.data()));
    if (audioDoc.exists) localStorage.setItem(STORAGE_KEY_AUDIO, JSON.stringify(audioDoc.data()));

    const results = resultsSnap.docs.map(d => ({ id: d.id, resultId: d.id, ...d.data() }));
    localStorage.setItem(STORAGE_KEY_RESULTS, JSON.stringify(results));

    const students = studentsSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
    localStorage.setItem(STORAGE_KEY_STUDENTS, JSON.stringify(students));

    populateDynamicDropdowns(); 
    renderBrandingImages(); 
    renderContactFooter(); 
    renderLeaderboardTable();
  } catch (error) {
    console.warn('Public settings loading info:', error.message || error);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  initializeStorage();
  populateDynamicDropdowns();
  renderBrandingImages();
  renderContactFooter();
  updateGlobalBadges();
  activateStudentPortal();
  renderLeaderboardTable();
  switchStudentAuthMode('login');

  refreshPublicConfig();

  setTimeout(() => {
    document.getElementById('welcome-readiness-modal').classList.remove('hidden');
  }, 350);
  // Register Service Worker for PWA (Relative Path)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registered successfully:', reg.scope))
      .catch(err => console.warn('Service Worker registration failed:', err));
  });
}
});
