// --- KONFIGURASI UTAMA ---
const DAILY_LIMIT = 50000;
// KUNCI PENYIMPANAN (Harus Sama Saat Load & Save)
const STORAGE_KEY = "sisaMasa_Master_Fix";

const defaultData = {
  lastOpenDate: "",
  wallet: { currentBalance: DAILY_LIMIT },
  items: [
    {
      id: 1,
      name: "Oli Motor",
      lastReplacement: "2024-12-01",
      maxDays: 60,
      category: "Safety",
      snoozeUntil: "",
    },
  ],
  health: [],
  habits: [],
  transactions: {},
  randomList: [],
  timeline: [],
  goals: [],
  notes: [],
  subs: [],
  journal: [],
  ideas: [],
  theme: "dark",
};

let appData = {};
let myChartInstance = null;
let myActivityChart = null;
let timerInterval = null;
let timeLeft = 25 * 60;

// Playlist Bawaan (Default)
const defaultPlaylists = [
  {
    id: "d1",
    name: "☕ Lofi Girl",
    url: "https://open.spotify.com/embed/playlist/0vvXsWCC9xrXsKd4BgS8ML",
  },
  {
    id: "d2",
    name: "🎹 Calm Piano",
    url: "https://open.spotify.com/embed/playlist/37i9dQZF1DX4sWSpwq3LiO",
  },
  {
    id: "d3",
    name: "🌧️ Rain Sounds",
    url: "https://open.spotify.com/embed/playlist/37i9dQZF1DXbcPC6VvquOE",
  },
];

// --- HELPER FUNCTIONS ---
function getTodayString() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().split("T")[0];
}
function formatRupiah(n) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}
function daysSince(d) {
  if (!d) return 0;
  return Math.floor((new Date() - new Date(d)) / 86400000);
}

// --- CORE FUNCTIONS (FIXED SAVE/LOAD) ---

function initApp() {
  // 1. Ambil data dengan kunci yang BENAR
  const saved = localStorage.getItem(STORAGE_KEY);

  appData = saved
    ? JSON.parse(saved)
    : { ...defaultData, lastOpenDate: getTodayString() };

  // Safety check array
  [
    "goals",
    "notes",
    "subs",
    "journal",
    "ideas",
    "timeline",
    "health",
    "habits",
    "randomList",
    "items",
  ].forEach((k) => {
    if (!appData[k]) appData[k] = [];
  });

  // Terapkan Tema
  if (appData.theme === "light") {
    document.body.classList.add("light-mode");
    setTimeout(() => {
      const icon = document.getElementById("theme-toggle-icon");
      if (icon) icon.innerText = "ON";
    }, 50);
  }

  if (appData.timeline.length === 0) generateDummyHistory();

  selectedDate = getTodayString();
  checkNewDay();
  renderAll();
}

function saveData() {
  // 2. Simpan data dengan kunci yang SAMA
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  renderAll();
}

function generateDummyHistory() {
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    // Acak jumlah aktivitas antara 1 sampai 5 untuk hari ini
    let randomCount = Math.floor(Math.random() * 5) + 1;

    // Buat data sebanyak angka acak tersebut
    for(let j = 0; j < randomCount; j++) {
        appData.timeline.push({
          id: Date.now() - i - (j * 1000), // Bedakan ID
          date: dateStr,
          title: "Aktivitas " + (j + 1),
          desc: "Auto Log",
          type: "finance",
        });
    }
  }
}

function checkNewDay() {
  if (appData.lastOpenDate !== getTodayString()) {
    appData.wallet.currentBalance = DAILY_LIMIT;
    appData.lastOpenDate = getTodayString();
    addToTimeline("🔄 Reset", "Daily Reset", "finance");
    saveData();
  }
}

// --- RENDERERS ---

function renderAll() {
  renderHome();
  renderFullCalendar();
  renderTransactionList();
  renderHealth();
  renderHabits();
  renderRandomList();
  renderSubs();
  renderGoals();
  renderNotes();
  renderJournal();
  renderIdeas();
  renderPlaylists();

  // Delay render chart agar canvas siap
  setTimeout(() => {
    initChart();
    initActivityChart();
  }, 100);
}

// --- MUSIC PLAYER & PLAYLIST LOGIC ---

function renderPlaylists() {
  const selector = document.getElementById("music-selector");
  if (!selector) return;

  selector.innerHTML = ""; // Bersihkan isi dropdown

  // Pastikan array playlists ada
  if (!appData.playlists) appData.playlists = [];

  // Gabungkan playlist bawaan + playlist buatan user
  const allPlaylists = [...defaultPlaylists, ...appData.playlists];

  allPlaylists.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.url;
    opt.innerText = p.name;
    selector.appendChild(opt);
  });

  // Set iframe ke lagu pertama saat pertama kali load
  const iframe = document.getElementById("spotify-frame");
  if (iframe && !iframe.src && allPlaylists.length > 0) {
    iframe.src = allPlaylists[0].url;
  }
}

function changeMusic() {
  const selector = document.getElementById("music-selector");
  const iframe = document.getElementById("spotify-frame");
  if (selector && iframe) {
    iframe.src = selector.value;
  }
}

function addPlaylist() {
  const name = document.getElementById("new-playlist-name").value;
  let url = document.getElementById("new-playlist-url").value;

  if (name && url) {
    // --- AUTO-CONVERTER KE FORMAT EMBED ---
    // Jika user masukin link Spotify biasa
    if (url.includes("spotify.com") && !url.includes("/embed/")) {
      url = url.replace("spotify.com/", "spotify.com/embed/");
    }
    // Jika user masukin link YouTube biasa
    else if (url.includes("youtube.com/watch?v=")) {
      url = url
        .replace("youtube.com/watch?v=", "youtube.com/embed/")
        .split("&")[0];
    }
    // Jika user masukin link YouTube pendek (youtu.be)
    else if (url.includes("youtu.be/")) {
      url = url.replace("youtu.be/", "youtube.com/embed/").split("?")[0];
    }

    // Simpan ke database
    if (!appData.playlists) appData.playlists = [];
    appData.playlists.push({ id: Date.now(), name: name, url: url });
    saveData(); // Auto save & re-render

    // Bersihkan & tutup form
    document.getElementById("new-playlist-name").value = "";
    document.getElementById("new-playlist-url").value = "";
    toggleForm("playlist");

    // Otomatis putar playlist yang baru ditambahkan
    setTimeout(() => {
      const selector = document.getElementById("music-selector");
      selector.value = url;
      changeMusic();
    }, 100);
  } else {
    alert("Nama dan Link tidak boleh kosong!");
  }
}

function renderHome() {
  const elSaldo = document.getElementById("display-saldo");
  if (elSaldo) elSaldo.innerText = formatRupiah(appData.wallet.currentBalance);

  const elMaint = document.getElementById("maintenance-count");
  if (elMaint)
    elMaint.innerText = appData.items.filter(
      (i) => i.maxDays - daysSince(i.lastReplacement) < 0,
    ).length;

  const elEvent = document.getElementById("total-event-count");
  if (elEvent) elEvent.innerText = appData.timeline.length;

  const listEl = document.getElementById("item-list");
  if (listEl) {
    listEl.innerHTML = "";
    appData.items
      .sort(
        (a, b) =>
          a.maxDays -
          daysSince(a.lastReplacement) -
          (b.maxDays - daysSince(b.lastReplacement)),
      )
      .forEach((i) => {
        const gone = daysSince(i.lastReplacement);
        const left = i.maxDays - gone;
        let statusText =
          left < 0
            ? `CRITICAL (${Math.abs(left)}D OVER)`
            : `STABLE (${left}D LEFT)`;
        let statusClass = left < 0 ? "bg-critical" : "bg-stable";
        let barColor = left < 0 ? "#ff5252" : "#00e676";
        let dotColor = left < 0 ? "#ff5252" : "#00e676";
        let pct = Math.min((gone / i.maxDays) * 100, 100);

        listEl.innerHTML += `
            <li class="maintenance-item">
                <div class="m-header">
                    <div class="m-title"><div class="m-dot" style="background:${dotColor}"></div>${i.name}<span class="m-tag">${i.category || "Comfort"}</span></div>
                    <div class="m-status-badge ${statusClass}">${statusText}</div>
                </div>
                <div class="m-progress-line"><div class="m-progress-fill" style="width:${pct}%; background:${barColor}"></div></div>
                <div class="m-controls">
                    <button onclick="snoozeItem(${i.id})" class="btn-control btn-snooze">Delete</button>
                    <button onclick="handleReset(${i.id})" class="btn-control btn-done">✅ Done</button>
                </div>
            </li>`;
      });
  }

  const tl = document.getElementById("timeline-container");
  if (tl) {
    tl.innerHTML = "";
    appData.timeline.slice(0, 5).forEach((ev) => {
      tl.innerHTML += `<div class="timeline-item type-${ev.type}"><div class="t-date">${ev.date}</div><div style="font-size:0.8rem">${ev.title}</div></div>`;
    });
  }
}

// --- CHARTS (LOGIKA TETAP SAMA AGAR TIDAK BERUBAH) ---
function initChart() {
  const canvas = document.getElementById("financeChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 300);
  grad.addColorStop(0, "rgba(124,77,255,0.5)");
  grad.addColorStop(1, "rgba(124,77,255,0)");
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(
      `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`,
    );
    data.push(appData.wallet.currentBalance + (Math.random() * 10000 - 5000));
  }
  if (myChartInstance) myChartInstance.destroy();
  myChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          data,
          borderColor: "#7c4dff",
          backgroundColor: grad,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: false },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#888" } },
        y: { grid: { color: "#2a2a35", borderDash: [5, 5] } },
      },
    },
  });
}

function initActivityChart() {
  const canvas = document.getElementById("activityChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const labels = [];
  const counts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    labels.push(
      `${d.getDate()} ${d.toLocaleString("default", { month: "short" })}`,
    );
    counts.push(appData.timeline.filter((e) => e.date === dateStr).length);
  }
  if (myActivityChart) myActivityChart.destroy();
  myActivityChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data: counts,
          backgroundColor: "#00e676",
          borderRadius: 4,
          barThickness: 10,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: false },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#666" } },
        y: { display: false },
      },
    },
  });
}

// --- ACTION HANDLERS ---

function addNewItem() {
  const n = document.getElementById("new-item-name").value;
  const c = document.getElementById("new-item-cat").value;
  const d = document.getElementById("new-item-days").value;
  if (n) {
    appData.items.push({
      id: Date.now(),
      name: n,
      maxDays: d,
      category: c || "Comfort",
      lastReplacement: getTodayString(),
    });
    saveData();
  }
}
function handleReset(id) {
  appData.items.find((i) => i.id === id).lastReplacement = getTodayString();
  addToTimeline("Done", "Maintenance", "maintenance");
  saveData();
}
function snoozeItem(id) {
  // Logic hapus sesuai tombol di renderHome yg tertulis "Delete"
  if (confirm("Hapus item ini?")) {
    appData.items = appData.items.filter((i) => i.id !== id);
    saveData();
  }
}

function addHealthItem() {
  const n = document.getElementById("new-health-name").value;
  if (n) {
    appData.health.push({
      id: Date.now(),
      name: n,
      lastAction: getTodayString(),
    });
    saveData();
    document.getElementById("new-health-name").value = "";
  }
}
function addHabitItem() {
  const n = document.getElementById("new-habit-name").value;
  if (n) {
    appData.habits.push({
      id: Date.now(),
      name: n,
      lastAction: getTodayString(),
    });
    saveData();
    document.getElementById("new-habit-name").value = "";
  }
}

// RENDERERS LAINNYA
function renderHealth() {
  const el = document.getElementById("health-list");
  if (el)
    el.innerHTML = appData.health
      .map(
        (i) =>
          `<li class="list-item-modern"><span>${i.name}</span><span style="color:#888">${daysSince(i.lastAction)} hari lalu</span><button onclick="updateGeneric('health',${i.id})" style="background:none; border:1px solid #333; color:#69f0ae; cursor:pointer; padding:2px 8px; border-radius:4px;">Done</button></li>`,
      )
      .join("");
}
function renderHabits() {
  const el = document.getElementById("habit-list");
  if (el)
    el.innerHTML = appData.habits
      .map(
        (i) =>
          `<li class="list-item-modern"><span>${i.name}</span><span style="color:#888">${daysSince(i.lastAction)} hari lalu</span><button onclick="updateGeneric('habits',${i.id})" style="background:none; border:1px solid #333; color:#69f0ae; cursor:pointer; padding:2px 8px; border-radius:4px;">Done</button></li>`,
      )
      .join("");
}
function renderNotes() {
  const el = document.getElementById("brain-list");
  if (el)
    el.innerHTML = appData.notes
      .map(
        (n) =>
          `<li class="list-item-modern"><span><b>${n.title}</b></span><span>${n.title.length > 20 ? "Note" : "Catatan"}</span><button onclick="deleteNote(${n.id})" style="color:#ff5252; background:none; border:none; cursor:pointer;">Hapus</button></li>`,
      )
      .join("");
}
function renderSubs() {
  const el = document.getElementById("subs-list");
  if (el)
    el.innerHTML = appData.subs
      .map(
        (s) =>
          `<li class="list-item-modern"><span>${s.name}</span><span>${formatRupiah(s.price)}</span><button onclick="deleteSub(${s.id})" style="color:#ff5252; background:none; border:none; cursor:pointer;">Hapus</button></li>`,
      )
      .join("");
}
function renderGoals() {
  const el = document.getElementById("goals-container");
  if (el)
    el.innerHTML = appData.goals
      .map((g) => {
        const pct = Math.round((g.current / g.target) * 100);
        return `<div class="list-item-modern" style="display:grid; grid-template-columns: 2fr 1fr 1fr; align-items:center;">
            <div>${g.title}</div>
            <div style="font-size:0.8rem; color:#aaa;">${pct}% (${g.current}/${g.target})</div>
            <div style="display:flex; gap:5px;"><button onclick="updateGoal(${g.id}, 1)" style="background:#69f0ae; color:black; border:none; width:20px; border-radius:4px;">+</button></div>
        </div>`;
      })
      .join("");
}

function updateGeneric(t, id) {
  appData[t].find((i) => i.id === id).lastAction = getTodayString();
  saveData();
}
function deleteNote(id) {
  appData.notes = appData.notes.filter((n) => n.id !== id);
  saveData();
}
function deleteSub(id) {
  appData.subs = appData.subs.filter((s) => s.id !== id);
  saveData();
}

function switchView(v) {
  document
    .querySelectorAll(".view-section")
    .forEach((e) => (e.style.display = "none"));
  document
    .querySelectorAll(".menu-icon")
    .forEach((e) => e.classList.remove("active"));

  const target = document.getElementById(`view-${v}`);
  const btn = document.getElementById(`btn-${v}`);

  if (target) target.style.display = "block";
  if (btn) btn.classList.add("active");

  if (v === "home") {
    setTimeout(() => {
      initChart();
      initActivityChart();
    }, 100);
  } else if (v === "calendar") renderFullCalendar();
}

function toggleForm(id) {
  const e = document.getElementById(`form-${id}`);
  if (e) e.style.display = e.style.display === "none" ? "block" : "none";
}

function addBalance() {
  const v = prompt("Top Up:");
  if (v) {
    appData.wallet.currentBalance += parseInt(v);
    saveData();
  }
}

function hardReset() {
  if (
    confirm(
      "⚠️ PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA data? Data tidak bisa dikembalikan.",
    )
  ) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
}

function addToTimeline(t, d, type) {
  appData.timeline.unshift({
    id: Date.now(),
    date: getTodayString(),
    title: t,
    desc: d,
    type,
  });
  if (appData.timeline.length > 20) appData.timeline.pop();
}

// CALENDAR & TRANSACTIONS
let currentViewMonth = new Date();
let selectedDate = null;

function changeMonth(s) {
  currentViewMonth.setMonth(currentViewMonth.getMonth() + s);
  renderFullCalendar();
}

function renderFullCalendar() {
  const y = currentViewMonth.getFullYear();
  const m = currentViewMonth.getMonth();
  const elTitle = document.getElementById("cal-month-year");
  if (elTitle)
    elTitle.innerText = new Date(y, m).toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

  const g = document.getElementById("full-calendar-grid");
  if (!g) return;
  g.innerHTML = "";

  const fd = new Date(y, m, 1).getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  for (let i = 0; i < fd; i++) g.appendChild(document.createElement("div"));
  for (let i = 1; i <= dim; i++) {
    const d = `${y}-${String(m + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    const div = document.createElement("div");
    div.className = "cal-date-box";
    if (d === selectedDate) div.classList.add("active");
    if (appData.transactions[d]?.length) div.classList.add("has-data");
    div.innerHTML = `<span class="cal-num">${i}</span>`;
    div.onclick = () => {
      selectedDate = d;
      renderFullCalendar();
      renderTransactionList();
    };
    g.appendChild(div);
  }
}

function addDailyTransaction() {
  const d = document.getElementById("daily-desc").value;
  const p = parseInt(document.getElementById("daily-price").value);
  const cutEl = document.getElementById("daily-cut-balance");
  const cut = cutEl ? cutEl.checked : false;

  if (d && !isNaN(p)) {
    if (!appData.transactions[selectedDate])
      appData.transactions[selectedDate] = [];
    appData.transactions[selectedDate].push({ desc: d, price: p });

    if (cut && selectedDate === getTodayString()) {
      appData.wallet.currentBalance -= p;
      addToTimeline("Expense", d, "finance");
    }
    document.getElementById("daily-desc").value = "";
    document.getElementById("daily-price").value = "";
    saveData();
  }
}

function renderTransactionList() {
  const dateEl = document.getElementById("selected-date-text");
  if (dateEl) dateEl.innerText = selectedDate || "Pilih Tanggal";

  const el = document.getElementById("transaction-list");
  if (el) {
    el.innerHTML = "";
    (appData.transactions[selectedDate] || []).forEach((i) => {
      el.innerHTML += `<li class="transaction-item"><span>${i.desc}</span><span style="color:#ff5252">-${formatRupiah(i.price)}</span></li>`;
    });
  }

  const totalEl = document.getElementById("daily-total");
  if (totalEl)
    totalEl.innerText = formatRupiah(
      (appData.transactions[selectedDate] || []).reduce(
        (a, c) => a + c.price,
        0,
      ),
    );
}

// TIMER & IDEAS
// --- TIMER & IDEAS LOGIC (UPDATED) ---

let initialTime = 25 * 60; // Default awal 25 menit

function setCustomTime() {
  const input = document.getElementById("focus-duration").value;
  if (input && input > 0) {
    pauseTimer(); // Hentikan timer jika sedang berjalan
    initialTime = parseInt(input) * 60; // Simpan durasi baru
    timeLeft = initialTime; // Set waktu tersisa
    updateTimerDisplay(); // Update tampilan angka
  } else {
    alert("Masukkan durasi menit yang valid!");
  }
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      updateTimerDisplay();
    } else {
      clearInterval(timerInterval);
      timerInterval = null;
      // Mainkan suara notifikasi sederhana (opsional)
      // new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg').play();
      alert("Waktu Fokus Selesai! Istirahatlah sejenak.");
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  pauseTimer();
  timeLeft = initialTime; // Reset ke waktu yang diset user terakhir
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const m = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const s = (timeLeft % 60).toString().padStart(2, "0");
  const el = document.getElementById("timer-display");
  if (el) el.innerText = `${m}:${s}`;
}

// --- MUSIC PLAYER LOGIC ---
function changeMusic() {
  const selector = document.getElementById("music-selector");
  const iframe = document.getElementById("spotify-frame");
  const vibe = selector.value;

  let src = "";

  // Ganti URL Embed sesuai pilihan (Playlist Spotify Resmi)
  switch (vibe) {
    case "lofi": // Lofi Girl
      src =
        "https://open.spotify.com/embed/playlist/0vvXsWCC9xrXsKd4FyS8kM?utm_source=generator&theme=0";
      break;
    case "piano": // Peaceful Piano
      src =
        "https://open.spotify.com/embed/playlist/37i9dQZF1DX4sWSpwq3LiO?utm_source=generator&theme=0";
      break;
    case "rain": // Rain Sounds
      src =
        "https://open.spotify.com/embed/playlist/37i9dQZF1DX8ymr6UES7vc?utm_source=generator&theme=0";
      break;
    case "synth": // Synthwave
      src =
        "https://open.spotify.com/embed/playlist/37i9dQZF1DXdLEN7aqioXM?utm_source=generator&theme=0";
      break;
    default:
      src =
        "https://open.spotify.com/embed/playlist/0vvXsWCC9xrXsKd4FyS8kM?utm_source=generator&theme=0";
  }

  iframe.src = src;
}

// ... (Fungsi addQuickIdea dan lainnya biarkan tetap ada di bawahnya) ...
function addQuickIdea() {
  const v = document.getElementById("quick-idea-input").value;
  if (v) {
    appData.ideas.push({ id: Date.now(), text: v });
    saveData();
    document.getElementById("quick-idea-input").value = "";
    renderIdeas();
  }
}
function renderIdeas() {
  const el = document.getElementById("idea-list");
  if (el)
    el.innerHTML = appData.ideas
      .map(
        (i) =>
          `<li class="list-item-modern">${i.text} <button onclick="deleteIdea(${i.id})" style="float:right; border:none; background:none; color:#555; cursor:pointer">x</button></li>`,
      )
      .join("");
}
function deleteIdea(id) {
  appData.ideas = appData.ideas.filter((i) => i.id !== id);
  saveData();
  renderIdeas();
}

function addGoal() {
  const t = document.getElementById("goal-title").value;
  const tg = document.getElementById("goal-target").value;
  const u = document.getElementById("goal-unit").value;
  if (t) {
    appData.goals.push({
      id: Date.now(),
      title: t,
      target: tg,
      current: 0,
      unit: u,
    });
    saveData();
    document.getElementById("goal-title").value = "";
  }
}
function updateGoal(id, v) {
  const g = appData.goals.find((i) => i.id === id);
  g.current += v;
  saveData();
}

function addNote() {
  const t = document.getElementById("note-title").value;
  const c = document.getElementById("note-content").value;
  if (t) {
    appData.notes.push({ id: Date.now(), title: t, content: c });
    saveData();
    document.getElementById("note-title").value = "";
  }
}

function addSub() {
  const n = document.getElementById("sub-name").value;
  const p = parseInt(document.getElementById("sub-price").value);
  const d = document.getElementById("sub-date").value;
  if (n) {
    appData.subs.push({ id: Date.now(), name: n, price: p, date: d });
    saveData();
    document.getElementById("sub-name").value = "";
  }
}

function addRandomExpense() {
  const n = document.getElementById("rand-name").value;
  const p = parseInt(document.getElementById("rand-price").value);
  const cutEl = document.getElementById("cut-balance");
  if (n) {
    appData.randomList.push({ id: Date.now(), name: n, price: p });
    if (cutEl && cutEl.checked) appData.wallet.currentBalance -= p;
    saveData();
  }
}
function renderRandomList() {
  const el = document.getElementById("random-list");
  if (el)
    el.innerHTML = appData.randomList
      .map(
        (i) =>
          `<li class="list-item-modern"><span>${i.name}</span><span>-${formatRupiah(i.price)}</span></li>`,
      )
      .join("");
  const totEl = document.getElementById("random-total-display");
  if (totEl)
    totEl.innerText = formatRupiah(
      appData.randomList.reduce((a, c) => a + c.price, 0),
    );
}

function addJournal() {
  const t = document.getElementById("journal-input").value;
  if (t) {
    appData.journal.unshift({
      id: Date.now(),
      date: getTodayString(),
      text: t,
    });
    saveData();
  }
}
function renderJournal() {
  const el = document.getElementById("journal-list");
  if (el)
    el.innerHTML = appData.journal
      .map(
        (j) =>
          `<div style="padding:10px; border-bottom:1px solid #333"><small style="color:#666">${j.date}</small><p>${j.text}</p></div>`,
      )
      .join("");
}

// --- FUNGSI PENGATURAN ---

function toggleTheme() {
  document.body.classList.toggle("light-mode");
  const isLight = document.body.classList.contains("light-mode");
  appData.theme = isLight ? "light" : "dark";
  const icon = document.getElementById("theme-toggle-icon");
  if (icon) icon.innerText = isLight ? "ON" : "OFF";
  saveData();
}

function hardReset() {
  if (
    confirm(
      "⚠️ PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA data? Data tidak bisa dikembalikan.",
    )
  ) {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }
}

// START
initApp();

// --- LOGIN LOGIC ---

// Misal PIN rahasia Mas adalah "1234"
const SECRET_PIN = "1234"; 

function checkLogin() {
    const inputPin = document.getElementById('login-pin').value;
    const errorMsg = document.getElementById('login-error');
    const loginScreen = document.getElementById('login-screen');

    if (inputPin === SECRET_PIN) {
        // Jika PIN Benar, hilangkan pesan error & pudarkan layar login
        errorMsg.style.display = 'none';
        loginScreen.style.opacity = '0';
        
        // Setelah animasi pudar selesai (500ms), hapus dari tampilan agar bisa klik menu di bawahnya
        setTimeout(() => {
            loginScreen.style.display = 'none';
        }, 500);
        
    } else {
        // Jika PIN Salah, munculkan teks merah
        errorMsg.style.display = 'block';
        document.getElementById('login-pin').value = ''; // Kosongkan input
    }
}

// Tambahkan fitur: Tekan tombol "Enter" di keyboard untuk login
document.getElementById("login-pin").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        checkLogin();
    }
});