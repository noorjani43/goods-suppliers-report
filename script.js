// Utility: safely query elements
function $(selector) { return document.querySelector(selector); }

// Constants
const ROW_COUNT = 12;

// State
let currentPage = 1;
let suppliers = []; // managed via modal

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  autoFillTodayDate();
  buildTableRows();
  wireToolbar();
  wireModal();
});

// Auto-fill date
function autoFillTodayDate() {
  const input = $('#date');
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  input.value = `${yyyy}-${mm}-${dd}`;
  syncRailMeta();
}

// Build 12 editable rows
function buildTableRows() {
  const tbody = document.querySelector('#reportTable tbody');
  tbody.innerHTML = '';
  for (let i = 1; i <= ROW_COUNT; i += 1) {
    const tr = document.createElement('tr');
    // No. column
    const th = document.createElement('th');
    th.textContent = String(i);
    tr.appendChild(th);

    // Helper to make td editable
    const makeCell = () => {
      const td = document.createElement('td');
      td.contentEditable = 'true';
      td.spellcheck = false;
      return td;
    };

    // Supplier (Name, Code) -> 2 cells
    tr.appendChild(makeCell());
    tr.appendChild(makeCell());

    // Invoice (Number, Items, Qty) -> 3 cells
    tr.appendChild(makeCell());
    tr.appendChild(makeCell());
    tr.appendChild(makeCell());

    // Notes 5 categories x (Items, Qty) -> 10 cells
    for (let j = 0; j < 10; j += 1) tr.appendChild(makeCell());

    tbody.appendChild(tr);
  }
}

// Toolbar interactions
function wireToolbar() {
  $('#btnPagePlus').addEventListener('click', () => {
    currentPage += 1;
    updatePageIndicator();
  });

  $('#btnPrint').addEventListener('click', () => {
    window.print();
  });

  $('#btnClear').addEventListener('click', () => {
    if (!confirm('Clear all table contents?')) return;
    clearAllTableCells();
  });

  $('#btnReset').addEventListener('click', () => {
    if (!confirm('Reset form and table to initial state?')) return;
    resetAll();
  });

  $('#btnSave').addEventListener('click', saveToLocalStorage);
  $('#btnBackup').addEventListener('click', backupToFile);
  $('#btnRestore').addEventListener('click', () => $('#fileRestore').click());
  $('#fileRestore').addEventListener('change', restoreFromFile);

  $('#btnGenerate').addEventListener('click', generateSummary);
  $('#btnManageSuppliers').addEventListener('click', openSuppliersModal);

  // Keep print rail meta synced with inputs
  ['date', 'storeLocation', 'qualitySpecialist'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', syncRailMeta);
  });
}

function updatePageIndicator() {
  $('#pageIndicator').textContent = `Page ${currentPage}`;
  const badge = $('#pageBadge');
  if (badge) badge.textContent = `Page ${currentPage}`;
  const railPage = document.getElementById('railPage');
  if (railPage) railPage.textContent = `Page ${currentPage}`;
  const ptPage = document.getElementById('ptPage');
  if (ptPage) ptPage.textContent = `Page ${currentPage}`;
}

function clearAllTableCells() {
  document.querySelectorAll('#reportTable tbody td').forEach((td) => { td.textContent = ''; });
}

function resetAll() {
  autoFillTodayDate();
  $('#storeLocation').value = '';
  $('#qualitySpecialist').value = '';
  clearAllTableCells();
  currentPage = 1;
  updatePageIndicator();
  syncRailMeta();
}

// Saving/Restoring
function collectData() {
  const rows = Array.from(document.querySelectorAll('#reportTable tbody tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim())
  );
  return {
    date: $('#date').value,
    storeLocation: $('#storeLocation').value,
    qualitySpecialist: $('#qualitySpecialist').value,
    page: currentPage,
    rows,
    suppliers,
  };
}

function populateData(data) {
  $('#date').value = data.date || '';
  $('#storeLocation').value = data.storeLocation || '';
  $('#qualitySpecialist').value = data.qualitySpecialist || '';
  currentPage = data.page || 1;
  updatePageIndicator();

  const bodyRows = document.querySelectorAll('#reportTable tbody tr');
  (data.rows || []).forEach((cols, idx) => {
    const tds = bodyRows[idx]?.querySelectorAll('td');
    if (!tds) return;
    cols.forEach((val, cIdx) => { if (tds[cIdx]) tds[cIdx].textContent = val; });
  });

  suppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
  renderSuppliersList();
  syncRailMeta();
}

function saveToLocalStorage() {
  const data = collectData();
  localStorage.setItem('daily-report', JSON.stringify(data));
  alert('Saved to browser storage.');
}

function backupToFile() {
  const data = collectData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const today = new Date().toISOString().slice(0, 10);
  a.download = `daily-report-${today}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function restoreFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      populateData(data);
      alert('Backup restored into the form.');
    } catch (err) {
      alert('Invalid backup file.');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// Generate: creates a simple summary modal content
function generateSummary() {
  const data = collectData();
  const totalRowsWithData = data.rows.filter((cols) => cols.some((c) => c && c.length)).length;
  const message = `Date: ${data.date}\nRows with entries: ${totalRowsWithData}\nPage: ${data.page}`;
  alert(message);
}

// Suppliers modal logic
function wireModal() {
  $('#closeSuppliers').addEventListener('click', closeSuppliersModal);
  $('#saveSuppliers').addEventListener('click', () => {
    saveToLocalStorage();
    closeSuppliersModal();
  });
  $('#addSupplier').addEventListener('click', addSupplier);
}

function openSuppliersModal() {
  renderSuppliersList();
  $('#suppliersModal').showModal();
}

function closeSuppliersModal() {
  $('#suppliersModal').close();
}

function addSupplier() {
  const name = $('#supplierName').value.trim();
  const code = $('#supplierCode').value.trim();
  if (!name || !code) return;
  suppliers.push({ name, code });
  $('#supplierName').value = '';
  $('#supplierCode').value = '';
  renderSuppliersList();
}

function renderSuppliersList() {
  const list = $('#suppliersList');
  list.innerHTML = '';
  suppliers.forEach((s, idx) => {
    const li = document.createElement('li');
    const info = document.createElement('span');
    info.textContent = `${s.name} (${s.code})`;
    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.className = 'btn btn-clear';
    remove.addEventListener('click', () => {
      suppliers.splice(idx, 1);
      renderSuppliersList();
    });
    li.appendChild(info);
    li.appendChild(remove);
    list.appendChild(li);
  });
}

// Sync meta values to the print rail
function syncRailMeta() {
  const railDate = document.getElementById('railDate');
  const railStore = document.getElementById('railStore');
  const railQuality = document.getElementById('railQuality');
  if (railDate) railDate.textContent = document.getElementById('date')?.value || '';
  if (railStore) railStore.textContent = document.getElementById('storeLocation')?.value || '';
  if (railQuality) railQuality.textContent = document.getElementById('qualitySpecialist')?.value || '';

  const ptDate = document.getElementById('ptDate');
  const ptStore = document.getElementById('ptStore');
  const ptQuality = document.getElementById('ptQuality');
  if (ptDate) ptDate.textContent = document.getElementById('date')?.value || '';
  if (ptStore) ptStore.textContent = document.getElementById('storeLocation')?.value || '';
  if (ptQuality) ptQuality.textContent = document.getElementById('qualitySpecialist')?.value || '';
}


