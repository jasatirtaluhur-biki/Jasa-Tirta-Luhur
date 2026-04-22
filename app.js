// ==========================================
// KONFIGURASI API
// ==========================================
const API_URL = 'https://script.google.com/macros/s/AKfycbzlyKR8z4Wnt351KJpt9HX2Po94rQaRjjBvo8HaRsElg2I-6oLEVTVlxz8pMnOej4jS/exec';

// ==========================================
// STATE MANAGEMENT
// ==========================================
let currentUser  = null;
let photoBase64  = null;
let stream       = null;
let deferredPrompt = null;

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
  const idPelanggan  = document.getElementById('idPelanggan').value.trim();
  const tanggal      = document.getElementById('tanggal').value;
  const nama         = document.getElementById('nama').value.trim();
  const alamat       = document.getElementById('alamat').value.trim();
  const kondisi      = document.getElementById('kondisi').value;       // ✅ UBAH
  const jenisPengguna = document.getElementById('jenisPengguna').value; // ✅ BARU
  const catatan      = document.getElementById('catatan').value.trim();

  // Validasi field wajib teks
  if (!idPelanggan || !tanggal || !nama || !alamat || !kondisi || !jenisPengguna) {
    showNotification('Semua field wajib (*) harus diisi!', 'error');
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
      kondisi,                  // ✅ UBAH: ganti dari 'status'
      jenisPengguna,            // ✅ BARU
      photoBase64,              // ✅ UBAH: selalu terisi (sudah divalidasi)
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
  document.getElementById('kondisi').value        = '';    // ✅ UBAH
  document.getElementById('jenisPengguna').value  = '';    // ✅ BARU
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
        ${detailRow('📅 Tanggal',        record.tanggal || '-')}
        ${detailRow('💧 Kondisi Meter',  `<span class="status-badge ${kondisiClass}">${kondisiIcon} ${record.kondisi}</span>`)}
        ${detailRow('👥 Jenis Pengguna', `<span class="status-badge jenis-badge">${jenisIcon} ${record.jenisPengguna}</span>`)}
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
