# Docker ile Çalıştırma Kılavuzu

Bu kılavuz, Deysis Bot'u Docker ve Docker Compose kullanarak çalıştırmanız için adım adım talimatlar içerir.

## 📋 Gereksinimler

- Docker (v20.10 veya üzeri)
- Docker Compose (v2.0 veya üzeri)
- Telegram Bot Token (BotFather'dan alınacak)
- **MySQL Veritabanı** (Local veya sunucuda çalışan)
  - Local MySQL: Host makinenizde çalışan MySQL
  - Sunucu MySQL: Uzak sunucuda çalışan MySQL (erişilebilir olmalı)

## 🚀 Hızlı Başlangıç

### 1. Dosyaları Hazırlama

```bash
# .env dosyasını oluşturun
cp env.example .env
```

### 2. MySQL Veritabanını Hazırlayın

**Local MySQL kullanıyorsanız:**
- MySQL'inizin çalıştığından emin olun
- Veritabanını oluşturun: `CREATE DATABASE deysis_users;`
- Tabloları oluşturun: `npm run setup-db` (local'de) veya `init.sql` script'ini çalıştırın

**Sunucu MySQL kullanıyorsanız:**
- Sunucu IP adresine veya domain'e erişebildiğinizden emin olun
- Firewall'da 3306 portunun açık olduğundan emin olun
- Veritabanı ve kullanıcı bilgilerine sahip olduğunuzdan emin olun

### 3. .env Dosyasını Düzenleyin

`.env` dosyasını açın ve aşağıdaki bilgileri doldurun:

**Local MySQL için:**
```env
# Telegram Bot Token (BotFather'dan alınacak)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# MySQL Veritabanı Ayarları (Local)
MYSQLHOST=host.docker.internal  # Windows/Mac için
# MYSQLHOST=localhost  # Linux için (docker-compose.yml'de network_mode: "host" kullanın)
MYSQLPORT=3306
MYSQLUSER=root
MYSQL_ROOT_PASSWORD=your_mysql_password_here
MYSQL_DATABASE=deysis_users

# Bot Ayarları
BOT_ADMIN_ID=your_telegram_user_id_here
```

**Sunucu MySQL için:**
```env
# Telegram Bot Token (BotFather'dan alınacak)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# MySQL Veritabanı Ayarları (Sunucu)
MYSQLHOST=192.168.1.100  # Sunucu IP adresi veya domain
MYSQLPORT=3306
MYSQLUSER=your_mysql_user
MYSQL_ROOT_PASSWORD=your_mysql_password_here
MYSQL_DATABASE=deysis_users

# Bot Ayarları
BOT_ADMIN_ID=your_telegram_user_id_here
```

**Önemli Notlar:**
- **Local MySQL (Windows/Mac):** `MYSQLHOST=host.docker.internal` kullanın
- **Local MySQL (Linux):** `MYSQLHOST=localhost` kullanın ve `docker-compose.yml`'de `network_mode: "host"` açın
- **Sunucu MySQL:** `MYSQLHOST=sunucu_ip_adresi` veya domain kullanın
- `MYSQL_ROOT_PASSWORD` gerçek MySQL şifrenizi girin
- `TELEGRAM_BOT_TOKEN` BotFather'dan alacağınız token'ı girin

### 4. Docker Compose ile Başlatma

```bash
# Docker Compose ile build ve start
docker-compose up --build -d
```

Bu komut:
- Bot container'ını oluşturur
- Bot'u arka planda çalıştırır
- Bot, .env dosyasındaki MySQL ayarlarına göre bağlanır

**Not:** MySQL servisi Docker içinde çalışmaz, local veya sunucudaki MySQL'e bağlanır.

### 5. Logları İzleme

```bash
# Bot loglarını görüntüle
docker-compose logs -f app

# Tüm logları görüntüle
docker-compose logs -f
```

### 6. Container Durumunu Kontrol Etme

```bash
# Container'ın durumunu görüntüle
docker-compose ps

# Bot container'ının durumunu kontrol et
docker-compose ps app
```

## 🛠️ Yönetim Komutları

### Container'ı Durdurma

```bash
# Container'ı durdur
docker-compose stop

# Container'ı durdur ve kaldır
docker-compose down
```

### Container'ı Yeniden Başlatma

```bash
# Container'ı yeniden başlat
docker-compose restart

# Bot'u yeniden başlat
docker-compose restart app
```

### Bot'u Yeniden Build Etme

```bash
# Değişikliklerden sonra yeniden build
docker-compose up --build -d

# Sadece bot'u yeniden build
docker-compose build app
docker-compose up -d app
```

## 🗄️ Veritabanı Yönetimi

### MySQL'e Bağlanma

**Local MySQL:**
```bash
# Local MySQL'e bağlan
mysql -u root -p -h localhost

# Veritabanını seç
USE deysis_users;
```

**Sunucu MySQL:**
```bash
# Sunucu MySQL'e bağlan
mysql -u root -p -h sunucu_ip_adresi

# Veritabanını seç
USE deysis_users;
```

### Veritabanını Yedekleme

**Local MySQL:**
```bash
# Veritabanını yedekle
mysqldump -u root -p -h localhost deysis_users > backup.sql
```

**Sunucu MySQL:**
```bash
# Veritabanını yedekle
mysqldump -u root -p -h sunucu_ip_adresi deysis_users > backup.sql
```

### Veritabanını Geri Yükleme

**Local MySQL:**
```bash
# Yedekten geri yükle
mysql -u root -p -h localhost deysis_users < backup.sql
```

**Sunucu MySQL:**
```bash
# Yedekten geri yükle
mysql -u root -p -h sunucu_ip_adresi deysis_users < backup.sql
```

### Tabloları Oluşturma

Veritabanı tablolarını oluşturmak için:

```bash
# Local'de çalıştırın (veritabanı local'deyse)
npm run setup-db

# Veya init.sql script'ini çalıştırın
mysql -u root -p -h localhost deysis_users < init.sql
```

## 🔍 Sorun Giderme

### Bot Başlamıyor

1. **Logları kontrol edin:**
   ```bash
   docker-compose logs app
   ```

2. **.env dosyasını kontrol edin:**
   - `TELEGRAM_BOT_TOKEN` doğru mu?
   - `MYSQLHOST=db` olarak ayarlı mı?

3. **MySQL bağlantısını test edin:**
   ```bash
   docker-compose exec app node -e "require('dotenv').config(); console.log(process.env.MYSQLHOST)"
   ```

### MySQL Bağlantı Hatası

1. **MySQL'in çalıştığını kontrol edin:**
   ```bash
   # Local MySQL
   mysql -u root -p -h localhost -e "SELECT 1;"
   
   # Sunucu MySQL
   mysql -u root -p -h sunucu_ip_adresi -e "SELECT 1;"
   ```

2. **.env dosyasındaki MySQL ayarlarını kontrol edin:**
   - `MYSQLHOST` doğru mu? (host.docker.internal veya sunucu IP)
   - `MYSQLPORT` doğru mu? (genellikle 3306)
   - `MYSQLUSER` ve `MYSQL_ROOT_PASSWORD` doğru mu?

3. **Firewall kontrolü (Sunucu MySQL için):**
   - Port 3306 açık mı?
   - IP adresi whitelist'te mi?

4. **Host.docker.internal çalışmıyorsa (Windows/Mac):**
   - Docker Desktop'ın çalıştığından emin olun
   - Alternatif: `network_mode: "host"` kullanın (sadece Linux)

5. **Linux'ta localhost bağlantısı için:**
   - `docker-compose.yml`'de `network_mode: "host"` açın
   - `.env`'de `MYSQLHOST=localhost` kullanın

### Puppeteer/Chrome Hatası

1. **Puppeteer cache'ini kontrol edin:**
   ```bash
   docker-compose exec app ls -la /home/appuser/.cache/puppeteer
   ```

2. **Container'ı yeniden build edin:**
   ```bash
   docker-compose down
   docker-compose build --no-cache app
   docker-compose up -d
   ```

## 📊 Performans ve Kaynak Kullanımı

### Kaynak Kullanımını İzleme

```bash
# Container'ın kaynak kullanımını görüntüle
docker stats

# Bot container'ını izle
docker stats deysis_bot
```

### Memory Limitleri (İsteğe Bağlı)

`docker-compose.yml` dosyasına memory limitleri ekleyebilirsiniz:

```yaml
services:
  app:
    mem_limit: 2g
    mem_reservation: 1g
```

## 🔒 Güvenlik

### Güvenli Şifre Kullanımı

- `.env` dosyasını asla Git'e commit etmeyin
- Güçlü MySQL şifreleri kullanın
- Telegram bot token'ınızı paylaşmayın

### Production Ortamı için Öneriler

1. **HTTPS kullanın** (eğer web arayüzü eklerseniz)
2. **Firewall kuralları** ayarlayın
3. **Düzenli yedekleme** yapın
4. **Log monitoring** kurun
5. **Resource limits** ayarlayın

## 📝 Notlar

- **MySQL Docker içinde çalışmaz**, local veya sunucudaki MySQL'e bağlanır
- Veritabanı verileri MySQL'in bulunduğu yerde saklanır (local veya sunucu)
- Container'ı silmeden önce yedek alın
- `.env` dosyasını production'da dikkatli yönetin
- Bot token'ınızı güvenli tutun
- **Windows/Mac:** `host.docker.internal` kullanın
- **Linux:** `network_mode: "host"` kullanabilirsiniz veya `host.docker.internal` ekleyin
- **Sunucu MySQL:** Firewall ve network ayarlarını kontrol edin

## 🆘 Yardım

Sorun yaşıyorsanız:

1. Logları kontrol edin: `docker-compose logs -f`
2. Container durumunu kontrol edin: `docker-compose ps`
3. GitHub Issues'da sorun açın
4. README.md dosyasını kontrol edin

---

**İyi çalışmalar! 🚀**

