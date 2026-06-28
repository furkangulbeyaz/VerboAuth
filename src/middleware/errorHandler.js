/**
 * src/middleware/errorHandler.js
 * Global hata yönetimi middleware'i
 *
 * Desteklenen hata türleri:
 *  - Mongoose ValidationError
 *  - Mongoose CastError (geçersiz ObjectId)
 *  - Mongoose Duplicate Key (11000)
 *  - JWT JsonWebTokenError
 *  - JWT TokenExpiredError
 *  - AppError (operational errors)
 */

'use strict';

const AppError = require('../utils/AppError');

// ── Mongoose Hata Dönüştürücüler ────────────────────────────────────────────

const handleCastErrorDB = (err) => {
  const message = `Geçersiz ${err.path}: '${err.value}'.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `'${value}' değeri zaten kullanılıyor. Lütfen başka bir değer girin.`;
  return new AppError(message, 409);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Geçersiz giriş: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// ── JWT Hata Dönüştürücüler ──────────────────────────────────────────────────

const handleJWTError = () =>
  new AppError('Geçersiz token. Lütfen tekrar giriş yapın.', 401);

const handleJWTExpiredError = () =>
  new AppError('Token süresi doldu. Lütfen tekrar giriş yapın.', 401);

// ── Yanıt Gönderme ──────────────────────────────────────────────────────────

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    status:  err.status,
    message: err.message,
    stack:   err.stack,
    error:   err,
  });
};

const sendErrorProd = (err, res) => {
  // Operasyonel, bilinen hatalar: güvenli şekilde kullanıcıya bildir
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Programlama hatası: detayları sızdırma
  console.error('⛔ KRİTİK HATA:', err);
  return res.status(500).json({
    success: false,
    message: 'Beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.',
  });
};

// ── Ana Error Handler ────────────────────────────────────────────────────────

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status     = err.status     || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err, message: err.message, name: err.name };

    if (error.name === 'CastError')             error = handleCastErrorDB(error);
    if (error.code === 11000)                   error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError')       error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError')     error = handleJWTError();
    if (error.name === 'TokenExpiredError')     error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

module.exports = errorHandler;
