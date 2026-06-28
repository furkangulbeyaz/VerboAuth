/**
 * app.js - Arayüz ve API Mantığı
 */

'use strict';

const API_BASE = window.location.origin + '/api/auth';

let currentTab = 'login';
let accessToken = localStorage.getItem('accessToken') || null;
let angryTimer = null;
let rememberMe = false;

document.addEventListener('DOMContentLoaded', () => {
  // Panel değiştirme butonları
  document.getElementById('switch-to-register').addEventListener('click', () => switchTab('register'));
  document.getElementById('switch-to-login').addEventListener('click', () => switchTab('login'));

  // Form gönderimleri
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('register-form').addEventListener('submit', handleRegister);

  // Oturumu kapatma
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Şifre gizle/göster butonları
  document.getElementById('toggle-login-password').addEventListener('click', function() {
    togglePassword('login-password', this);
  });
  document.getElementById('toggle-register-password').addEventListener('click', function() {
    togglePassword('register-password', this);
  });

  // Beni hatırla butonu
  const rememberBtn = document.getElementById('remember-me-btn');
  if (rememberBtn) {
    const savedRemember = localStorage.getItem('remember_me_active');
    if (savedRemember === 'true') {
      rememberMe = true;
      rememberBtn.classList.add('remember-active');
      rememberBtn.textContent = 'beni hatırlayarak';
    }
    rememberBtn.addEventListener('click', handleRememberToggle);
  }

  // Sakinleştirme butonu
  const apologyBtn = document.getElementById('apologize-btn');
  if (apologyBtn) {
    apologyBtn.addEventListener('click', handleApology);
  }

  // Şifre güç göstergesi
  document.getElementById('register-password').addEventListener('input', updatePasswordStrength);

  // Girdi genişliği ve maskot dinleyicileri
  setupAutoExpandingInputs();
  setupMascotTriggers();

  // Kilit durumunu kontrol et
  checkAngryState();

  // Token varsa kullanıcı bilgilerini çek
  if (accessToken) {
    fetchCurrentUser();
  }
});

// Şifre alanına odaklanınca gözleri kapat
function setupMascotTriggers() {
  const mascot = document.getElementById('mascot-robo');
  if (!mascot) return;

  const passwordInputs = [
    document.getElementById('login-password'),
    document.getElementById('register-password'),
    document.getElementById('register-confirm')
  ];

  passwordInputs.forEach(input => {
    if (!input) return;
    input.addEventListener('focus', () => {
      mascot.classList.add('cover-eyes');
    });
    input.addEventListener('blur', () => {
      mascot.classList.remove('cover-eyes');
    });
  });
}

// Beni hatırla durumu ve robot animasyonu
function handleRememberToggle() {
  const btn = document.getElementById('remember-me-btn');
  const mascot = document.getElementById('mascot-robo');
  const screenText = document.getElementById('robo-screen-text');
  if (!btn || !mascot) return;

  rememberMe = !rememberMe;
  
  if (rememberMe) {
    localStorage.setItem('remember_me_active', 'true');
    btn.classList.add('remember-active');
    btn.textContent = 'beni hatırlayarak';

    // Karalama animasyonu başlat
    mascot.classList.add('writing');
    if (screenText) screenText.textContent = 'MEM...';

    // 1 sn sonra Thumbs Up moduna geç
    setTimeout(() => {
      mascot.classList.remove('writing');
      mascot.classList.add('ok-sign');
      if (screenText) screenText.textContent = 'SAVED 👍';

      // 1.5 sn sonra normal haline dön
      setTimeout(() => {
        mascot.classList.remove('ok-sign');
        if (screenText) screenText.textContent = '';
      }, 1500);

    }, 1000);

    showToast('Beni hatırla özelliği aktif edildi.', 'success');
  } else {
    localStorage.removeItem('remember_me_active');
    btn.classList.remove('remember-active');
    btn.textContent = 'beni hatırlamadan';
    showToast('Beni hatırla özelliği devre dışı bırakıldı.', 'success');
  }
  
  animateCardHeight();
}

// Özür butonu limit ve bekleme süresi ayarları
let isApologyOnCooldown = false;
let randomToggleTimer = null;
let isSignalOnline = true;

function updateApologyButtonText(clicks) {
  const apologyBtn = document.getElementById('apologize-btn');
  if (!apologyBtn) return;
  
  const remainingClicks = 3 - clicks;
  if (remainingClicks <= 0) {
    apologyBtn.textContent = '❌ Robot özür kabul etmiyor!';
    apologyBtn.disabled = true;
    if (randomToggleTimer) clearTimeout(randomToggleTimer);
    return;
  }

  if (isApologyOnCooldown) {
    apologyBtn.textContent = `⏳ Robot Düşünüyor... [Kalan Hak: ${remainingClicks}]`;
    apologyBtn.disabled = true;
  } else if (!isSignalOnline) {
    apologyBtn.textContent = `📡 Parazit Algılandı... [Kalan Hak: ${remainingClicks}]`;
    apologyBtn.disabled = true;
  } else {
    apologyBtn.textContent = `🤖 Özür Dile (-10s) [Kalan Hak: ${remainingClicks}]`;
    apologyBtn.disabled = false;
  }
}

// Butonun rastgele aktif/pasif olması
function startRandomApologyToggles() {
  if (randomToggleTimer) clearTimeout(randomToggleTimer);
  
  const angryUntil = localStorage.getItem('angry_until');
  const clicks = parseInt(localStorage.getItem('apology_clicks') || '0', 10);
  if (!angryUntil || clicks >= 3) return;

  const nextToggleTime = 1500 + Math.random() * 2000;

  randomToggleTimer = setTimeout(() => {
    if (!isApologyOnCooldown) {
      isSignalOnline = Math.random() > 0.5;
      updateApologyButtonText(clicks);
    }
    startRandomApologyToggles();
  }, nextToggleTime);
}

// Robotu sakinleştirme işlevi
function handleApology() {
  const mascot = document.getElementById('mascot-robo');
  const screenText = document.getElementById('robo-screen-text');
  const apologyContainer = document.getElementById('apology-container');
  const timerContainer = document.getElementById('cooldown-timer');
  const apologyBtn = document.getElementById('apologize-btn');
  if (!mascot || isApologyOnCooldown || !isSignalOnline) return;

  const angryUntil = localStorage.getItem('angry_until');
  if (!angryUntil) return;

  let clicks = parseInt(localStorage.getItem('apology_clicks') || '0', 10);
  if (clicks >= 3) return;

  clicks++;
  localStorage.setItem('apology_clicks', clicks);

  // 5 saniyelik cooldown başlat
  isApologyOnCooldown = true;
  updateApologyButtonText(clicks);

  // Süreden 10 sn düşür
  let newAngryUntil = parseInt(angryUntil, 10) - 10 * 1000;
  localStorage.setItem('angry_until', newAngryUntil);

  if (screenText) {
    screenText.textContent = '-10s 👍';
    screenText.setAttribute('fill', '#10b981');
  }
  
  mascot.classList.remove('angry');
  mascot.classList.add('ok-sign');

  showToast('Özür dileme başarılı! Ceza süresi 10 saniye kısaltıldı.', 'success');

  // Cooldown bitişi
  setTimeout(() => {
    isApologyOnCooldown = false;
    isSignalOnline = true;
    updateApologyButtonText(clicks);
    startRandomApologyToggles();
  }, 5000);

  // 800ms sonra hala ceza varsa robotu tekrar sinirlendir
  setTimeout(() => {
    mascot.classList.remove('ok-sign');
    const remainingTime = parseInt(localStorage.getItem('angry_until'), 10) - Date.now();
    if (remainingTime > 0) {
      mascot.classList.add('angry');
      if (screenText) {
        screenText.textContent = '';
        screenText.setAttribute('fill', '#6366f1');
      }
    }
  }, 800);

  checkAngryState();
}

// Robot ceza durumunu kontrol et
function checkAngryState() {
  const mascot = document.getElementById('mascot-robo');
  const apologyContainer = document.getElementById('apology-container');
  const timerContainer = document.getElementById('cooldown-timer');
  const timerCountdown = document.getElementById('timer-countdown');
  if (!mascot) return;

  const angryUntil = localStorage.getItem('angry_until');
  if (angryUntil) {
    const updateCountdown = () => {
      const timeLeft = parseInt(localStorage.getItem('angry_until'), 10) - Date.now();
      
      if (timeLeft <= 0) {
        clearInterval(angryTimer);
        mascot.classList.remove('angry');
        mascot.classList.remove('ok-sign');
        
        if (timerContainer) {
          timerContainer.setAttribute('hidden', '');
          timerContainer.style.display = 'none';
        }
        if (apologyContainer) {
          apologyContainer.setAttribute('hidden', '');
          apologyContainer.style.display = 'none';
          animateCardHeight();
        }
        
        localStorage.removeItem('angry_until');
        localStorage.removeItem('failed_attempts');
        localStorage.removeItem('apology_clicks');
        showToast('Robot sakinleşti. Giriş yapmayı tekrar deneyebilirsiniz.', 'success');
      } else {
        if (timerContainer) {
          timerContainer.removeAttribute('hidden');
          timerContainer.style.display = 'flex';
        }
        
        const mins = Math.floor(timeLeft / 60000);
        const secs = Math.floor((timeLeft % 60000) / 1000);
        if (timerCountdown) {
          timerCountdown.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }

        // Son 1 dakika kala özür dileme panelini göster
        if (timeLeft <= 60000) {
          if (apologyContainer && (apologyContainer.hasAttribute('hidden') || apologyContainer.style.display !== 'flex')) {
            apologyContainer.removeAttribute('hidden');
            apologyContainer.style.display = 'flex';
            
            isApologyOnCooldown = false;
            isSignalOnline = true;
            const clicks = parseInt(localStorage.getItem('apology_clicks') || '0', 10);
            updateApologyButtonText(clicks);
            startRandomApologyToggles();
            
            animateCardHeight();
          }
        } else {
          if (apologyContainer && (!apologyContainer.hasAttribute('hidden') || apologyContainer.style.display !== 'none')) {
            apologyContainer.setAttribute('hidden', '');
            apologyContainer.style.display = 'none';
          }
        }
      }
    };

    mascot.classList.add('angry');
    updateCountdown();
    
    if (angryTimer) clearInterval(angryTimer);
    angryTimer = setInterval(updateCountdown, 1000);
  } else {
    if (timerContainer) {
      timerContainer.setAttribute('hidden', '');
      timerContainer.style.display = 'none';
    }
    if (apologyContainer) {
      apologyContainer.setAttribute('hidden', '');
      apologyContainer.style.display = 'none';
      if (randomToggleTimer) clearTimeout(randomToggleTimer);
    }
    mascot.classList.remove('angry');
  }
}

// Giriş denemesi başarısız olunca sayacı artır
function handleFailedAttempt() {
  const mascot = document.getElementById('mascot-robo');
  if (!mascot) return;

  let failedAttempts = parseInt(localStorage.getItem('failed_attempts') || '0', 10);
  failedAttempts++;
  localStorage.setItem('failed_attempts', failedAttempts);

  if (failedAttempts >= 3) {
    // 2 dakika kilitleme süresi
    const angryDuration = 2 * 60 * 1000;
    const angryUntil = Date.now() + angryDuration;
    localStorage.setItem('angry_until', angryUntil);
    localStorage.setItem('apology_clicks', '0');
    
    mascot.classList.add('angry');
    showToast('Çok fazla hatalı giriş! Robot sinirlendi. (2 dk engellendiniz)', 'error');
    
    checkAngryState();
  }
}

// Kart yüksekliğini yumuşakça esnet
function animateCardHeight() {
  const card = document.getElementById('auth-card');
  if (!card || card.hidden) return;

  const startHeight = card.getBoundingClientRect().height;
  card.style.height = 'auto';
  const targetHeight = card.getBoundingClientRect().height;
  card.style.height = `${startHeight}px`;

  void card.offsetHeight;
  card.style.height = `${targetHeight}px`;

  const onTransitionEnd = (e) => {
    if (e.propertyName === 'height') {
      card.style.height = 'auto';
      card.removeEventListener('transitionend', onTransitionEnd);
    }
  };
  card.addEventListener('transitionend', onTransitionEnd);
}

// Harf sayısına göre input genişliklerini ayarla
function setupAutoExpandingInputs() {
  const inputs = document.querySelectorAll('.inline-input');
  
  let helper = document.getElementById('input-width-helper');
  if (!helper) {
    helper = document.createElement('span');
    helper.id = 'input-width-helper';
    Object.assign(helper.style, {
      position: 'absolute',
      visibility: 'hidden',
      height: '0',
      overflow: 'hidden',
      whiteSpace: 'pre',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      fontSize: '1.45rem',
      fontWeight: '500',
      letterSpacing: '0.05em'
    });
    document.body.appendChild(helper);
  }

  const resizeInput = (input) => {
    const text = input.value || input.placeholder || '';
    helper.textContent = text;
    const width = Math.max(helper.getBoundingClientRect().width + 16, 100);
    input.style.width = `${width}px`;

    const wrapper = input.closest('.inline-input-wrapper');
    if (wrapper) {
      if (input.value.length > 0) {
        wrapper.classList.add('has-value');
      } else {
        wrapper.classList.remove('has-value');
      }
    }
    
    animateCardHeight();
  };

  inputs.forEach(input => {
    resizeInput(input);
    input.addEventListener('input', () => {
      input.classList.remove('error');
      resizeInput(input);
    });
  });
}

// Paneller arasında geçiş yap
function switchTab(tab) {
  if (tab === currentTab) return;
  currentTab = tab;

  const loginPanel    = document.getElementById('panel-login');
  const registerPanel = document.getElementById('panel-register');

  if (tab === 'login') {
    loginPanel.classList.add('active');
    loginPanel.hidden = false;
    registerPanel.classList.remove('active');
    registerPanel.hidden = true;
  } else {
    registerPanel.classList.add('active');
    registerPanel.hidden = false;
    loginPanel.classList.remove('active');
    loginPanel.hidden = true;
  }

  clearErrors();
  
  const inputs = document.querySelectorAll('.inline-input');
  inputs.forEach(input => {
    const event = new Event('input');
    input.dispatchEvent(event);
  });
}

// Giriş işlemi
async function handleLogin(e) {
  e.preventDefault();
  clearErrors();

  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const btn = document.getElementById('login-submit-btn');

  if (localStorage.getItem('angry_until') && parseInt(localStorage.getItem('angry_until'), 10) > Date.now()) {
    shakeForm();
    showToast('Robot hâlâ sinirli! Lütfen bekleyin veya robottan özür dileyin.', 'error');
    return;
  }

  let valid = true;
  if (!emailInput.value.trim()) {
    emailInput.classList.add('error');
    valid = false;
  }
  if (!passwordInput.value) {
    passwordInput.classList.add('error');
    valid = false;
  }

  if (!valid) {
    shakeForm();
    showToast('Lütfen boş bırakılan alanları doldurun.', 'error');
    return;
  }

  setLoading(btn, true);

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: emailInput.value.trim(), password: passwordInput.value })
    });

    const data = await res.json();

    if (!res.ok) {
      shakeForm();
      showToast(data.message || 'Giriş işlemi başarısız.', 'error');
      
      handleFailedAttempt();

      if (data.message && data.message.includes('e-posta')) {
        emailInput.classList.add('error');
      } else {
        passwordInput.classList.add('error');
      }
      return;
    }

    if (data.data?.accessToken) {
      accessToken = data.data.accessToken;
      localStorage.setItem('accessToken', accessToken);
    }

    localStorage.removeItem('failed_attempts');
    localStorage.removeItem('angry_until');
    
    showToast(`Başarıyla giriş yapıldı. Hoş geldin, ${data.data.user.name}`, 'success');
    setTimeout(() => showDashboard(data.data.user), 600);
  } catch (err) {
    shakeForm();
    showToast('Sunucuya bağlanırken hata oluştu.', 'error');
  } finally {
    setLoading(btn, false);
  }
}

// Kayıt işlemi
async function handleRegister(e) {
  e.preventDefault();
  clearErrors();

  const nameInput = document.getElementById('register-name');
  const emailInput = document.getElementById('register-email');
  const passwordInput = document.getElementById('register-password');
  const confirmInput = document.getElementById('register-confirm');
  const btn = document.getElementById('register-submit-btn');

  let valid = true;
  if (!nameInput.value.trim() || nameInput.value.trim().length < 2) {
    nameInput.classList.add('error');
    valid = false;
  }
  if (!emailInput.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
    emailInput.classList.add('error');
    valid = false;
  }
  if (passwordInput.value.length < 8) {
    passwordInput.classList.add('error');
    valid = false;
  } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.,#^()\-_=+])/.test(passwordInput.value)) {
    passwordInput.classList.add('error');
    valid = false;
  }
  if (passwordInput.value !== confirmInput.value) {
    confirmInput.classList.add('error');
    valid = false;
  }

  if (!valid) {
    shakeForm();
    showToast('Gereksinimler sağlanamadı. Şifrenizi kontrol edin.', 'error');
    return;
  }

  setLoading(btn, true);

  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passwordInput.value,
        passwordConfirm: confirmInput.value
      })
    });

    const data = await res.json();

    if (!res.ok) {
      shakeForm();
      showToast(data.message || 'Kayıt işlemi başarısız.', 'error');
      return;
    }

    if (data.data?.accessToken) {
      accessToken = data.data.accessToken;
      localStorage.setItem('accessToken', accessToken);
    }

    showToast('Hesabınız başarıyla oluşturuldu! 🎉', 'success');
    setTimeout(() => showDashboard(data.data.user), 600);
  } catch (err) {
    shakeForm();
    showToast('Sunucuya bağlanırken hata oluştu.', 'error');
  } finally {
    setLoading(btn, false);
  }
}

// Oturumu kapat
async function handleLogout() {
  try {
    await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` },
      credentials: 'include'
    });
  } catch (_) {}

  accessToken = null;
  localStorage.removeItem('accessToken');
  showToast('Oturum kapatıldı.', 'success');
  setTimeout(() => showAuthCard(), 400);
}

// Mevcut kullanıcıyı çek
async function fetchCurrentUser() {
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      credentials: 'include'
    });

    if (!res.ok) {
      accessToken = null;
      localStorage.removeItem('accessToken');
      return;
    }

    const data = await res.json();
    showDashboard(data.data.user);
  } catch (_) {}
}

// Dashboard göster
function showDashboard(user) {
  document.getElementById('panel-login').hidden = true;
  document.getElementById('panel-register').hidden = true;
  
  const authCard = document.getElementById('auth-card');
  if (authCard) {
    authCard.setAttribute('hidden', '');
    authCard.style.display = 'none';
  }
  
  const dashCard = document.getElementById('dashboard-card');
  const avatar = document.getElementById('dashboard-avatar');
  const nameEl = document.getElementById('dashboard-welcome');
  const emailEl = document.getElementById('dashboard-email');

  const initials = user.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  avatar.textContent = initials;
  nameEl.textContent = user.name;
  emailEl.textContent = `${user.email} // ${user.role.toUpperCase()}`;

  dashCard.classList.add('active');
  dashCard.removeAttribute('hidden');
  dashCard.style.display = 'block';
}

// Auth kartını göster
function showAuthCard() {
  const dashCard = document.getElementById('dashboard-card');
  if (dashCard) {
    dashCard.setAttribute('hidden', '');
    dashCard.style.display = 'none';
    dashCard.classList.remove('active');
  }
  
  const authCard = document.getElementById('auth-card');
  if (authCard) {
    authCard.removeAttribute('hidden');
    authCard.style.display = 'block';
  }
  
  document.getElementById('login-form').reset();
  document.getElementById('register-form').reset();
  
  clearErrors();
  currentTab = 'register';
  switchTab('login');
}

// Hataları temizle
function clearErrors() {
  document.querySelectorAll('.inline-input').forEach(el => el.classList.remove('error'));
}

// Formu titret
function shakeForm() {
  const sentence = document.querySelector('.form-panel.active .natural-sentence');
  if (!sentence) return;
  sentence.classList.remove('shake');
  void sentence.offsetWidth;
  sentence.classList.add('shake');
}

// Yükleniyor durumu
function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = 'işleniyor...';
  } else {
    btn.textContent = btn.dataset.originalText || btn.textContent;
  }
}

// Toast göster
let toastTimer = null;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  if (!toast) return;

  if (toastTimer) clearTimeout(toastTimer);
  toast.className = `toast toast-${type}`;
  msgEl.textContent = msg;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}

// Şifre gücü hesaplama
function updatePasswordStrength(e) {
  const pwd = e.target.value;
  const bars = [
    document.getElementById('bar-1'),
    document.getElementById('bar-2'),
    document.getElementById('bar-3'),
    document.getElementById('bar-4')
  ];
  const label = document.getElementById('strength-label');

  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[@$!%*?&.,#^()\-_=+]/.test(pwd)) score++;

  bars.forEach(b => { b.className = 'strength-bar'; });

  if (pwd.length === 0) {
    label.textContent = '';
    return;
  }

  const configs = [
    { cls: 'weak', text: 'ZAYIF', color: '#f43f5e' },
    { cls: 'weak', text: 'KOLAY', color: '#f43f5e' },
    { cls: 'medium', text: 'ORTA', color: '#fbbf24' },
    { cls: 'strong', text: 'GÜÇLÜ', color: '#10b981' },
    { cls: 'strong', text: 'ÇOK GÜÇLÜ', color: '#10b981' }
  ];

  const conf = configs[score] || configs[0];
  for (let i = 0; i < score; i++) bars[i].classList.add(conf.cls);
  label.textContent = conf.text;
  label.style.color = conf.color;
}

// Şifre göster/gizle
function togglePassword(id, btn) {
  const input = document.getElementById(id);
  const mascot = document.getElementById('mascot-robo');
  if (!input) return;

  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  btn.textContent = isPass ? 'gizle' : 'göster';

  if (mascot) {
    if (isPass) {
      mascot.classList.add('peeking');
    } else {
      mascot.classList.remove('peeking');
    }
  }
}
