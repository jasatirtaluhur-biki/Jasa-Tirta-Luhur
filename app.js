// ==========================================
// KONFIGURASI API
// ==========================================
const API_URL = 'https://script.google.com/macros/s/AKfycbx9oDwr1qj9BxKL2oA3FzPfF2wHEc8k-8sZ1MZlJGMYuFHIG4_lGCABvL1vObUjPp52/exec';

// ==========================================
// STATE MANAGEMENT
// ==========================================
let currentUser    = null;
let photoBase64    = null;
let stream         = null;
let deferredPrompt = null;
let lookupTimer    = null;   // debounce untuk auto-fill ID pelanggan

// ==========================================
// INITIALIZATION
// ==========================================
window.onload = function() {
  const savedUser = localStorage.getItem('currentUser');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    showMainApp();
  }

  // Set default date to today
  document.getElementById('tanggal').valueAsDate = new Date();

  // ✅ BARU: Auto-fill saat operator mengetik ID Pelanggan
  const idInput = document.getElementById('idPelanggan');

  idInput.addEventListener('input', function() {
    clearTimeout(lookupTimer);
    const val = this.value.trim();
    hideSuggestions();
    if (val.length === 0) { clearAutoFill(); return; }
    // ✅ FIX: Search mulai 3 karakter — agar mode 3 digit terakhir bekerja benar
    if (val.length >= 3) {
      lookupTimer = setTimeout(() => fetchSuggestions(val), 350);
    }
  });

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.id-input-wrapper')) hideSuggestions();
  });

  // Enter key di field login
  document.getElementById('loginUsername').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('loginPassword').focus();
  });
  document.getElementById('loginPassword').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') login();
  });
};

// ==========================================
// PWA INSTALL
// ==========================================
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBtn').style.display = 'block';
});

function installPWA() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showNotification('Aplikasi berhasil diinstall!', 'success');
      }
      deferredPrompt = null;
      document.getElementById('installBtn').style.display = 'none';
    });
  }
}

// ==========================================
// AUTHENTICATION
// ==========================================
async function login() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!username || !password) {
    showNotification('Username dan password harus diisi!', 'error');
    return;
  }

  const loginBtn = document.querySelector('#loginScreen .btn-primary');
  loginBtn.disabled = true;
  loginBtn.textContent = '⏳ Memproses...';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'login', username, password })
    });

    const result = await response.json();

    if (result.success) {
      currentUser = result.data;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      showNotification('Login berhasil! Selamat datang, ' + currentUser.nama, 'success');
      showMainApp();
    } else {
      showNotification(result.message, 'error');
    }
  } catch (error) {
    showNotification('Gagal connect ke server: ' + error.message, 'error');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
}

function logout() {
  if (confirm('Yakin ingin logout?')) {
    stopCamera();
    localStorage.removeItem('currentUser');
    currentUser = null;
    document.getElementById('mainApp').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    showNotification('Logout berhasil!', 'success');
  }
}

function showMainApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  document.getElementById('userDisplay').textContent = `👤 ${currentUser.nama}`;
}

// ==========================================
// CAMERA FUNCTIONS
// ==========================================
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });

    const video = document.getElementById('video');
    video.srcObject = stream;
    video.style.display = 'block';

    document.getElementById('canvas').style.display = 'none';
    document.getElementById('preview').classList.add('hidden');
    document.getElementById('cameraPlaceholder').style.display = 'none';
    document.getElementById('captureBtn').disabled = false;

    photoBase64 = null;
    updateFotoStatus(false);
  } catch (error) {
    showNotification('Tidak bisa akses kamera: ' + error.message, 'error');
  }
}

function capturePhoto() {
  const video   = document.getElementById('video');
  const canvas  = document.getElementById('canvas');
  const preview = document.getElementById('preview');

  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  photoBase64 = canvas.toDataURL('image/jpeg', 0.8);

  if (!photoBase64 || photoBase64 === 'data:,') {
    showNotification('Gagal mengambil foto, coba lagi!', 'error');
    photoBase64 = null;
    return;
  }

  preview.src = photoBase64;
  preview.classList.remove('hidden');

  stopCamera();
  updateFotoStatus(true);
  showNotification('✅ Foto berhasil diambil!', 'success');
}

function resetCamera() {
  stopCamera();
  document.getElementById('preview').classList.add('hidden');
  document.getElementById('preview').src = '';
  document.getElementById('cameraPlaceholder').style.display = 'flex';
  photoBase64 = null;
  updateFotoStatus(false);
  showNotification('Foto direset', 'info');
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  const video = document.getElementById('video');
  video.srcObject = null;
  video.style.display = 'none';
  document.getElementById('captureBtn').disabled = true;
}

// ✅ BARU: Update indikator status foto
function updateFotoStatus(sudahAda) {
  const el = document.getElementById('fotoStatus');
  if (sudahAda) {
    el.textContent   = '✅ Sudah diambil';
    el.className     = 'foto-status foto-sudah';
  } else {
    el.textContent   = '⚠️ Belum diambil';
    el.className     = 'foto-status foto-belum';
  }
}

// ==========================================
// SAVE DATA
// ==========================================
async function saveData() {
  const idPelanggan    = document.getElementById('idPelanggan').value.trim();
  const tanggal        = document.getElementById('tanggal').value;
  const nama           = document.getElementById('nama').value.trim();
  const alamat         = document.getElementById('alamat').value.trim();
  const kondisi        = document.getElementById('kondisi').value;
  const jenisPengguna  = document.getElementById('jenisPengguna').value;
  const spamWilayah    = document.getElementById('spamWilayah')?.value.trim() || '';  // ✅ BARU
  const nomorMeterLama = document.getElementById('nomorMeterLama').value.trim();
  const nomorMeterBaru = document.getElementById('nomorMeterBaru').value.trim();
  const catatan        = document.getElementById('catatan').value.trim();

  // Validasi field wajib teks
  if (!idPelanggan || !tanggal || !nama || !alamat || !kondisi || !jenisPengguna) {
    showNotification('Semua field wajib (*) harus diisi!', 'error');
    return;
  }
  if (!nomorMeterBaru) {
    showNotification('No. Water Meter Baru wajib diisi!', 'error');
    document.getElementById('nomorMeterBaru').focus();
    return;
  }

  // ✅ UBAH: Validasi foto wajib di frontend
  if (!photoBase64) {
    showNotification('📷 Foto water meter wajib diambil!', 'error');
    // Scroll ke area kamera
    document.getElementById('cameraContainer').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = '⏳ Menyimpan...';

  try {
    console.log('Photo tersedia:', Math.round(photoBase64.length / 1024) + ' KB');

    const payload = {
      action:        'saveData',
      userId:        currentUser.userId,
      idPelanggan,
      tanggal,
      nama,
      alamat,
      kondisi,
      jenisPengguna,
      spamWilayah,              // ✅ BARU
      nomorMeterLama,
      nomorMeterBaru,
      photoBase64,
      catatan
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.success) {
      showNotification('✅ Data berhasil disimpan!', 'success');
      console.log('Photo URL tersimpan:', result.data.photoUrl);
      clearForm();
    } else {
      showNotification('Gagal simpan: ' + result.message, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Simpan Data';
  }
}

function clearForm() {
  document.getElementById('idPelanggan').value    = '';
  document.getElementById('tanggal').valueAsDate  = new Date();
  document.getElementById('nama').value           = '';
  document.getElementById('alamat').value         = '';
  document.getElementById('kondisi').value        = '';
  document.getElementById('jenisPengguna').value  = '';
  const spamEl = document.getElementById('spamWilayah');
  if (spamEl) { spamEl.value = ''; spamEl.style.background = '#f0f4ff'; }  // ✅ BARU
  const spamInd = document.getElementById('spamAutoIndicator');
  if (spamInd) spamInd.textContent = '';
  document.getElementById('nomorMeterLama').value = '';
  document.getElementById('nomorMeterBaru').value = '';
  document.getElementById('catatan').value        = '';

  // Reset kamera
  document.getElementById('preview').classList.add('hidden');
  document.getElementById('preview').src          = '';
  document.getElementById('cameraPlaceholder').style.display = 'flex';
  photoBase64 = null;
  updateFotoStatus(false);
  stopCamera();
}

// ==========================================
// LOAD HISTORY
// ==========================================
async function loadHistory() {
  const historyList = document.getElementById('historyList');
  historyList.innerHTML = '<div class="loading"><div class="spinner"></div>Memuat data...</div>';

  // ✅ BARU: Ambil nilai filter
  const filterKondisi = document.getElementById('filterKondisi')?.value || '';
  const filterJenis   = document.getElementById('filterJenis')?.value   || '';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action:        'getHistory',
        userId:        currentUser.userId,
        role:          currentUser.role,
        limit:         50,
        filterKondisi,   // ✅ UBAH: ganti dari filterStatus
        filterJenis      // ✅ BARU
      })
    });

    const result = await response.json();

    if (result.success) {
      const records = result.data.records;

      if (records.length === 0) {
        historyList.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">Belum ada data</div>';
        return;
      }

      let html = '';
      records.forEach(record => {
        const date         = new Date(record.createdAt).toLocaleString('id-ID');
        // ✅ UBAH: pakai kondisi, bukan status
        const kondisiClass = record.kondisi === 'Normal' ? 'kondisi-normal' : 'kondisi-error';
        const jenisIcon    = { Penduduk: '🏠', Niaga: '🏪', Industri: '🏭' }[record.jenisPengguna] || '👤';

        html += `
          <div class="history-item" onclick="viewDetail(${JSON.stringify(record).replace(/"/g, '&quot;')})">
            <div class="history-date">${date}</div>
            <div class="history-name">${record.nama} 📷</div>
            <div class="history-id">ID: ${record.idPelanggan}</div>
            <div class="history-id">📍 ${record.alamat}</div>
            ${record.spamWilayah ? `<div class="history-id">🗺️ ${record.spamWilayah}</div>` : ''}
            <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
              <span class="status-badge ${kondisiClass}">${record.kondisi === 'Normal' ? '✅' : '❌'} ${record.kondisi}</span>
              <span class="status-badge jenis-badge">${jenisIcon} ${record.jenisPengguna}</span>
            </div>
          </div>
        `;
      });

      historyList.innerHTML = html;
    } else {
      historyList.innerHTML = '<div style="text-align:center; padding:40px; color:#f44336;">Gagal memuat data: ' + result.message + '</div>';
    }
  } catch (error) {
    historyList.innerHTML = '<div style="text-align:center; padding:40px; color:#f44336;">Error: ' + error.message + '</div>';
  }
}

// ==========================================
// VIEW DETAIL
// ==========================================
function viewDetail(record) {
  const existingModal = document.getElementById('detailModal');
  if (existingModal) existingModal.remove();

  const date         = new Date(record.createdAt).toLocaleString('id-ID');
  const kondisiClass = record.kondisi === 'Normal' ? 'kondisi-normal' : 'kondisi-error';
  const kondisiIcon  = record.kondisi === 'Normal' ? '✅' : '❌';
  const jenisIcon    = { Penduduk: '🏠', Niaga: '🏪', Industri: '🏭' }[record.jenisPengguna] || '👤';

  const modal = document.createElement('div');
  modal.id = 'detailModal';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.6); z-index: 9999;
    display: flex; align-items: flex-end; justify-content: center;
    animation: fadeIn 0.2s ease;
  `;

  modal.innerHTML = `
    <div style="
      background: white; border-radius: 20px 20px 0 0;
      padding: 24px; width: 100%; max-width: 600px;
      max-height: 85vh; overflow-y: auto;
      animation: slideUp 0.3s ease;
    ">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
        <h2 style="color:#333; font-size:18px;">📋 Detail Data</h2>
        <button onclick="closeDetail()" style="
          background:#f0f0f0; border:none; border-radius:50%;
          width:32px; height:32px; cursor:pointer; font-size:16px;
        ">✕</button>
      </div>

      <div style="margin-bottom:16px; border-radius:12px; overflow:hidden;">
        <img src="${record.photoUrl}" style="width:100%; max-height:240px; object-fit:cover; border-radius:12px;"
          onerror="this.parentElement.innerHTML='<div style=\'padding:16px;text-align:center;color:#999;background:#f5f5f5;border-radius:12px;\'>📷 Foto tidak dapat dimuat</div>'"
        />
      </div>

      <div style="display:flex; flex-direction:column; gap:12px;">
        ${detailRow('🆔 ID Pelanggan',   record.idPelanggan)}
        ${detailRow('👤 Nama',           record.nama)}
        ${detailRow('📍 Alamat',         record.alamat)}
        ${record.spamWilayah ? detailRow('🗺️ SPAM / Wilayah', record.spamWilayah) : ''}
        ${detailRow('📅 Tanggal',        record.tanggal || '-')}
        ${detailRow('💧 Kondisi Meter',  `<span class="status-badge ${kondisiClass}">${kondisiIcon} ${record.kondisi}</span>`)}
        ${detailRow('👥 Jenis Pengguna', `<span class="status-badge jenis-badge">${jenisIcon} ${record.jenisPengguna}</span>`)}
        ${record.nomorMeterLama ? detailRow('🔢 No. Meter Lama', record.nomorMeterLama) : ''}
        ${record.nomorMeterBaru  ? detailRow('🔢 No. Meter Baru',  record.nomorMeterBaru)  : ''}
        ${record.catatan ? detailRow('📝 Catatan', record.catatan) : ''}
        ${detailRow('🕐 Dibuat',         date)}
        ${detailRow('👷 Operator',       record.createdBy)}
        ${detailRow('🔗 Link Foto',      `<a href="${record.photoUrl}" target="_blank" style="color:#4285f4; word-break:break-all;">Lihat Foto di Drive</a>`)}
      </div>

      <button onclick="closeDetail()" style="
        width:100%; margin-top:20px; padding:14px; border:none;
        background:#4285f4; color:white; border-radius:8px;
        font-size:16px; font-weight:600; cursor:pointer;
      ">Tutup</button>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeIn  { from { opacity:0 }           to { opacity:1 } }
    @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
  `;
  document.head.appendChild(style);

  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeDetail();
  });

  document.body.appendChild(modal);
}

function detailRow(label, value) {
  return `
    <div style="display:flex; flex-direction:column; gap:4px; padding:12px; background:#f8f9fa; border-radius:8px;">
      <span style="font-size:12px; color:#888; font-weight:600;">${label}</span>
      <span style="font-size:15px; color:#333;">${value}</span>
    </div>
  `;
}

function closeDetail() {
  const modal = document.getElementById('detailModal');
  if (modal) modal.remove();
}

// ==========================================
// NAVIGATION
// ==========================================
function switchScreen(screen) {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));

  if (screen === 'form') {
    document.getElementById('formScreen').classList.remove('hidden');
    document.getElementById('historyScreen').classList.add('hidden');
    navItems[0].classList.add('active');
  } else if (screen === 'history') {
    document.getElementById('formScreen').classList.add('hidden');
    document.getElementById('historyScreen').classList.remove('hidden');
    navItems[1].classList.add('active');
    loadHistory();
  }
}

// ==========================================
// NOTIFICATION
// ==========================================
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.className   = `notification ${type} show`;

  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// ==========================================
// AUTO-FILL ID PELANGGAN (MASTER LOOKUP)
// ==========================================

// Lookup eksak — isi semua field otomatis
async function lookupAndFill(idPelanggan) {
  const indicator = document.getElementById('lookupIndicator');
  if (indicator) { indicator.textContent = '🔍 Mencari...'; indicator.className = 'lookup-indicator looking'; }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'lookupPelanggan', idPelanggan })
    });
    const result = await response.json();

    if (result.success) {
      fillFromMaster(result.data);
      if (indicator) { indicator.textContent = '✅ Ditemukan'; indicator.className = 'lookup-indicator found'; }
      showNotification('✅ Data pelanggan ditemukan!', 'success');
    } else {
      if (indicator) { indicator.textContent = '❌ Tidak ditemukan'; indicator.className = 'lookup-indicator notfound'; }
    }
  } catch (err) {
    if (indicator) { indicator.textContent = ''; indicator.className = 'lookup-indicator'; }
    console.error('lookupAndFill error:', err);
  }
}

// Fetch suggestions untuk autocomplete dropdown
async function fetchSuggestions(query) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'searchPelanggan', query, limit: 7 })
    });
    const result = await response.json();

    if (result.success && result.data.suggestions.length > 0) {
      showSuggestions(result.data.suggestions);
    } else {
      hideSuggestions();
    }
  } catch (err) {
    hideSuggestions();
  }
}

// Tampilkan dropdown suggestions
function showSuggestions(suggestions) {
  let dropdown = document.getElementById('suggestionDropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'suggestionDropdown';
    dropdown.className = 'suggestion-dropdown';
    const wrapper = document.getElementById('idPelanggan').closest('.id-input-wrapper') || document.getElementById('idPelanggan').parentNode;
    wrapper.style.position = 'relative';
    wrapper.appendChild(dropdown);
  }

  dropdown.innerHTML = suggestions.map(s => `
    <div class="suggestion-item" onclick="selectSuggestion(${JSON.stringify(s).replace(/"/g, '&quot;')})">
      <div class="suggestion-id">${s.idPelanggan}</div>
      <div class="suggestion-nama">${s.nama}</div>
      <div class="suggestion-meta">${s.jenisPengguna} • ${s.lokasiBlok}</div>
    </div>
  `).join('');

  dropdown.style.display = 'block';
}

// User klik salah satu suggestion
function selectSuggestion(data) {
  document.getElementById('idPelanggan').value = data.idPelanggan;
  hideSuggestions();
  fillFromMaster(data);
  showNotification('✅ Data pelanggan diisi otomatis!', 'success');
}

// Isi field form dari data master
function fillFromMaster(data) {
  if (data.nama)          document.getElementById('nama').value          = data.nama;
  // master tidak punya alamat — isi dengan lokasiBlok sebagai referensi awal
  if (data.lokasiBlok)    document.getElementById('alamat').value        = data.lokasiBlok;
  if (data.jenisPengguna) document.getElementById('jenisPengguna').value = data.jenisPengguna;

  // ✅ BARU: auto-fill SPAM/Wilayah
  const spamVal = data.spam || data.wilayah || '';
  const spamEl  = document.getElementById('spamWilayah');
  if (spamEl) {
    spamEl.value = spamVal;
    const ind = document.getElementById('spamAutoIndicator');
    if (ind) ind.textContent = spamVal ? '✅ Terisi otomatis' : '';
  }

  // Highlight field yang terisi otomatis
  ['nama', 'alamat', 'jenisPengguna'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('autofilled');
      setTimeout(() => el.classList.remove('autofilled'), 2500);
    }
  });

  // Highlight SPAM
  if (spamEl && spamVal) {
    spamEl.style.background = '#e8f5e9';
    setTimeout(() => { spamEl.style.background = '#f0f4ff'; }, 2500);
  }
}

// Kosongkan field auto-fill saat ID dihapus
function clearAutoFill() {
  const indicator = document.getElementById('lookupIndicator');
  if (indicator) { indicator.textContent = ''; indicator.className = 'lookup-indicator'; }
  const spamEl = document.getElementById('spamWilayah');
  if (spamEl) { spamEl.value = ''; spamEl.style.background = '#f0f4ff'; }
  const spamInd = document.getElementById('spamAutoIndicator');
  if (spamInd) spamInd.textContent = '';
}

function hideSuggestions() {
  const d = document.getElementById('suggestionDropdown');
  if (d) d.style.display = 'none';
}
