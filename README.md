# Deysis Attendance Automation – **for educational purposes only**

This project is a Telegram bot developed to automate attendance on the Deysis platform for Dokuz Eylül University (DEU) students. The bot allows users to automatically log into Deysis and mark attendance using their credentials and class code.

---

## 🚀 Features

* ✅ User registration system via Telegram bot
* ✅ MySQL database integration
* ✅ School email verification (DEU domain check)
* ✅ Password storage (plain text for Deysis login)
* ✅ User profile management
* ✅ Password change functionality
* ✅ **Automatic login to Deysis and attendance submission**
* ✅ **Smart browser management (opens/closes only when required)**
* ✅ **Real-time process tracking and log messages**
* ✅ **Location spoofing (Tınaztepe Campus coordinates)**
* ✅ **Camera/microphone permission denial**
* ✅ **Class code validation and error detection**
* ✅ Web scraping and session management

---

## 📋 Requirements

* Node.js (v14 or later)
* MySQL (v5.7 or later)
* Telegram Bot Token (from BotFather)

---

## 🛠️ Setup

### 1. Clone the Project

```bash
git clone <repository-url>
cd deysis_bypass
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy the `env.example` file and rename it to `.env`:

```bash
cp env.example .env
```

Update `.env`:

```env
# Telegram Bot Token (from BotFather)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# MySQL Database Settings
MYSQLHOST=localhost
MYSQLPORT=3306
MYSQLUSER=root
MYSQL_ROOT_PASSWORD=your_password
MYSQL_DATABASE=deysis_users

# Bot Settings
BOT_ADMIN_ID=your_admin_telegram_id
```

### 4. Prepare MySQL Database

```sql
CREATE DATABASE deysis_users CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 5. Create Tables

```bash
npm run setup-db
```

### 6. Start the Bot

```bash
npm start
```

---

## 🤖 Telegram Bot Setup

### 1. Create Bot with BotFather

1. Talk to [@BotFather](https://t.me/botfather)
2. Send `/newbot`
3. Provide bot name and username
4. Copy the token and add it to `.env`

### 2. Set Bot Commands (Optional)

```
start - Start the bot
register - Register a new user
profile - View your profile
changepassword - Change password
attend - Join attendance
help - Show help menu
```

---

## 📱 Usage

### Main Commands

* `/start` – Start bot and see welcome message
* `/register` – Register a new user
* `/profile` – View your profile
* `/changepassword` – Change password
* `/attend` – **Automatically join attendance**
* `/help` – Help menu

---

## 🗄️ Database Structure

**Users Table:**

```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    school_email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,  -- plain text for Deysis login
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

⚠️ **Note:** Passwords are stored in plain text only because Deysis requires direct login.

---

## 🔧 Technical Details

* **Playwright** for headless browser automation (Chromium)
* **Location spoofing** → Tınaztepe Campus (38.3675561, 27.2016134)
* **Permission management** → Automatically denies camera/mic
* **Error handling** → Detects toast messages and invalid codes
* **Session management** → Uses cookies and handles session persistence
* **Auto-wait** → Playwright automatically waits for elements to be ready

---

## 📦 Technologies Used

* **Node.js** – Runtime
* **node-telegram-bot-api** – Telegram bot framework
* **mysql2** – MySQL driver
* **playwright** – Browser automation (modern, fast, reliable)
* **axios** – HTTP requests
* **cheerio** – HTML parsing
* **dotenv** – Environment management

---

## 🔒 Security & Performance

### Security

* Only DEU school emails allowed
* Plain text password storage (due to Deysis requirements)
* Connection pooling for DB connections
* Markdown-safe message formatting

### Performance

* Browser only launches during `/attend`
* Automatic cleanup after process ends
* Lightweight memory usage
* Fast bot startup
* Playwright's auto-wait reduces flakiness and improves reliability

---

## � Docker

Bu projeyi Docker ve Docker Compose kullanarak çalıştırabilirsiniz. Docker image, Puppeteer/Chromium için gerekli tüm bağımlılıkları içerir.

### Hızlı Başlangıç

1. **.env dosyasını oluşturun:**
   ```bash
   cp env.example .env
   ```

2. **.env dosyasını düzenleyin:**
   - `TELEGRAM_BOT_TOKEN`: BotFather'dan aldığınız token
   - `MYSQL_ROOT_PASSWORD`: Güçlü bir MySQL şifresi
   - `MYSQLHOST=db` (Docker Compose için)
   - Diğer ayarları ihtiyacınıza göre düzenleyin

3. **Docker Compose ile başlatın:**
   ```bash
   docker-compose up --build -d
   ```

4. **Logları izleyin:**
   ```bash
   docker-compose logs -f app
   ```

### Docker Compose Komutları

```bash
# Container'ları başlat (detached mode)
docker-compose up -d --build

# Logları görüntüle
docker-compose logs -f

# Container'ları durdur
docker-compose stop

# Container'ları durdur ve kaldır
docker-compose down

# Container'ları durdur, kaldır ve volume'ları sil (DİKKAT: Veriler silinir!)
docker-compose down -v

# Container'ları yeniden başlat
docker-compose restart
```

### Detaylı Docker Kılavuzu

Daha detaylı bilgi için [DOCKER.md](./DOCKER.md) dosyasına bakın.

### Notlar

- Bot, Telegram client olarak çalışır ve varsayılan olarak HTTP port açmaz
- MySQL servisi Docker Compose ile otomatik olarak başlatılır
- Veritabanı tabloları otomatik olarak oluşturulur (`init.sql`)
- `.env` dosyanızı build etmeden önce düzgün şekilde yapılandırdığınızdan emin olun
- Veritabanı verileri `mysql_data` volume'unda saklanır

---

## �📞 Support

1. Re-read this README
2. Verify database connection settings
3. Check your bot token
4. Ensure Node.js & MySQL versions are compatible

---

## 📄 License

This project is licensed under the **MIT License**.

⚠️ **Disclaimer:** This bot is created strictly **for educational purposes only**. Use responsibly and only with your own credentials.

---
