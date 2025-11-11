/**
 * Deysis Platform Giriş Modülü
 * https://deysis.deu.edu.tr/ sitesine otomatik giriş yapma
 * Playwright kullanarak browser automation
 */

const { chromium } = require('playwright');
const axios = require('axios');
const cheerio = require('cheerio');

class DeysisLogin {
    constructor() {
        this.baseUrl = 'https://deysis.deu.edu.tr/';
        this.browser = null;
        this.context = null;
        this.page = null;
        this.isLoggedIn = false;
        this.sessionCookies = null;
        this.logCallback = null; // Telegram log callback
    }

    // Telegram log fonksiyonunu ayarla
    setLogCallback(callback) {
        this.logCallback = callback;
    }

    // Log mesajı gönder
    async sendLog(message) {
        console.log(message); // Console'a da yazdır
        if (this.logCallback) {
            try {
                await this.logCallback(message);
            } catch (error) {
                console.error('Log gönderme hatası:', error.message);
            }
        }
    }

    /**
     * Browser'ı başlat
     * @param {Object} options - Browser seçenekleri
     * @returns {Promise<boolean>} - Başarı durumu
     */
    async initBrowser(options = {}) {
        try {
            await this.sendLog('🌐 Browser başlatılıyor...');
            console.log('🌐 Browser başlatılıyor...');
            
            // Playwright browser'ı başlat
            this.browser = await chromium.launch({
                headless: false, // Test için false yapabilirsiniz
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                    '--disable-extensions',
                    '--disable-plugins'
                ],
                ...options
            });

            // Browser context'i oluştur (permissions, geolocation vb. burada ayarlanır)
            this.context = await this.browser.newContext({
                viewport: { width: 1366, height: 768 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                geolocation: {
                latitude: 38.3675561,
                longitude: 27.2016134
                },
                permissions: ['geolocation'], // Konum izni ver
                locale: 'tr-TR',
                timezoneId: 'Europe/Istanbul'
            });
            
            // Konum izni için JavaScript override
            await this.context.addInitScript(() => {
                navigator.geolocation.getCurrentPosition = (success, error) => {
                    success({
                        coords: {
                            latitude: 38.3675561,
                            longitude: 27.2016134,
                            accuracy: 20
                        },
                        timestamp: Date.now()
                    });
                };
            });

            // Kamera ve mikrofon izinlerini reddet
            await this.context.addInitScript(() => {
                // Kamera izni reddet
                navigator.mediaDevices.getUserMedia = () => {
                    return Promise.reject(new Error('Kamera izni reddedildi'));
                };
                
                // Mikrofon izni reddet
                navigator.mediaDevices.getDisplayMedia = () => {
                    return Promise.reject(new Error('Ekran paylaşımı reddedildi'));
                };
            });

            // Yeni sayfa oluştur
            this.page = await this.context.newPage();

            // Dialog handler (konum izni popup'ı için)
            this.page.on('dialog', async dialog => {
                console.log('🔔 Dialog tespit edildi:', dialog.message());
                if (dialog.message().includes('konum') || dialog.message().includes('location')) {
                    console.log('✅ Konum izni otomatik olarak verildi');
                    await dialog.accept();
                } else if (dialog.message().includes('kamera') || dialog.message().includes('camera')) {
                    console.log('❌ Kamera izni reddediliyor');
                    await dialog.dismiss();
                }
            });
            
            await this.sendLog('✅ Browser başlatıldı');
            console.log('✅ Browser başarıyla başlatıldı');
            return true;
        } catch (error) {
            console.error('❌ Browser başlatma hatası:', error.message);
            return false;
        }
    }

    /**
     * Deysis sitesine giriş yap
     * @param {string} email - Kullanıcı e-postası
     * @param {string} password - Şifre
     * @param {string} courseCode - Ders kodu
     * @returns {Promise<Object>} - Giriş sonucu
     */
    async login(email, password, courseCode) {
        try {
            if (!this.page) {
                throw new Error('Browser başlatılmamış. Önce initBrowser() çağırın.');
            }

            await this.sendLog('🔐 Deysis\'e giriş yapılıyor...');
            console.log(`🔐 ${email} ile giriş yapılıyor...`);
            
            // Önce konum kontrolü yap
            console.log('📍 Konum kontrolü yapılıyor...');
            await this.checkAndSetLocation();
            
            // Deysis ana sayfasına git - Retry mekanizması ile
            console.log(`🌐 ${this.baseUrl} adresine gidiliyor...`);
            
            let navigationSuccess = false;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (!navigationSuccess && retryCount < maxRetries) {
                try {
                    console.log(`🔄 Deneme ${retryCount + 1}/${maxRetries}...`);
                    
                    await this.page.goto(this.baseUrl, { 
                        waitUntil: 'networkidle',
                        timeout: 30000 
                    });
                    
                    // Sayfa tamamen yüklenene kadar bekle
                    await this.page.waitForLoadState('networkidle');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Sayfa başlığını kontrol et
                    const pageTitle = await this.page.title();
                    console.log(`📄 Sayfa başlığı: ${pageTitle}`);
                    
                    // Mevcut URL'yi kontrol et
                    const currentUrl = this.page.url();
                    console.log(`📍 Mevcut URL: ${currentUrl}`);
                    
                    navigationSuccess = true;
                    console.log('✅ Sayfa başarıyla yüklendi');
                    
                } catch (error) {
                    retryCount++;
                    console.log(`❌ Navigasyon hatası (${retryCount}/${maxRetries}): ${error.message}`);
                    
                    if (retryCount < maxRetries) {
                        console.log('⏳ 3 saniye bekleniyor ve tekrar deneniyor...');
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        // Yeni sayfa oluştur
                        try {
                            await this.page.close();
                            this.page = await this.context.newPage();
                        } catch (pageError) {
                            console.log(`❌ Sayfa yenileme hatası: ${pageError.message}`);
                        }
                    }
                }
            }
            
            if (!navigationSuccess) {
                throw new Error(`Sayfa yüklenemedi. ${maxRetries} deneme başarısız.`);
            }

            // Giriş formunu bul ve doldur
            const loginResult = await this.fillLoginForm(email, password, courseCode);
            
            if (loginResult.success) {
                this.isLoggedIn = true;
                // Oturum çerezlerini kaydet
                this.sessionCookies = await this.context.cookies();
                console.log('✅ Deysis\'e başarıyla giriş yapıldı');
            }

            return loginResult;

        } catch (error) {
            console.error('❌ Giriş hatası:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Giriş formunu doldur ve gönder
     * @param {string} email - E-posta
     * @param {string} password - Şifre
     * @param {string} courseCode - Ders kodu
     * @returns {Promise<Object>} - Form gönderme sonucu
     */
    async fillLoginForm(email, password, courseCode) {
        try {
            // Sayfa hazır mı kontrol et
            console.log('🔍 Sayfa durumu kontrol ediliyor...');
            await this.page.waitForLoadState('domcontentloaded');
            console.log('✅ Sayfa tamamen yüklendi');

            // Deysis sitesinin gerçek XPath'leri
            const emailXPath = '/html/body/app-root/app-login/div/div/div/form/div[1]/div/mat-form-field/div[1]/div/div[3]/input';
            const passwordXPath = '/html/body/app-root/app-login/div/div/div/form/div[2]/div/mat-form-field/div[1]/div/div[3]/input';
            
            // Alternatif CSS seçiciler
            const emailSelectors = [
                emailXPath,
                'input[formControlName="email"]',
                'input[name="email"]',
                'input[type="email"]',
                '#mat-input-13',
                'input[name="username"]',
                'input[name="user"]',
                '#email',
                '#username',
                'mat-form-field input[type="text"]',
                'mat-form-field input[type="email"]',
                'input[formControlName="username"]'
            ];
            
            const passwordSelectors = [
                passwordXPath,
                'input[formControlName="sifre"]',
                'input[name="password"]',
                'input[type="password"]',
                '#mat-input-14',
                '#password',
                'mat-form-field input[type="password"]',
                'input[formControlName="password"]'
            ];

            console.log('🔍 E-posta alanı aranıyor...');
            
            // E-posta alanını bul ve doldur
            let emailElement = null;
            for (const selector of emailSelectors) {
                try {
                    if (this.page.isClosed()) {
                        throw new Error('Sayfa kapatılmış');
                    }
                    
                    console.log(`🔍 Denenen seçici: ${selector}`);
                    
                    if (selector.startsWith('/')) {
                        // XPath kullan - Playwright'da locator ile
                        const locator = this.page.locator(`xpath=${selector}`);
                        const count = await locator.count();
                        if (count > 0) {
                            emailElement = locator.first();
                            console.log(`✅ E-posta alanı XPath ile bulundu: ${selector}`);
                            break;
                        }
                    } else {
                        // CSS seçici kullan
                        await this.page.waitForSelector(selector, { timeout: 3000, state: 'visible' });
                        emailElement = this.page.locator(selector).first();
                        const isVisible = await emailElement.isVisible();
                        if (isVisible) {
                            console.log(`✅ E-posta alanı CSS seçici ile bulundu: ${selector}`);
                            break;
                        }
                    }
                } catch (error) {
                    console.log(`❌ Seçici başarısız: ${selector} - ${error.message}`);
                    continue;
                }
            }

            if (!emailElement) {
                throw new Error('E-posta alanı bulunamadı');
            }

            // E-posta alanını temizle ve doldur
            await emailElement.click();
            await emailElement.fill(''); // Temizle
            await emailElement.type(email, { delay: 100 });
            console.log('📧 E-posta dolduruldu');

            console.log('🔍 Şifre alanı aranıyor...');
            
            // Şifre alanını bul ve doldur
            let passwordElement = null;
            for (const selector of passwordSelectors) {
                try {
                    if (this.page.isClosed()) {
                        throw new Error('Sayfa kapatılmış');
                    }
                    
                    console.log(`🔍 Denenen seçici: ${selector}`);
                    
                    if (selector.startsWith('/')) {
                        // XPath kullan
                        const locator = this.page.locator(`xpath=${selector}`);
                        const count = await locator.count();
                        if (count > 0) {
                            passwordElement = locator.first();
                            console.log(`✅ Şifre alanı XPath ile bulundu: ${selector}`);
                            break;
                        }
                    } else {
                        // CSS seçici kullan
                        await this.page.waitForSelector(selector, { timeout: 3000, state: 'visible' });
                        passwordElement = this.page.locator(selector).first();
                        const isVisible = await passwordElement.isVisible();
                        if (isVisible) {
                            console.log(`✅ Şifre alanı CSS seçici ile bulundu: ${selector}`);
                            break;
                        }
                    }
                } catch (error) {
                    console.log(`❌ Seçici başarısız: ${selector} - ${error.message}`);
                    continue;
                }
            }

            if (!passwordElement) {
                throw new Error('Şifre alanı bulunamadı');
            }

            // Şifre alanını temizle ve doldur
            await passwordElement.click();
            await passwordElement.fill(''); // Temizle
            await passwordElement.type(password, { delay: 100 });
            console.log('🔐 Şifre dolduruldu');

            // Giriş butonunu bul ve tıkla
            console.log('🔍 Giriş butonu aranıyor...');
            
            const submitSelectors = [
                '#loginForm > div:nth-child(3) > div > button',
                'button[type="submit"]',
                'input[type="submit"]',
                '.login-btn',
                '.submit-btn',
                'mat-raised-button',
                'mat-button',
                'button[mat-raised-button]',
                'button[mat-button]',
                'button.mdc-button',
                'button[class*="mdc-filled-button"]'
            ];

            let submitClicked = false;
            for (const selector of submitSelectors) {
                try {
                    if (!this.page.isClosed()) {
                        await this.page.waitForSelector(selector, { timeout: 2000, state: 'visible' });
                        await this.page.click(selector);
                        console.log(`✅ Giriş butonu tıklandı: ${selector}`);
                        submitClicked = true;
                        break;
                    } else {
                        throw new Error('Sayfa kapatılmış');
                    }
                } catch (error) {
                    console.log(`❌ Buton seçici başarısız: ${selector} - ${error.message}`);
                    continue;
                }
            }

            if (!submitClicked) {
                // Enter tuşu ile dene
                console.log('⌨️ Enter tuşu ile giriş deneniyor...');
                await this.page.keyboard.press('Enter');
            }

            console.log('📤 Form gönderildi');

            // Sayfa yönlendirmesini bekle
            console.log('⏳ Sayfa yanıtı bekleniyor...');
            await this.page.waitForLoadState('networkidle');
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Giriş başarılı mı kontrol et
            let currentUrl, pageContent;
            
            try {
                if (!this.page.isClosed()) {
                    currentUrl = this.page.url();
                    pageContent = await this.page.content();
                    console.log(`📍 Mevcut URL: ${currentUrl}`);
                } else {
                    throw new Error('Sayfa kapatılmış');
                }
            } catch (error) {
                console.log(`❌ Sayfa durumu kontrol hatası: ${error.message}`);
                return {
                    success: false,
                    error: `Sayfa durumu hatası: ${error.message}`
                };
            }

            // Başarılı giriş kontrolü
            if (this.isLoginSuccessful(currentUrl, pageContent)) {
                await this.sendLog('✅ Giriş başarılı');
                console.log('✅ Giriş başarılı olarak tespit edildi');
                
                // Konum izni popup'ını kontrol et ve kabul et
                console.log('🔍 Konum izni kontrol ediliyor...');
                await this.handleLocationPermission();
                console.log('✅ Konum izni kontrolü tamamlandı');
                
                // Direkt yoklama katıl sayfasına git
                await this.sendLog('🎯 Yoklama sayfasına gidiliyor...');
                console.log('🎯 Yoklama katıl sayfasına yönlendiriliyor...');
                const attendanceResult = await this.goToAttendancePage(courseCode);
                console.log('✅ Yoklama katıl sayfası işlemi tamamlandı');
                
                // Yoklama katıl işlemi sonucunu kontrol et
                if (attendanceResult && attendanceResult.success) {
                    return { 
                        success: true, 
                        url: currentUrl,
                        message: attendanceResult.message || 'Yoklama katıl işlemi başarıyla tamamlandı'
                    };
                } else {
                    // Yoklama katıl işlemi başarısız
                    const errorMessage = attendanceResult ? attendanceResult.error : 'Yoklama katıl işlemi başarısız';
                    const errorType = attendanceResult ? attendanceResult.errorType : 'UNKNOWN';
                    console.log(`❌ Yoklama katıl işlemi başarısız: ${errorMessage}`);
                    return {
                        success: false,
                        error: errorMessage,
                        errorType: errorType,
                        url: currentUrl
                    };
                }
            } else {
                console.log('❌ Giriş başarısız olarak tespit edildi');
                return { 
                    success: false, 
                    error: 'Giriş başarısız. Kullanıcı adı veya şifre hatalı olabilir.',
                    url: currentUrl 
                };
            }

        } catch (error) {
            console.error('❌ Form doldurma hatası:', error.message);
            return {
                success: false,
                error: `Form doldurma hatası: ${error.message}`
            };
        }
    }

    /**
     * Konum kontrolü yap ve ayarla
     * @returns {Promise<void>}
     */
    async checkAndSetLocation() {
        try {
            console.log('🌍 Mevcut konum kontrol ediliyor...');
            
            // Browser'ın geolocation API'sini test et
            const locationResult = await this.page.evaluate(async () => {
                return new Promise((resolve) => {
                    if (!navigator.geolocation) {
                        resolve({ success: false, error: 'Geolocation API desteklenmiyor' });
                        return;
                    }
                    
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            resolve({
                                success: true,
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                                accuracy: position.coords.accuracy
                            });
                        },
                        (error) => {
                            resolve({
                                success: false,
                                error: error.message
                            });
                        },
                        { timeout: 5000, enableHighAccuracy: false }
                    );
                });
            });
            
            if (locationResult.success) {
                console.log(`✅ Konum alındı: ${locationResult.latitude}, ${locationResult.longitude} (Doğruluk: ${locationResult.accuracy}m)`);
                
                // Tınaztepe kampüsüne yakın mı kontrol et
                const distance = this.calculateDistance(
                    locationResult.latitude, 
                    locationResult.longitude,
                    38.3675561, 
                    27.2016134
                );
                
                if (distance > 1000) { // 1km'den uzaksa
                    console.log(`⚠️ Mevcut konum kampüsten ${Math.round(distance)}m uzakta. Tınaztepe konumu ayarlanıyor...`);
                    await this.setTinaztepeLocation();
                } else {
                    console.log(`✅ Konum kampüse yakın (${Math.round(distance)}m)`);
                }
            } else {
                console.log(`⚠️ Konum alınamadı: ${locationResult.error}. Tınaztepe konumu ayarlanıyor...`);
                await this.setTinaztepeLocation();
            }
        } catch (error) {
            console.log(`❌ Konum kontrolü hatası: ${error.message}. Tınaztepe konumu ayarlanıyor...`);
            await this.setTinaztepeLocation();
        }
    }

    /**
     * Tınaztepe kampüsü konumunu ayarla
     * @returns {Promise<void>}
     */
    async setTinaztepeLocation() {
        try {
            console.log('📍 Dokuz Eylül Tınaztepe Kampüsü konumu ayarlanıyor...');
            
            // Context geolocation'ı güncelle
            await this.context.setGeolocation({
                latitude: 38.3675561,
                longitude: 27.2016134
            });
            
            // Geolocation API'sini override et
            await this.context.addInitScript(() => {
                navigator.geolocation.getCurrentPosition = (success, error) => {
                    success({
                        coords: {
                            latitude: 38.3675561,
                            longitude: 27.2016134,
                            accuracy: 20
                        },
                        timestamp: Date.now()
                    });
                };
            });
            
            console.log('✅ Tınaztepe kampüsü konumu ayarlandı');
        } catch (error) {
            console.log(`❌ Konum ayarlama hatası: ${error.message}`);
        }
    }

    /**
     * İki nokta arasındaki mesafeyi hesapla (Haversine formülü)
     * @param {number} lat1 - İlk nokta latitude
     * @param {number} lon1 - İlk nokta longitude
     * @param {number} lat2 - İkinci nokta latitude
     * @param {number} lon2 - İkinci nokta longitude
     * @returns {number} - Mesafe (metre)
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Dünya yarıçapı (metre)
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c; // metre cinsinden mesafe
    }

    /**
     * Yoklama katıl sayfasına git ve ders kodunu gir
     * @param {string} courseCode - Ders kodu
     * @returns {Promise<Object>} - İşlem sonucu
     */
    async goToAttendancePage(courseCode) {
        try {
            console.log('🎓 goToAttendancePage fonksiyonu çağrıldı');
            console.log(`📋 Ders kodu: ${courseCode}`);
            console.log('🎓 Yoklama katıl sayfasına gidiliyor...');
            
            // Direkt yoklama katıl sayfasına git
            const attendanceUrl = 'https://deysis.deu.edu.tr/ogrenci/yoklama-katil';
            await this.page.goto(attendanceUrl, { 
                waitUntil: 'networkidle',
                timeout: 30000 
            });
            
            console.log('✅ Yoklama katıl sayfası yüklendi');
            
            // Sayfa yüklenmesini bekle
            await this.page.waitForLoadState('networkidle');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Kamera izni popup'ını kontrol et
            await this.handleCameraPermission();
            
                // Ders kodunu gir
                const codeResult = await this.enterCourseCode(courseCode);
                
                if (codeResult && codeResult.success) {
                    console.log('✅ Yoklama katıl işlemi tamamlandı');
                return {
                    success: true,
                    message: 'Yoklama katıl işlemi başarıyla tamamlandı'
                };
                } else {
                    console.log('❌ Yoklama katıl işlemi başarısız');
                const errorMessage = codeResult ? codeResult.error : 'Ders kodu girme işlemi başarısız';
                const errorType = codeResult ? codeResult.errorType : 'UNKNOWN';
                
                // Hatayı return et (throw etme, çünkü fillLoginForm'da handle edilecek)
                return {
                    success: false,
                    error: errorMessage,
                    errorType: errorType
                };
                }
            
        } catch (error) {
            console.log(`❌ Yoklama katıl sayfası hatası: ${error.message}`);
            return {
                success: false,
                error: error.message,
                errorType: 'SYSTEM_ERROR'
            };
        }
    }

    /**
     * Ders kodunu giriş alanlarına gir
     * @param {string} courseCode - Ders kodu (6 haneli)
     * @returns {Promise<Object>} - Ders kodu girme sonucu
     */
    async enterCourseCode(courseCode) {
        try {
            await this.sendLog(`🔢 Ders kodu giriliyor... ${courseCode}`);
            console.log(`🔢 Ders kodu "${courseCode}" giriliyor...`);

            // HTML'deki gerçek seçiciler
            const codeInputSelectors = [
                'code-input input[type="tel"]',
                'code-input input[autocomplete="one-time-code"]',
                'input[type="tel"][inputmode="numeric"]',
                'code-input span input',
                'input[type="tel"]',
                'input[inputmode="numeric"]'
            ];

            const inputElements = [];
            for (const selector of codeInputSelectors) {
                try {
                    if (!this.page.isClosed()) {
                        const locator = this.page.locator(selector);
                        const count = await locator.count();
                        if (count > 0) {
                            for (let i = 0; i < Math.min(count, courseCode.length); i++) {
                                inputElements.push(locator.nth(i));
                            }
                            console.log(`✅ Ders kodu giriş alanları bulundu: ${selector} (${count} adet)`);
                            if (inputElements.length >= courseCode.length) break;
                        }
                    }
                } catch (error) {
                    console.log(`❌ Seçici ile ders kodu alanı bulunamadı ${selector}: ${error.message}`);
                }
            }
            
            // Sadece benzersiz elementleri al
            const uniqueInputElements = inputElements.slice(0, courseCode.length);

            if (uniqueInputElements.length >= courseCode.length) {
                console.log(`📝 ${uniqueInputElements.length} adet input alanı bulundu, ders kodu giriliyor...`);
                
                for (let i = 0; i < courseCode.length; i++) {
                    const input = uniqueInputElements[i];
                    const char = courseCode[i];
                    if (input) {
                        // Input alanına odaklan ve karakteri gir
                        await input.click();
                        await input.fill(char);
                        console.log(`   ➡️ ${i + 1}. karakter "${char}" girildi`);
                        
                        // Her karakter arasında kısa bekleme
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                }
                console.log('✅ Ders kodu başarıyla girildi.');

                // Enter tuşu ile gönder
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.page.keyboard.press('Enter');
                console.log('📤 Enter tuşu ile ders kodu gönderildi');
                
                // İşlemin tamamlanmasını bekle (toast'un görünmesi için yeterli süre)
                await this.page.waitForLoadState('networkidle');
                // Toast'un görünmesi için daha uzun bekle (animasyon + DOM yükleme + API yanıtı)
                await new Promise(resolve => setTimeout(resolve, 3000)); // 3 saniye bekle
                
                // Toast container kontrolü yap (başarı/hata kontrolü)
                // ÖNEMLİ: Bu kontrol kritik - toast-error görünüyorsa kesinlikle başarısız dönmeli
                const attendanceResult = await this.checkAttendanceResult();
                
                // Eğer hata varsa, kesinlikle başarısız dön
                if (!attendanceResult.success) {
                    await this.sendLog(`❌ Ders bulunamadı: ${attendanceResult.error}`);
                    console.log(`❌ Yoklama hatası tespit edildi: ${attendanceResult.error}`);
                    console.log(`❌ Hata detayları:`, attendanceResult);
                    return {
                        success: false,
                        error: attendanceResult.error,
                        errorType: attendanceResult.errorType || 'INVALID_CODE'
                    };
                }
                
                // Başarı kontrolü: Eğer success true ise ve swal2Success varsa veya hiç hata yoksa başarılı
                if (attendanceResult.success) {
                    // Ek kontrol: Toast-error'un gerçekten görünmediğinden emin ol
                    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 saniye daha bekle
                    const finalCheck = await this.checkAttendanceResult();
                    
                    if (!finalCheck.success) {
                        // Son kontrol hata gösteriyorsa, başarısız dön
                        await this.sendLog(`❌ Ders bulunamadı (son kontrol): ${finalCheck.error}`);
                        console.log(`❌ Yoklama hatası tespit edildi (son kontrol): ${finalCheck.error}`);
                        return {
                            success: false,
                            error: finalCheck.error,
                            errorType: finalCheck.errorType || 'INVALID_CODE'
                    };
                }
                
                await this.sendLog(`✅ Derse başarıyla katıldınız ${courseCode}`);
                console.log('✅ Ders kodu başarıyla işlendi');
                return {
                    success: true,
                    message: 'Ders kodu başarıyla girildi ve işlendi'
                };
                } else {
                    // Güvenli tarafta kal: Eğer sonuç belirsizse, başarısız say
                    await this.sendLog(`❌ Yoklama sonucu belirsiz, güvenli tarafta kalınıyor`);
                    console.log(`⚠️ Yoklama sonucu belirsiz:`, attendanceResult);
                    return {
                        success: false,
                        error: 'Yoklama sonucu belirlenemedi. Lütfen tekrar deneyin.',
                        errorType: 'UNKNOWN'
                    };
                }

            } else {
                console.warn(`⚠️ Ders kodu giriş alanları bulunamadı veya yeterli değil. Beklenen: ${courseCode.length}, Bulunan: ${uniqueInputElements.length}`);
                
                // Alternatif yöntem: Tüm input'ları bul
                const allInputs = this.page.locator('input');
                const inputCount = await allInputs.count();
                console.log(`🔍 Sayfada toplam ${inputCount} input bulundu`);
                
                if (inputCount >= courseCode.length) {
                        for (let i = 0; i < courseCode.length; i++) {
                        const input = allInputs.nth(i);
                            const char = courseCode[i];
                        await input.click();
                        await input.fill(char);
                                console.log(`   ➡️ Alternatif yöntemle ${i + 1}. karakter "${char}" girildi`);
                                await new Promise(resolve => setTimeout(resolve, 200));
                        }
                        console.log('✅ Ders kodu alternatif yöntemle girildi');
                        
                        // Enter tuşu ile gönder
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await this.page.keyboard.press('Enter');
                        console.log('📤 Enter tuşu ile ders kodu gönderildi (alternatif yöntem)');
                        
                    // İşlemin tamamlanmasını bekle (toast'un görünmesi için yeterli süre)
                    await this.page.waitForLoadState('networkidle');
                    // Toast'un görünmesi için daha uzun bekle (animasyon + DOM yükleme)
                    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 saniye bekle
                    
                    // Toast container kontrolü yap (başarı/hata kontrolü)
                    const attendanceResult = await this.checkAttendanceResult();
                    if (!attendanceResult.success) {
                        console.log(`❌ Yoklama hatası tespit edildi (alternatif): ${attendanceResult.error}`);
                            return {
                                success: false,
                            error: attendanceResult.error,
                            errorType: attendanceResult.errorType || 'INVALID_CODE'
                            };
                        }
                        
                        return {
                            success: true,
                            message: 'Ders kodu alternatif yöntemle başarıyla girildi ve işlendi'
                        };
                }
            }
            
            return {
                success: false,
                error: 'Ders kodu giriş alanları bulunamadı',
                errorType: 'INPUT_NOT_FOUND'
            };
            
        } catch (error) {
            console.error('❌ Ders kodu girerken hata oluştu:', error);
            return {
                success: false,
                error: `Ders kodu girme hatası: ${error.message}`,
                errorType: 'SYSTEM_ERROR'
            };
        }
    }

    /**
     * Yoklama sonucunu kontrol et (toast container ve SweetAlert2 bazlı)
     * Toast-error görünüyorsa -> başarısız
     * SweetAlert2 success görünüyorsa -> başarılı
     * İkisi de yoksa -> başarılı (varsayılan)
     * @returns {Promise<Object>} - Sonuç kontrolü
     */
    async checkAttendanceResult() {
        try {
            console.log('🔍 Yoklama sonucu kontrol ediliyor (toast container ve SweetAlert2)...');
            
            // 1. TOAST-ERROR VE SWAL2-SUCCESS LISTENER: İkisini de dinle (en güvenilir yöntem)
            console.log('⏳ Toast-error ve Swal2-success listener başlatılıyor (max 10 saniye)...');
            let toastErrorDetected = false;
            let swal2SuccessDetected = false;
            let toastErrorInfo = null;
            let swal2SuccessInfo = null;
            
            try {
                // Toast-error ve Swal2-success'i aynı anda dinle
                await Promise.race([
                    // 1. Toast-error görünene kadar bekle
                    this.page.waitForSelector('#toast-container .toast-error', { 
                        state: 'visible', 
                        timeout: 10000 
                    }).then(async () => {
                        console.log('✅ Toast-error göründü! İçeriği okunuyor...');
                        toastErrorDetected = true;
                        
                        // Toast-error içeriğini oku
                        toastErrorInfo = await this.page.evaluate(() => {
                            const container = document.querySelector('#toast-container');
                            if (!container) return null;
                            
                            const errorToast = container.querySelector('.toast-error');
                            if (!errorToast) return null;
                            
                            const titleEl = errorToast.querySelector('.toast-title');
                            const messageEl = errorToast.querySelector('.toast-message');
                            
                            const title = titleEl ? (titleEl.getAttribute('aria-label') || titleEl.textContent || titleEl.innerText || '') : '';
                            const message = messageEl ? (messageEl.getAttribute('aria-label') || messageEl.textContent || messageEl.innerText || '') : '';
                            
                            // Eğer text yoksa, element'in kendisinden al
                            let finalTitle = title.trim();
                            let finalMessage = message.trim();
                            
                            if (!finalTitle && !finalMessage) {
                                const fullText = errorToast.textContent || errorToast.innerText || '';
                                const parts = fullText.trim().split('\n');
                                if (parts.length >= 2) {
                                    finalTitle = parts[0].trim();
                                    finalMessage = parts.slice(1).join(' ').trim();
                                } else if (parts.length === 1) {
                                    finalMessage = parts[0].trim();
                                }
                            }
                            
                            return {
                                title: finalTitle,
                                message: finalMessage,
                                fullText: (finalTitle + ' ' + finalMessage).trim()
                            };
                        }).catch(() => null);
                        
                        console.log(`❌ Toast-error içeriği: Başlık: "${toastErrorInfo?.title || ''}", Mesaj: "${toastErrorInfo?.message || ''}"`);
                    }).catch(() => {
                        console.log('ℹ️ Toast-error görünmedi (timeout)');
                    }),
                    
                    // 2. Swal2-success görünene kadar bekle
                    Promise.race([
                        // Swal2-success ikonu kontrolü
                        this.page.waitForSelector('.swal2-success', { 
                            state: 'visible', 
                            timeout: 10000 
                        }).then(async () => {
                            console.log('✅ Swal2-success ikonu göründü!');
                            swal2SuccessDetected = true;
                            
                            // Swal2 içeriğini oku
                            swal2SuccessInfo = await this.page.evaluate(() => {
                                const container = document.querySelector('.swal2-container');
                                const popup = document.querySelector('.swal2-popup');
                                if (!popup) return null;
                                
                                const titleEl = popup.querySelector('.swal2-title');
                                const contentEl = popup.querySelector('.swal2-html-container');
                                
                                const title = titleEl ? (titleEl.textContent || titleEl.innerText || '') : '';
                                const content = contentEl ? (contentEl.textContent || contentEl.innerText || '') : '';
                                
                    return {
                                    title: title.trim(),
                                    content: content.trim(),
                                    fullText: (title + ' ' + content).trim()
                                };
                            }).catch(() => null);
                            
                            console.log(`✅ Swal2-success içeriği: Başlık: "${swal2SuccessInfo?.title || ''}", İçerik: "${swal2SuccessInfo?.content || ''}"`);
                        }).catch(() => {
                            console.log('ℹ️ Swal2-success ikonu görünmedi (timeout)');
                        }),
                        
                        // Swal2-icon-success kontrolü
                        this.page.waitForSelector('.swal2-icon-success', { 
                            state: 'visible', 
                            timeout: 10000 
                        }).then(async () => {
                            console.log('✅ Swal2-icon-success göründü!');
                            swal2SuccessDetected = true;
                            
                            // Swal2 içeriğini oku
                            swal2SuccessInfo = await this.page.evaluate(() => {
                                const popup = document.querySelector('.swal2-popup');
                                if (!popup) return null;
                                
                                const titleEl = popup.querySelector('.swal2-title');
                                const contentEl = popup.querySelector('.swal2-html-container');
                                
                                const title = titleEl ? (titleEl.textContent || titleEl.innerText || '') : '';
                                const content = contentEl ? (contentEl.textContent || contentEl.innerText || '') : '';
                                
                                return {
                                    title: title.trim(),
                                    content: content.trim(),
                                    fullText: (title + ' ' + content).trim()
                                };
                            }).catch(() => null);
                            
                            console.log(`✅ Swal2-icon-success içeriği: Başlık: "${swal2SuccessInfo?.title || ''}", İçerik: "${swal2SuccessInfo?.content || ''}"`);
                        }).catch(() => {
                            console.log('ℹ️ Swal2-icon-success görünmedi (timeout)');
                        }),
                        
                        // Swal2-container kontrolü (genel)
                        this.page.waitForSelector('.swal2-container', { 
                            state: 'visible', 
                            timeout: 10000 
                        }).then(async () => {
                            console.log('✅ Swal2-container göründü! Success kontrolü yapılıyor...');
                            
                            // Container içinde success ikonu var mı kontrol et
                            const hasSuccess = await this.page.evaluate(() => {
                                const container = document.querySelector('.swal2-container');
                                if (!container) return false;
                                
                                const successIcon = container.querySelector('.swal2-success, .swal2-icon-success, .swal2-success-ring');
                                if (successIcon) {
                                    const computedStyle = window.getComputedStyle(successIcon);
                                    const opacity = parseFloat(computedStyle.opacity);
                                    const display = computedStyle.display;
                                    return opacity > 0 && display !== 'none';
                                }
                                return false;
                            }).catch(() => false);
                            
                            if (hasSuccess) {
                                console.log('✅ Swal2-container içinde success ikonu bulundu!');
                                swal2SuccessDetected = true;
                                
                                // Swal2 içeriğini oku
                                swal2SuccessInfo = await this.page.evaluate(() => {
                                    const popup = document.querySelector('.swal2-popup');
                                    if (!popup) return null;
                                    
                                    const titleEl = popup.querySelector('.swal2-title');
                                    const contentEl = popup.querySelector('.swal2-html-container');
                                    
                                    const title = titleEl ? (titleEl.textContent || titleEl.innerText || '') : '';
                                    const content = contentEl ? (contentEl.textContent || contentEl.innerText || '') : '';
                                    
                                    return {
                                        title: title.trim(),
                                        content: content.trim(),
                                        fullText: (title + ' ' + content).trim()
                                    };
                                }).catch(() => null);
                                
                                console.log(`✅ Swal2-success içeriği: Başlık: "${swal2SuccessInfo?.title || ''}", İçerik: "${swal2SuccessInfo?.content || ''}"`);
                            } else {
                                console.log('ℹ️ Swal2-container var ama success ikonu yok');
                            }
                        }).catch(() => {
                            console.log('ℹ️ Swal2-container görünmedi (timeout)');
                        })
                    ]),
                    
                    // 3. "Yoklama Bulunamadı" yazısını bekle (alternatif kontrol)
                    this.page.waitForFunction(() => {
                        const bodyText = (document.body.innerText || document.body.textContent || '').toLowerCase();
                        const container = document.querySelector('#toast-container');
                        const toastText = container ? (container.innerText || container.textContent || '').toLowerCase() : '';
                        
                        return bodyText.includes('yoklama bulunamadı') || 
                               toastText.includes('yoklama bulunamadı') ||
                               bodyText.includes('yoklama not found') ||
                               toastText.includes('yoklama not found');
                    }, { timeout: 10000 }).then(async () => {
                        console.log('✅ "Yoklama Bulunamadı" yazısı göründü!');
                        toastErrorDetected = true;
                        toastErrorInfo = {
                            title: 'Hata',
                            message: 'Yoklama bulunamadı',
                            fullText: 'Hata Yoklama bulunamadı'
                        };
                    }).catch(() => {
                        console.log('ℹ️ "Yoklama Bulunamadı" yazısı görünmedi (timeout)');
                    }),
                    
                    // 4. Timeout: 10 saniye sonra devam et
                    new Promise(resolve => setTimeout(resolve, 10000))
                ]);
            } catch (error) {
                console.log(`ℹ️ Listener hatası (normal olabilir): ${error.message}`);
            }
            
            // Eğer toast-error tespit edildiyse -> KESINLIKLE HATA
            if (toastErrorDetected && toastErrorInfo) {
                const title = toastErrorInfo.title || '';
                const message = toastErrorInfo.message || '';
                const fullText = toastErrorInfo.fullText || '';
                
                console.log(`❌ Toast-error tespit edildi! Başlık: "${title}", Mesaj: "${message}"`);
                
                // Hata mesajını belirle
                let errorType = 'INVALID_CODE';
                let errorMessage = 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.';
                
                const lowerMessage = message.toLowerCase();
                const lowerTitle = title.toLowerCase();
                const lowerFullText = fullText.toLowerCase();
                
                if (lowerMessage.includes('yoklama bulunamadı') || 
                    lowerFullText.includes('yoklama bulunamadı') ||
                    lowerMessage.includes('yoklama not found')) {
                    errorType = 'INVALID_CODE';
                    errorMessage = 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.';
                } else if (lowerMessage.includes('geçersiz') || 
                          lowerMessage.includes('invalid') ||
                          lowerFullText.includes('geçersiz')) {
                    errorType = 'INVALID_CODE';
                    errorMessage = 'Geçersiz ders kodu. Lütfen doğru kodu giriniz.';
                } else if (lowerTitle.includes('hata') || 
                          lowerMessage.includes('hata') || 
                          lowerMessage.includes('error') ||
                          lowerFullText.includes('hata')) {
                    errorType = 'GENERAL_ERROR';
                    errorMessage = message || `Yoklama hatası: ${fullText}`;
                }
                
                return {
                    success: false,
                    error: errorMessage,
                    errorType: errorType,
                    toastTitle: title,
                    toastMessage: message,
                    fullText: fullText,
                    detectedBy: 'toast-error-listener'
                };
            }
            
            // Eğer Swal2-success tespit edildiyse -> KESINLIKLE BAŞARILI
            if (swal2SuccessDetected && swal2SuccessInfo) {
                const title = swal2SuccessInfo.title || '';
                const content = swal2SuccessInfo.content || '';
                const fullText = swal2SuccessInfo.fullText || '';
                
                console.log(`✅ Swal2-success tespit edildi! Başlık: "${title}", İçerik: "${content}"`);
                
                return {
                    success: true,
                    message: fullText || 'Yoklama başarıyla tamamlandı (SweetAlert2 success tespit edildi)',
                    swal2Success: true,
                    swal2Title: title,
                    swal2Content: content,
                    detectedBy: 'swal2-success-listener'
                };
            }
            
            // Eğer ikisi de tespit edilmediyse -> MANUEL KONTROL GEREKLİ
            if (!toastErrorDetected && !swal2SuccessDetected) {
                console.log(`⚠️ Ne toast-error ne de Swal2-success tespit edilemedi! Manuel kontrol gerekli.`);
                return {
                    success: false,
                    error: 'Yoklama sonucu tespit edilemedi. Ne toast-error ne de Swal2-success görünmedi. Lütfen manuel olarak kontrol edin.',
                    errorType: 'MANUAL_CHECK_REQUIRED',
                    detectedBy: 'no-indicator-found',
                    requiresManualCheck: true
                };
            }
            
            // Toast-error görünmedi, biraz bekle ve tekrar kontrol et (toast geç görünebilir)
            console.log('ℹ️ Toast-error listener timeout, son kontrol yapılıyor...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Son kontrol: "Yoklama Bulunamadı" yazısını ara
            console.log('🔍 "Yoklama Bulunamadı" yazısı son kontrol...');
            const yoklamaBulunamadiCheck = await this.page.evaluate(() => {
                // Sayfa içeriğinde "Yoklama Bulunamadı" yazısını ara
                const bodyText = document.body.innerText || document.body.textContent || '';
                const lowerBodyText = bodyText.toLowerCase();
                
                // Toast container içinde ara
                const container = document.querySelector('#toast-container');
                let toastText = '';
                if (container) {
                    toastText = container.innerText || container.textContent || '';
                }
                const lowerToastText = toastText.toLowerCase();
                
                // "Yoklama Bulunamadı" veya "yoklama bulunamadı" yazısını ara
                const hasYoklamaBulunamadi = lowerBodyText.includes('yoklama bulunamadı') || 
                                             lowerToastText.includes('yoklama bulunamadı') ||
                                             lowerBodyText.includes('yoklama not found') ||
                                             lowerToastText.includes('yoklama not found');
                
                return {
                    found: hasYoklamaBulunamadi,
                    inBody: lowerBodyText.includes('yoklama bulunamadı') || lowerBodyText.includes('yoklama not found'),
                    inToast: lowerToastText.includes('yoklama bulunamadı') || lowerToastText.includes('yoklama not found')
                };
            }).catch((error) => {
                console.log(`⚠️ "Yoklama Bulunamadı" kontrolü hatası: ${error.message}`);
                return { found: false, error: error.message };
            });
            
            if (yoklamaBulunamadiCheck.found) {
                console.log(`❌ "Yoklama Bulunamadı" yazısı bulundu! Toast içinde: ${yoklamaBulunamadiCheck.inToast}, Sayfa içinde: ${yoklamaBulunamadiCheck.inBody}`);
                return {
                    success: false,
                    error: 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.',
                    errorType: 'INVALID_CODE',
                    detectedBy: 'yoklama-bulunamadi-text-check',
                    inToast: yoklamaBulunamadiCheck.inToast,
                    inBody: yoklamaBulunamadiCheck.inBody
                };
            }
            
            // 2. Toast container içinde yeni div/container kontrolü
            console.log('🔍 Toast container içinde yeni div/container kontrolü...');
            const toastContainerCheck = await this.page.evaluate(() => {
                const container = document.querySelector('#toast-container');
                if (!container) {
                    return { found: false, reason: 'container_not_found' };
                }
                
                // Container'ın içindeki tüm child elementleri kontrol et
                const children = container.children;
                const childCount = children.length;
                
                // Toast-error elementini bul
                const errorToast = container.querySelector('.toast-error');
                
                // Container içinde herhangi bir görünür element var mı?
                let visibleElements = [];
                for (let i = 0; i < children.length; i++) {
                    const child = children[i];
                    const style = window.getComputedStyle(child);
                    const opacity = parseFloat(style.opacity);
                    const display = style.display;
                    const visibility = style.visibility;
                    
                    if (opacity > 0 && display !== 'none' && visibility !== 'hidden') {
                        const text = child.innerText || child.textContent || '';
                        visibleElements.push({
                            tagName: child.tagName,
                            className: child.className,
                            text: text.substring(0, 100),
                            opacity: opacity,
                            display: display
                        });
                    }
                }
                
                return {
                    found: container !== null,
                    childCount: childCount,
                    hasErrorToast: errorToast !== null,
                    visibleElements: visibleElements,
                    containerText: container.innerText || container.textContent || ''
                };
            }).catch((error) => {
                console.log(`⚠️ Toast container kontrolü hatası: ${error.message}`);
                return { found: false, reason: 'evaluate_error', error: error.message };
            });
            
            console.log(`🔍 Toast container kontrol sonucu:`, toastContainerCheck);
            
            // Eğer toast container içinde görünür elementler varsa ve toast-error varsa -> HATA
            if (toastContainerCheck.found && toastContainerCheck.hasErrorToast && toastContainerCheck.visibleElements.length > 0) {
                console.log(`❌ Toast container içinde toast-error ve görünür elementler bulundu!`);
                
                // Toast-error içeriğini oku
                const errorToastContent = await this.page.evaluate(() => {
                    const container = document.querySelector('#toast-container');
                    if (!container) return null;
                    
                    const errorToast = container.querySelector('.toast-error');
                    if (!errorToast) return null;
                    
                    const titleEl = errorToast.querySelector('.toast-title');
                    const messageEl = errorToast.querySelector('.toast-message');
                    
                    const title = titleEl ? (titleEl.getAttribute('aria-label') || titleEl.textContent || titleEl.innerText || '') : '';
                    const message = messageEl ? (messageEl.getAttribute('aria-label') || messageEl.textContent || messageEl.innerText || '') : '';
                    
                    return {
                        title: title.trim(),
                        message: message.trim(),
                        fullText: (title + ' ' + message).trim()
                    };
                }).catch(() => null);
                
                if (errorToastContent) {
                    console.log(`❌ Toast-error içeriği: Başlık: "${errorToastContent.title}", Mesaj: "${errorToastContent.message}"`);
                    
                    let errorType = 'INVALID_CODE';
                    let errorMessage = 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.';
                    
                    const lowerMessage = errorToastContent.message.toLowerCase();
                    const lowerTitle = errorToastContent.title.toLowerCase();
                    
                    if (lowerMessage.includes('yoklama bulunamadı') || lowerMessage.includes('yoklama not found')) {
                        errorType = 'INVALID_CODE';
                        errorMessage = 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.';
                    } else if (lowerMessage.includes('geçersiz') || lowerMessage.includes('invalid')) {
                        errorType = 'INVALID_CODE';
                        errorMessage = 'Geçersiz ders kodu. Lütfen doğru kodu giriniz.';
                    } else if (lowerTitle.includes('hata') || lowerMessage.includes('hata') || lowerMessage.includes('error')) {
                        errorType = 'GENERAL_ERROR';
                        errorMessage = errorToastContent.message || `Yoklama hatası: ${errorToastContent.fullText}`;
                    }
                    
                    return {
                        success: false,
                        error: errorMessage,
                        errorType: errorType,
                        toastTitle: errorToastContent.title,
                        toastMessage: errorToastContent.message,
                        fullText: errorToastContent.fullText,
                        detectedBy: 'toast-container-error-check'
                    };
                }
            }
            
            // 3. Direkt DOM'da toast-error'u kontrol et (fallback)
            console.log('🔍 Toast-error direkt DOM kontrolü...');
            const toastErrorCheck = await this.page.evaluate(() => {
                // Toast container'ı bul
                const container = document.querySelector('#toast-container');
                if (!container) {
                    return { found: false, reason: 'container_not_found' };
                }
                
                // Toast-error elementini bul
                const errorToast = container.querySelector('.toast-error');
                if (!errorToast) {
                    return { found: false, reason: 'error_toast_not_found' };
                }
                
                // Element'in stilini kontrol et
                const computedStyle = window.getComputedStyle(errorToast);
                const opacity = parseFloat(computedStyle.opacity);
                const display = computedStyle.display;
                const visibility = computedStyle.visibility;
                
                // Eğer element görünürse (opacity > 0, display != 'none', visibility != 'hidden')
                if (opacity > 0 && display !== 'none' && visibility !== 'hidden') {
                    // Toast içeriğini al
                    const titleEl = errorToast.querySelector('.toast-title');
                    const messageEl = errorToast.querySelector('.toast-message');
                    
                    // Text içeriğini al (aria-label, textContent, innerText)
                    let title = '';
                    let message = '';
                    
                    if (titleEl) {
                        title = titleEl.getAttribute('aria-label') || titleEl.textContent || titleEl.innerText || '';
                    }
                    if (messageEl) {
                        message = messageEl.getAttribute('aria-label') || messageEl.textContent || messageEl.innerText || '';
                    }
                    
                    // Eğer text yoksa, element'in kendisinden al
                    if (!title && !message) {
                        const fullText = errorToast.textContent || errorToast.innerText || '';
                        const parts = fullText.trim().split('\n');
                        if (parts.length >= 2) {
                            title = parts[0].trim();
                            message = parts.slice(1).join(' ').trim();
                        } else if (parts.length === 1) {
                            message = parts[0].trim();
                        }
                    }
                    
                    return {
                        found: true,
                        visible: true,
                        title: title.trim(),
                        message: message.trim(),
                        opacity: opacity,
                        display: display,
                        visibility: visibility,
                        fullText: (title + ' ' + message).trim()
                    };
                } else {
                    return {
                        found: true,
                        visible: false,
                        reason: 'not_visible',
                        opacity: opacity,
                        display: display,
                        visibility: visibility
                    };
                }
            }).catch((error) => {
                console.log(`⚠️ Toast-error DOM kontrolü hatası: ${error.message}`);
                return { found: false, reason: 'evaluate_error', error: error.message };
            });
            
            console.log(`🔍 Toast-error kontrol sonucu:`, toastErrorCheck);
            
            // Eğer toast-error bulundu ve görünürse -> KESINLIKLE HATA
            if (toastErrorCheck.found && toastErrorCheck.visible) {
                const title = toastErrorCheck.title || '';
                const message = toastErrorCheck.message || '';
                const fullText = toastErrorCheck.fullText || '';
                
                console.log(`❌ Toast-error görünür! Başlık: "${title}", Mesaj: "${message}"`);
                
                // Hata mesajını belirle
                let errorType = 'INVALID_CODE';
                let errorMessage = 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.';
                
                const lowerMessage = message.toLowerCase();
                const lowerTitle = title.toLowerCase();
                const lowerFullText = fullText.toLowerCase();
                
                if (lowerMessage.includes('yoklama bulunamadı') || 
                    lowerFullText.includes('yoklama bulunamadı') ||
                    lowerMessage.includes('yoklama not found')) {
                    errorType = 'INVALID_CODE';
                    errorMessage = 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.';
                } else if (lowerMessage.includes('geçersiz') || 
                          lowerMessage.includes('invalid') ||
                          lowerFullText.includes('geçersiz')) {
                    errorType = 'INVALID_CODE';
                    errorMessage = 'Geçersiz ders kodu. Lütfen doğru kodu giriniz.';
                } else if (lowerTitle.includes('hata') || 
                          lowerMessage.includes('hata') || 
                          lowerMessage.includes('error') ||
                          lowerFullText.includes('hata')) {
                    errorType = 'GENERAL_ERROR';
                    errorMessage = message || `Yoklama hatası: ${fullText}`;
                }
                
                // Toast-error görünürse, kesinlikle başarısız dön
                return {
                    success: false,
                    error: errorMessage,
                    errorType: errorType,
                    toastTitle: title,
                    toastMessage: message,
                    fullText: fullText,
                    detectedBy: 'toast-error-dom-check'
                };
            }
            
            // Toast-error DOM'da var ama görünür değilse, biraz bekle ve tekrar kontrol et
            if (toastErrorCheck.found && !toastErrorCheck.visible) {
                console.log(`ℹ️ Toast-error DOM'da var ama görünür değil, bekleniyor...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Tekrar kontrol et
                const retryCheck = await this.page.evaluate(() => {
                    const container = document.querySelector('#toast-container');
                    if (!container) return { found: false };
                    
                    const errorToast = container.querySelector('.toast-error');
                    if (!errorToast) return { found: false };
                    
                    const computedStyle = window.getComputedStyle(errorToast);
                    const opacity = parseFloat(computedStyle.opacity);
                    const display = computedStyle.display;
                    
                    if (opacity > 0 && display !== 'none') {
                        const titleEl = errorToast.querySelector('.toast-title');
                        const messageEl = errorToast.querySelector('.toast-message');
                        const title = titleEl ? (titleEl.getAttribute('aria-label') || titleEl.textContent || titleEl.innerText || '') : '';
                        const message = messageEl ? (messageEl.getAttribute('aria-label') || messageEl.textContent || messageEl.innerText || '') : '';
                        return {
                            found: true,
                            visible: true,
                            title: title.trim(),
                            message: message.trim()
                        };
                    }
                    return { found: true, visible: false };
                }).catch(() => ({ found: false }));
                
                if (retryCheck.found && retryCheck.visible) {
                    console.log(`❌ Toast-error görünür hale geldi! Başlık: "${retryCheck.title}", Mesaj: "${retryCheck.message}"`);
                    return {
                        success: false,
                        error: 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.',
                        errorType: 'INVALID_CODE',
                        toastTitle: retryCheck.title,
                        toastMessage: retryCheck.message,
                        detectedBy: 'toast-error-retry-check'
                    };
                }
            }
            
            // waitForSelector ile de kontrol et (fallback)
            let toastErrorFound = false;
            try {
                console.log('⏳ Toast-error waitForSelector ile kontrol ediliyor (max 5 saniye)...');
                await this.page.waitForSelector('#toast-container .toast-error', { 
                    state: 'visible', 
                    timeout: 5000 
                }).then(() => {
                    toastErrorFound = true;
                    console.log('✅ Toast-error waitForSelector ile göründü!');
                }).catch(() => {
                    console.log('ℹ️ Toast-error waitForSelector ile görünmedi (timeout - normal olabilir)');
                });
            } catch (error) {
                console.log(`ℹ️ Toast-error waitForSelector hatası: ${error.message}`);
            }
            
            if (toastErrorFound) {
                // waitForSelector ile bulundu, içeriğini oku
                const toastErrorElement = this.page.locator('#toast-container .toast-error').first();
                try {
                    const titleElement = toastErrorElement.locator('.toast-title');
                    const messageElement = toastErrorElement.locator('.toast-message');
                    
                    const title = await titleElement.textContent().catch(() => '');
                    const message = await messageElement.textContent().catch(() => '');
                    const titleAria = await titleElement.getAttribute('aria-label').catch(() => '');
                    const messageAria = await messageElement.getAttribute('aria-label').catch(() => '');
                    
                    const cleanTitle = (title || titleAria || '').trim();
                    const cleanMessage = (message || messageAria || '').trim();
                    const fullText = `${cleanTitle} ${cleanMessage}`.trim();
                    
                    console.log(`❌ Toast-error waitForSelector ile bulundu! Başlık: "${cleanTitle}", Mesaj: "${cleanMessage}"`);
                    
                    return {
                        success: false,
                        error: 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.',
                        errorType: 'INVALID_CODE',
                        toastTitle: cleanTitle,
                        toastMessage: cleanMessage,
                        fullText: fullText,
                        detectedBy: 'toast-error-waitforselector'
                    };
                } catch (error) {
                    console.log(`⚠️ Toast-error içeriği okunamadı: ${error.message}`);
                    return {
                        success: false,
                        error: 'Yoklama işleminde hata oluştu (toast-error tespit edildi).',
                        errorType: 'UI_ERROR',
                        detectedBy: 'toast-error-waitforselector-fallback'
                    };
                }
            }
            
            // Toast-error bulunamadı, biraz daha bekle ve tekrar kontrol et
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Alternatif: Toast container'ın içeriğini direkt kontrol et (DOM'da olabilir ama görünür olmayabilir)
            try {
                const toastContainerExists = await this.page.locator('#toast-container').count() > 0;
                if (toastContainerExists) {
                    // Container içinde toast-error var mı kontrol et (DOM'da olsa bile)
                    const errorInDOM = await this.page.evaluate(() => {
                        const container = document.querySelector('#toast-container');
                        if (container) {
                            const errorToast = container.querySelector('.toast-error');
                            if (errorToast) {
                                // Element'in içeriğini al
                                const titleEl = errorToast.querySelector('.toast-title');
                                const messageEl = errorToast.querySelector('.toast-message');
                                return {
                                    exists: true,
                                    title: titleEl ? (titleEl.getAttribute('aria-label') || titleEl.textContent || titleEl.innerText || '') : '',
                                    message: messageEl ? (messageEl.getAttribute('aria-label') || messageEl.textContent || messageEl.innerText || '') : '',
                                    opacity: window.getComputedStyle(errorToast).opacity,
                                    display: window.getComputedStyle(errorToast).display,
                                    visibility: window.getComputedStyle(errorToast).visibility
                                };
                            }
                        }
                        return { exists: false };
                    }).catch(() => ({ exists: false }));
                    
                    if (errorInDOM.exists) {
                        console.log(`🔍 Toast-error DOM'da bulundu - Opacity: ${errorInDOM.opacity}, Display: ${errorInDOM.display}`);
                        const cleanTitle = (errorInDOM.title || '').trim();
                        const cleanMessage = (errorInDOM.message || '').trim();
                        
                        // Eğer opacity > 0 veya display != 'none' ise -> görünür demektir
                        if (parseFloat(errorInDOM.opacity) > 0 && errorInDOM.display !== 'none') {
                            console.log(`⚠️ Toast-error DOM'da görünür - Başlık: "${cleanTitle}", Mesaj: "${cleanMessage}"`);
                            
                            if (cleanMessage || cleanTitle) {
                                let errorType = 'INVALID_CODE';
                                let errorMessage = 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.';
                                
                                const lowerMessage = cleanMessage.toLowerCase();
                                const lowerTitle = cleanTitle.toLowerCase();
                                
                                if (lowerMessage.includes('yoklama bulunamadı') || lowerMessage.includes('yoklama not found')) {
                                    errorType = 'INVALID_CODE';
                                    errorMessage = 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.';
                                } else if (lowerMessage.includes('geçersiz') || lowerMessage.includes('invalid')) {
                                    errorType = 'INVALID_CODE';
                                    errorMessage = 'Geçersiz ders kodu. Lütfen doğru kodu giriniz.';
                                } else if (lowerTitle.includes('hata') || lowerMessage.includes('hata') || lowerMessage.includes('error')) {
                                    errorType = 'GENERAL_ERROR';
                                    errorMessage = cleanMessage || `Yoklama hatası: ${cleanTitle} ${cleanMessage}`;
                                }
                                
                                return {
                                    success: false,
                                    error: errorMessage,
                                    errorType: errorType,
                                    toastTitle: cleanTitle,
                                    toastMessage: cleanMessage,
                                    fullText: `${cleanTitle} ${cleanMessage}`.trim()
                                };
                            }
                        }
                    }
                }
            } catch (error) {
                console.log(`⚠️ Toast DOM kontrolü sırasında hata: ${error.message}`);
            }
            
            // Toast container'ı kontrol et (birden fazla yöntemle)
            const toastContainer = this.page.locator('#toast-container');
            const toastContainerCount = await toastContainer.count();
            console.log(`🔍 Toast container sayısı: ${toastContainerCount}`);
            
            // Toast container var mı ve görünür mü?
            if (toastContainerCount > 0 || toastErrorFound) {
                const containerVisible = toastContainerCount > 0 ? await toastContainer.isVisible().catch(() => false) : false;
                console.log(`🔍 Toast container görünür mü: ${containerVisible}`);
                
                // Eğer toast-error zaten bulunduysa, direkt içeriğini oku
                if (toastErrorElement) {
                    try {
                        console.log('❌ Toast-error bulundu, hata mesajı okunuyor...');
                        
                        const titleElement = toastErrorElement.locator('.toast-title');
                        const messageElement = toastErrorElement.locator('.toast-message');
                        
                        // Text content'i al
                        const title = await titleElement.textContent().catch(() => '');
                        const message = await messageElement.textContent().catch(() => '');
                        
                        // aria-label'dan da oku (Angular'daki ngx-toastr aria-label kullanır)
                        const titleAria = await titleElement.getAttribute('aria-label').catch(() => '');
                        const messageAria = await messageElement.getAttribute('aria-label').catch(() => '');
                        
                        // innerText dene (eğer textContent boşsa)
                        let cleanTitle = (title || titleAria || '').trim();
                        let cleanMessage = (message || messageAria || '').trim();
                        
                        // Eğer hala boşsa, evaluate ile innerText al
                        if (!cleanTitle || !cleanMessage) {
                            const textContent = await toastErrorElement.evaluate((el) => {
                                const titleEl = el.querySelector('.toast-title');
                                const messageEl = el.querySelector('.toast-message');
                                return {
                                    title: titleEl ? (titleEl.innerText || titleEl.textContent || titleEl.getAttribute('aria-label') || '') : '',
                                    message: messageEl ? (messageEl.innerText || messageEl.textContent || messageEl.getAttribute('aria-label') || '') : ''
                                };
                            }).catch(() => ({ title: '', message: '' }));
                            
                            cleanTitle = cleanTitle || textContent.title.trim();
                            cleanMessage = cleanMessage || textContent.message.trim();
                        }
                        
                        const fullText = `${cleanTitle} ${cleanMessage}`.trim();
                        
                        console.log(`⚠️ Toast hata mesajı - Başlık: "${cleanTitle}", Mesaj: "${cleanMessage}"`);
                        
                        // Eğer mesaj veya başlık varsa -> hata var
                        if (cleanMessage || cleanTitle) {
                            let errorType = 'INVALID_CODE';
                            let errorMessage = 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.';
                            
                            const lowerMessage = cleanMessage.toLowerCase();
                            const lowerTitle = cleanTitle.toLowerCase();
                            
                            if (lowerMessage.includes('yoklama bulunamadı') || lowerMessage.includes('yoklama not found')) {
                            errorType = 'INVALID_CODE';
                            errorMessage = 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.';
                            } else if (lowerMessage.includes('geçersiz') || lowerMessage.includes('invalid')) {
                            errorType = 'INVALID_CODE';
                            errorMessage = 'Geçersiz ders kodu. Lütfen doğru kodu giriniz.';
                            } else if (lowerTitle.includes('hata') || lowerMessage.includes('hata') || lowerMessage.includes('error')) {
                                errorType = 'GENERAL_ERROR';
                                errorMessage = cleanMessage || `Yoklama hatası: ${fullText}`;
                        }
                        
                        return {
                                success: false,
                                error: errorMessage,
                            errorType: errorType,
                                toastTitle: cleanTitle,
                                toastMessage: cleanMessage,
                                fullText: fullText
                            };
                        }
                    } catch (error) {
                        console.log(`⚠️ Toast-error içeriği okunamadı: ${error.message}`);
                        // Toast-error var ama içerik okunamadı, yine de hata olarak işaretle
                        return {
                            success: false,
                            error: 'Yoklama işleminde hata oluştu (toast-error tespit edildi).',
                            errorType: 'UI_ERROR'
                        };
                    }
                }
                
                // Container içeriğini kontrol et (fallback)
                if (containerVisible && toastContainerCount > 0) {
                    // Toast-error'u container içinde ara
                    const errorToast = toastContainer.locator('.toast-error');
                    const errorToastCount = await errorToast.count();
                    console.log(`🔍 Container içinde toast-error sayısı: ${errorToastCount}`);
                    
                    if (errorToastCount > 0) {
                        // Toast-error var, detaylı kontrol yap
                        for (let i = 0; i < errorToastCount; i++) {
                            try {
                                const toastElement = errorToast.nth(i);
                                const isVisible = await toastElement.isVisible().catch(() => false);
                                
                                // Opacity ve display kontrolü
                                const styles = await toastElement.evaluate((el) => {
                                    const computed = window.getComputedStyle(el);
                                    return {
                                        opacity: computed.opacity,
                                        display: computed.display,
                                        visibility: computed.visibility
                                    };
                                }).catch(() => ({ opacity: '0', display: 'none', visibility: 'hidden' }));
                                
                                console.log(`🔍 Toast-error[${i}] - Görünür: ${isVisible}, Opacity: ${styles.opacity}, Display: ${styles.display}, Visibility: ${styles.visibility}`);
                                
                                // Eğer toast-error görünürse veya opacity > 0 ise -> hata var
                                if (isVisible || (parseFloat(styles.opacity) > 0 && styles.display !== 'none' && styles.visibility !== 'hidden')) {
                                    console.log(`❌ Toast-error[${i}] görünür, hata mesajı okunuyor...`);
                                    
                                    try {
                                        const titleElement = toastElement.locator('.toast-title');
                                        const messageElement = toastElement.locator('.toast-message');
                                        
                                        // Text content ve aria-label'dan oku
                                        const title = await titleElement.textContent().catch(() => '');
                                        const message = await messageElement.textContent().catch(() => '');
                                        const titleAria = await titleElement.getAttribute('aria-label').catch(() => '');
                                        const messageAria = await messageElement.getAttribute('aria-label').catch(() => '');
                                        
                                        let cleanTitle = (title || titleAria || '').trim();
                                        let cleanMessage = (message || messageAria || '').trim();
                                        
                                        // Eğer hala boşsa, evaluate ile innerText al
                                        if (!cleanTitle || !cleanMessage) {
                                            const textContent = await toastElement.evaluate((el) => {
                                                const titleEl = el.querySelector('.toast-title');
                                                const messageEl = el.querySelector('.toast-message');
                                                return {
                                                    title: titleEl ? (titleEl.innerText || titleEl.textContent || titleEl.getAttribute('aria-label') || '') : '',
                                                    message: messageEl ? (messageEl.innerText || messageEl.textContent || messageEl.getAttribute('aria-label') || '') : ''
                                                };
                                            }).catch(() => ({ title: '', message: '' }));
                                            
                                            cleanTitle = cleanTitle || textContent.title.trim();
                                            cleanMessage = cleanMessage || textContent.message.trim();
                                        }
                                        
                                        const fullText = `${cleanTitle} ${cleanMessage}`.trim();
                                        
                                        console.log(`⚠️ Toast hata mesajı - Başlık: "${cleanTitle}", Mesaj: "${cleanMessage}"`);
                                        
                                        // Eğer mesaj boş değilse veya "hata" kelimesi varsa -> hata var
                                        if (cleanMessage || cleanTitle.toLowerCase().includes('hata') || cleanTitle.toLowerCase().includes('error')) {
                                            let errorType = 'INVALID_CODE';
                                            let errorMessage = 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.';
                                            
                                            const lowerMessage = cleanMessage.toLowerCase();
                                            const lowerTitle = cleanTitle.toLowerCase();
                                            
                                            if (lowerMessage.includes('yoklama bulunamadı') || lowerMessage.includes('yoklama not found')) {
                                                errorType = 'INVALID_CODE';
                                                errorMessage = 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.';
                                            } else if (lowerMessage.includes('geçersiz') || lowerMessage.includes('invalid')) {
                                                errorType = 'INVALID_CODE';
                                                errorMessage = 'Geçersiz ders kodu. Lütfen doğru kodu giriniz.';
                                            } else if (lowerTitle.includes('hata') || lowerMessage.includes('hata') || lowerMessage.includes('error')) {
                                                errorType = 'GENERAL_ERROR';
                                                errorMessage = cleanMessage || `Yoklama hatası: ${fullText}`;
                                            }
                                            
                                            return {
                                                success: false,
                                                error: errorMessage,
                                                errorType: errorType,
                                                toastTitle: cleanTitle,
                                                toastMessage: cleanMessage,
                                                fullText: fullText
                                            };
                                        }
            } catch (error) {
                                        console.log(`⚠️ Toast içeriği okunamadı: ${error.message}`);
                                        // Toast-error var ama içerik okunamadı, yine de hata olarak işaretle
                                        return {
                                            success: false,
                                            error: 'Yoklama işleminde hata oluştu (toast-error tespit edildi).',
                                            errorType: 'UI_ERROR'
                                        };
                                    }
                                }
                            } catch (error) {
                                console.log(`⚠️ Toast-error[${i}] kontrolü sırasında hata: ${error.message}`);
                            }
                        }
                    } else {
                        console.log('ℹ️ Toast container var ama toast-error yok');
                    }
                }
            }
            
            // Alternatif: Sayfa içeriğinde "yoklama bulunamadı" veya "hata" kelimesi ara
            console.log('🔍 Sayfa içeriğinde hata mesajı aranıyor...');
            try {
                // Sayfa HTML içeriğini al
                const pageContent = await this.page.content();
                const pageText = await this.page.evaluate(() => {
                    // Tüm text içeriğini al (toast dahil)
                    return document.body.innerText || document.body.textContent || '';
                }).catch(() => '');
                
                // Toast container'ın içeriğini de kontrol et
                const toastContent = await this.page.evaluate(() => {
                    const container = document.querySelector('#toast-container');
                    if (container) {
                        return container.innerText || container.textContent || '';
                    }
                    return '';
                }).catch(() => '');
                
                const lowerPageText = pageText.toLowerCase();
                const lowerPageContent = pageContent.toLowerCase();
                const lowerToastContent = toastContent.toLowerCase();
                
                console.log(`🔍 Sayfa text uzunluğu: ${lowerPageText.length}, Toast text uzunluğu: ${lowerToastContent.length}`);
                if (lowerToastContent) {
                    console.log(`🔍 Toast içeriği: "${lowerToastContent.substring(0, 100)}"`);
                }
                
                // Hata kelimelerini ara (öncelik sırasına göre)
                const errorKeywords = [
                    'yoklama bulunamadı',
                    'yoklama not found',
                    'geçersiz kod',
                    'invalid code',
                    'hata',
                    'error'
                ];
                
                for (const keyword of errorKeywords) {
                    // Önce toast içeriğinde ara (daha spesifik)
                    if (lowerToastContent.includes(keyword)) {
                        console.log(`⚠️ Toast içeriğinde hata kelimesi bulundu: "${keyword}"`);
                        return {
                            success: false,
                            error: 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.',
                            errorType: 'INVALID_CODE'
                        };
                    }
                    // Sonra sayfa içeriğinde ara
                    if (lowerPageText.includes(keyword) || lowerPageContent.includes(keyword)) {
                        console.log(`⚠️ Sayfa içeriğinde hata kelimesi bulundu: "${keyword}"`);
                        return {
                            success: false,
                            error: 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.',
                            errorType: 'INVALID_CODE'
                        };
                    }
                }
                
                // Toast içeriğinde "hata" veya "error" kelimesi var mı kontrol et
                if (lowerToastContent && (lowerToastContent.includes('hata') || lowerToastContent.includes('error'))) {
                    console.log(`⚠️ Toast içeriğinde genel hata kelimesi bulundu`);
                    return {
                        success: false,
                        error: 'Yoklama işleminde hata oluştu.',
                        errorType: 'GENERAL_ERROR'
                    };
                }
            } catch (error) {
                console.log(`⚠️ Sayfa içeriği kontrolü sırasında hata: ${error.message}`);
            }
            
            // Direkt toast-error selector'ını da kontrol et (fallback)
            const errorToastDirect = this.page.locator('.toast-error');
            const errorToastDirectCount = await errorToastDirect.count();
            console.log(`🔍 Direkt toast-error sayısı (fallback): ${errorToastDirectCount}`);
            
            if (errorToastDirectCount > 0) {
                try {
                    const firstErrorToast = errorToastDirect.first();
                    const isVisible = await firstErrorToast.isVisible().catch(() => false);
                    const opacity = await firstErrorToast.evaluate((el) => {
                        return window.getComputedStyle(el).opacity;
                    }).catch(() => '0');
                    
                    console.log(`🔍 Direkt toast-error görünürlük: ${isVisible}, Opacity: ${opacity}`);
                    
                    // Eğer toast-error görünürse -> hata var
                    if (isVisible || parseFloat(opacity) > 0) {
                        console.log('❌ Direkt toast-error görünür, hata mesajı okunuyor...');
                        
                        try {
                            const titleElement = firstErrorToast.locator('.toast-title');
                            const messageElement = firstErrorToast.locator('.toast-message');
                            
                            const title = await titleElement.textContent().catch(() => '');
                            const message = await messageElement.textContent().catch(() => '');
                            
                            // aria-label'dan da oku
                            const titleAria = await titleElement.getAttribute('aria-label').catch(() => '');
                            const messageAria = await messageElement.getAttribute('aria-label').catch(() => '');
                            
                            const cleanTitle = (title || titleAria || '').trim();
                            const cleanMessage = (message || messageAria || '').trim();
                            const fullText = `${cleanTitle} ${cleanMessage}`.trim();
                            
                            console.log(`⚠️ Direkt toast hata mesajı - Başlık: "${cleanTitle}", Mesaj: "${cleanMessage}"`);
                            
                            if (cleanMessage || cleanTitle) {
                                let errorType = 'INVALID_CODE';
                                let errorMessage = 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.';
                                
                                const lowerMessage = cleanMessage.toLowerCase();
                                const lowerTitle = cleanTitle.toLowerCase();
                                
                                if (lowerMessage.includes('yoklama bulunamadı') || lowerMessage.includes('yoklama not found')) {
                                    errorType = 'INVALID_CODE';
                                    errorMessage = 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.';
                                } else if (lowerMessage.includes('geçersiz') || lowerMessage.includes('invalid')) {
                                    errorType = 'INVALID_CODE';
                                    errorMessage = 'Geçersiz ders kodu. Lütfen doğru kodu giriniz.';
                                } else if (lowerTitle.includes('hata') || lowerMessage.includes('hata') || lowerMessage.includes('error')) {
                                    errorType = 'GENERAL_ERROR';
                                    errorMessage = cleanMessage || `Yoklama hatası: ${fullText}`;
                                }
                                
                        return {
                                    success: false,
                                    error: errorMessage,
                                    errorType: errorType,
                                    toastTitle: cleanTitle,
                                    toastMessage: cleanMessage,
                                    fullText: fullText
                        };
                    }
                } catch (error) {
                            console.log(`⚠️ Direkt toast içeriği okunamadı: ${error.message}`);
                            // Toast-error var ama içerik okunamadı, yine de hata olarak işaretle
                            return {
                                success: false,
                                error: 'Yoklama işleminde hata oluştu (toast-error tespit edildi).',
                                errorType: 'UI_ERROR'
                            };
                        }
                    }
                } catch (error) {
                    console.log(`⚠️ Direkt toast-error kontrolü sırasında hata: ${error.message}`);
                }
            }
            
            // 2. BAŞARI KONTROLÜ: SweetAlert2 success kontrolü (önce kontrol et, çünkü success varsa direkt başarılı)
            console.log('🔍 SweetAlert2 success kontrol ediliyor...');
            try {
                // SweetAlert2 container'ını kontrol et
                const swal2Container = this.page.locator('.swal2-container');
                const swal2Popup = this.page.locator('.swal2-popup');
                
                // Swal2 container veya popup var mı kontrol et
                const swal2ContainerCount = await swal2Container.count();
                const swal2PopupCount = await swal2Popup.count();
                
                console.log(`🔍 Swal2 container sayısı: ${swal2ContainerCount}, Popup sayısı: ${swal2PopupCount}`);
                
                if (swal2ContainerCount > 0 || swal2PopupCount > 0) {
                    // Swal2 var, success ikonu var mı kontrol et
                    const successIcons = [
                        '.swal2-success',
                        '.swal2-icon-success',
                        '.swal2-success-ring',
                        '.swal2-icon.swal2-success'
                    ];
                    
                    for (const iconSelector of successIcons) {
                        try {
                            const successIcon = this.page.locator(iconSelector);
                            const iconCount = await successIcon.count();
                            
                            if (iconCount > 0) {
                                const isVisible = await successIcon.first().isVisible().catch(() => false);
                                
                                if (isVisible) {
                                    console.log(`✅ SweetAlert2 success ikonu bulundu: ${iconSelector}`);
                                    
                                    // Swal2 başlık ve içeriğini oku (opsiyonel)
                                    try {
                                        const swal2Title = swal2Popup.locator('.swal2-title');
                                        const swal2Content = swal2Popup.locator('.swal2-html-container');
                                        
                                        const title = await swal2Title.textContent().catch(() => '');
                                        const content = await swal2Content.textContent().catch(() => '');
                                        
                                        console.log(`✅ Swal2 başarı mesajı - Başlık: "${title.trim()}", İçerik: "${content.trim()}"`);
                                    } catch (error) {
                                        console.log('ℹ️ Swal2 içeriği okunamadı (önemli değil)');
                                    }
                                    
                                    // Success ikonu görünüyorsa -> başarılı
                return {
                                        success: true,
                                        message: 'Yoklama başarıyla tamamlandı (SweetAlert2 success tespit edildi)',
                                        swal2Success: true
                                    };
                                }
                            }
                        } catch (error) {
                            // Bu selector başarısız, diğerini dene
                            continue;
                        }
                    }
                    
                    // Swal2 var ama success ikonu yok, başka bir şey olabilir
                    console.log('ℹ️ Swal2 popup var ama success ikonu bulunamadı');
                } else {
                    console.log('ℹ️ SweetAlert2 popup bulunamadı');
                }
            } catch (error) {
                console.log(`⚠️ SweetAlert2 kontrolü sırasında hata: ${error.message}`);
            }
            
            // 3. SON KONTROL: Eğer hiçbir şey bulunamadıysa, tekrar kontrol et (toast geç görünebilir)
            // Toast'un geç görünmesi durumunda tekrar dene
            console.log('🔍 Son kontrol yapılıyor (toast geç görünebilir)...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Toast-error'u tekrar kontrol et
            const finalToastCheck = await this.page.evaluate(() => {
                const container = document.querySelector('#toast-container');
                if (container) {
                    const errorToast = container.querySelector('.toast-error');
                    if (errorToast) {
                        const titleEl = errorToast.querySelector('.toast-title');
                        const messageEl = errorToast.querySelector('.toast-message');
                        const opacity = window.getComputedStyle(errorToast).opacity;
                        const display = window.getComputedStyle(errorToast).display;
                        
                        if (parseFloat(opacity) > 0 && display !== 'none') {
            return {
                                found: true,
                                title: titleEl ? (titleEl.getAttribute('aria-label') || titleEl.textContent || titleEl.innerText || '') : '',
                                message: messageEl ? (messageEl.getAttribute('aria-label') || messageEl.textContent || messageEl.innerText || '') : '',
                                toastText: errorToast.innerText || errorToast.textContent || ''
                            };
                        }
                    }
                }
                return { found: false };
            }).catch(() => ({ found: false }));
            
            if (finalToastCheck.found) {
                const cleanTitle = (finalToastCheck.title || '').trim();
                const cleanMessage = (finalToastCheck.message || '').trim();
                const toastText = (finalToastCheck.toastText || '').trim();
                
                console.log(`⚠️ Son kontrol: Toast-error bulundu - Başlık: "${cleanTitle}", Mesaj: "${cleanMessage}", Text: "${toastText}"`);
                
                // Eğer toast içeriğinde hata kelimesi varsa
                const lowerToastText = toastText.toLowerCase();
                if (lowerToastText.includes('yoklama bulunamadı') || 
                    lowerToastText.includes('hata') || 
                    cleanMessage.toLowerCase().includes('yoklama bulunamadı') ||
                    cleanTitle.toLowerCase().includes('hata')) {
                    
                    return {
                        success: false,
                        error: 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.',
                        errorType: 'INVALID_CODE',
                        toastTitle: cleanTitle,
                        toastMessage: cleanMessage
                    };
                }
            }
            
            // 4. BAŞARI KONTROLÜ: SweetAlert2 success kontrolü
            console.log('🔍 SweetAlert2 success kontrol ediliyor...');
            try {
                // SweetAlert2 container'ını kontrol et
                const swal2Container = this.page.locator('.swal2-container');
                const swal2Popup = this.page.locator('.swal2-popup');
                
                // Swal2 container veya popup var mı kontrol et
                const swal2ContainerCount = await swal2Container.count();
                const swal2PopupCount = await swal2Popup.count();
                
                console.log(`🔍 Swal2 container sayısı: ${swal2ContainerCount}, Popup sayısı: ${swal2PopupCount}`);
                
                if (swal2ContainerCount > 0 || swal2PopupCount > 0) {
                    // Swal2 var, success ikonu var mı kontrol et
                    const successIcons = [
                        '.swal2-success',
                        '.swal2-icon-success',
                        '.swal2-success-ring',
                        '.swal2-icon.swal2-success'
                    ];
                    
                    for (const iconSelector of successIcons) {
                        try {
                            const successIcon = this.page.locator(iconSelector);
                            const iconCount = await successIcon.count();
                            
                            if (iconCount > 0) {
                                const isVisible = await successIcon.first().isVisible().catch(() => false);
                                
                                if (isVisible) {
                                    console.log(`✅ SweetAlert2 success ikonu bulundu: ${iconSelector}`);
                                    
                                    // Swal2 başlık ve içeriğini oku (opsiyonel)
                                    try {
                                        const swal2Title = swal2Popup.locator('.swal2-title');
                                        const swal2Content = swal2Popup.locator('.swal2-html-container');
                                        
                                        const title = await swal2Title.textContent().catch(() => '');
                                        const content = await swal2Content.textContent().catch(() => '');
                                        
                                        console.log(`✅ Swal2 başarı mesajı - Başlık: "${title.trim()}", İçerik: "${content.trim()}"`);
        } catch (error) {
                                        console.log('ℹ️ Swal2 içeriği okunamadı (önemli değil)');
                                    }
                                    
                                    // Success ikonu görünüyorsa -> başarılı
            return {
                                        success: true,
                                        message: 'Yoklama başarıyla tamamlandı (SweetAlert2 success tespit edildi)',
                                        swal2Success: true
                                    };
                                }
                            }
                        } catch (error) {
                            // Bu selector başarısız, diğerini dene
                            continue;
                        }
                    }
                    
                    // Swal2 var ama success ikonu yok, başka bir şey olabilir
                    console.log('ℹ️ Swal2 popup var ama success ikonu bulunamadı');
                } else {
                    console.log('ℹ️ SweetAlert2 popup bulunamadı');
                }
            } catch (error) {
                console.log(`⚠️ SweetAlert2 kontrolü sırasında hata: ${error.message}`);
            }
            
            // 5. SON KONTROL: Eğer hiçbir hata veya başarı göstergesi yoksa, ek kontroller yap
            console.log('🔍 Son kontrol yapılıyor (toast-error ve Swal2 success bulunamadı)...');
            
            // Sayfa durumunu kontrol et
            const finalPageCheck = await this.page.evaluate(() => {
                // Toast container kontrolü
                const container = document.querySelector('#toast-container');
                const hasToastContainer = container !== null;
                const toastContainerHasChildren = container ? container.children.length > 0 : false;
                
                // Swal2 kontrolü
                const swal2Container = document.querySelector('.swal2-container');
                const hasSwal2 = swal2Container !== null;
                
                // Sayfa içeriğinde hata veya başarı kelimeleri
                const bodyText = (document.body.innerText || document.body.textContent || '').toLowerCase();
                const hasErrorKeywords = bodyText.includes('hata') || 
                                       bodyText.includes('error') ||
                                       bodyText.includes('yoklama bulunamadı') ||
                                       bodyText.includes('başarısız');
                const hasSuccessKeywords = bodyText.includes('başarılı') || 
                                         bodyText.includes('success') ||
                                         bodyText.includes('tamamlandı');
                
                return {
                    hasToastContainer,
                    toastContainerHasChildren,
                    hasSwal2,
                    hasErrorKeywords,
                    hasSuccessKeywords,
                    bodyTextLength: bodyText.length
                };
            }).catch((error) => {
                console.log(`⚠️ Son sayfa kontrolü hatası: ${error.message}`);
                return null;
            });
            
            console.log(`🔍 Son sayfa kontrol sonucu:`, finalPageCheck);
            
            // Eğer sayfa kontrolünde hata kelimeleri varsa -> BAŞARISIZ
            if (finalPageCheck && finalPageCheck.hasErrorKeywords && !finalPageCheck.hasSuccessKeywords) {
                console.log(`❌ Sayfa içeriğinde hata kelimeleri bulundu!`);
                return {
                    success: false,
                    error: 'Yoklama işleminde hata oluştu. Lütfen tekrar deneyin.',
                    errorType: 'GENERAL_ERROR',
                    detectedBy: 'final-page-check-error-keywords'
                };
            }
            
            // Eğer Swal2 var ama success ikonu yoksa -> BAŞARISIZ (çünkü başka bir hata olabilir)
            if (finalPageCheck && finalPageCheck.hasSwal2 && !finalPageCheck.hasSuccessKeywords) {
                console.log(`⚠️ Swal2 var ama success kelimesi yok, başarısız sayılıyor`);
                return {
                    success: false,
                    error: 'Yoklama sonucu belirlenemedi. Lütfen tekrar deneyin.',
                    errorType: 'UNKNOWN',
                    detectedBy: 'final-page-check-swal2-no-success'
                };
            }
            
            // Eğer toast container var ve içinde elementler varsa ama toast-error bulunamadıysa
            // Bu durumda başka bir toast olabilir (success toast), kontrol et
            if (finalPageCheck && finalPageCheck.hasToastContainer && finalPageCheck.toastContainerHasChildren) {
                console.log(`🔍 Toast container var ve içinde elementler var, detaylı kontrol yapılıyor...`);
                
                const toastDetails = await this.page.evaluate(() => {
                    const container = document.querySelector('#toast-container');
                    if (!container) return null;
                    
                    // Tüm toast elementlerini kontrol et
                    const allToasts = container.querySelectorAll('[class*="toast"]');
                    const toastTypes = [];
                    
                    for (const toast of allToasts) {
                        const classes = toast.className || '';
                        const text = toast.innerText || toast.textContent || '';
                        
                        if (classes.includes('toast-error')) {
                            toastTypes.push({ type: 'error', text: text.substring(0, 100) });
                        } else if (classes.includes('toast-success')) {
                            toastTypes.push({ type: 'success', text: text.substring(0, 100) });
                        } else if (classes.includes('toast-info')) {
                            toastTypes.push({ type: 'info', text: text.substring(0, 100) });
                        } else if (classes.includes('toast-warning')) {
                            toastTypes.push({ type: 'warning', text: text.substring(0, 100) });
                        } else {
                            toastTypes.push({ type: 'unknown', text: text.substring(0, 100) });
                        }
                    }
                    
                    return {
                        toastCount: allToasts.length,
                        toastTypes: toastTypes
                    };
                }).catch(() => null);
                
                console.log(`🔍 Toast detayları:`, toastDetails);
                
                // Eğer sadece error toast varsa -> BAŞARISIZ
                if (toastDetails && toastDetails.toastTypes.length > 0) {
                    const hasErrorToast = toastDetails.toastTypes.some(t => t.type === 'error');
                    const hasSuccessToast = toastDetails.toastTypes.some(t => t.type === 'success');
                    
                    if (hasErrorToast && !hasSuccessToast) {
                        console.log(`❌ Sadece error toast bulundu!`);
                        return {
                            success: false,
                            error: 'Yoklama işleminde hata oluştu.',
                            errorType: 'GENERAL_ERROR',
                            detectedBy: 'final-toast-check-error-only'
                        };
                    }
                }
            }
            
            // Eğer hiçbir şey bulunamadıysa -> BAŞARISIZ (güvenli tarafta kal)
            // Çünkü ya swal ya da toast kesinlikle çıkıyor, ikisi de yoksa bir sorun var demektir
            console.log(`⚠️ Hiçbir sonuç göstergesi bulunamadı (ne toast-error ne de Swal2 success). Başarısız sayılıyor.`);
            return {
                success: false,
                error: 'Yoklama sonucu belirlenemedi. Lütfen tekrar deneyin.',
                errorType: 'UNKNOWN',
                detectedBy: 'no-indicator-found',
                finalPageCheck: finalPageCheck
            };
            
        } catch (error) {
            console.log(`❌ Yoklama sonucu kontrolü sırasında sorun: ${error.message}`);
            console.log(`❌ Hata stack: ${error.stack}`);
            // Hata durumunda güvenli tarafta kal - başarısız olarak işaretle
            return {
                success: false,
                error: `Yoklama sonucu kontrol edilemedi: ${error.message}`,
                errorType: 'SYSTEM_ERROR'
            };
        }
    }

    /**
     * Yoklama hatası kontrolü yap (deprecated - checkAttendanceResult kullan)
     * @returns {Promise<Object>} - Hata kontrol sonucu
     */
    async checkForAttendanceError() {
        // Yeni fonksiyonu kullan
        const result = await this.checkAttendanceResult();
        return {
            hasError: !result.success,
            errorMessage: result.error || '',
            errorType: result.errorType || 'UNKNOWN'
        };
    }

    /**
     * Kamera izni popup'ını yönet
     * @returns {Promise<void>}
     */
    async handleCameraPermission() {
        try {
            console.log('📹 Kamera izni popup\'ı kontrol ediliyor...');
            
            // Kamera izni popup'ını bekle ve reddet
            const denyButton = this.page.locator('button:has-text("İzin Verme")').first();
            const isVisible = await denyButton.isVisible({ timeout: 5000 }).catch(() => false);
            
            if (isVisible) {
                await denyButton.click();
                console.log('❌ Kamera izni reddedildi');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.log('ℹ️ Kamera izni popup\'ı bulunamadı veya zaten reddedilmiş');
        }
    }

    /**
     * Konum izni popup'ını yönet
     * @returns {Promise<void>}
     */
    async handleLocationPermission() {
        try {
            console.log('🔍 Konum izni popup\'ı kontrol ediliyor...');
            
            // Konum izni popup'ını bekleyip kabul et
            const allowButton = this.page.locator('button:has-text("Siteyi ziyaret ederken izin ver")').first();
            const isVisible = await allowButton.isVisible({ timeout: 5000 }).catch(() => false);
            
            if (isVisible) {
                await allowButton.click();
                console.log('✅ Konum izni popup\'ı kabul edildi');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (error) {
            console.log('ℹ️ Konum izni popup\'ı bulunamadı veya zaten kabul edilmiş');
        }
    }

    /**
     * Giriş başarılı mı kontrol et
     * @param {string} url - Mevcut URL
     * @param {string} content - Sayfa içeriği
     * @returns {boolean} - Giriş başarı durumu
     */
    isLoginSuccessful(url, content) {
        console.log('🔍 Giriş başarı kontrolü yapılıyor...');
        
        // URL kontrolü - Deysis özel URL'leri
        const successUrls = [
            'dashboard', 
            'home', 
            'main', 
            'panel', 
            'student',
            'ogrenci',
            'profile',
            'courses',
            'lessons',
            'attendance',
            'yoklama'
        ];
        const hasSuccessUrl = successUrls.some(successUrl => url.toLowerCase().includes(successUrl));
        console.log(`📍 URL kontrolü: ${hasSuccessUrl ? '✅' : '❌'} (${url})`);
        
        // İçerik kontrolü - Türkçe ve İngilizce
        const successIndicators = [
            'hoş geldiniz',
            'welcome',
            'dashboard',
            'panel',
            'çıkış',
            'logout',
            'profile',
            'profil',
            'dersler',
            'lessons',
            'kurslar',
            'courses',
            'yoklama',
            'attendance',
            'öğrenci',
            'student',
            'ana sayfa',
            'home'
        ];
        const hasSuccessContent = successIndicators.some(indicator => 
            content.toLowerCase().includes(indicator.toLowerCase())
        );
        console.log(`📄 İçerik kontrolü: ${hasSuccessContent ? '✅' : '❌'}`);

        // Hata kontrolü
        const errorIndicators = [
            'hatalı kullanıcı adı',
            'yanlış şifre',
            'giriş başarısız',
            'invalid username',
            'incorrect password',
            'login failed',
            'authentication failed',
            'giriş yapılamadı',
            'kullanıcı adı veya şifre hatalı',
            'username or password incorrect'
        ];
        const hasError = errorIndicators.some(error => 
            content.toLowerCase().includes(error.toLowerCase())
        );
        console.log(`❌ Hata kontrolü: ${hasError ? 'HATA VAR' : 'HATA YOK'}`);

        // Login sayfasında mı kontrol et
        const isStillOnLoginPage = url.toLowerCase().includes('login') || 
                                   content.toLowerCase().includes('giriş yap') ||
                                   content.toLowerCase().includes('login');
        console.log(`🔐 Login sayfasında mı: ${isStillOnLoginPage ? 'EVET' : 'HAYIR'}`);

        // Eğer URL'de /ogrenci varsa ve login sayfasında değilse başarılı
        const isSuccessful = (hasSuccessUrl && !isStillOnLoginPage) || 
                            (url.includes('/ogrenci') && !isStillOnLoginPage);
        
        console.log(`🎯 Genel sonuç: ${isSuccessful ? '✅ BAŞARILI' : '❌ BAŞARISIZ'}`);

        return isSuccessful;
    }

    /**
     * Sayfa içeriğini al
     * @param {string} url - Alınacak sayfa URL'si
     * @returns {Promise<string>} - Sayfa içeriği
     */
    async getPageContent(url = null) {
        try {
            if (url) {
                await this.page.goto(url, { waitUntil: 'networkidle' });
            }
            return await this.page.content();
        } catch (error) {
            console.error('❌ Sayfa içeriği alma hatası:', error.message);
            return null;
        }
    }

    /**
     * Mevcut URL'yi al
     * @returns {string} - Mevcut URL
     */
    getCurrentUrl() {
        return this.page ? this.page.url() : null;
    }

    /**
     * Çerezleri al
     * @returns {Array} - Mevcut çerezler
     */
    async getCookies() {
        if (this.context) {
            return await this.context.cookies();
        }
        return this.sessionCookies || [];
    }

    /**
     * Çerezleri ayarla
     * @param {Array} cookies - Ayarlanacak çerezler
     */
    async setCookies(cookies) {
        if (this.context && cookies) {
            await this.context.addCookies(cookies);
            this.sessionCookies = cookies;
        }
    }

    /**
     * Browser'ı kapat
     */
    async close() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            if (this.context) {
                await this.context.close();
                this.context = null;
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
            this.isLoggedIn = false;
            console.log('🔒 Browser kapatıldı');
        } catch (error) {
            console.error('❌ Browser kapatma hatası:', error.message);
        }
    }

    /**
     * Browser'ı kapat (alias for close)
     */
    async closeBrowser() {
        return await this.close();
    }

    /**
     * Giriş durumunu kontrol et
     * @returns {boolean} - Giriş durumu
     */
    isLoggedInToDeysis() {
        return this.isLoggedIn;
    }
}

module.exports = DeysisLogin;
