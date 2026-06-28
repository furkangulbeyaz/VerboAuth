/**
 * src/middleware/auth.js
 * JWT Bearer token doğrulama middleware'i
 */

'use strict';

const { verifyAccessToken } = require('../utils/jwt');
const AppError              = require('../utils/AppError');
const User                  = require('../models/User');

/**
 * Korumalı rotalar için JWT doğrulama
 * Authorization: Bearer <token> header'ı beklenir
 */
const protect = async (req, res, next) => {
  try {
    // 1. Token'ı al
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      // Cookie'den de alabiliriz
      token = req.cookies.accessToken;
    }

    if (!token) {
      return next(new AppError('Bu işlem için giriş yapmanız gerekiyor.', 401));
    }

    // 2. Token'ı doğrula
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Oturumunuz sona erdi. Lütfen tekrar giriş yapın.', 401));
      }
      return next(new AppError('Geçersiz token. Lütfen tekrar giriş yapın.', 401));
    }

    // 3. Token tipi kontrolü
    if (decoded.type !== 'access') {
      return next(new AppError('Geçersiz token türü.', 401));
    }

    // 4. Kullanıcı hâlâ var mı?
    const currentUser = await User.findById(decoded.id).select('+isActive +passwordChangedAt');
    if (!currentUser) {
      return next(new AppError('Bu token\'a ait kullanıcı artık mevcut değil.', 401));
    }

    // 5. Kullanıcı aktif mi?
    if (!currentUser.isActive) {
      return next(new AppError('Hesabınız devre dışı bırakılmış. Destek ekibiyle iletişime geçin.', 401));
    }

    // 6. Şifre token'dan sonra değiştirildi mi?
    if (currentUser.isPasswordChangedAfter(decoded.iat)) {
      return next(new AppError('Şifreniz değiştirilmiş. Lütfen tekrar giriş yapın.', 401));
    }

    // Kullanıcıyı request'e ekle
    req.user = currentUser;
    next();

  } catch (error) {
    next(error);
  }
};

/**
 * Rol tabanlı yetkilendirme
 * @param {...string} roles - İzin verilen roller
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('Bu işlemi gerçekleştirme yetkiniz yok.', 403)
      );
    }
    next();
  };
};

module.exports = { protect, restrictTo };
