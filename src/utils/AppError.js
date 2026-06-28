/**
 * src/utils/AppError.js
 * Özel uygulama hata sınıfı
 */

'use strict';

class AppError extends Error {
  /**
   * @param {string} message - Kullanıcıya gösterilecek hata mesajı
   * @param {number} statusCode - HTTP durum kodu
   */
  constructor(message, statusCode) {
    super(message);

    this.statusCode = statusCode;
    this.status     = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Tahmin edilen, güvenli hatalar

    // Stack trace'i bu constructor'ı dahil etme
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
