# Deysis Yoklama Otomasyonu - Telegram Bot

Bu proje, DEÜ öğrencilerinin Deysis yoklama platformuna katılımını otomatize etmek için geliştirilmiş bir Telegram botudur.

## 🚀 Özellikler

- ✅ Telegram bot ile kullanıcı kayıt sistemi
- ✅ MySQL veritabanı entegrasyonu
- ✅ Okul maili doğrulama (DEÜ domain kontrolü)
- ✅ Şifre saklama (Deysis giriş için)
- ✅ Kullanıcı profil yönetimi
- ✅ Şifre değiştirme özelliği
- ✅ Deysis platformuna otomatik giriş modülü
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
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=deysis_users

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
help - Yardım menüsü
```

## 📱 Bot Kullanımı

### Temel Komutlar

- `/start` - Botu başlat ve hoş geldin mesajını gör
- `/register` - Yeni kullanıcı kaydı yap
- `/profile` - Profil bilgilerini görüntüle
- `/changepassword` - Şifre değiştir
- `/help` - Yardım menüsü

### Kayıt Süreci

1. `/register` komutunu kullanın
2. DEÜ okul mailinizi girin (örn: ogrenci@ogr.deu.edu.tr)
3. Güvenli bir şifre oluşturun
4. Kayıt tamamlandıktan sonra profil bilgilerinizi görüntüleyebilirsiniz

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
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

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

## 🔒 Güvenlik

- Şifreler Deysis platformuna giriş için düz metin olarak saklanır
- E-posta adresleri sadece DEÜ domain'lerini kabul eder
- Kullanıcı durumları bot belleğinde güvenli şekilde saklanır
- Veritabanı bağlantıları connection pooling ile yönetilir

## 📞 Destek

Herhangi bir sorun yaşarsanız:

1. README dosyasını tekrar okuyun
2. Veritabanı bağlantı ayarlarını kontrol edin
3. Bot token'ının doğru olduğundan emin olun
4. Node.js ve MySQL sürümlerini kontrol edin

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 🚧 Gelecek Özellikler

- [ ] Deysis platformu entegrasyonu
- [ ] Otomatik yoklama katılımı
- [ ] Kullanıcı istatistikleri
- [ ] Admin paneli
- [ ] Bildirim sistemi
- [ ] Çoklu kampüs desteği
