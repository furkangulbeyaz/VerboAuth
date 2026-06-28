/**
 * src/routes/authRoutes.js
 * Kimlik doğrulama rotaları
 */

'use strict';

const express = require('express');
const router  = express.Router();

const {
  register,
  login,
  logout,
  logoutAll,
  refreshToken,
  getMe,
  changePassword,
} = require('../controllers/authController');

const { protect }                                    = require('../middleware/auth');
const { validateRegister, validateLogin,
        validateChangePassword }                      = require('../middleware/validate');

// ── Public Rotalar ────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 * Yeni kullanıcı kaydı
 * Body: { name, email, password, passwordConfirm }
 */
router.post('/register', validateRegister, register);

/**
 * POST /api/auth/login
 * Kullanıcı girişi
 * Body: { email, password }
 */
router.post('/login', validateLogin, login);

/**
 * POST /api/auth/refresh-token
 * Access token yenileme (cookie veya body'deki refresh token kullanılır)
 */
router.post('/refresh-token', refreshToken);

// ── Korumalı Rotalar (JWT Gerektirir) ────────────────────────────────────────

/**
 * POST /api/auth/logout
 * Mevcut cihazdan çıkış
 */
router.post('/logout', protect, logout);

/**
 * POST /api/auth/logout-all
 * Tüm cihazlardan çıkış
 */
router.post('/logout-all', protect, logoutAll);

/**
 * GET /api/auth/me
 * Giriş yapmış kullanıcının bilgilerini getir
 */
router.get('/me', protect, getMe);

/**
 * PUT /api/auth/change-password
 * Şifre değiştirme
 * Body: { currentPassword, newPassword, newPasswordConfirm }
 */
router.put('/change-password', protect, validateChangePassword, changePassword);

module.exports = router;
