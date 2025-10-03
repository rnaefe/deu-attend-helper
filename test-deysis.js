/**
 * Deysis Giriş Modülü Test Dosyası
 * Bu dosya Deysis modülünü test etmek için kullanılır
 */

const DeysisLogin = require('./modules/deysisLogin');
require('dotenv').config();

async function testDeysisLogin() {
    const deysis = new DeysisLogin();
    
    try {
        console.log('🚀 Deysis giriş testi başlatılıyor...\n');
        
        // Test kullanıcı bilgileri - GERÇEK BİLGİLERİ BURAYA GİRİN
        const testEmail = 'daglarefe.goksoy@ogr.deu.edu.tr'; // Test için gerçek e-posta
        const testPassword = '10377920Dd'; // Test için gerçek şifre
        const testCourseCode = '123456'; // Test için 6 haneli ders kodu
        
        console.log('⚠️  UYARI: Test dosyasında gerçek e-posta ve şifre kullanın!');
        console.log('⚠️  Bu bilgiler Deysis sisteminizde kayıtlı olmalıdır.\n');
        
        console.log(`📧 Test E-posta: ${testEmail}`);
        console.log(`🔐 Test Şifre: ${testPassword}`);
        console.log(`🔢 Test Ders Kodu: ${testCourseCode}\n`);
        
        // Browser'ı başlat
        console.log('1️⃣ Browser başlatılıyor...');
        const browserStarted = await deysis.initBrowser({ 
            headless: false // Test için görünür mod
        });
        
        if (!browserStarted) {
            throw new Error('Browser başlatılamadı');
        }
        
        // Giriş yap
        console.log('\n2️⃣ Deysis\'e giriş yapılıyor...');
        const loginResult = await deysis.login(testEmail, testPassword, testCourseCode);
        
        if (loginResult.success) {
            console.log('✅ Giriş başarılı!');
            console.log(`📍 Mevcut URL: ${deysis.getCurrentUrl()}`);
            
            // Giriş durumunu kontrol et
            console.log(`🔐 Giriş durumu: ${deysis.isLoggedInToDeysis()}`);
            
            // Sayfa içeriğini al
            console.log('\n3️⃣ Sayfa içeriği alınıyor...');
            const content = await deysis.getPageContent();
            
            if (content) {
                console.log(`📄 Sayfa içeriği uzunluğu: ${content.length} karakter`);
                
                // İçerikte önemli kelimeler ara
                const keywords = ['dashboard', 'panel', 'hoş geldiniz', 'çıkış', 'profil'];
                keywords.forEach(keyword => {
                    if (content.toLowerCase().includes(keyword)) {
                        console.log(`✅ "${keyword}" kelimesi sayfada bulundu`);
                    }
                });
            }
            
            // Çerezleri kontrol et
            console.log('\n4️⃣ Oturum çerezleri kontrol ediliyor...');
            const cookies = await deysis.getCookies();
            console.log(`🍪 Toplam çerez sayısı: ${cookies.length}`);
            
            if (cookies.length > 0) {
                console.log('Çerez örnekleri:');
                cookies.slice(0, 3).forEach(cookie => {
                    console.log(`  - ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
                });
            }
            
        } else {
            console.log('❌ Deysis işlemi başarısız!');
            console.log(`🔍 Hata: ${loginResult.error}`);
            console.log(`📍 URL: ${loginResult.url || 'Bilinmiyor'}`);
            
            // Hata tipine göre özel mesaj
            if (loginResult.errorType) {
                switch (loginResult.errorType) {
                    case 'INVALID_CODE':
                        console.log('💡 Çözüm: Doğru ders kodunu girdiğinizden emin olun.');
                        if (loginResult.toastMessage) {
                            console.log(`📱 Toast Mesajı: "${loginResult.toastMessage}"`);
                        }
                        break;
                    case 'UI_ERROR':
                        console.log('💡 Çözüm: Sayfa yükleme sorunu olabilir, tekrar deneyin.');
                        break;
                    case 'SYSTEM_ERROR':
                        console.log('💡 Çözüm: Sistem hatası, daha sonra tekrar deneyin.');
                        break;
                    default:
                        console.log('💡 Çözüm: Genel bir hata oluştu, tekrar deneyin.');
                }
            }
            
            // Toast detayları varsa göster
            if (loginResult.toastTitle || loginResult.toastMessage) {
                console.log('📱 Toast Detayları:');
                if (loginResult.toastTitle) {
                    console.log(`   📋 Başlık: "${loginResult.toastTitle}"`);
                }
                if (loginResult.toastMessage) {
                    console.log(`   📄 Mesaj: "${loginResult.toastMessage}"`);
                }
            }
        }
        
        // Test tamamlandı
        console.log('\n🎉 Test tamamlandı!');
        console.log('⏳ 5 saniye sonra browser kapatılacak...');
        
        // 5 saniye bekle (test sonucunu görmek için)
        await new Promise(resolve => setTimeout(resolve, 5000));
        
    } catch (error) {
        console.error('❌ Test hatası:', error.message);
    } finally {
        // Browser'ı kapat
        await deysis.close();
        console.log('\n🔒 Test tamamlandı, browser kapatıldı.');
        process.exit(0);
    }
}

// Test'i çalıştır
if (require.main === module) {
    testDeysisLogin().catch(error => {
        console.error('❌ Test çalıştırma hatası:', error);
        process.exit(1);
    });
}

module.exports = testDeysisLogin;
