const DAILY_LIMIT = 50000;
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
  theme: "dark", // Setting default theme
};

let appData = {};
let myChartInstance = null;
let myActivityChart = null;
let timerInterval = null;
let timeLeft = 25 * 60;

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

function initApp() {
  const saved = localStorage.getItem("sisaMasaApp_vSettings");
  appData = saved
    ? JSON.parse(saved)
    : { ...defaultData, lastOpenDate: getTodayString() };

  // Safety check arrays
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
  ].forEach((k) => {
    if (!appData[k]) appData[k] = [];
  });

  // Apply Saved Theme
  if (appData.theme === "light") {
    document.body.classList.add("light-mode");
    // Tunggu DOM load utk update teks toggle
    setTimeout(() => {
      const icon = document.getElementById("theme-toggle-icon");
      if (icon) icon.innerText = "ON";
    }, 100);
  }

  if (appData.timeline.length === 0) generateDummyHistory();

  selectedDate = getTodayString();
  checkNewDay();
  renderAll();
}

function saveData() {
  localStorage.setItem("sisaMasaApp_vSettings", JSON.stringify(appData));
  renderAll();
}
function generateDummyHistory() {
  for (let i = 0; i < 7; i++)
    appData.timeline.push({
      id: Date.now() - i,
      date: getTodayString(),
      title: "Auto Log",
      desc: "System Init",
      type: "finance",
    });
}

// --- SETTINGS FEATURES ---
function toggleTheme() {
  document.body.classList.toggle("light-mode");
  const isLight = document.body.classList.contains("light-mode");
  appData.theme = isLight ? "light" : "dark";

  const icon = document.getElementById("theme-toggle-icon");
  if (icon) icon.innerText = isLight ? "ON" : "OFF";

  saveData();
}

// ... (SISA KODE SAMA SEPERTI SEBELUMNYA) ...
// Copy semua fungsi renderHome, renderCalendar, dll dari kode sebelumnya di sini.
// Agar tidak kepanjangan, saya tulis ulang fungsi inti yang sering dipakai.

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
  setTimeout(() => {
    initChart();
    initActivityChart();
  }, 100);
}

function checkNewDay() {
  if (appData.lastOpenDate !== getTodayString()) {
    appData.wallet.currentBalance = DAILY_LIMIT;
    appData.lastOpenDate = getTodayString();
    addToTimeline("🔄 Reset", "Daily Reset", "finance");
    saveData();
  }
}

function renderHome() {
  document.getElementById("display-saldo").innerText = formatRupiah(
    appData.wallet.currentBalance,
  );
  document.getElementById("maintenance-count").innerText = appData.items.filter(
    (i) => i.maxDays - daysSince(i.lastReplacement) < 0,
  ).length;
  document.getElementById("total-event-count").innerText =
    appData.timeline.length;

  const listEl = document.getElementById("item-list");
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
                <button onclick="snoozeItem(${i.id})" class="btn-control btn-snooze">🙈 Snooze 3d</button>
                <button onclick="handleReset(${i.id})" class="btn-control btn-done">✅ Done</button>
            </div>
        </li>`;
    });

  const tl = document.getElementById("timeline-container");
  tl.innerHTML = "";
  appData.timeline.slice(0, 5).forEach((ev) => {
    tl.innerHTML += `<div class="timeline-item type-${ev.type}"><div class="t-date">${ev.date}</div><div style="font-size:0.8rem">${ev.title}</div></div>`;
  });
}

function initChart() {
  const ctx = document.getElementById("financeChart").getContext("2d");
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
  const ctx = document.getElementById("activityChart").getContext("2d");
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
  addToTimeline("Snooze", "Maintenance", "maintenance");
  saveData();
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
function renderHealth() {
  document.getElementById("health-list").innerHTML = appData.health
    .map(
      (i) =>
        `<li class="list-item-modern"><span>${i.name}</span><span style="font-size:0.8rem; color:#888">${daysSince(i.lastAction)}d ago</span> <button onclick="updateGeneric('health',${i.id})" style="background:#333; color:#fff; border:none; padding:3px 8px; cursor:pointer">Done</button></li>`,
    )
    .join("");
}
function renderHabits() {
  document.getElementById("habit-list").innerHTML = appData.habits
    .map(
      (i) =>
        `<li class="list-item-modern"><span>${i.name}</span><span style="font-size:0.8rem; color:#888">${daysSince(i.lastAction)}d ago</span> <button onclick="updateGeneric('habits',${i.id})" style="background:#333; color:#fff; border:none; padding:3px 8px; cursor:pointer">Done</button></li>`,
    )
    .join("");
}
function updateGeneric(t, id) {
  appData[t].find((i) => i.id === id).lastAction = getTodayString();
  saveData();
}

function switchView(v) {
  document
    .querySelectorAll(".view-section")
    .forEach((e) => (e.style.display = "none"));
  document
    .querySelectorAll(".menu-icon")
    .forEach((e) => e.classList.remove("active"));
  document.getElementById(`view-${v}`).style.display = "block";
  if (document.getElementById(`btn-${v}`))
    document.getElementById(`btn-${v}`).classList.add("active");
  if (v === "home") {
    setTimeout(() => {
      initChart();
      initActivityChart();
    }, 100);
  } else if (v === "calendar") renderFullCalendar();
}
function toggleForm(id) {
  const e = document.getElementById(`form-${id}`);
  e.style.display = e.style.display === "none" ? "block" : "none";
}
function addBalance() {
  const v = prompt("Top Up:");
  if (v) {
    appData.wallet.currentBalance += parseInt(v);
    saveData();
  }
}
function hardReset() {
  if (confirm("Reset All?")) {
    localStorage.removeItem("sisaMasaApp_vSettings");
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

let currentViewMonth = new Date();
let selectedDate = null;
function changeMonth(s) {
  currentViewMonth.setMonth(currentViewMonth.getMonth() + s);
  renderFullCalendar();
}
function renderFullCalendar() {
  const y = currentViewMonth.getFullYear();
  const m = currentViewMonth.getMonth();
  document.getElementById("cal-month-year").innerText = new Date(
    y,
    m,
  ).toLocaleString("default", { month: "long", year: "numeric" });
  const g = document.getElementById("full-calendar-grid");
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
  const cut = document.getElementById("daily-cut-balance").checked;
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
  document.getElementById("selected-date-text").innerText =
    selectedDate || "Pilih Tanggal";
  const el = document.getElementById("transaction-list");
  el.innerHTML = "";
  (appData.transactions[selectedDate] || []).forEach((i) => {
    el.innerHTML += `<li class="transaction-item"><span>${i.desc}</span><span style="color:#ff5252">-${formatRupiah(i.price)}</span></li>`;
  });
  document.getElementById("daily-total").innerText = formatRupiah(
    (appData.transactions[selectedDate] || []).reduce((a, c) => a + c.price, 0),
  );
}

function startTimer() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      updateTimerDisplay();
    } else {
      clearInterval(timerInterval);
      alert("Selesai!");
    }
  }, 1000);
}
function pauseTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}
function resetTimer() {
  pauseTimer();
  timeLeft = 25 * 60;
  updateTimerDisplay();
}
function updateTimerDisplay() {
  const m = Math.floor(timeLeft / 60)
    .toString()
    .padStart(2, "0");
  const s = (timeLeft % 60).toString().padStart(2, "0");
  document.getElementById("timer-display").innerText = `${m}:${s}`;
}
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
  document.getElementById("idea-list").innerHTML = appData.ideas
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
function renderGoals() {
  const el = document.getElementById("goals-container");
  el.innerHTML = "";
  appData.goals.forEach((g) => {
    const pct = Math.min((g.current / g.target) * 100, 100);
    el.innerHTML += `<div class="list-item-modern" style="display:grid; grid-template-columns: 2fr 1fr 1fr; align-items:center;"><div>${g.title}</div><div style="font-size:0.8rem; color:#aaa;">${pct}% (${g.current}/${g.target})</div><div style="display:flex; gap:5px;"><button onclick="updateGoal(${g.id}, 1)" style="background:#69f0ae; color:black; border:none; width:20px; border-radius:4px;">+</button></div></div>`;
  });
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
function renderNotes() {
  document.getElementById("brain-list").innerHTML = appData.notes
    .map(
      (n) =>
        `<li class="list-item-modern"><span><b>${n.title}</b></span><span>${n.title.length > 20 ? "Note" : "Catatan"}</span><button onclick="deleteNote(${n.id})" style="color:#ff5252; background:none; border:none; cursor:pointer;">Hapus</button></li>`,
    )
    .join("");
}
function deleteNote(id) {
  appData.notes = appData.notes.filter((n) => n.id !== id);
  saveData();
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
function renderSubs() {
  document.getElementById("subs-list").innerHTML = appData.subs
    .map(
      (s) =>
        `<li class="list-item-modern"><span>${s.name}</span><span>${formatRupiah(s.price)}</span><button onclick="deleteSub(${s.id})" style="color:#ff5252; background:none; border:none; cursor:pointer;">Hapus</button></li>`,
    )
    .join("");
}
function deleteSub(id) {
  appData.subs = appData.subs.filter((s) => s.id !== id);
  saveData();
}

function addRandomExpense() {
  const n = document.getElementById("rand-name").value;
  const p = parseInt(document.getElementById("rand-price").value);
  if (n) {
    appData.randomList.push({ id: Date.now(), name: n, price: p });
    if (document.getElementById("cut-balance").checked)
      appData.wallet.currentBalance -= p;
    saveData();
  }
}
function renderRandomList() {
  document.getElementById("random-list").innerHTML = appData.randomList
    .map(
      (i) =>
        `<li class="list-item-modern"><span>${i.name}</span><span>-${formatRupiah(i.price)}</span></li>`,
    )
    .join("");
  document.getElementById("random-total-display").innerText = formatRupiah(
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
  document.getElementById("journal-list").innerHTML = appData.journal
    .map(
      (j) =>
        `<div style="padding:10px; border-bottom:1px solid #333"><small style="color:#666">${j.date}</small><p>${j.text}</p></div>`,
    )
    .join("");
}

initApp();
