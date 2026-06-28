/**
 * src/utils/jwt.js
 * JWT token oluşturma ve doğrulama yardımcıları
 */

'use strict';

const jwt = require('jsonwebtoken');

/**
 * Access Token oluştur (kısa ömürlü)
 * @param {string} userId - Kullanıcı ID
 * @returns {string} JWT token
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'access' },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      issuer:    'login-system',
      audience:  'login-system-client',
    }
  );
};

/**
 * Refresh Token oluştur (uzun ömürlü)
 * @param {string} userId - Kullanıcı ID
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer:    'login-system',
      audience:  'login-system-client',
    }
  );
};

/**
 * Access Token doğrula
 * @param {string} token
 * @returns {object} Decoded payload
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET, {
    issuer:   'login-system',
    audience: 'login-system-client',
  });
};

/**
 * Refresh Token doğrula
 * @param {string} token
 * @returns {object} Decoded payload
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
    issuer:   'login-system',
    audience: 'login-system-client',
  });
};

/**
 * Token'ı HTTP-Only cookie'ye yaz
 * @param {object} res   - Express response objesi
 * @param {string} name  - Cookie adı
 * @param {string} token - Token değeri
 * @param {number} maxAge - Cookie ömrü (ms)
 */
const sendTokenCookie = (res, name, token, maxAge) => {
  res.cookie(name, token, {
    httpOnly: true,                                      // JS erişimi yok
    secure:   process.env.NODE_ENV === 'production',     // Sadece HTTPS (prod)
    sameSite: 'strict',                                  // CSRF koruması
    maxAge,
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  sendTokenCookie,
};
