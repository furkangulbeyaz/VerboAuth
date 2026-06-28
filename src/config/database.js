/**
 * src/config/database.js
 * MongoDB bağlantı konfigürasyonu
 */

'use strict';

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error('MONGODB_URI environment variable tanımlanmamış!');
    }

    const options = {
      // Bağlantı güvenliği
      serverSelectionTimeoutMS: 5000,   // 5 saniyede bağlanamazsa hata ver
      socketTimeoutMS:          45000,  // Uzun sorguları kes
      connectTimeoutMS:         10000,

      // Connection Pool
      maxPoolSize:    10,  // Maksimum eş zamanlı bağlantı
      minPoolSize:    2,

      // Otomatik yeniden bağlanma
      heartbeatFrequencyMS: 10000,
    };

    const conn = await mongoose.connect(uri, options);

    console.log(`✅ MongoDB bağlandı: ${conn.connection.host}`);

    // Bağlantı olayları
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB bağlantı hatası:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB bağlantısı kesildi. Yeniden bağlanılıyor...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB yeniden bağlandı.');
    });

  } catch (error) {
    console.error('❌ MongoDB bağlantısı başarısız:', error.message);
    process.exit(1); // Kritik hata - uygulamayı sonlandır
  }
};

module.exports = connectDB;
