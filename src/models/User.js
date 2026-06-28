/**
 * src/models/User.js
 * Mongoose kullanıcı modeli
 *
 * Güvenlik Özellikleri:
 *  - bcryptjs ile şifre hash'leme (salt rounds: 12)
 *  - Şifre alanı varsayılan olarak sorgu sonuçlarından gizlenir
 *  - Başarısız giriş takibi + hesap kilitleme
 *  - Refresh token saklanması
 *  - Şifre değişiklik zamanı takibi (JWT invalidation için)
 */

'use strict';

const mongoose  = require('mongoose');
const bcrypt    = require('bcryptjs');

const SALT_ROUNDS    = 12;
const MAX_ATTEMPTS   = parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5;
const LOCK_TIME_MS   = (parseInt(process.env.LOCK_TIME_MINUTES, 10) || 15) * 60 * 1000;

const userSchema = new mongoose.Schema(
  {
    // ── Temel Bilgiler ──────────────────────────────────────────────────────
    name: {
      type:      String,
      required:  [true, 'Ad alanı zorunludur.'],
      trim:      true,
      minlength: [2,  'Ad en az 2 karakter olmalıdır.'],
      maxlength: [50, 'Ad en fazla 50 karakter olabilir.'],
    },

    email: {
      type:      String,
      required:  [true, 'E-posta alanı zorunludur.'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match: [
        /^[\w-]+(\.[\w-]+)*@([\w-]+\.)+[a-zA-Z]{2,7}$/,
        'Geçerli bir e-posta adresi giriniz.',
      ],
      index: true,
    },

    password: {
      type:      String,
      required:  [true, 'Şifre alanı zorunludur.'],
      minlength: [8,  'Şifre en az 8 karakter olmalıdır.'],
      select:    false, // Varsayılan sorgularda şifreyi getirme
    },

    role: {
      type:    String,
      enum:    ['user', 'admin'],
      default: 'user',
    },

    isActive: {
      type:    Boolean,
      default: true,
      select:  false,
    },

    // ── Güvenlik Alanları ───────────────────────────────────────────────────
    loginAttempts: {
      type:    Number,
      default: 0,
      select:  false,
    },

    lockUntil: {
      type:   Date,
      select: false,
    },

    passwordChangedAt: {
      type:   Date,
      select: false,
    },

    refreshTokens: {
      type:   [String],
      select: false,
      default: [],
    },
  },
  {
    timestamps: true, // createdAt, updatedAt otomatik
    toJSON: {
      transform: (doc, ret) => {
        // API yanıtlarından gizli alanları kaldır
        delete ret.__v;
        delete ret.password;
        delete ret.loginAttempts;
        delete ret.lockUntil;
        delete ret.refreshTokens;
        delete ret.passwordChangedAt;
        return ret;
      },
    },
  }
);

// ── Sanal Alan: Hesap kilitli mi? ───────────────────────────────────────────
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// ── Pre-Save Hook: Şifreyi Hash'le ──────────────────────────────────────────
userSchema.pre('save', async function (next) {
  // Şifre değişmediyse atla
  if (!this.isModified('password')) return next();

  try {
    this.password          = await bcrypt.hash(this.password, SALT_ROUNDS);
    this.passwordChangedAt = new Date(Date.now() - 1000); // JWT'den 1s önceye set et
    next();
  } catch (err) {
    next(err);
  }
});

// ── Method: Şifre Karşılaştırma ─────────────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Method: Başarısız Giriş Denemesi ────────────────────────────────────────
userSchema.methods.incrementLoginAttempts = async function () {
  // Kilit süresi dolmuşsa sayacı sıfırla
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set:   { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Maksimum denemeye ulaşıldıysa kilitle
  if (this.loginAttempts + 1 >= MAX_ATTEMPTS && !this.isLocked) {
    updates.$set = { lockUntil: new Date(Date.now() + LOCK_TIME_MS) };
  }

  return this.updateOne(updates);
};

// ── Method: Başarılı Giriş - Sayacı Sıfırla ─────────────────────────────────
userSchema.methods.resetLoginAttempts = async function () {
  return this.updateOne({
    $set:   { loginAttempts: 0 },
    $unset: { lockUntil: 1 },
  });
};

// ── Method: JWT'nin şifre değişiminden önce çıkarılıp çıkarılmadığını kontrol et ─
userSchema.methods.isPasswordChangedAfter = function (jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedAt = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return jwtTimestamp < changedAt; // true = token geçersiz
  }
  return false;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
