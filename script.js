/* =========================================================
   ตั้งค่าทีม — แก้ชื่อสมาชิกทีมของคุณตรงนี้ (2-8 คนก็ได้)
   ========================================================= */
const TEAM = ["พลอย", "ฟลุ๊ค", "แนน", "ต้น"];

/* สีประจำตัวแต่ละคน วนซ้ำถ้าคนเยอะกว่าจำนวนสี */
const AVATAR_COLORS = ["#24504F", "#E0982C", "#7B4B94", "#2D6CA6", "#B6553C", "#4B8B6F"];

const STORAGE_KEY = "task-board:tasks:v1";
const USER_KEY = "task-board:current-user:v1";

let tasks = loadTasks();
let currentUser = localStorage.getItem(USER_KEY) || null;
let activeStatusFilter = "all";
let activePersonFilter = "all";

/* ---------- storage ---------- */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("โหลดข้อมูลไม่สำเร็จ", e);
    return [];
  }
}
function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

/* ---------- helpers ---------- */
function colorFor(name) {
  const idx = TEAM.indexOf(name);
  return AVATAR_COLORS[(idx >= 0 ? idx : 0) % AVATAR_COLORS.length];
}
function initials(name) {
  return name ? name.trim().slice(0, 1).toUpperCase() : "?";
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function formatDue(iso) {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}
function dueStatus(iso, status) {
  if (!iso || status === "done") return "normal";
  const today = todayISO();
  if (iso < today) return "overdue";
  if (iso === today) return "today";
  return "normal";
}

/* ---------- gate: choose who you are ---------- */
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

/* ---------- form setup ---------- */
function populateAssigneeSelect() {
  const sel = document.getElementById("f-assignee");
  sel.innerHTML = TEAM.map(name => `<option value="${name}">${name}</option>`).join("");
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

document.getElementById("status-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  activeStatusFilter = btn.dataset.filter;
  [...document.getElementById("status-tabs").children].forEach(c => c.classList.toggle("active", c === btn));
  render();
});

document.getElementById("switch-user").addEventListener("click", () => {
  document.getElementById("app").classList.add("hidden");
  document.getElementById("gate").classList.remove("hidden");
});

document.getElementById("task-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const title = document.getElementById("f-title").value.trim();
  const assignee = document.getElementById("f-assignee").value;
  const due = document.getElementById("f-due").value || null;
  const priority = document.getElementById("f-priority").value;
  if (!title) return;

  tasks.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title,
    assignee,
    due,
    priority,
    status: "todo",
    createdBy: currentUser,
    createdAt: new Date().toISOString()
  });
  saveTasks();
  e.target.reset();
  render();
});

/* ---------- rendering ---------- */
function render() {
  renderWorkload();
  renderBoard();
}

function renderWorkload() {
  const wrap = document.getElementById("workload-bars");
  const openCounts = TEAM.map(name => ({
    name,
    count: tasks.filter(t => t.assignee === name && t.status !== "done").length
  }));
  const max = Math.max(1, ...openCounts.map(o => o.count));
  wrap.innerHTML = openCounts.map(o => `
    <div class="workload-row">
      <span class="workload-name">${o.name}</span>
      <div class="workload-track">
        <div class="workload-fill" style="width:${(o.count / max) * 100}%; background:${colorFor(o.name)}"></div>
      </div>
      <span class="workload-count">${o.count} งานค้าง</span>
    </div>
  `).join("");
}

function renderBoard() {
  const board = document.getElementById("board");
  const empty = document.getElementById("empty-state");

  let list = tasks.filter(t => {
    if (activeStatusFilter !== "all" && t.status !== activeStatusFilter) return false;
    if (activePersonFilter !== "all" && t.assignee !== activePersonFilter) return false;
    return true;
  });

  // sort: overdue/today first, then by due date, undated last
  list.sort((a, b) => {
    if (a.status === "done" && b.status !== "done") return 1;
    if (b.status === "done" && a.status !== "done") return -1;
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due.localeCompare(b.due);
  });

  if (list.length === 0) {
    board.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  board.innerHTML = list.map(t => {
    const dStatus = dueStatus(t.due, t.status);
    const dueLabel = formatDue(t.due);
    let dueBadge = "";
    if (dueLabel) {
      const cls = dStatus === "overdue" ? "overdue-badge" : dStatus === "today" ? "today-badge" : "";
      const label = dStatus === "overdue" ? `เลยกำหนด · ${dueLabel}` : dStatus === "today" ? `วันนี้` : dueLabel;
      dueBadge = `<span class="due-badge ${cls}">${label}</span>`;
    }
    return `
      <div class="task-card status-${t.status} priority-${t.priority} ${dStatus === 'overdue' ? 'overdue' : ''}" data-id="${t.id}">
        <button class="task-check ${t.status === 'done' ? 'checked' : ''}" data-action="toggle" title="ทำเสร็จแล้ว">${t.status === 'done' ? '✓' : ''}</button>
        <div class="task-body">
          <p class="task-title">${escapeHtml(t.title)}</p>
          <div class="task-meta">
            <span class="meta-avatar">
              <span class="avatar" style="background:${colorFor(t.assignee)}">${initials(t.assignee)}</span>
              ${t.assignee}
            </span>
            ${dueBadge}
          </div>
        </div>
        <select class="status-select" data-action="status">
          <option value="todo" ${t.status === "todo" ? "selected" : ""}>ยังไม่ทำ</option>
          <option value="doing" ${t.status === "doing" ? "selected" : ""}>กำลังทำ</option>
          <option value="done" ${t.status === "done" ? "selected" : ""}>เสร็จแล้ว</option>
        </select>
        <button class="task-delete" data-action="delete" title="ลบงาน">×</button>
      </div>
    `;
  }).join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- board event delegation ---------- */
document.getElementById("board").addEventListener("click", (e) => {
  const card = e.target.closest(".task-card");
  if (!card) return;
  const id = card.dataset.id;
  const action = e.target.dataset.action;

  if (action === "toggle") {
    const t = tasks.find(x => x.id === id);
    t.status = t.status === "done" ? "todo" : "done";
    saveTasks();
    render();
  }
  if (action === "delete") {
    if (confirm("ลบงานนี้ใช่ไหม?")) {
      tasks = tasks.filter(x => x.id !== id);
      saveTasks();
      render();
    }
  }
});

document.getElementById("board").addEventListener("change", (e) => {
  if (e.target.dataset.action !== "status") return;
  const card = e.target.closest(".task-card");
  const t = tasks.find(x => x.id === card.dataset.id);
  t.status = e.target.value;
  saveTasks();
  render();
});

/* ---------- init ---------- */
populateAssigneeSelect();
populatePersonFilter();
renderGate();
if (currentUser && TEAM.includes(currentUser)) {
  showApp();
}
