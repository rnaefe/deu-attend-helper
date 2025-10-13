const mysql = require('mysql2/promise');
require('dotenv').config();

// MySQL veritabanı bağlantı havuzu
const pool = mysql.createPool({
    uri: process.env.MYSQL_CONNECTION_STRING,
});

// Veritabanı bağlantısını test et
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ MySQL veritabanına başarıyla bağlanıldı');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ MySQL veritabanı bağlantı hatası:', error.message);
        return false;
    }
}

// Kullanıcılar tablosunu oluştur
async function createUsersTable() {
    try {
        const createTableQuery = `
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
        `;
        
        await pool.execute(createTableQuery);
        console.log('✅ Kullanıcılar tablosu hazır');
        return true;
    } catch (error) {
        console.error('❌ Kullanıcılar tablosu oluşturma hatası:', error.message);
        return false;
    }
}

// Yeni kullanıcı kaydet
async function createUser(userData) {
    try {
        const { telegram_id, username, first_name, last_name, school_email, password } = userData;
        
        const query = `
            INSERT INTO users (telegram_id, username, first_name, last_name, school_email, password)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const [result] = await pool.execute(query, [
            telegram_id, username, first_name, last_name, school_email, password
        ]);
        
        return { success: true, userId: result.insertId };
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return { success: false, error: 'Bu kullanıcı zaten kayıtlı' };
        }
        return { success: false, error: error.message };
    }
}

// Telegram ID ile kullanıcı bul
async function findUserByTelegramId(telegram_id) {
    try {
        const query = 'SELECT * FROM users WHERE telegram_id = ?';
        const [rows] = await pool.execute(query, [telegram_id]);
        
        if (rows.length > 0) {
            return { success: true, user: rows[0] };
        } else {
            return { success: false, error: 'Kullanıcı bulunamadı' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Okul maili ile kullanıcı bul
async function findUserBySchoolEmail(school_email) {
    try {
        const query = 'SELECT * FROM users WHERE school_email = ?';
        const [rows] = await pool.execute(query, [school_email]);
        
        if (rows.length > 0) {
            return { success: true, user: rows[0] };
        } else {
            return { success: false, error: 'Bu okul maili ile kayıtlı kullanıcı bulunamadı' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Kullanıcı şifresini güncelle
async function updateUserPassword(telegram_id, new_password) {
    try {
        const query = 'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?';
        const [result] = await pool.execute(query, [new_password, telegram_id]);
        
        if (result.affectedRows > 0) {
            return { success: true };
        } else {
            return { success: false, error: 'Kullanıcı bulunamadı' };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Tüm kullanıcıları listele (admin için)
async function getAllUsers() {
    try {
        const query = 'SELECT id, telegram_id, username, first_name, last_name, school_email, is_active, created_at FROM users ORDER BY created_at DESC';
        const [rows] = await pool.execute(query);
        
        return { success: true, users: rows };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = {
    pool,
    testConnection,
    createUsersTable,
    createUser,
    findUserByTelegramId,
    findUserBySchoolEmail,
    updateUserPassword,
    getAllUsers
};
