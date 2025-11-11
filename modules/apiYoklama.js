/**
 * API Tabanlı Deysis Yoklama Katılım Sistemi
 * Cookie yönetimi ile login -> user -> yoklama katıl akışı
 * NOT: Bu dosya test amaçlıdır, deysisLogin.js ile birleştirilmeyecektir
 */

const fetch = require("node-fetch");
const { HttpsProxyAgent } = require('https-proxy-agent');

class DeysisAPI {
    constructor(proxyUrl = null) {
        this.baseUrl = 'https://deysis.deu.edu.tr';
        this.cookies = {}; // Cookie objesi { name: value }
        this.cookieString = ''; // Cookie string (header için)
        this.proxyUrl = proxyUrl || process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.PROXY_URL || null;
        this.proxyAgent = null;
        
        // Proxy agent oluştur (eğer proxy varsa)
        if (this.proxyUrl) {
            try {
                if (this.proxyUrl.startsWith('https://') || this.proxyUrl.startsWith('http://')) {
                    this.proxyAgent = new HttpsProxyAgent(this.proxyUrl);
                    console.log(`🔌 Proxy aktif: ${this.proxyUrl.replace(/:[^:]*@/, ':****@')}`); // Şifreyi gizle
                } else {
                    // Proxy URL formatı yanlışsa uyar
                    console.warn(`⚠️ Proxy URL formatı hatalı: ${this.proxyUrl}`);
                    console.warn(`   Doğru format: http://proxy.com:8080 veya http://user:pass@proxy.com:8080`);
                }
            } catch (error) {
                console.error(`❌ Proxy agent oluşturma hatası: ${error.message}`);
                this.proxyAgent = null;
            }
        }
    }
    
    /**
     * Proxy agent'ı al (fetch için)
     */
    getAgent() {
        return this.proxyAgent || undefined; // undefined ise proxy kullanılmaz
    }

    /**
     * Response'dan Set-Cookie header'larını parse et ve sakla
     */
    parseCookies(response) {
        const setCookieHeaders = response.headers.raw()['set-cookie'];
        if (setCookieHeaders && Array.isArray(setCookieHeaders)) {
            setCookieHeaders.forEach(cookieHeader => {
                // Cookie string'ini parse et: "name=value; Path=/; HttpOnly" -> { name: "value" }
                const cookieParts = cookieHeader.split(';');
                const [name, value] = cookieParts[0].split('=').map(s => s.trim());
                if (name && value) {
                    this.cookies[name] = value;
                }
            });
            
            // Cookie string'ini oluştur (header için)
            this.cookieString = Object.entries(this.cookies)
                .map(([name, value]) => `${name}=${value}`)
                .join('; ');
            
            console.log(`🍪 Cookie'ler güncellendi: ${Object.keys(this.cookies).length} adet cookie`);
            console.log(`   Cookie isimleri: ${Object.keys(this.cookies).join(', ')}`);
        }
    }

    /**
     * Cookie string'ini al (header için)
     */
    getCookieHeader() {
        return this.cookieString;
    }

    /**
     * Cookie'leri manuel olarak ayarla (test için)
     */
    setCookies(cookies) {
        if (typeof cookies === 'string') {
            // String formatı: "name1=value1; name2=value2"
            cookies.split(';').forEach(cookie => {
                const [name, value] = cookie.trim().split('=');
                if (name && value) {
                    this.cookies[name.trim()] = value.trim();
                }
            });
        } else if (typeof cookies === 'object') {
            // Object formatı: { name1: value1, name2: value2 }
            this.cookies = { ...this.cookies, ...cookies };
        }
        
        // Cookie string'ini güncelle
        this.cookieString = Object.entries(this.cookies)
            .map(([name, value]) => `${name}=${value}`)
            .join('; ');
    }

    /**
     * Login API'sini çağır
     */
    async login(email, password, rememberMe = true) {
        try {
            console.log(`🔐 Login API çağrısı yapılıyor... Email: ${email}`);

            const fetchOptions = {
                method: "POST",
                headers: {
                    "accept": "application/json, text/plain, */*",
                    "accept-language": "tr-TR,tr;q=0.8",
                    "cache-control": "no-cache",
                    "content-type": "text/plain", // ÖNEMLİ: text/plain kullanılıyor (JSON değil!)
                    "pragma": "no-cache",
                    "priority": "u=1, i",
                    "sec-ch-ua": '"Chromium";v="142", "Brave";v="142", "Not_A Brand";v="99"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"Windows"',
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "sec-gpc": "1",
                    "Referer": `${this.baseUrl}/`
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                    rememberMe: rememberMe
                })
            };
            
            // Proxy agent ekle (eğer varsa)
            const agent = this.getAgent();
            if (agent) {
                fetchOptions.agent = agent;
            }
            
            const response = await fetch(`${this.baseUrl}/api/Login`, fetchOptions);

            console.log(`   Status: ${response.status} ${response.statusText}`);

            // Cookie'leri parse et ve sakla
            this.parseCookies(response);
            console.log(`   Cookie sayısı: ${Object.keys(this.cookies).length}`);

            // Response'u oku
            const responseText = await response.text();
            console.log(`   Response length: ${responseText.length} karakter`);

            if (response.ok) {
                console.log(`✅ Login başarılı`);
                return {
                    success: true,
                    cookies: this.cookies,
                    cookieString: this.cookieString,
                    response: responseText
                };
            } else {
                console.log(`❌ Login başarısız: ${response.status}`);
                console.log(`   Response: ${responseText.substring(0, 200)}`);
                return {
                    success: false,
                    status: response.status,
                    error: responseText
                };
            }

        } catch (error) {
            console.error(`❌ Login hatası: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * User API'sini çağır (doğrulama için)
     */
    async getUser() {
        try {
            if (!this.cookieString || Object.keys(this.cookies).length === 0) {
                throw new Error('Cookie bulunamadı! Önce login yapın.');
            }

            const fetchOptions = {
                method: "GET",
                headers: {
                    "accept": "application/json, text/plain, */*",
                    "accept-language": "tr-TR,tr;q=0.8",
                    "cache-control": "no-cache",
                    "pragma": "no-cache",
                    "priority": "u=1, i",
                    "sec-ch-ua": '"Chromium";v="142", "Brave";v="142", "Not_A Brand";v="99"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"Windows"',
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "sec-gpc": "1",
                    "cookie": this.cookieString, // Cookie'leri header'a ekle
                    "Referer": `${this.baseUrl}/`
                }
            };
            
            // Proxy agent ekle (eğer varsa)
            const agent = this.getAgent();
            if (agent) {
                fetchOptions.agent = agent;
            }
            
            const response = await fetch(`${this.baseUrl}/api/User`, fetchOptions);

            // Cookie'leri güncelle (yeni cookie'ler gelebilir)
            this.parseCookies(response);

            const responseText = await response.text();

            if (response.ok) {
                try {
                    const userData = JSON.parse(responseText);
                    return {
                        success: true,
                        userData: userData
                    };
                } catch (parseError) {
                    return {
                        success: true,
                        userData: responseText
                    };
                }
            } else {
                return {
                    success: false,
                    status: response.status,
                    error: responseText
                };
            }

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Yoklama katıl API'sini çağır
     */
    async yoklamaKatil(kod, konum, girisTipi = "K") {
        try {
            if (!this.cookieString || Object.keys(this.cookies).length === 0) {
                throw new Error('Cookie bulunamadı! Önce login yapın.');
            }

            console.log(`🎓 Yoklama katıl API çağrısı yapılıyor...`);
            console.log(`   Ders Kodu: ${kod}`);
            console.log(`   Konum: ${konum}`);
            console.log(`   Giriş Tipi: ${girisTipi}`);

            const fetchOptions = {
                method: "POST",
                headers: {
                    "accept": "application/json, text/plain, */*",
                    "accept-language": "tr-TR,tr;q=0.8",
                    "cache-control": "no-cache",
                    "content-type": "application/json",
                    "pragma": "no-cache",
                    "priority": "u=1, i",
                    "sec-ch-ua": '"Chromium";v="142", "Brave";v="142", "Not_A Brand";v="99"',
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": '"Windows"',
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "sec-gpc": "1",
                    "cookie": this.cookieString, // Cookie'leri header'a ekle
                    "Referer": `${this.baseUrl}/ogrenci/yoklama-katil`
                },
                body: JSON.stringify({
                    GIRIS_TIPI: girisTipi,
                    KOD: kod,
                    KONUM: konum
                })
            };
            
            // Proxy agent ekle (eğer varsa)
            const agent = this.getAgent();
            if (agent) {
                fetchOptions.agent = agent;
            }
            
            const response = await fetch(`${this.baseUrl}/api/Ogrenci/YoklamaKatil`, fetchOptions);

            console.log(`   Status: ${response.status} ${response.statusText}`);

            // Response'u oku
            const responseText = await response.text();
            console.log(`   Response length: ${responseText.length} karakter`);

            if (response.ok) {
                // Response boş olabilir (başarılı)
                if (!responseText || responseText.trim() === '') {
                    console.log(`✅ Yoklama katılımı başarılı (boş response)`);
                    return {
                        success: true,
                        message: 'Yoklama katılımı başarılı'
                    };
                }

                // JSON parse etmeyi dene
                try {
                    const data = JSON.parse(responseText);
                    console.log(`✅ Yoklama katılımı başarılı`);
                    console.log(`   Response data:`, JSON.stringify(data, null, 2));
                    return {
                        success: true,
                        data: data,
                        message: 'Yoklama katılımı başarılı'
                    };
                } catch (parseError) {
                    console.log(`✅ Yoklama katılımı başarılı (text response)`);
                    console.log(`   Response: ${responseText.substring(0, 200)}`);
                    return {
                        success: true,
                        message: responseText,
                        rawResponse: responseText
                    };
                }
            } else {
                // Hata mesajını parse etmeyi dene
                let errorMessage = 'Yoklama katılımı başarısız';
                try {
                    const errorData = JSON.parse(responseText);
                    errorMessage = errorData.message || errorData.error || errorMessage;
                    console.log(`❌ Yoklama katılımı başarısız: ${response.status}`);
                    console.log(`   Hata mesajı: ${errorMessage}`);
                    console.log(`   Response: ${responseText}`);
                } catch (e) {
                    if (responseText) {
                        errorMessage = responseText;
                    }
                    console.log(`❌ Yoklama katılımı başarısız: ${response.status}`);
                    console.log(`   Response: ${responseText.substring(0, 200)}`);
                }

                return {
                    success: false,
                    status: response.status,
                    error: errorMessage,
                    response: responseText
                };
            }

        } catch (error) {
            console.error(`❌ Yoklama katıl hatası: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

/**
 * Test fonksiyonu
 * NOT: Bu fonksiyon sadece test amaçlıdır. Bot.js kullanıldığında konum bot.js'den gelir.
 */
async function testAPIYoklama() {
    const api = new DeysisAPI();

    // Test bilgileri
    const email = "daglarefe.goksoy@ogr.deu.edu.tr";
    const password = "10377920Dd";
    const courseCode = "123123";
    
    // Test için konum oluştur (bot.js'deki gibi dinamik)
    // Bot.js'den gelmiyor, sadece test için burada tanımlı
    const baseLatitude = 38.36715;
    const baseLongitude = 27.203146;
    const latOffset = (Math.random() * 0.000009 + 0.000009).toFixed(8);
    const lonOffset = (Math.random() * 0.000009 + 0.000009).toFixed(8);
    const latSign = Math.random() > 0.5 ? 1 : -1;
    const lonSign = Math.random() > 0.5 ? 1 : -1;
    const latitude = (parseFloat(baseLatitude) + parseFloat(latOffset) * latSign).toFixed(8);
    const longitude = (parseFloat(baseLongitude) + parseFloat(lonOffset) * lonSign).toFixed(8);
    const konum = `${latitude},${longitude}`;

    console.log('🚀 API tabanlı yoklama katılım testi başlatılıyor...\n');
    console.log('='.repeat(60));
    console.log(`📍 Test konumu: ${konum} (bot.js'deki gibi dinamik oluşturuldu)`);

    // 1. Login
    console.log('\n1️⃣ LOGIN');
    console.log('='.repeat(60));
    const loginResult = await api.login(email, password);
    if (!loginResult.success) {
        console.error('\n❌ Login başarısız, test durduruluyor.');
        console.error(`   Hata: ${loginResult.error}`);
        return;
    }
    console.log(`   Cookie String: ${api.getCookieHeader().substring(0, 100)}...`);

    // 2. User (doğrulama)
    console.log('\n2️⃣ USER (DOĞRULAMA)');
    console.log('='.repeat(60));
    const userResult = await api.getUser();
    if (!userResult.success) {
        console.error('\n❌ User API başarısız, test durduruluyor.');
        console.error(`   Hata: ${userResult.error}`);
        return;
    }

    // 3. Yoklama Katıl
    console.log('\n3️⃣ YOKLAMA KATIL');
    console.log('='.repeat(60));
    const yoklamaResult = await api.yoklamaKatil(courseCode, konum);
    if (yoklamaResult.success) {
        console.log('\n✅ ✅ ✅ YOKLAMA KATILIMI BAŞARILI! ✅ ✅ ✅');
        console.log(`   Mesaj: ${yoklamaResult.message}`);
    } else {
        console.log('\n❌ ❌ ❌ YOKLAMA KATILIMI BAŞARISIZ! ❌ ❌ ❌');
        console.log(`   Hata: ${yoklamaResult.error}`);
        console.log(`   Status: ${yoklamaResult.status}`);
    }

    // Sonuç özeti
    console.log('\n' + '='.repeat(60));
    console.log('SONUÇ ÖZETİ');
    console.log('='.repeat(60));
    console.log(`Login: ${loginResult.success ? '✅' : '❌'}`);
    console.log(`User: ${userResult.success ? '✅' : '❌'}`);
    console.log(`Yoklama: ${yoklamaResult.success ? '✅' : '❌'}`);
    console.log('='.repeat(60));
}

// Eğer direkt çalıştırılıyorsa test et
if (require.main === module) {
    testAPIYoklama().catch(console.error);
}

module.exports = DeysisAPI;

