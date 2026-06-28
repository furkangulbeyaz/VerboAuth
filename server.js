'use strict';

const path = require('path');

// Env ayarlari
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express       = require('express');
const mongoose      = require('mongoose');
const helmet        = require('helmet');
const cors          = require('cors');
const rateLimit     = require('express-rate-limit');
const xssLib        = require('xss');
const mongoSanitize = require('express-mongo-sanitize');
const morgan        = require('morgan');

const connectDB      = require('./src/config/database');
const authRoutes     = require('./src/routes/authRoutes');
const errorHandler   = require('./src/middleware/errorHandler');
const AppError       = require('./src/utils/AppError');

const app = express();

// Veritabanı baglantısı
connectDB();

// Helmet ile HTTP guvenlik basliklari
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],
        scriptSrc:  ["'self'"],
        imgSrc:     ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy:   { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    dnsPrefetchControl:        { allow: false },
    frameguard:                { action: 'deny' },
    hidePoweredBy:             true,
    hsts: {
      maxAge:            31536000,
      includeSubDomains: true,
      preload:           true,
    },
    ieNoOpen:         true,
    noSniff:          true,
    referrerPolicy:   { policy: 'strict-origin-when-cross-origin' },
    xssFilter:        true,
  })
);

// CORS ayarları
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new AppError(`CORS policy: '${origin}' izin verilmiyor.`, 403));
    }
  },
  methods:          ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders:   ['Content-Type', 'Authorization'],
  exposedHeaders:   ['X-Total-Count'],
  credentials:      true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Genel rate limiter
const generalLimiter = rateLimit({
  windowMs:        parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max:             parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    status:  429,
    success: false,
    message: 'Çok fazla istek gönderdiniz. Lütfen 15 dakika sonra tekrar deneyin.',
  },
  skipSuccessfulRequests: false,
});
app.use('/api', generalLimiter);

// Auth endpointleri icin rate limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 10,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    status:  429,
    success: false,
    message: 'Çok fazla kimlik doğrulama denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
  },
  skipSuccessfulRequests: true,
});
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// XSS temizleme
const xssSanitize = (obj) => {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      obj[key] = xssLib(obj[key]);
    } else if (typeof obj[key] === 'object') {
      xssSanitize(obj[key]);
    }
  }
};
app.use((req, res, next) => {
  xssSanitize(req.body);
  xssSanitize(req.query);
  xssSanitize(req.params);
  next();
});

// NoSQL injection koruması
app.use(
  mongoSanitize({
    replaceWith:  '_',
    onSanitizeError: (req, res) => {
      res.status(400).json({
        success: false,
        message: 'Geçersiz karakter tespit edildi. İstek reddedildi.',
      });
    },
  })
);

// Loglama (Sadece dev)
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Server header temizligi
app.use((req, res, next) => {
  res.removeHeader('Server');
  next();
});

// Statik dosyaları sunma (Frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Rotalar
app.use('/api/auth', authRoutes);

// Health check endpointi
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server çalışıyor.',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// 404
app.all('*', (req, res, next) => {
  next(new AppError(`'${req.originalUrl}' endpoint bulunamadı.`, 404));
});

// Hata yakalama middleware
app.use(errorHandler);

// Sunucuyu baslat
const PORT = parseInt(process.env.PORT, 10) || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server http://localhost:${PORT} portunda calisiyor.`);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n⚠️  ${signal} alindi. Kapatiliyor...`);
  server.close(async () => {
    try {
      await mongoose.connection.close();
      console.log('✅ MongoDB baglantisi kapatildi.');
      process.exit(0);
    } catch (err) {
      console.error('❌ Hata:', err.message);
      process.exit(1);
    }
  });
  setTimeout(() => {
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (err) => {
  console.error('❌ Hata:', err.name, '-', err.message);
  gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  console.error('❌ Hata:', err.name, '-', err.message);
  gracefulShutdown('uncaughtException');
});

module.exports = app;
