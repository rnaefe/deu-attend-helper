/**
 * Deysis Platform Giriş Modülü
 * https://deysis.deu.edu.tr/ sitesine otomatik giriş yapma
 */

const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');

class DeysisLogin {
    constructor() {
        this.baseUrl = 'https://deysis.deu.edu.tr/';
        this.browser = null;
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
            const defaultOptions = {
                headless: true, // Test için false yapabilirsiniz
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
            };

            await this.sendLog('🌐 Browser başlatılıyor...');
            console.log('🌐 Browser başlatılıyor...');
            this.browser = await puppeteer.launch(defaultOptions);
            this.page = await this.browser.newPage();

            // Dokuz Eylül Tınaztepe Kampüsü konum ayarları
            await this.sendLog('📍 Konum ayarlanıyor...');
            console.log('📍 Dokuz Eylül Tınaztepe Kampüsü konumu ayarlanıyor...');
            await this.page.setGeolocation({
                latitude: 38.3675561,
                longitude: 27.2016134
            });
            
            // Konum izni otomatik ver
            await this.page.evaluateOnNewDocument(() => {
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
            
            // User agent ayarla
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            // Konum izni popup'ını otomatik kabul et, kamera iznini reddet
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

            // Kamera ve mikrofon izinlerini reddet
            await this.page.evaluateOnNewDocument(() => {
                // Kamera izni reddet
                navigator.mediaDevices.getUserMedia = () => {
                    return Promise.reject(new Error('Kamera izni reddedildi'));
                };
                
                // Mikrofon izni reddet
                navigator.mediaDevices.getDisplayMedia = () => {
                    return Promise.reject(new Error('Ekran paylaşımı reddedildi'));
                };
            });

            // Viewport ayarla
            await this.page.setViewport({ width: 1366, height: 768 });
            
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
                        waitUntil: 'networkidle0',
                        timeout: 30000 
                    });
                    
                    // Sayfa tamamen yüklenene kadar bekle
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
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
                            this.page = await this.browser.newPage();
                            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
                            await this.page.setViewport({ width: 1366, height: 768 });
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
                this.sessionCookies = await this.page.cookies();
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
            await this.page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });
            console.log('✅ Sayfa tamamen yüklendi');

            // Deysis sitesinin gerçek XPath'leri
            const emailXPath = '/html/body/app-root/app-login/div/div/div/form/div[1]/div/mat-form-field/div[1]/div/div[3]/input';
            const passwordXPath = '/html/body/app-root/app-login/div/div/div/form/div[2]/div/mat-form-field/div[1]/div/div[3]/input';
            
            // Alternatif CSS seçiciler (XPath başarısız olursa)
            const emailSelectors = [
                emailXPath,
                'input[formControlName="email"]',  // Kullanıcının verdiği gerçek seçici
                'input[name="email"]',
                'input[type="email"]',
                '#mat-input-13',  // Kullanıcının verdiği ID
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
                'input[formControlName="sifre"]',  // Kullanıcının verdiği gerçek seçici
                'input[name="password"]',
                'input[type="password"]',
                '#mat-input-14',  // Kullanıcının verdiği ID
                '#password',
                'mat-form-field input[type="password"]',
                'input[formControlName="password"]'
            ];

            console.log('🔍 E-posta alanı aranıyor...');
            
            // E-posta alanını bul ve doldur
            let emailElement = null;
            for (const selector of emailSelectors) {
                try {
                    // Sayfa hala aktif mi kontrol et
                    if (this.page.isClosed()) {
                        throw new Error('Sayfa kapatılmış');
                    }
                    
                    console.log(`🔍 Denenen seçici: ${selector}`);
                    
                    if (selector.startsWith('/')) {
                        // XPath kullan - Puppeteer'da doğru fonksiyon
                        const elements = await this.page.$x(selector);
                        if (elements.length > 0) {
                            emailElement = elements[0];
                            console.log(`✅ E-posta alanı XPath ile bulundu: ${selector}`);
                            break;
                        }
                    } else {
                        // CSS seçici kullan
                        await this.page.waitForSelector(selector, { timeout: 3000 });
                        emailElement = await this.page.$(selector);
                        if (emailElement) {
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
            await this.page.keyboard.down('Control');
            await this.page.keyboard.press('KeyA');
            await this.page.keyboard.up('Control');
            await this.page.keyboard.type(email, { delay: 100 });
            console.log('📧 E-posta dolduruldu');

            console.log('🔍 Şifre alanı aranıyor...');
            
            // Şifre alanını bul ve doldur
            let passwordElement = null;
            for (const selector of passwordSelectors) {
                try {
                    // Sayfa hala aktif mi kontrol et
                    if (this.page.isClosed()) {
                        throw new Error('Sayfa kapatılmış');
                    }
                    
                    console.log(`🔍 Denenen seçici: ${selector}`);
                    
                    if (selector.startsWith('/')) {
                        // XPath kullan - Puppeteer'da doğru fonksiyon
                        const elements = await this.page.$x(selector);
                        if (elements.length > 0) {
                            passwordElement = elements[0];
                            console.log(`✅ Şifre alanı XPath ile bulundu: ${selector}`);
                            break;
                        }
                    } else {
                        // CSS seçici kullan
                        await this.page.waitForSelector(selector, { timeout: 3000 });
                        passwordElement = await this.page.$(selector);
                        if (passwordElement) {
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
            await this.page.keyboard.down('Control');
            await this.page.keyboard.press('KeyA');
            await this.page.keyboard.up('Control');
            await this.page.keyboard.type(password, { delay: 100 });
            console.log('🔐 Şifre dolduruldu');

            // Giriş butonunu bul ve tıkla
            console.log('🔍 Giriş butonu aranıyor...');
            
            const submitSelectors = [
                '#loginForm > div:nth-child(3) > div > button',  // Kullanıcının verdiği seçici
                'button[type="submit"]',
                'input[type="submit"]',
                '.login-btn',
                '.submit-btn',
                'button:contains("Giriş")',
                'button:contains("Login")',
                'button:contains("Gönder")',
                'button:contains("Submit")',
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
                    // Sayfa hala aktif mi kontrol et
                    if (!this.page.isClosed()) {
                        await this.page.waitForSelector(selector, { timeout: 2000 });
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
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Giriş başarılı mı kontrol et
            let currentUrl, pageContent;
            
            try {
                // Sayfa hala aktif mi kontrol et
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
                await this.goToAttendancePage(courseCode);
                console.log('✅ Yoklama katıl sayfası işlemi tamamlandı');
                
                return { success: true, url: currentUrl };
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
            
            // Geolocation API'sini override et
            await this.page.evaluateOnNewDocument(() => {
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
            
            // Browser konum ayarlarını güncelle
            await this.page.setGeolocation({
                latitude: 38.3675561,
                longitude: 27.2016134
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
     * @returns {Promise<void>}
     */
    async goToAttendancePage(courseCode) {
        try {
            console.log('🎓 goToAttendancePage fonksiyonu çağrıldı');
            console.log(`📋 Ders kodu: ${courseCode}`);
            console.log('🎓 Yoklama katıl sayfasına gidiliyor...');
            
            // Direkt yoklama katıl sayfasına git
            const attendanceUrl = 'https://deysis.deu.edu.tr/ogrenci/yoklama-katil';
            await this.page.goto(attendanceUrl, { 
                waitUntil: 'networkidle0',
                timeout: 30000 
            });
            
            console.log('✅ Yoklama katıl sayfası yüklendi');
            
            // Sayfa yüklenmesini bekle
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Kamera izni popup'ını kontrol et
            await this.handleCameraPermission();
            
                // Ders kodunu gir
                const codeResult = await this.enterCourseCode(courseCode);
                
                if (codeResult && codeResult.success) {
                    console.log('✅ Yoklama katıl işlemi tamamlandı');
                } else {
                    console.log('❌ Yoklama katıl işlemi başarısız');
                    throw new Error(codeResult ? codeResult.error : 'Ders kodu girme işlemi başarısız');
                }
            
        } catch (error) {
            console.log(`❌ Yoklama katıl sayfası hatası: ${error.message}`);
        }
    }

    /**
     * Derse Katıl butonuna tıkla
     * @returns {Promise<void>}
     */
    async clickJoinClass() {
        try {
            console.log('🎓 Derse Katıl butonu aranıyor...');
            
            // Derse Katıl butonunu bul ve tıkla
            const joinClassSelectors = [
                'button:contains("Derse Katıl")',
                'div:contains("Derse Katıl")',
                '[class*="join-class"]',
                '[class*="derse-katil"]',
                'button[title*="Derse Katıl"]',
                'a:contains("Derse Katıl")'
            ];
            
            let joinButton = null;
            for (const selector of joinClassSelectors) {
                try {
                    console.log(`🔍 Denenen seçici: ${selector}`);
                    await this.page.waitForSelector(selector, { timeout: 3000 });
                    joinButton = await this.page.$(selector);
                    if (joinButton) {
                        console.log(`✅ Derse Katıl butonu bulundu: ${selector}`);
                        break;
                    }
                } catch (error) {
                    console.log(`❌ Seçici başarısız: ${selector}`);
                    continue;
                }
            }
            
            if (joinButton) {
                console.log('🎯 Derse Katıl butonuna tıklanıyor...');
                await joinButton.click();
                
                // Sayfa yüklenmesini bekle
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Kamera izni popup'ını kontrol et
                await this.handleCameraPermission();
                
                console.log('✅ Derse Katıl butonuna tıklandı');
            } else {
                console.log('⚠️ Derse Katıl butonu bulunamadı');
            }
        } catch (error) {
            console.log(`❌ Derse Katıl butonu tıklama hatası: ${error.message}`);
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
                'code-input input[type="tel"]', // Gerçek HTML seçicisi
                'code-input input[autocomplete="one-time-code"]', // Autocomplete ile
                'input[type="tel"][inputmode="numeric"]', // Type ve inputmode ile
                'code-input span input', // Span içindeki input'lar
                'input[type="tel"]', // Sadece type ile
                'input[inputmode="numeric"]' // Sadece inputmode ile
            ];

            const inputElements = [];
            for (const selector of codeInputSelectors) {
                try {
                    if (!this.page.isClosed()) {
                        const elements = await this.page.$$(selector);
                        if (elements.length > 0) {
                            inputElements.push(...elements);
                            console.log(`✅ Ders kodu giriş alanları bulundu: ${selector} (${elements.length} adet)`);
                            // Eğer yeterli sayıda input bulunduysa döngüyü kır
                            if (inputElements.length >= courseCode.length) break;
                        }
                    }
                } catch (error) {
                    console.log(`❌ Seçici ile ders kodu alanı bulunamadı ${selector}: ${error.message}`);
                }
            }
            
            // Sadece benzersiz elementleri al
            const uniqueInputElements = [...new Set(inputElements)];

            if (uniqueInputElements.length >= courseCode.length) {
                console.log(`📝 ${uniqueInputElements.length} adet input alanı bulundu, ders kodu giriliyor...`);
                
                for (let i = 0; i < courseCode.length; i++) {
                    const input = uniqueInputElements[i];
                    const char = courseCode[i];
                    if (input) {
                        // Input alanına odaklan
                        await input.focus();
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                        // Mevcut içeriği temizle
                        await input.click({ clickCount: 3 }); // Tüm metni seç
                        await this.page.keyboard.press('Delete');
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                        // Karakteri gir
                        await input.type(char);
                        console.log(`   ➡️ ${i + 1}. karakter "${char}" girildi`);
                        
                        // Her karakter arasında kısa bekleme
                        await new Promise(resolve => setTimeout(resolve, 200));
                    }
                }
                console.log('✅ Ders kodu başarıyla girildi.');

                // Enter tuşu ile gönder (genellikle otomatik gönderilir)
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.page.keyboard.press('Enter');
                console.log('📤 Enter tuşu ile ders kodu gönderildi');
                
                // İşlemin tamamlanmasını bekle
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Hata kontrolü yap
                const errorCheck = await this.checkForAttendanceError();
                if (errorCheck.hasError) {
                    await this.sendLog(`❌ Ders bulunamadı ${courseCode}`);
                    console.log(`❌ Yoklama hatası tespit edildi: ${errorCheck.errorMessage}`);
                    return {
                        success: false,
                        error: errorCheck.errorMessage,
                        errorType: errorCheck.errorType
                    };
                }
                
                await this.sendLog(`✅ Derse başarıyla katıldınız ${courseCode}`);
                console.log('✅ Ders kodu başarıyla işlendi');
                return {
                    success: true,
                    message: 'Ders kodu başarıyla girildi ve işlendi'
                };

            } else {
                console.warn(`⚠️ Ders kodu giriş alanları bulunamadı veya yeterli değil. Beklenen: ${courseCode.length}, Bulunan: ${uniqueInputElements.length}`);
                
                // Alternatif yöntem: Sayfa içeriğini kontrol et
                const pageContent = await this.page.content();
                if (pageContent.includes('Ders Kodunuzu Giriniz')) {
                    console.log('📄 Sayfa içeriğinde ders kodu alanı bulundu, alternatif yöntem deneniyor...');
                    
                    // Tüm input'ları bul ve ilk 6'sını kullan
                    const allInputs = await this.page.$$('input');
                    console.log(`🔍 Sayfada toplam ${allInputs.length} input bulundu`);
                    
                    if (allInputs.length >= courseCode.length) {
                        for (let i = 0; i < courseCode.length; i++) {
                            const input = allInputs[i];
                            const char = courseCode[i];
                            if (input) {
                                await input.focus();
                                await input.type(char);
                                console.log(`   ➡️ Alternatif yöntemle ${i + 1}. karakter "${char}" girildi`);
                                await new Promise(resolve => setTimeout(resolve, 200));
                            }
                        }
                        console.log('✅ Ders kodu alternatif yöntemle girildi');
                        
                        // Enter tuşu ile gönder
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await this.page.keyboard.press('Enter');
                        console.log('📤 Enter tuşu ile ders kodu gönderildi (alternatif yöntem)');
                        
                        // İşlemin tamamlanmasını bekle
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        
                        // Hata kontrolü yap
                        const errorCheck = await this.checkForAttendanceError();
                        if (errorCheck.hasError) {
                            console.log(`❌ Yoklama hatası tespit edildi (alternatif): ${errorCheck.errorMessage}`);
                            return {
                                success: false,
                                error: errorCheck.errorMessage,
                                errorType: errorCheck.errorType
                            };
                        }
                        
                        return {
                            success: true,
                            message: 'Ders kodu alternatif yöntemle başarıyla girildi ve işlendi'
                        };
                    }
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
     * Yoklama hatası kontrolü yap
     * @returns {Promise<Object>} - Hata kontrol sonucu
     */
    async checkForAttendanceError() {
        try {
            console.log('🔍 Yoklama hatası kontrol ediliyor...');
            
            // Sayfa içeriğini al
            const pageContent = await this.page.content();
            const currentUrl = this.page.url();
            
            // Hata mesajları
            const errorMessages = {
                'yoklama bulunamadı': {
                    type: 'INVALID_CODE',
                    message: 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.'
                },
                'yoklama not found': {
                    type: 'INVALID_CODE',
                    message: 'Attendance not found. Please enter a valid course code.'
                },
                'geçersiz kod': {
                    type: 'INVALID_CODE',
                    message: 'Geçersiz ders kodu. Lütfen doğru kodu giriniz.'
                },
                'invalid code': {
                    type: 'INVALID_CODE',
                    message: 'Invalid course code. Please enter a valid code.'
                },
                'hata': {
                    type: 'GENERAL_ERROR',
                    message: 'Yoklama işleminde hata oluştu.'
                },
                'error': {
                    type: 'GENERAL_ERROR',
                    message: 'An error occurred during attendance process.'
                }
            };
            
            // Sayfa içeriğinde hata mesajı ara
            for (const [errorText, errorInfo] of Object.entries(errorMessages)) {
                if (pageContent.toLowerCase().includes(errorText.toLowerCase())) {
                    console.log(`⚠️ Hata mesajı bulundu: "${errorText}"`);
                    return {
                        hasError: true,
                        errorMessage: errorInfo.message,
                        errorType: errorInfo.type,
                        detectedText: errorText
                    };
                }
            }
            
            // Toast hata mesajı kontrol et
            console.log('🔍 Toast hata mesajı kontrol ediliyor...');
            try {
                // Toast container'ı kontrol et
                const toastContainer = await this.page.$('#toast-container');
                if (toastContainer) {
                    // Toast içeriğini kontrol et
                    const toastContent = await this.page.evaluate(container => {
                        // Toast var mı kontrol et (boş değilse)
                        if (container.children.length > 0) {
                            // Hata toast'ı var mı?
                            const errorToast = container.querySelector('.toast-error');
                            if (errorToast) {
                                // Hata mesajını al
                                const titleElement = errorToast.querySelector('.toast-title');
                                const messageElement = errorToast.querySelector('.toast-message');
                                
                                const title = titleElement ? titleElement.textContent.trim() : '';
                                const message = messageElement ? messageElement.textContent.trim() : '';
                                
                                return {
                                    hasToast: true,
                                    title: title,
                                    message: message,
                                    fullText: `${title} ${message}`.trim()
                                };
                            }
                        }
                        return { hasToast: false };
                    }, toastContainer);
                    
                    if (toastContent.hasToast) {
                        console.log(`⚠️ Toast hata mesajı bulundu: "${toastContent.fullText}"`);
                        
                        // Hata mesajına göre tip belirle
                        let errorType = 'UI_ERROR';
                        let errorMessage = `Yoklama hatası: ${toastContent.fullText}`;
                        
                        if (toastContent.message.toLowerCase().includes('yoklama bulunamadı')) {
                            errorType = 'INVALID_CODE';
                            errorMessage = 'Ders kodu bulunamadı. Lütfen doğru ders kodunu giriniz.';
                        } else if (toastContent.message.toLowerCase().includes('geçersiz')) {
                            errorType = 'INVALID_CODE';
                            errorMessage = 'Geçersiz ders kodu. Lütfen doğru kodu giriniz.';
                        }
                        
                        return {
                            hasError: true,
                            errorMessage: errorMessage,
                            errorType: errorType,
                            detectedText: toastContent.fullText,
                            toastTitle: toastContent.title,
                            toastMessage: toastContent.message
                        };
                    }
                }
                console.log('✅ Toast hata mesajı bulunamadı');
            } catch (error) {
                console.log(`⚠️ Toast kontrolü sırasında hata: ${error.message}`);
            }
            
            // Alternatif hata popup'ı kontrol et (fallback)
            const errorSelectors = [
                '.alert-danger',
                '.error-message',
                '.alert-error',
                '[class*="error"]',
                '[class*="danger"]'
            ];
            
            for (const selector of errorSelectors) {
                try {
                    const errorElement = await this.page.$(selector);
                    if (errorElement) {
                        const errorText = await this.page.evaluate(el => el.textContent, errorElement);
                        console.log(`⚠️ Alternatif hata elementi bulundu: ${errorText}`);
                        return {
                            hasError: true,
                            errorMessage: `Yoklama hatası: ${errorText.trim()}`,
                            errorType: 'UI_ERROR',
                            detectedText: errorText.trim()
                        };
                    }
                } catch (error) {
                    // Seçici bulunamadı, devam et
                }
            }
            
            // URL kontrolü - hata sayfasında mı?
            if (currentUrl.includes('error') || currentUrl.includes('hata')) {
                return {
                    hasError: true,
                    errorMessage: 'Yoklama işleminde hata oluştu.',
                    errorType: 'URL_ERROR',
                    detectedText: 'error_url'
                };
            }
            
            console.log('✅ Yoklama hatası bulunamadı');
            return {
                hasError: false,
                message: 'Herhangi bir hata tespit edilmedi'
            };
            
        } catch (error) {
            console.log(`❌ Hata kontrolü sırasında sorun: ${error.message}`);
            return {
                hasError: false,
                message: 'Hata kontrolü yapılamadı'
            };
        }
    }

    /**
     * Kamera izni popup'ını yönet
     * @returns {Promise<void>}
     */
    async handleCameraPermission() {
        try {
            console.log('📹 Kamera izni popup\'ı kontrol ediliyor...');
            
            // Kamera izni popup'ını bekle ve reddet
            await this.page.waitForSelector('button:contains("İzin Verme")', { timeout: 5000 });
            
            const denyButton = await this.page.$('button:contains("İzin Verme")');
            if (denyButton) {
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
            await this.page.waitForSelector('button:contains("Siteyi ziyaret ederken izin ver")', { timeout: 5000 });
            
            const allowButton = await this.page.$('button:contains("Siteyi ziyaret ederken izin ver")');
            if (allowButton) {
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
            'ogrenci',  // Türkçe öğrenci sayfası
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

        // Hata kontrolü - Daha spesifik hata mesajları
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
                await this.page.goto(url, { waitUntil: 'networkidle2' });
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
        if (this.page) {
            return await this.page.cookies();
        }
        return this.sessionCookies || [];
    }

    /**
     * Çerezleri ayarla
     * @param {Array} cookies - Ayarlanacak çerezler
     */
    async setCookies(cookies) {
        if (this.page && cookies) {
            await this.page.setCookie(...cookies);
            this.sessionCookies = cookies;
        }
    }

    /**
     * Browser'ı kapat
     */
    async close() {
        try {
            if (this.browser) {
                await this.browser.close();
                console.log('🔒 Browser kapatıldı');
            }
        } catch (error) {
            console.error('❌ Browser kapatma hatası:', error.message);
        }
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
