import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

/* =========================================================
   ตั้งค่าทีม — แก้ชื่อสมาชิกทีมของคุณตรงนี้ (2-8 คนก็ได้)
   ========================================================= */
const TEAM = ["พลอย", "ฟลุ๊ค", "แนน", "ต้น"];
const AVATAR_COLORS = ["#24504F", "#E0982C", "#7B4B94", "#2D6CA6", "#B6553C", "#4B8B6F"];

const LOCAL_KEY = "gantt-board:tasks:v1";
const USER_KEY = "gantt-board:current-user:v1";

let tasks = [];
let currentUser = localStorage.getItem(USER_KEY) || null;
let activePersonFilter = "all";
let zoom = "week"; // "day" | "week"
let editingId = null;

/* ---------- Firebase (or localStorage fallback) ---------- */
let db = null;
let colRef = null;
let fsApi = null;

async function initData() {
  if (isFirebaseConfigured) {
    try {
      const appMod = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js");
      const fsMod = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
      fsApi = fsMod;
      const app = appMod.initializeApp(firebaseConfig);
      db = fsMod.getFirestore(app);
      colRef = fsMod.collection(db, "gantt-tasks");
      setSyncStatus("online");
      fsMod.onSnapshot(colRef, (snap) => {
        tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        render();
      }, (err) => {
        console.error("Firestore sync error", err);
        setSyncStatus("error");
      });
      return;
    } catch (err) {
      console.error("เชื่อมต่อ Firebase ไม่สำเร็จ ใช้ localStorage แทนชั่วคราว", err);
    }
  }
  // Fallback: local only
  document.getElementById("setup-banner").classList.remove("hidden");
  setSyncStatus("local");
  tasks = loadLocal();
  render();
}

function setSyncStatus(status) {
  const dot = document.getElementById("sync-dot");
  dot.className = "sync-dot " + status;
  dot.title = status === "online" ? "ซิงก์กับทีมแบบเรียลไทม์"
    : status === "local" ? "โหมดออฟไลน์ (เครื่องนี้เท่านั้น)"
    : "เชื่อมต่อมีปัญหา";
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(tasks));
}

async function addTask(task) {
  if (colRef && fsApi) {
    await fsApi.addDoc(colRef, task);
  } else {
    tasks.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...task });
    saveLocal();
    render();
  }
}
async function updateTask(id, patch) {
  if (colRef && fsApi) {
    await fsApi.updateDoc(fsApi.doc(db, "gantt-tasks", id), patch);
  } else {
    const t = tasks.find(x => x.id === id);
    Object.assign(t, patch);
    saveLocal();
    render();
  }
}
async function deleteTask(id) {
  if (colRef && fsApi) {
    await fsApi.deleteDoc(fsApi.doc(db, "gantt-tasks", id));
  } else {
    tasks = tasks.filter(x => x.id !== id);
    saveLocal();
    render();
  }
}

/* ---------- helpers ---------- */
function colorFor(name) {
  const idx = TEAM.indexOf(name);
  return AVATAR_COLORS[(idx >= 0 ? idx : 0) % AVATAR_COLORS.length];
}
function initials(name) { return name ? name.trim().slice(0, 1).toUpperCase() : "?"; }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function dayDiff(a, b) {
  return Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);
}
function formatShort(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- gate ---------- */
function renderGate() {
  const wrap = document.getElementById("gate-names");
  wrap.innerHTML = "";
  TEAM.forEach(name => {
    const btn = document.createElement("button");
    btn.className = "gate-name-btn";
    btn.innerHTML = `<span class="avatar" style="background:${colorFor(name)}">${initials(name)}</span> ${name}`;
    btn.addEventListener("click", () => {
      currentUser = name;
      localStorage.setItem(USER_KEY, name);
      showApp();
    });
    wrap.appendChild(btn);
  });
}
function showApp() {
  document.getElementById("gate").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
  document.getElementById("whoami-name").textContent = currentUser;
  render();
}
document.getElementById("switch-user").addEventListener("click", () => {
  document.getElementById("app").classList.add("hidden");
  document.getElementById("gate").classList.remove("hidden");
});

/* ---------- form setup ---------- */
function populateAssigneeSelect() {
  const sel = document.getElementById("f-assignee");
  sel.innerHTML = TEAM.map(name => `<option value="${name}">${name}</option>`).join("");
  if (currentUser) sel.value = currentUser;
}
function populatePersonFilter() {
  const wrap = document.getElementById("person-filter");
  wrap.innerHTML = `<button class="chip active" data-person="all">ทุกคน</button>`;
  TEAM.forEach(name => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.dataset.person = name;
    chip.textContent = name;
    wrap.appendChild(chip);
  });
  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    activePersonFilter = btn.dataset.person;
    [...wrap.children].forEach(c => c.classList.toggle("active", c === btn));
    render();
  });
}
document.getElementById("zoom-toggle").addEventListener("click", (e) => {
  const btn = e.target.closest(".zoom-btn");
  if (!btn) return;
  zoom = btn.dataset.zoom;
  [...document.getElementById("zoom-toggle").children].forEach(c => c.classList.toggle("active", c === btn));
  render();
});

document.getElementById("task-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("f-title").value.trim();
  const assignee = document.getElementById("f-assignee").value;
  const start = document.getElementById("f-start").value;
  const end = document.getElementById("f-end").value;
  if (!title || !start || !end) return;
  if (end < start) { alert("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม"); return; }

  await addTask({
    title, assignee, start, end,
    progress: 0,
    createdBy: currentUser,
    createdAt: new Date().toISOString()
  });
  e.target.reset();
  populateAssigneeSelect();
});

/* ---------- modal ---------- */
function openModal(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  editingId = id;
  document.getElementById("modal-assignee").innerHTML =
    `<span class="avatar" style="background:${colorFor(t.assignee)};width:18px;height:18px;font-size:9px;display:inline-flex;vertical-align:-3px;margin-right:6px;">${initials(t.assignee)}</span>${t.assignee}`;
  document.getElementById("modal-title").textContent = t.title;
  document.getElementById("modal-dates").textContent = `${formatShort(t.start)} → ${formatShort(t.end)}`;
  document.getElementById("modal-progress").value = t.progress;
  document.getElementById("modal-progress-val").textContent = t.progress + "%";
  document.getElementById("modal-start").value = t.start;
  document.getElementById("modal-end").value = t.end;
  document.getElementById("modal-backdrop").classList.remove("hidden");
}
function closeModal() {
  editingId = null;
  document.getElementById("modal-backdrop").classList.add("hidden");
}
document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-backdrop").addEventListener("click", (e) => {
  if (e.target.id === "modal-backdrop") closeModal();
});
document.getElementById("modal-progress").addEventListener("input", (e) => {
  document.getElementById("modal-progress-val").textContent = e.target.value + "%";
});
document.getElementById("modal-save").addEventListener("click", async () => {
  if (!editingId) return;
  const progress = Number(document.getElementById("modal-progress").value);
  const start = document.getElementById("modal-start").value;
  const end = document.getElementById("modal-end").value;
  if (end < start) { alert("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม"); return; }
  await updateTask(editingId, { progress, start, end });
  closeModal();
});
document.getElementById("modal-delete").addEventListener("click", async () => {
  if (!editingId) return;
  if (confirm("ลบงานนี้ออกจากแผนงานใช่ไหม?")) {
    await deleteTask(editingId);
    closeModal();
  }
});

/* ---------- rendering ---------- */
function render() {
  renderOverallProgress();
  renderGantt();
}

function renderOverallProgress() {
  const list = tasks;
  const pct = list.length
    ? Math.round(list.reduce((s, t) => s + (t.progress || 0), 0) / list.length)
    : 0;
  document.getElementById("overall-fill").style.width = pct + "%";
  document.getElementById("overall-pct").textContent = pct + "%";
}

function renderGantt() {
  const side = document.getElementById("gantt-side");
  const timeline = document.getElementById("gantt-timeline");
  const empty = document.getElementById("empty-state");

  let list = tasks.filter(t => activePersonFilter === "all" || t.assignee === activePersonFilter);
  list = [...list].sort((a, b) => a.start.localeCompare(b.start));

  if (list.length === 0) {
    side.innerHTML = "";
    timeline.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  const dayWidth = zoom === "day" ? 36 : 14;
  const rowHeight = 44;

  const today = todayISO();
  let rangeStart = list.reduce((min, t) => t.start < min ? t.start : min, list[0].start);
  let rangeEnd = list.reduce((max, t) => t.end > max ? t.end : max, list[0].end);
  rangeStart = addDays(rangeStart < today ? rangeStart : today, -3);
  rangeEnd = addDays(rangeEnd > today ? rangeEnd : today, 5);
  const totalDays = Math.max(dayDiff(rangeStart, rangeEnd) + 1, 14);

  // ---- side (task list) ----
  side.innerHTML = list.map(t => `
    <div class="gantt-row-label" data-id="${t.id}" style="height:${rowHeight}px">
      <span class="avatar" style="background:${colorFor(t.assignee)}">${initials(t.assignee)}</span>
      <span class="row-title">${escapeHtml(t.title)}</span>
    </div>
  `).join("");

  // ---- timeline header ----
  let headerHtml = `<div class="gantt-header" style="width:${totalDays * dayWidth}px">`;
  // month groups
  let cursor = rangeStart;
  let months = [];
  for (let i = 0; i < totalDays; i++) {
    const iso = addDays(rangeStart, i);
    const m = iso.slice(0, 7);
    if (!months.length || months[months.length - 1].key !== m) {
      months.push({ key: m, count: 1, label: new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { month: "long", year: "2-digit" }) });
    } else {
      months[months.length - 1].count++;
    }
  }
  headerHtml += `<div class="gantt-months">` + months.map(m =>
    `<div class="gantt-month" style="width:${m.count * dayWidth}px">${m.label}</div>`
  ).join("") + `</div>`;

  headerHtml += `<div class="gantt-days">`;
  for (let i = 0; i < totalDays; i++) {
    const iso = addDays(rangeStart, i);
    const d = new Date(iso + "T00:00:00");
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const isToday = iso === today;
    const label = zoom === "day" ? d.getDate() : (d.getDay() === 1 ? d.getDate() : "");
    headerHtml += `<div class="gantt-day ${isWeekend ? "weekend" : ""} ${isToday ? "is-today" : ""}" style="width:${dayWidth}px">${label}</div>`;
  }
  headerHtml += `</div></div>`;

  // ---- grid background + bars ----
  let gridHtml = `<div class="gantt-grid" style="width:${totalDays * dayWidth}px; height:${list.length * rowHeight}px;">`;
  for (let i = 0; i < totalDays; i++) {
    const iso = addDays(rangeStart, i);
    const d = new Date(iso + "T00:00:00");
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const isToday = iso === today;
    gridHtml += `<div class="grid-col ${isWeekend ? "weekend" : ""} ${isToday ? "is-today" : ""}" style="left:${i * dayWidth}px; width:${dayWidth}px;"></div>`;
  }
  list.forEach((t, rowIdx) => {
    const offset = dayDiff(rangeStart, t.start);
    const span = dayDiff(t.start, t.end) + 1;
    const left = offset * dayWidth;
    const width = Math.max(span * dayWidth - 4, dayWidth - 4);
    const top = rowIdx * rowHeight + 8;
    const overdue = t.end < today && t.progress < 100;
    gridHtml += `
      <div class="gantt-bar ${overdue ? "overdue" : ""}" data-id="${t.id}"
           style="left:${left}px; top:${top}px; width:${width}px; background:${colorFor(t.assignee)}22; border-color:${colorFor(t.assignee)};">
        <div class="gantt-bar-fill" style="width:${t.progress}%; background:${colorFor(t.assignee)};"></div>
        <span class="gantt-bar-pct">${t.progress}%</span>
      </div>`;
  });
  gridHtml += `</div>`;

  timeline.innerHTML = headerHtml + gridHtml;

  // sync row heights / click handlers
  timeline.querySelectorAll(".gantt-bar").forEach(el => {
    el.addEventListener("click", () => openModal(el.dataset.id));
  });
  side.querySelectorAll(".gantt-row-label").forEach(el => {
    el.addEventListener("click", () => openModal(el.dataset.id));
  });

  // keep side rows and grid rows vertically aligned via matching heights (already fixed rowHeight)
}

/* ---------- init ---------- */
populateAssigneeSelect();
populatePersonFilter();
renderGate();
initData();
if (currentUser && TEAM.includes(currentUser)) {
  showApp();
}

// default date inputs to today / +3 days for convenience
document.getElementById("f-start").value = todayISO();
document.getElementById("f-end").value = addDays(todayISO(), 3);
