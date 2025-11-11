-- Deysis Bot Database Initialization Script
-- NOT: Bu dosya artık kullanılmıyor (Docker'da MySQL servisi yok)
-- Veritabanınızı manuel olarak oluşturmak için bu script'i kullanabilirsiniz
-- veya setup-database.js script'ini çalıştırabilirsiniz: npm run setup-db

-- Veritabanını oluştur (eğer yoksa)
CREATE DATABASE IF NOT EXISTS deysis_users CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Veritabanını kullan
USE deysis_users;

-- Kullanıcılar tablosunu oluştur
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    school_email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- İndeksler (performans için)
CREATE INDEX idx_telegram_id ON users(telegram_id);
CREATE INDEX idx_school_email ON users(school_email);
CREATE INDEX idx_is_active ON users(is_active);
