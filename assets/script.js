/* =========================================================
   PRODUKTIF — assets/script.js
   Praktikum 3 PABWE — Studi Kasus: Expense Tracker,
   Bookmark Manager, Quiz App. Murni JavaScript + localStorage,
   tanpa backend/API.

   Daftar isi (cari komentar berikut untuk lompat ke bagian):
   1. UTIL
   2. TAB SWITCHER (query string, bukan localStorage)
   3. MODAL HELPER (dipakai bersama semua fitur)
   4. EXPENSE TRACKER
   5. BOOKMARK MANAGER
   6. QUIZ APP
   7. INIT
   ========================================================= */

"use strict";

/* =========================================================
   1. UTIL
   ========================================================= */

/** Shortcut querySelector */
function qs(selector, ctx = document) {
  return ctx.querySelector(selector);
}

/** Shortcut querySelectorAll -> array */
function qsa(selector, ctx = document) {
  return Array.from(ctx.querySelectorAll(selector));
}

/** Buat id unik sederhana tanpa library eksternal */
function makeId() {
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

/** Format angka jadi Rupiah, mis. 15000 -> "Rp15.000" */
function formatRupiah(num) {
  const n = Number(num) || 0;
  return "Rp" + n.toLocaleString("id-ID");
}

/** Format tanggal ISO (yyyy-mm-dd) jadi "3 Sep 2026" */
function formatTanggal(isoDate) {
  if (!isoDate) return "-";
  const d = new Date(isoDate + "T00:00:00");
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/** Escape teks user sebelum dimasukkan ke innerHTML, cegah HTML injection sederhana */
function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}

/* =========================================================
   2. TAB SWITCHER (query string, bukan localStorage)
   ========================================================= */

const VALID_TABS = ["expense", "bookmark", "quiz"];

/** Baca tab aktif dari query string ?tab=..., fallback 'expense' jika tidak valid */
function getTabFromURL() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  return VALID_TABS.includes(tab) ? tab : "expense";
}

/**
 * Aktifkan panel & tombol tab sesuai nama tab, lalu perbarui query string
 * lewat history.replaceState supaya tab yang sama dipulihkan saat refresh,
 * tanpa menambah entri baru di history browser.
 */
function setActiveTab(tabName, { updateURL = true } = {}) {
  if (!VALID_TABS.includes(tabName)) tabName = "expense";

  // tampilkan hanya panel yang aktif
  qsa(".tab-panel").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tabName;
  });

  // highlight tombol tab yang aktif
  qsa("[data-tab-btn]").forEach((btn) => {
    const active = btn.dataset.tabBtn === tabName;
    btn.classList.toggle("text-brand", active);
    btn.classList.toggle("border-brand", active);
    btn.classList.toggle("text-slate-500", !active);
    btn.classList.toggle("border-transparent", !active);
  });

  if (updateURL) {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tabName);
    const newUrl = window.location.pathname + "?" + params.toString();
    history.replaceState(null, "", newUrl);
  }
}

/** Pasang event listener tombol tab + pulihkan tab dari URL saat halaman dibuka */
function initTabs() {
  qsa("[data-tab-btn]").forEach((btn) => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tabBtn));
  });

  // pulihkan tab terakhir dari query string (bukan localStorage)
  setActiveTab(getTabFromURL(), { updateURL: true });

  // dukung tombol back/forward browser
  window.addEventListener("popstate", () => {
    setActiveTab(getTabFromURL(), { updateURL: false });
  });
}

/* =========================================================
   3. MODAL HELPER (dipakai bersama semua fitur)
   ========================================================= */

function openModal(id) {
  qs("#" + id).hidden = false;
}

function closeModal(id) {
  qs("#" + id).hidden = true;
}

// tombol dengan [data-close-modal="id"] otomatis menutup modal terkait
qsa("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
});

// klik area gelap di belakang modal (backdrop) juga menutup modal
qsa(".modal-backdrop").forEach((backdrop) => {
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) backdrop.hidden = true;
  });
});

/** State konfirmasi hapus generik, dipakai bersama Expense & Bookmark */
let pendingDelete = null; // { type: 'expense' | 'bookmark', id: string }

qs("#confirm-cancel").addEventListener("click", () => {
  pendingDelete = null;
  closeModal("modal-confirm");
});

qs("#confirm-ok").addEventListener("click", () => {
  if (!pendingDelete) return;
  if (pendingDelete.type === "expense") deleteExpense(pendingDelete.id);
  if (pendingDelete.type === "bookmark") deleteBookmark(pendingDelete.id);
  pendingDelete = null;
  closeModal("modal-confirm");
});

function askDeleteConfirm(type, id, message) {
  pendingDelete = { type, id };
  qs("#confirm-message").textContent = message;
  openModal("modal-confirm");
}

/* =========================================================
   4. EXPENSE TRACKER
   ========================================================= */

const EXPENSE_KEY = "produktif_expenses"; // key localStorage khusus Expense Tracker
let expenses = loadExpenses();
let editingExpenseId = null;
let expenseFilter = { search: "", type: "all", category: "all", sort: "newest" };

function loadExpenses() {
  try {
    const raw = localStorage.getItem(EXPENSE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Gagal membaca data expense dari localStorage:", e);
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(EXPENSE_KEY, JSON.stringify(expenses));
}

/** Hitung & tampilkan ringkasan total pemasukan, pengeluaran, saldo (dari SEMUA data) */
function renderExpenseSummary() {
  let income = 0;
  let outcome = 0;
  expenses.forEach((tx) => {
    if (tx.type === "pemasukan") income += tx.amount;
    else outcome += tx.amount;
  });
  qs("#expense-total-income").textContent = formatRupiah(income);
  qs("#expense-total-expense").textContent = formatRupiah(outcome);
  qs("#expense-balance").textContent = formatRupiah(income - outcome);
}

/** Bangun ulang opsi dropdown filter kategori berdasarkan kategori yang benar-benar ada */
function rebuildExpenseCategoryOptions() {
  const select = qs("#expense-filter-category");
  const current = select.value;
  const categories = Array.from(new Set(expenses.map((tx) => tx.category))).sort();

  select.innerHTML = '<option value="all">Semua Kategori</option>';
  categories.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });

  // pertahankan pilihan filter sebelumnya jika kategorinya masih ada
  if (categories.includes(current)) select.value = current;
}

/** Terapkan pencarian, filter, dan sorting -> array baru (tidak mengubah `expenses` asli) */
function getFilteredExpenses() {
  let result = expenses.filter((tx) => {
    const matchSearch = tx.title.toLowerCase().includes(expenseFilter.search.toLowerCase());
    const matchType = expenseFilter.type === "all" || tx.type === expenseFilter.type;
    const matchCategory = expenseFilter.category === "all" || tx.category === expenseFilter.category;
    return matchSearch && matchType && matchCategory;
  });

  switch (expenseFilter.sort) {
    case "oldest":
      result.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case "highest":
      result.sort((a, b) => b.amount - a.amount);
      break;
    case "lowest":
      result.sort((a, b) => a.amount - b.amount);
      break;
    case "newest":
    default:
      result.sort((a, b) => b.createdAt - a.createdAt);
  }
  return result;
}

/** Render satu baris transaksi lewat createElement (bukan innerHTML mentah) */
function buildExpenseRow(tx) {
  const row = document.createElement("div");
  row.className =
    "flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3";

  const isIncome = tx.type === "pemasukan";
  const badgeColor = isIncome ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700";

  row.innerHTML = `
    <div class="min-w-0">
      <p class="font-semibold text-sm text-slate-800 truncate">${escapeHTML(tx.title)}</p>
      <div class="flex flex-wrap items-center gap-2 mt-1">
        <span class="text-xs px-2 py-0.5 rounded-full ${badgeColor} font-medium">${isIncome ? "Pemasukan" : "Pengeluaran"}</span>
        <span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">${escapeHTML(tx.category)}</span>
        <span class="text-xs text-slate-400">${formatTanggal(tx.date)}</span>
      </div>
    </div>
    <div class="flex items-center gap-3 shrink-0">
      <span class="font-display font-bold text-sm ${isIncome ? "text-emerald-600" : "text-rose-600"}">
        ${isIncome ? "+" : "-"}${formatRupiah(tx.amount)}
      </span>
      <button type="button" data-action="edit" class="text-slate-400 hover:text-brand" aria-label="Ubah transaksi">
        <i class="ti ti-pencil"></i>
      </button>
      <button type="button" data-action="delete" class="text-slate-400 hover:text-rose-600" aria-label="Hapus transaksi">
        <i class="ti ti-trash"></i>
      </button>
    </div>
  `;

  row.querySelector('[data-action="edit"]').addEventListener("click", () => openExpenseModal(tx.id));
  row.querySelector('[data-action="delete"]').addEventListener("click", () =>
    askDeleteConfirm("expense", tx.id, `Yakin ingin menghapus transaksi "${tx.title}"?`)
  );

  return row;
}

/** Render ulang seluruh daftar transaksi sesuai filter aktif + tangani empty state */
function renderExpenseList() {
  const container = qs("#expense-list");
  const emptyState = qs("#expense-empty");
  const filtered = getFilteredExpenses();

  container.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");
  filtered.forEach((tx) => container.appendChild(buildExpenseRow(tx)));
}

function openExpenseModal(id = null) {
  const form = qs("#form-expense");
  form.reset();
  qs("#expense-form-error").classList.add("hidden");

  if (id) {
    const tx = expenses.find((e) => e.id === id);
    if (!tx) return;
    editingExpenseId = id;
    qs("#expense-modal-title").textContent = "Ubah Transaksi";
    qs("#expense-id").value = tx.id;
    qs("#expense-title").value = tx.title;
    qs("#expense-category").value = tx.category;
    qs("#expense-amount").value = tx.amount;
    qs("#expense-type").value = tx.type;
    qs("#expense-date").value = tx.date;
  } else {
    editingExpenseId = null;
    qs("#expense-modal-title").textContent = "Tambah Transaksi";
    qs("#expense-date").value = new Date().toISOString().slice(0, 10);
  }
  openModal("modal-expense");
}

function deleteExpense(id) {
  expenses = expenses.filter((tx) => tx.id !== id);
  saveExpenses();
  rebuildExpenseCategoryOptions();
  renderExpenseSummary();
  renderExpenseList();
}

/** Validasi + simpan (tambah atau ubah) transaksi */
function handleExpenseSubmit(e) {
  e.preventDefault();

  const title = qs("#expense-title").value.trim();
  const category = qs("#expense-category").value;
  const amount = Number(qs("#expense-amount").value);
  const type = qs("#expense-type").value;
  const date = qs("#expense-date").value;
  const errorEl = qs("#expense-form-error");

  // validasi: field wajib tidak boleh kosong, jumlah harus angka valid > 0
  if (!title || !category || !date) {
    errorEl.textContent = "Judul, kategori, dan tanggal wajib diisi.";
    errorEl.classList.remove("hidden");
    return;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    errorEl.textContent = "Jumlah harus berupa angka lebih dari 0.";
    errorEl.classList.remove("hidden");
    return;
  }
  errorEl.classList.add("hidden");

  if (editingExpenseId) {
    const tx = expenses.find((e2) => e2.id === editingExpenseId);
    Object.assign(tx, { title, category, amount, type, date });
  } else {
    expenses.push({ id: makeId(), title, category, amount, type, date, createdAt: Date.now() });
  }

  saveExpenses();
  rebuildExpenseCategoryOptions();
  renderExpenseSummary();
  renderExpenseList();
  closeModal("modal-expense");
}

function initExpense() {
  renderExpenseSummary();
  rebuildExpenseCategoryOptions();
  renderExpenseList();

  qs("#btn-add-expense").addEventListener("click", () => openExpenseModal());
  qs("#form-expense").addEventListener("submit", handleExpenseSubmit);

  qs("#expense-search").addEventListener("input", (e) => {
    expenseFilter.search = e.target.value;
    renderExpenseList();
  });
  qs("#expense-filter-type").addEventListener("change", (e) => {
    expenseFilter.type = e.target.value;
    renderExpenseList();
  });
  qs("#expense-filter-category").addEventListener("change", (e) => {
    expenseFilter.category = e.target.value;
    renderExpenseList();
  });
  qs("#expense-sort").addEventListener("change", (e) => {
    expenseFilter.sort = e.target.value;
    renderExpenseList();
  });
}

/* =========================================================
   5. BOOKMARK MANAGER
   ========================================================= */

const BOOKMARK_KEY = "produktif_bookmarks"; // key localStorage berbeda dari Expense Tracker
let bookmarks = loadBookmarks();
let editingBookmarkId = null;
let bookmarkFilter = { search: "", sort: "newest" };

function loadBookmarks() {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("Gagal membaca data bookmark dari localStorage:", e);
    return [];
  }
}

function saveBookmarks() {
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
}

/** Validasi URL sederhana: wajib diawali http:// atau https:// */
function isValidUrl(url) {
  return /^https?:\/\/.+/i.test(url.trim());
}

function getFilteredBookmarks() {
  const keyword = bookmarkFilter.search.toLowerCase();
  let result = bookmarks.filter(
    (b) =>
      b.title.toLowerCase().includes(keyword) ||
      b.url.toLowerCase().includes(keyword) ||
      b.category.toLowerCase().includes(keyword)
  );

  switch (bookmarkFilter.sort) {
    case "az":
      result.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "za":
      result.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case "newest":
    default:
      result.sort((a, b) => b.createdAt - a.createdAt);
  }
  return result;
}

function buildBookmarkCard(bm) {
  const card = document.createElement("div");
  card.className = "bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-2";

  card.innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <a href="${escapeHTML(bm.url)}" target="_blank" rel="noopener noreferrer"
         class="font-semibold text-sm text-slate-800 hover:text-brand flex items-center gap-1.5 min-w-0">
        <i class="ti ti-external-link shrink-0"></i>
        <span class="truncate">${escapeHTML(bm.title)}</span>
      </a>
      <div class="flex items-center gap-2 shrink-0">
        <button type="button" data-action="edit" class="text-slate-400 hover:text-brand" aria-label="Ubah bookmark">
          <i class="ti ti-pencil"></i>
        </button>
        <button type="button" data-action="delete" class="text-slate-400 hover:text-rose-600" aria-label="Hapus bookmark">
          <i class="ti ti-trash"></i>
        </button>
      </div>
    </div>
    <a href="${escapeHTML(bm.url)}" target="_blank" rel="noopener noreferrer" class="text-xs text-slate-400 truncate hover:text-brand">${escapeHTML(bm.url)}</a>
    <div class="flex items-center gap-2">
      <span class="text-xs px-2 py-0.5 rounded-full bg-brand-soft text-brand-dark font-medium">${escapeHTML(bm.category)}</span>
    </div>
    ${bm.note ? `<p class="text-xs text-slate-500 mt-1">${escapeHTML(bm.note)}</p>` : ""}
  `;

  card.querySelector('[data-action="edit"]').addEventListener("click", () => openBookmarkModal(bm.id));
  card.querySelector('[data-action="delete"]').addEventListener("click", () =>
    askDeleteConfirm("bookmark", bm.id, `Yakin ingin menghapus bookmark "${bm.title}"?`)
  );

  return card;
}

function renderBookmarkList() {
  const container = qs("#bookmark-list");
  const emptyState = qs("#bookmark-empty");
  const filtered = getFilteredBookmarks();

  container.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");
  filtered.forEach((bm) => container.appendChild(buildBookmarkCard(bm)));
}

function openBookmarkModal(id = null) {
  const form = qs("#form-bookmark");
  form.reset();
  qs("#bookmark-form-error").classList.add("hidden");

  if (id) {
    const bm = bookmarks.find((b) => b.id === id);
    if (!bm) return;
    editingBookmarkId = id;
    qs("#bookmark-modal-title").textContent = "Ubah Bookmark";
    qs("#bookmark-id").value = bm.id;
    qs("#bookmark-title").value = bm.title;
    qs("#bookmark-url").value = bm.url;
    qs("#bookmark-category").value = bm.category;
    qs("#bookmark-note").value = bm.note || "";
  } else {
    editingBookmarkId = null;
    qs("#bookmark-modal-title").textContent = "Tambah Bookmark";
  }
  openModal("modal-bookmark");
}

function deleteBookmark(id) {
  bookmarks = bookmarks.filter((b) => b.id !== id);
  saveBookmarks();
  renderBookmarkList();
}

function handleBookmarkSubmit(e) {
  e.preventDefault();

  const title = qs("#bookmark-title").value.trim();
  const url = qs("#bookmark-url").value.trim();
  const category = qs("#bookmark-category").value;
  const note = qs("#bookmark-note").value.trim();
  const errorEl = qs("#bookmark-form-error");

  if (!title || !url || !category) {
    errorEl.textContent = "Nama, URL, dan kategori wajib diisi.";
    errorEl.classList.remove("hidden");
    return;
  }
  if (!isValidUrl(url)) {
    errorEl.textContent = "URL harus diawali http:// atau https://";
    errorEl.classList.remove("hidden");
    return;
  }
  errorEl.classList.add("hidden");

  if (editingBookmarkId) {
    const bm = bookmarks.find((b) => b.id === editingBookmarkId);
    Object.assign(bm, { title, url, category, note });
  } else {
    bookmarks.push({ id: makeId(), title, url, category, note, createdAt: Date.now() });
  }

  saveBookmarks();
  renderBookmarkList();
  closeModal("modal-bookmark");
}

function initBookmark() {
  renderBookmarkList();

  qs("#btn-add-bookmark").addEventListener("click", () => openBookmarkModal());
  qs("#form-bookmark").addEventListener("submit", handleBookmarkSubmit);

  qs("#bookmark-search").addEventListener("input", (e) => {
    bookmarkFilter.search = e.target.value;
    renderBookmarkList();
  });
  qs("#bookmark-sort").addEventListener("change", (e) => {
    bookmarkFilter.sort = e.target.value;
    renderBookmarkList();
  });
}

/* =========================================================
   6. QUIZ APP
   ========================================================= */

const QUIZ_HS_KEY = "produktif_quiz_highscore"; // key localStorage khusus high score kuis

// Soal disimpan sebagai array of object (bukan hardcode satu-satu di HTML)
const quizQuestions = [
  {
    question: "Tag HTML apa yang digunakan untuk membuat tautan (link)?",
    options: ["<link>", "<a>", "<href>", "<nav>"],
    correct: 1,
  },
  {
    question: "Properti CSS apa yang digunakan untuk mengubah warna teks?",
    options: ["text-color", "font-color", "color", "background-color"],
    correct: 2,
  },
  {
    question: "Method mana yang digunakan untuk memilih satu elemen pertama yang cocok di DOM?",
    options: ["getElementsByClass", "querySelector", "querySelectorList", "getElementId"],
    correct: 1,
  },
  {
    question: "Apa fungsi localStorage pada browser?",
    options: [
      "Mengirim data ke server otomatis",
      "Menyimpan data secara sementara sampai tab ditutup",
      "Menyimpan data di browser yang tetap ada setelah refresh",
      "Menjalankan kode di server",
    ],
    correct: 2,
  },
  {
    question: "Method array mana yang mengembalikan array baru berisi elemen yang lolos suatu kondisi?",
    options: ["forEach", "map", "filter", "reduce"],
    correct: 2,
  },
  {
    question: "Tipe data apa yang dihasilkan oleh JSON.stringify()?",
    options: ["Object", "Array", "String", "Number"],
    correct: 2,
  },
  {
    question: "Atribut apa yang wajib ditambahkan pada <a target=\"_blank\"> demi keamanan?",
    options: ['rel="noopener noreferrer"', 'rel="nofollow"', 'type="external"', 'download'],
    correct: 0,
  },
];

let quizState = {
  currentIndex: 0,
  score: 0,
  answered: false,
};

function getQuizHighScore() {
  return Number(localStorage.getItem(QUIZ_HS_KEY)) || 0;
}

function saveQuizHighScore(score) {
  localStorage.setItem(QUIZ_HS_KEY, String(score));
}

function showQuizScreen(name) {
  qs("#quiz-start").classList.toggle("hidden", name !== "start");
  qs("#quiz-question").classList.toggle("hidden", name !== "question");
  qs("#quiz-result").classList.toggle("hidden", name !== "result");
}

function startQuiz() {
  quizState = { currentIndex: 0, score: 0, answered: false };
  showQuizScreen("question");
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const q = quizQuestions[quizState.currentIndex];
  quizState.answered = false;

  qs("#quiz-progress").textContent = `Soal ${quizState.currentIndex + 1} dari ${quizQuestions.length}`;
  qs("#quiz-score-live").textContent = `Skor: ${quizState.score}`;
  qs("#quiz-question-text").textContent = q.question;

  const feedback = qs("#quiz-feedback");
  feedback.classList.add("hidden");
  feedback.textContent = "";

  const nextBtn = qs("#btn-next-quiz");
  nextBtn.disabled = true;
  nextBtn.classList.add("bg-slate-300", "text-slate-500", "cursor-not-allowed");
  nextBtn.classList.remove("bg-brand", "hover:bg-brand-dark", "text-white");
  nextBtn.textContent = quizState.currentIndex === quizQuestions.length - 1 ? "Lihat Hasil" : "Lanjut";
  nextBtn.innerHTML += ' <i class="ti ti-arrow-right"></i>';

  const optionsContainer = qs("#quiz-options");
  optionsContainer.innerHTML = "";

  q.options.forEach((optionText, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "w-full text-left px-4 py-3 text-sm border border-slate-300 rounded-xl hover:border-brand hover:bg-brand-soft transition";
    btn.textContent = optionText;
    btn.addEventListener("click", () => selectQuizAnswer(idx, btn));
    optionsContainer.appendChild(btn);
  });
}

function selectQuizAnswer(selectedIdx, btnEl) {
  if (quizState.answered) return; // cegah jawab dua kali per soal
  quizState.answered = true;

  const q = quizQuestions[quizState.currentIndex];
  const isCorrect = selectedIdx === q.correct;
  if (isCorrect) quizState.score++;

  // beri feedback visual: hijau untuk jawaban benar, merah untuk yang dipilih salah
  qsa("#quiz-options button").forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === q.correct) {
      btn.classList.add("border-emerald-500", "bg-emerald-50", "text-emerald-700");
    } else if (idx === selectedIdx) {
      btn.classList.add("border-rose-500", "bg-rose-50", "text-rose-700");
    }
  });

  const feedback = qs("#quiz-feedback");
  feedback.textContent = isCorrect ? "Benar! 🎉" : `Kurang tepat. Jawaban benar: "${q.options[q.correct]}"`;
  feedback.className = `text-sm font-semibold mt-3 mb-4 ${isCorrect ? "text-emerald-600" : "text-rose-600"}`;

  qs("#quiz-score-live").textContent = `Skor: ${quizState.score}`;

  const nextBtn = qs("#btn-next-quiz");
  nextBtn.disabled = false;
  nextBtn.classList.remove("bg-slate-300", "text-slate-500", "cursor-not-allowed");
  nextBtn.classList.add("bg-brand", "hover:bg-brand-dark", "text-white");
}

function goToNextQuestion() {
  if (!quizState.answered) return;
  quizState.currentIndex++;
  if (quizState.currentIndex >= quizQuestions.length) {
    finishQuiz();
  } else {
    renderQuizQuestion();
  }
}

function finishQuiz() {
  const highScore = getQuizHighScore();
  const isNewHighScore = quizState.score > highScore;
  if (isNewHighScore) saveQuizHighScore(quizState.score);

  qs("#quiz-final-score").textContent = `${quizState.score} / ${quizQuestions.length}`;
  qs("#quiz-highscore-note").textContent = isNewHighScore
    ? "Skor tertinggi baru! 🏆"
    : `Skor tertinggi saat ini: ${Math.max(highScore, quizState.score)}`;

  showQuizScreen("result");
}

function initQuiz() {
  qs("#quiz-highscore").textContent = getQuizHighScore();
  showQuizScreen("start");

  qs("#btn-start-quiz").addEventListener("click", startQuiz);
  qs("#btn-next-quiz").addEventListener("click", goToNextQuestion);
  qs("#btn-restart-quiz").addEventListener("click", () => {
    qs("#quiz-highscore").textContent = getQuizHighScore();
    showQuizScreen("start");
  });
}

/* =========================================================
   7. INIT
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initExpense();
  initBookmark();
  initQuiz();
});
