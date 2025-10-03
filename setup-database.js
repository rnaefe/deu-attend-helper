const { testConnection, createUsersTable } = require('./database');
require('dotenv').config();

async function setupDatabase() {
    console.log('🗄️ Veritabanı kurulumu başlatılıyor...');
    
    // Veritabanı bağlantısını test et
    console.log('📡 Veritabanı bağlantısı test ediliyor...');
    const connected = await testConnection();
    
    if (!connected) {
        console.error('❌ Veritabanı bağlantısı kurulamadı!');
        console.error('🔧 Lütfen aşağıdaki ayarları kontrol edin:');
        console.error('   • MySQL sunucusu çalışıyor mu?');
        console.error('   • Veritabanı kullanıcı adı ve şifresi doğru mu?');
        console.error('   • Veritabanı mevcut mu?');
        console.error('   • .env dosyasındaki ayarlar doğru mu?');
        process.exit(1);
    }
    
    // Kullanıcılar tablosunu oluştur
    console.log('📋 Kullanıcılar tablosu oluşturuluyor...');
    const tableCreated = await createUsersTable();
    
    if (!tableCreated) {
        console.error('❌ Kullanıcılar tablosu oluşturulamadı!');
        process.exit(1);
    }
    
    console.log('✅ Veritabanı kurulumu tamamlandı!');
    console.log('🤖 Artık botu başlatabilirsiniz: npm start');
}

// Veritabanı kurulumunu çalıştır
setupDatabase().catch(error => {
    console.error('❌ Veritabanı kurulum hatası:', error);
    process.exit(1);
});
