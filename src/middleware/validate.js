/**
 * src/middleware/validate.js
 * express-validator ile request doğrulama middleware'leri
 */

'use strict';

const { body, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Validation hatalarını kontrol et ve yanıt döndür
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const messages = errors.array().map((err) => err.msg);
    return next(new AppError(messages.join('. '), 400));
  }

  next();
};

/**
 * Kayıt için doğrulama kuralları
 */
const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Ad alanı zorunludur.')
    .isLength({ min: 2, max: 50 }).withMessage('Ad 2-50 karakter arasında olmalıdır.')
    .matches(/^[a-zA-ZğüşıöçĞÜŞİÖÇ\s]+$/).withMessage('Ad yalnızca harf içerebilir.'),

  body('email')
    .trim()
    .notEmpty().withMessage('E-posta alanı zorunludur.')
    .isEmail().withMessage('Geçerli bir e-posta adresi giriniz.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Şifre alanı zorunludur.')
    .isLength({ min: 8 }).withMessage('Şifre en az 8 karakter olmalıdır.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.,#^()\-_=+])/)
    .withMessage('Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir.'),

  body('passwordConfirm')
    .notEmpty().withMessage('Şifre onay alanı zorunludur.')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Şifreler eşleşmiyor.');
      }
      return true;
    }),

  handleValidationErrors,
];

/**
 * Giriş için doğrulama kuralları
 */
const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('E-posta alanı zorunludur.')
    .isEmail().withMessage('Geçerli bir e-posta adresi giriniz.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Şifre alanı zorunludur.')
    .isLength({ min: 1 }).withMessage('Şifre alanı boş bırakılamaz.'),

  handleValidationErrors,
];

/**
 * Şifre değiştirme için doğrulama kuralları
 */
const validateChangePassword = [
  body('currentPassword')
    .notEmpty().withMessage('Mevcut şifre zorunludur.'),

  body('newPassword')
    .notEmpty().withMessage('Yeni şifre zorunludur.')
    .isLength({ min: 8 }).withMessage('Yeni şifre en az 8 karakter olmalıdır.')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.,#^()\-_=+])/)
    .withMessage('Şifre en az bir büyük harf, bir küçük harf, bir rakam ve bir özel karakter içermelidir.'),

  body('newPasswordConfirm')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Yeni şifreler eşleşmiyor.');
      }
      return true;
    }),

  handleValidationErrors,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateChangePassword,
};
