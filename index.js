const DeysisBot = require('./bot');
require('dotenv').config();

// Bot token kontrolü
if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN çevre değişkeni bulunamadı!');
    console.error('📝 Lütfen .env dosyası oluşturun ve bot tokenınızı ekleyin.');
    console.error('📋 Örnek dosya için env.example dosyasına bakabilirsiniz.');
    process.exit(1);
}

// Bot instance'ı oluştur ve başlat
const bot = new DeysisBot();

// Bot'u başlat
bot.start().catch(error => {
    console.error('❌ Bot başlatma hatası:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 SIGINT sinyali alındı. Bot güvenli şekilde kapatılıyor...');
    await bot.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 SIGTERM sinyali alındı. Bot güvenli şekilde kapatılıyor...');
    await bot.stop();
    process.exit(0);
});

// Unhandled promise rejection
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ İşlenmemiş Promise Reddi:', reason);
    console.error('📍 Promise:', promise);
});

// Uncaught exception
process.on('uncaughtException', (error) => {
    console.error('❌ Yakalanmamış Hata:', error);
    process.exit(1);
});
