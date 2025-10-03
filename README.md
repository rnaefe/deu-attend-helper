# Deysis Yoklama Otomasyonu - for educational purposes only

Bu proje, DEÜ öğrencilerinin Deysis yoklama platformuna katılımını otomatize etmek için geliştirilmiş bir Telegram botudur. Bot, kullanıcıların Deysis platformuna otomatik giriş yapmasını ve yoklamaya katılmasını sağlar.

## 🚀 Özellikler

- ✅ Telegram bot ile kullanıcı kayıt sistemi
- ✅ MySQL veritabanı entegrasyonu
- ✅ Okul maili doğrulama (DEÜ domain kontrolü)
- ✅ Şifre saklama (Deysis giriş için düz metin)
- ✅ Kullanıcı profil yönetimi
- ✅ Şifre değiştirme özelliği
- ✅ **Deysis platformuna otomatik giriş ve yoklama katılımı**
- ✅ **Akıllı browser yönetimi (ihtiyaç anında açılır/kapanır)**
- ✅ **Gerçek zamanlı işlem takibi ve log mesajları**
- ✅ **Konum spoofing (Tınaztepe Kampüsü)**
- ✅ **Kamera/mikrofon izin reddi**
- ✅ **Ders kodu doğrulama ve hata tespiti**
- ✅ Web scraping ve oturum yönetimi

## 📋 Gereksinimler

- Node.js (v14 veya üzeri)
- MySQL (v5.7 veya üzeri)
- Telegram Bot Token (BotFather'dan alınacak)

## 🛠️ Kurulum

### 1. Projeyi İndirin

```bash
git clone <repository-url>
cd deysis_bypass
```

### 2. Bağımlılıkları Yükleyin

```bash
npm install
```

### 3. Çevre Değişkenlerini Ayarlayın

`env.example` dosyasını kopyalayın ve `.env` olarak yeniden adlandırın:

```bash
cp env.example .env
```

`.env` dosyasını düzenleyin:

```env
# Telegram Bot Token (BotFather'dan alınacak)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# MySQL Veritabanı Ayarları
MYSQLHOST=localhost
MYSQLPORT=3306
MYSQLUSER=root
MYSQL_ROOT_PASSWORD=your_password
MYSQL_DATABASE=deysis_users

# Bot Ayarları
BOT_ADMIN_ID=your_admin_telegram_id
```

### 4. MySQL Veritabanını Hazırlayın

MySQL'de yeni bir veritabanı oluşturun:

```sql
CREATE DATABASE deysis_users CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. Veritabanı Tablolarını Oluşturun

```bash
npm run setup-db
```

### 6. Botu Başlatın

```bash
npm start
```

## 🤖 Telegram Bot Kurulumu

### 1. BotFather ile Bot Oluşturun

1. Telegram'da [@BotFather](https://t.me/botfather) ile konuşun
2. `/newbot` komutunu gönderin
3. Bot adını ve kullanıcı adını girin
4. Bot token'ınızı alın ve `.env` dosyasına ekleyin

### 2. Bot Komutlarını Ayarlayın (Opsiyonel)

BotFather'da `/setcommands` komutunu kullanarak bot komutlarını ayarlayabilirsiniz:

```
start - Botu başlat
register - Yeni kullanıcı kaydı
profile - Profil bilgilerini görüntüle
changepassword - Şifre değiştir
attend - Yoklamaya katıl
help - Yardım menüsü
```

## 📱 Bot Kullanımı

### Temel Komutlar

- `/start` - Botu başlat ve hoş geldin mesajını gör
- `/register` - Yeni kullanıcı kaydı yap
- `/profile` - Profil bilgilerini görüntüle
- `/changepassword` - Şifre değiştir
- `/attend` - **Yoklamaya otomatik katıl**
- `/help` - Yardım menüsü

### Kayıt Süreci

1. `/register` komutunu kullanın
2. DEÜ okul mailinizi girin (örn: ogrenci@ogr.deu.edu.tr)
3. Deysis şifrenizi girin (Deysis platformuna giriş için kullanılacak)
4. Kayıt tamamlandıktan sonra profil bilgilerinizi görüntüleyebilirsiniz

### Yoklama Katılım Süreci

1. `/attend` komutunu kullanın
2. 6 haneli ders kodunuzu girin (örn: 123456)
3. Bot otomatik olarak:
   - Browser'ı açar
   - Deysis'e giriş yapar
   - Konumu Tınaztepe Kampüsü olarak ayarlar
   - Yoklama sayfasına gider
   - Ders kodunu girer
   - Sonucu bildirir
   - Browser'ı kapatır

### Gerçek Zamanlı Takip

Bot, yoklama katılım sürecinde size şu mesajları gönderir:

```
🌐 Browser başlatılıyor...
✅ Browser hazır
🌐 Browser başlatılıyor...
📍 Konum ayarlanıyor...
🔐 Deysis'e giriş yapılıyor...
✅ Giriş başarılı
🎯 Yoklama sayfasına gidiliyor...
🔢 Ders kodu giriliyor... 123456
❌ Ders bulunamadı 123456
🔒 Browser kapatıldı
```

### Başarılı Yoklama Katılımı Örneği

```
📚 Yoklamaya Katıl

Merhaba Ahmet

Ders kodunuzu giriniz (6 haneli):
Örnek: `123456`

🔄 Yoklamaya katılım başlatılıyor...

📧 E-posta: ahmet@ogr.deu.edu.tr
🔢 Ders Kodu: `123456`

🌐 Browser başlatılıyor...
✅ Browser hazır
🌐 Browser başlatılıyor...
📍 Konum ayarlanıyor...
✅ Browser başlatıldı
🔐 Deysis'e giriş yapılıyor...
✅ Giriş başarılı
🎯 Yoklama sayfasına gidiliyor...
🔢 Ders kodu giriliyor... 123456
✅ Derse başarıyla katıldınız 123456

✅ Yoklamaya Başarıyla Katıldınız

📧 E-posta: ahmet@ogr.deu.edu.tr
🔢 Ders Kodu: `123456`
⏰ Tarih: 03.01.2025

🎉 İşlem tamamlandı

🔒 Browser kapatıldı
```

## 🗄️ Veritabanı Yapısı

### Users Tablosu

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    school_email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,  -- Deysis şifresi (düz metin)
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Not:** Şifreler düz metin olarak saklanır çünkü Deysis platformuna giriş için kullanılır.

## 🔧 Teknik Detaylar

### Deysis Entegrasyonu

Bot, Deysis platformu ile etkileşim için şu özellikleri kullanır:

- **Puppeteer:** Headless Chrome browser otomasyonu
- **Konum Spoofing:** Tınaztepe Kampüsü koordinatları (38.3675561, 27.2016134)
- **İzin Yönetimi:** Kamera/mikrofon izinlerini otomatik reddetme
- **Element Seçimi:** XPath ve CSS selector kombinasyonu
- **Hata Tespiti:** Toast mesajları ve sayfa içeriği analizi
- **Session Yönetimi:** Oturum sürekliliği ve cookie yönetimi

### Browser Optimizasyonları

- **Minimal Kaynak Kullanımı:** Sadece gerekli sayfalarda açılır
- **Otomatik Temizlik:** İşlem bitince kapatılır
- **Hata Toleransı:** Sayfa yükleme hatalarında yeniden deneme
- **Element Bekleme:** Dinamik içerik yüklenmesini bekler

## 🔧 Geliştirme

### Geliştirme Modunda Çalıştırma

```bash
npm run dev
```

### Veritabanı Kurulumu (Manuel)

```bash
node setup-database.js
```

### Deysis Giriş Modülü Testi

```bash
npm run test-deysis
```

Bu komut Deysis platformuna giriş modülünü test eder. Test dosyasında gerçek e-posta ve şifre bilgilerini girmeniz gerekir.

## 📦 Kullanılan Teknolojiler

- **Node.js** - Runtime environment
- **node-telegram-bot-api** - Telegram Bot API
- **mysql2** - MySQL veritabanı bağlantısı
- **validator** - E-posta validasyonu
- **dotenv** - Çevre değişkenleri yönetimi
- **puppeteer** - Web scraping ve browser otomasyonu
- **axios** - HTTP istekleri
- **cheerio** - HTML parsing

## 🔒 Güvenlik ve Performans

### Güvenlik
- Şifreler Deysis platformuna giriş için düz metin olarak saklanır
- E-posta adresleri sadece DEÜ domain'lerini kabul eder
- Kullanıcı durumları bot belleğinde güvenli şekilde saklanır
- Veritabanı bağlantıları connection pooling ile yönetilir
- MarkdownV2 güvenli mesaj formatı kullanılır

### Performans Optimizasyonları
- **Akıllı Browser Yönetimi:** Browser sadece `/attend` komutu kullanıldığında açılır
- **Otomatik Temizlik:** İşlem bitince browser otomatik kapatılır
- **Düşük Bellek Kullanımı:** Bot başlangıcında gereksiz kaynak tüketimi yok
- **Hızlı Başlatma:** Bot çok hızlı başlar ve hazır olur

## 📞 Destek

Herhangi bir sorun yaşarsanız:

1. README dosyasını tekrar okuyun
2. Veritabanı bağlantı ayarlarını kontrol edin
3. Bot token'ının doğru olduğundan emin olun
4. Node.js ve MySQL sürümlerini kontrol edin

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 🚧 Gelecek Özellikler

- [x] Deysis platformu entegrasyonu ✅
- [x] Otomatik yoklama katılımı ✅
- [x] Gerçek zamanlı işlem takibi ✅
- [x] Akıllı browser yönetimi ✅
- [ ] Kullanıcı istatistikleri
- [ ] Admin paneli
- [ ] Bildirim sistemi
- [ ] Çoklu kampüs desteği
- [ ] Toplu yoklama katılımı
- [ ] Yoklama geçmişi takibi
