/**
 * src/controllers/authController.js
 * Kimlik doğrulama endpoint controller'ları
 *
 * Endpoints:
 *  POST /api/auth/register      - Yeni kullanıcı kaydı
 *  POST /api/auth/login         - Giriş yap
 *  POST /api/auth/logout        - Çıkış yap
 *  POST /api/auth/refresh-token - Access token yenile
 *  GET  /api/auth/me            - Mevcut kullanıcı bilgisi (korumalı)
 *  PUT  /api/auth/change-password - Şifre değiştir (korumalı)
 */

'use strict';

const User      = require('../models/User');
const AppError  = require('../utils/AppError');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  sendTokenCookie,
} = require('../utils/jwt');

// Hata callback'ini async sarmalayan yardımcı
const catchAsync = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Token'ları cookie ve response body'e ekle
const sendAuthResponse = (user, statusCode, req, res) => {
  const accessToken  = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  // HTTP-Only cookie'ye yaz
  sendTokenCookie(res, 'accessToken',  accessToken,  15 * 60 * 1000);          // 15 dk
  sendTokenCookie(res, 'refreshToken', refreshToken, 7 * 24 * 60 * 60 * 1000); // 7 gün

  res.status(statusCode).json({
    success: true,
    message: statusCode === 201 ? 'Kayıt başarılı.' : 'Giriş başarılı.',
    data: {
      user,
      accessToken,  // İstemci taraflı depolama için (opsiyonel)
    },
  });

  return refreshToken; // DB'ye kayıt için
};

// ── REGISTER ────────────────────────────────────────────────────────────────

exports.register = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;

  // E-posta zaten kullanılıyor mu?
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return next(new AppError('Bu e-posta adresi zaten kayıtlı.', 409));
  }

  // Kullanıcı oluştur (şifre pre-save hook ile hash'lenir)
  const user = await User.create({ name, email, password });

  const refreshToken = sendAuthResponse(user, 201, req, res);

  // Refresh token'ı DB'ye kaydet
  await User.findByIdAndUpdate(user._id, {
    $push: { refreshTokens: refreshToken },
  });
});

// ── LOGIN ────────────────────────────────────────────────────────────────────

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Şifre dahil kullanıcıyı getir
  const user = await User.findOne({ email })
    .select('+password +loginAttempts +lockUntil +isActive +refreshTokens');

  if (!user) {
    // Kullanıcı bulunamadı - timing attack önleme için genel mesaj
    return next(new AppError('E-posta veya şifre hatalı.', 401));
  }

  // Hesap aktif mi?
  if (!user.isActive) {
    return next(new AppError('Hesabınız devre dışı bırakılmış. Destek ekibiyle iletişime geçin.', 403));
  }

  // Hesap kilitli mi?
  if (user.isLocked) {
    const lockMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return next(
      new AppError(
        `Hesabınız kilitlendi. ${lockMinutes} dakika sonra tekrar deneyin.`,
        423
      )
    );
  }

  // Şifre doğru mu?
  const isPasswordCorrect = await user.comparePassword(password);

  if (!isPasswordCorrect) {
    await user.incrementLoginAttempts();

    const remaining = Math.max(0, (parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5) - (user.loginAttempts + 1));
    const message = remaining > 0
      ? `E-posta veya şifre hatalı. ${remaining} deneme hakkınız kaldı.`
      : 'Çok fazla başarısız deneme. Hesabınız kilitlendi.';

    return next(new AppError(message, 401));
  }

  // Başarılı giriş: sayacı sıfırla
  await user.resetLoginAttempts();

  const refreshToken = sendAuthResponse(user, 200, req, res);

  // Yeni refresh token'ı kaydet (max 5 cihaz)
  const updatedTokens = [...(user.refreshTokens || []), refreshToken].slice(-5);
  await User.findByIdAndUpdate(user._id, { refreshTokens: updatedTokens });
});

// ── LOGOUT ──────────────────────────────────────────────────────────────────

exports.logout = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    // Refresh token'ı DB'den sil
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { refreshTokens: refreshToken },
    });
  }

  // Cookie'leri temizle
  res.clearCookie('accessToken',  { httpOnly: true, sameSite: 'strict' });
  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'strict' });

  res.status(200).json({
    success: true,
    message: 'Başarıyla çıkış yapıldı.',
  });
});

// ── LOGOUT ALL (Tüm cihazlardan çıkış) ─────────────────────────────────────

exports.logoutAll = catchAsync(async (req, res, next) => {
  // Tüm refresh token'ları sil
  await User.findByIdAndUpdate(req.user._id, { refreshTokens: [] });

  res.clearCookie('accessToken',  { httpOnly: true, sameSite: 'strict' });
  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'strict' });

  res.status(200).json({
    success: true,
    message: 'Tüm cihazlardan başarıyla çıkış yapıldı.',
  });
});

// ── REFRESH TOKEN ────────────────────────────────────────────────────────────

exports.refreshToken = catchAsync(async (req, res, next) => {
  const token = req.cookies.refreshToken || req.body.refreshToken;

  if (!token) {
    return next(new AppError('Refresh token bulunamadı. Lütfen tekrar giriş yapın.', 401));
  }

  // Token doğrula
  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch (err) {
    return next(new AppError('Geçersiz veya süresi dolmuş refresh token.', 401));
  }

  if (decoded.type !== 'refresh') {
    return next(new AppError('Geçersiz token türü.', 401));
  }

  // Kullanıcıyı bul ve token DB'de var mı kontrol et (Token Rotation)
  const user = await User.findById(decoded.id).select('+refreshTokens +isActive');

  if (!user || !user.isActive) {
    return next(new AppError('Kullanıcı bulunamadı veya hesap devre dışı.', 401));
  }

  if (!user.refreshTokens.includes(token)) {
    // Token yeniden kullanım tespiti: Tüm token'ları geçersiz kıl!
    await User.findByIdAndUpdate(decoded.id, { refreshTokens: [] });
    return next(
      new AppError('Güvenlik ihlali tespit edildi. Lütfen tekrar giriş yapın.', 401)
    );
  }

  // Eski token'ı kaldır, yeni token'ları oluştur (Refresh Token Rotation)
  const newAccessToken  = generateAccessToken(user._id);
  const newRefreshToken = generateRefreshToken(user._id);

  const updatedTokens = user.refreshTokens
    .filter((t) => t !== token)
    .concat(newRefreshToken)
    .slice(-5);

  await User.findByIdAndUpdate(user._id, { refreshTokens: updatedTokens });

  sendTokenCookie(res, 'accessToken',  newAccessToken,  15 * 60 * 1000);
  sendTokenCookie(res, 'refreshToken', newRefreshToken, 7 * 24 * 60 * 60 * 1000);

  res.status(200).json({
    success:     true,
    accessToken: newAccessToken,
  });
});

// ── GET ME ───────────────────────────────────────────────────────────────────

exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new AppError('Kullanıcı bulunamadı.', 404));
  }

  res.status(200).json({
    success: true,
    data: { user },
  });
});

// ── CHANGE PASSWORD ──────────────────────────────────────────────────────────

exports.changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password +refreshTokens');

  if (!user) {
    return next(new AppError('Kullanıcı bulunamadı.', 404));
  }

  // Mevcut şifre doğru mu?
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    return next(new AppError('Mevcut şifre hatalı.', 401));
  }

  // Yeni şifre mevcut şifreden farklı mı?
  const isSame = await user.comparePassword(newPassword);
  if (isSame) {
    return next(new AppError('Yeni şifre mevcut şifreden farklı olmalıdır.', 400));
  }

  // Şifreyi güncelle (pre-save hook ile hash'lenir)
  user.password = newPassword;
  await user.save();

  // Tüm refresh token'ları geçersiz kıl (diğer cihazlardan çıkış)
  await User.findByIdAndUpdate(user._id, { refreshTokens: [] });

  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'strict' });

  // Yeni token'lar oluştur
  const refreshToken = sendAuthResponse(user, 200, req, res);
  await User.findByIdAndUpdate(user._id, {
    refreshTokens: [refreshToken],
  });
});
