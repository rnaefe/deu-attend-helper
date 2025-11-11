const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

const { 
    testConnection, 
    createUsersTable, 
    createUser, 
    findUserByTelegramId,
    findUserBySchoolEmail,
    updateUserPassword 
} = require('./database');

const MarkdownHelper = require('./utils/markdownHelper');
const MessageTemplates = require('./utils/messageTemplates');
const Validators = require('./utils/validators');
const DeysisAPI = require('./modules/apiYoklama');

class DeysisBot {
    constructor() {
        this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
        this.userStates = new Map(); // Kullanıcı durumlarını takip etmek için
        // Deysis API modülü - her kullanıcı için ayrı instance oluşturulacak
        this.setupCommands();
        this.setupHandlers();
    }

    setupCommands() {
        // Bot komutlarını ayarla
        this.bot.setMyCommands([
            { command: 'start', description: 'Botu başlat' },
            { command: 'register', description: 'Yeni kullanıcı kaydı' },
            { command: 'profile', description: 'Profil bilgilerini görüntüle' },
            { command: 'changepassword', description: 'Şifre değiştir' },
            { command: 'attend', description: 'Yoklamaya katıl' },
            { command: 'help', description: 'Yardım menüsü' }
        ]);
    }

    setupHandlers() {
        // /start komutu
        this.bot.onText(/\/start/, (msg) => {
            this.handleStart(msg);
        });

        // /register komutu
        this.bot.onText(/\/register/, (msg) => {
            this.handleRegister(msg);
        });

        // /profile komutu
        this.bot.onText(/\/profile/, (msg) => {
            this.handleProfile(msg);
        });

        // /changepassword komutu
        this.bot.onText(/\/changepassword/, (msg) => {
            this.handleChangePassword(msg);
        });

        // /help komutu
        this.bot.onText(/\/help/, (msg) => {
            this.handleHelp(msg);
        });

        // /attend komutu
        this.bot.onText(/\/attend/, (msg) => {
            this.handleAttend(msg);
        });

        // Mesaj işleyicisi (kayıt sürecindeki mesajlar için)
        this.bot.on('message', (msg) => {
            this.handleMessage(msg);
        });

        // Hata işleyicisi
        this.bot.on('polling_error', (error) => {
            console.error('Telegram Bot Polling Hatası:', error);
        });
    }

    async handleStart(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const firstName = msg.from.first_name;

        // Kullanıcı zaten kayıtlı mı kontrol et
        const existingUser = await findUserByTelegramId(userId);
        
        if (existingUser.success) {
            const user = existingUser.user;
            const formattedUser = MarkdownHelper.formatUserInfo(user);
            const message = MessageTemplates.welcomeRegistered(formattedUser);
            this.bot.sendMessage(chatId, message, MarkdownHelper.getMessageOptions());
        } else {
            const escapedFirstName = MarkdownHelper.escape(firstName);
            const message = MessageTemplates.welcomeNew(escapedFirstName);
            this.bot.sendMessage(chatId, message, MarkdownHelper.getMessageOptions());
        }
    }

    async handleRegister(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        // Kullanıcı zaten kayıtlı mı kontrol et
        const existingUser = await findUserByTelegramId(userId);
        
        if (existingUser.success) {
            this.bot.sendMessage(chatId, MessageTemplates.errors.alreadyRegistered);
            return;
        }

        // Kayıt sürecini başlat
        this.userStates.set(userId, { step: 'waiting_email', chatId: chatId });
        
        const message = MessageTemplates.registerForm();
        this.bot.sendMessage(chatId, message, MarkdownHelper.getMessageOptions());
    }

    async handleProfile(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        const userResult = await findUserByTelegramId(userId);
        
        if (!userResult.success) {
            this.bot.sendMessage(chatId, MessageTemplates.errors.notRegistered);
            return;
        }

        const user = userResult.user;
        const formattedUser = MarkdownHelper.formatUserInfo(user);
        formattedUser.is_active = user.is_active;
        formattedUser.is_admin = user.is_admin;
        formattedUser.created_at = user.created_at;
        formattedUser.updated_at = user.updated_at;

        const message = MessageTemplates.profileInfo(formattedUser);
        this.bot.sendMessage(chatId, message, MarkdownHelper.getMessageOptions());
    }

    async handleChangePassword(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        const userResult = await findUserByTelegramId(userId);
        
        if (!userResult.success) {
            this.bot.sendMessage(chatId, MessageTemplates.errors.notRegistered);
            return;
        }

        this.userStates.set(userId, { step: 'waiting_new_password', chatId: chatId });
        
        const message = MessageTemplates.changePassword();
        this.bot.sendMessage(chatId, message, MarkdownHelper.getMessageOptions());
    }

    handleHelp(msg) {
        const chatId = msg.chat.id;
        const message = MessageTemplates.help();
        this.bot.sendMessage(chatId, message, MarkdownHelper.getMessageOptions());
    }

    async handleMessage(msg) {
        const userId = msg.from.id;
        const chatId = msg.chat.id;
        const text = msg.text;

        // Komut mesajlarını atla
        if (text.startsWith('/')) {
            return;
        }

        const userState = this.userStates.get(userId);
        if (!userState) {
            return;
        }

        if (userState.step === 'waiting_email') {
            await this.handleEmailInput(msg, userState);
        } else if (userState.step === 'waiting_password') {
            await this.handlePasswordInput(msg, userState);
        } else if (userState.step === 'waiting_new_password') {
            await this.handleNewPasswordInput(msg, userState);
        } else if (userState.step === 'waiting_course_code') {
            await this.handleCourseCodeInput(msg, userState);
        }
    }

    async handleEmailInput(msg, userState) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const email = msg.text.trim();

        // E-posta validasyonu
        const emailValidation = Validators.validateEmail(email);
        if (!emailValidation.isValid) {
            this.bot.sendMessage(chatId, `❌ ${emailValidation.message}`);
            return;
        }

        // E-posta zaten kullanılıyor mu kontrol et
        const existingEmail = await findUserBySchoolEmail(emailValidation.email);
        if (existingEmail.success) {
            this.bot.sendMessage(chatId, MessageTemplates.errors.emailAlreadyExists);
            return;
        }

        // E-posta geçerli, şifre adımına geç
        userState.step = 'waiting_password';
        userState.email = emailValidation.email;
        this.userStates.set(userId, userState);

        const escapedEmail = MarkdownHelper.escape(emailValidation.email);
        const message = MessageTemplates.passwordInput(escapedEmail);
        this.bot.sendMessage(chatId, message, MarkdownHelper.getMessageOptions());
    }

    async handlePasswordInput(msg, userState) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const password = msg.text;

        // Şifre validasyonu
        const passwordValidation = Validators.validatePassword(password);
        if (!passwordValidation.isValid) {
            this.bot.sendMessage(chatId, `❌ ${passwordValidation.message}`);
            return;
        }

        // Kullanıcı bilgilerini al
        const userInfo = msg.from;
        const userData = {
            telegram_id: userId,
            username: userInfo.username || null, // undefined -> null
            first_name: userInfo.first_name || null, // undefined -> null
            last_name: userInfo.last_name || null, // undefined -> null (boş string yerine null)
            school_email: userState.email,
            password: passwordValidation.password
        };

        // Kullanıcıyı veritabanına kaydet
        const result = await createUser(userData);
        
        if (result.success) {
            // Başarılı kayıt
            this.userStates.delete(userId);
            
            const formattedUserData = MarkdownHelper.formatUserInfo(userData);
            const message = MessageTemplates.registrationSuccess(formattedUserData);
            this.bot.sendMessage(chatId, message, MarkdownHelper.getMessageOptions());
        } else {
            // Kayıt hatası
            this.bot.sendMessage(chatId, MessageTemplates.errors.registrationError + result.error);
            this.userStates.delete(userId);
        }
    }

    async handleNewPasswordInput(msg, userState) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const newPassword = msg.text;

        // Şifre validasyonu
        const passwordValidation = Validators.validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            this.bot.sendMessage(chatId, `❌ ${passwordValidation.message}`);
            return;
        }

        // Şifreyi güncelle
        const result = await updateUserPassword(userId, passwordValidation.password);
        
        if (result.success) {
            this.userStates.delete(userId);
            this.bot.sendMessage(chatId, MessageTemplates.errors.passwordUpdated);
        } else {
            this.bot.sendMessage(chatId, MessageTemplates.errors.passwordUpdateError + result.error);
            this.userStates.delete(userId);
        }
    }

    async handleAttend(msg) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        // Kullanıcı kayıtlı mı kontrol et
        const userResult = await findUserByTelegramId(userId);
        if (!userResult.success) {
            const message = `❌ Yoklamaya katılmak için önce kayıt olmanız gerekiyor\\.\n\n/register komutu ile kayıt olabilirsiniz\\.`;
            this.bot.sendMessage(chatId, message, MarkdownHelper.getMessageOptions());
            return;
        }

        const user = userResult.user;
        
        // Ders kodu iste
        const message = `📚 **Yoklamaya Katıl**\n\n` +
                       `Merhaba ${MarkdownHelper.escape(user.first_name)}\n\n` +
                       `Ders kodunuzu giriniz \\(6 haneli\\):\n\n` +
                       `Örnek: ` + "`123456`";

        this.userStates.set(userId, { step: 'waiting_course_code' });
        this.bot.sendMessage(chatId, message, MarkdownHelper.getMessageOptions());
    }

    async handleCourseCodeInput(msg, userState) {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const courseCode = msg.text.trim();

        // Ders kodu validasyonu
        if (!courseCode || courseCode.length !== 6 || !/^\d{6}$/.test(courseCode)) {
            this.bot.sendMessage(chatId, `❌ Ders kodu 6 haneli rakam olmalıdır\\.\n\nÖrnek: ` + "`123456`", MarkdownHelper.getMessageOptions());
            return;
        }

        // Kullanıcı bilgilerini al
        const userResult = await findUserByTelegramId(userId);
        if (!userResult.success) {
            this.userStates.delete(userId);
            this.bot.sendMessage(chatId, `❌ Kullanıcı bilgileri bulunamadı\\.`);
            return;
        }

        const user = userResult.user;
        
        // Loading mesajı gönder
        const loadingMessage = await this.bot.sendMessage(chatId, `🔄 Yoklamaya katılım başlatılıyor\\.\\.\\.\n\n` +
                                                               `📧 E\\-posta: ${MarkdownHelper.formatEmail(user.school_email)}\n` +
                                                               `🔢 Ders Kodu: ` + "`" + courseCode + "`", MarkdownHelper.getMessageOptions());

        try {
            // API instance oluştur
            const api = new DeysisAPI();
            
            // Konum bilgisi (Dokuz Eylül Tınaztepe Kampüsü)
            // Her yoklama katılımında konumu 1-2 metre arasında değiştir (rastgele offset)
            const baseLatitude = 38.36715;
            const baseLongitude = 27.203146;
            // 1-2 metre arasında rastgele offset (0.000009 derece ≈ 1 metre, 0.000018 derece ≈ 2 metre)
            // Her eksen için ±1-2 metre (rastgele yön)
            const latOffset = (Math.random() * 0.000009 + 0.000009).toFixed(8); // 0.000009 ile 0.000018 arası
            const lonOffset = (Math.random() * 0.000009 + 0.000009).toFixed(8); // 0.000009 ile 0.000018 arası
            // Rastgele yön için pozitif veya negatif yap
            const latSign = Math.random() > 0.5 ? 1 : -1;
            const lonSign = Math.random() > 0.5 ? 1 : -1;
            const latitude = (parseFloat(baseLatitude) + parseFloat(latOffset) * latSign).toFixed(8);
            const longitude = (parseFloat(baseLongitude) + parseFloat(lonOffset) * lonSign).toFixed(8);
            const konum = `${latitude},${longitude}`;
            
            const actualLatOffset = (parseFloat(latOffset) * latSign).toFixed(8);
            const actualLonOffset = (parseFloat(lonOffset) * lonSign).toFixed(8);
            console.log(`📍 Konum: ${konum} (offset: ${actualLatOffset}, ${actualLonOffset} - yaklaşık 1-2 metre)`);
            
            // 1. Login
            console.log(`🚀 API Login işlemi başlatılıyor: ${user.school_email}`);
            const loginResult = await api.login(user.school_email, user.password);
            
            if (!loginResult.success) {
                // Loading mesajını sil
                this.bot.deleteMessage(chatId, loadingMessage.message_id).catch(() => {});
                
                let errorMessage = `❌ **Giriş Hatası**\n\n` +
                                 `📧 E\\-posta: ${MarkdownHelper.formatEmail(user.school_email)}\n\n` +
                                 `🔍 Hata: ${MarkdownHelper.escape(loginResult.error || 'Giriş başarısız')}\n\n`;
                
                if (loginResult.status === 401) {
                    errorMessage += `💡 **Çözüm:** E\\-posta veya şifrenizi kontrol edin\\.\n` +
                                  `Şifrenizi değiştirmek için /changepassword komutunu kullanabilirsiniz\\.`;
                } else {
                    errorMessage += `💡 **Çözüm:** Lütfen daha sonra tekrar deneyin\\.`;
                }
                
                this.bot.sendMessage(chatId, errorMessage, MarkdownHelper.getMessageOptions());
                this.userStates.delete(userId);
                return;
            }
            
            // 2. Yoklama Katıl
            console.log(`🎓 Yoklama katıl işlemi başlatılıyor: ${courseCode}`);
            const yoklamaResult = await api.yoklamaKatil(courseCode, konum);
            
            // Loading mesajını sil
            this.bot.deleteMessage(chatId, loadingMessage.message_id).catch(() => {});

            if (yoklamaResult.success) {
                // Başarılı yoklama katılımı
                const successMessage = `✅ **Yoklamaya Başarıyla Katıldınız**\n\n` +
                                     `📧 E\\-posta: ${MarkdownHelper.formatEmail(user.school_email)}\n` +
                                     `🔢 Ders Kodu: ` + "`" + courseCode + "`" + `\n` +
                                     `⏰ Tarih: ${MarkdownHelper.formatDate(new Date().toLocaleDateString('tr-TR'))}\n\n` +
                                     `🎉 İşlem tamamlandı`;
                
                this.bot.sendMessage(chatId, successMessage, MarkdownHelper.getMessageOptions());
            } else {
                // Hata durumu
                let errorMessage = `❌ **Yoklama Katılımında Hata**\n\n` +
                                 `📧 E\\-posta: ${MarkdownHelper.formatEmail(user.school_email)}\n` +
                                 `🔢 Ders Kodu: ` + "`" + courseCode + "`" + `\n\n` +
                                 `🔍 Hata: ${MarkdownHelper.escape(yoklamaResult.error || 'Yoklama katılımı başarısız')}\n\n`;

                // Hata durumuna göre çözüm önerisi
                if (yoklamaResult.status === 400) {
                    if (yoklamaResult.error && yoklamaResult.error.toLowerCase().includes('bulunamadı')) {
                        errorMessage += `💡 **Çözüm:** Ders kodu bulunamadı\\. Lütfen doğru ders kodunu girdiğinizden emin olun\\.\n\n` +
                                      `⚠️ **Not:** Ders kodunun aktif bir yoklama olması gerekmektedir\\.`;
                    } else {
                        errorMessage += `💡 **Çözüm:** Geçersiz istek\\. Lütfen ders kodunu kontrol edip tekrar deneyin\\.`;
                    }
                } else if (yoklamaResult.status === 401) {
                    errorMessage += `💡 **Çözüm:** Oturum süresi dolmuş olabilir\\. Lütfen tekrar deneyin\\.`;
                } else if (yoklamaResult.status === 403) {
                    errorMessage += `💡 **Çözüm:** Bu işlem için yetkiniz bulunmamaktadır\\.`;
                } else if (yoklamaResult.status >= 500) {
                    errorMessage += `💡 **Çözüm:** Sunucu hatası\\. Lütfen daha sonra tekrar deneyin\\.`;
                } else {
                    errorMessage += `💡 **Çözüm:** Tekrar deneyin veya ders kodunu kontrol edin\\.`;
                }

                this.bot.sendMessage(chatId, errorMessage, MarkdownHelper.getMessageOptions());
            }

        } catch (error) {
            // Loading mesajını sil
            this.bot.deleteMessage(chatId, loadingMessage.message_id).catch(() => {});
            
            // Sistem hatası
            console.error('Yoklama katılım hatası:', error);
            const errorMessage = `❌ **Sistem Hatası**\n\n` +
                               `🔍 Hata: ${MarkdownHelper.escape(error.message)}\n\n` +
                               `💡 Lütfen daha sonra tekrar deneyin\\.`;
            
            this.bot.sendMessage(chatId, errorMessage, MarkdownHelper.getMessageOptions());
        }

        // State'i temizle
        this.userStates.delete(userId);
    }

    async start() {
        console.log('🤖 Deysis Bot başlatılıyor...');
        
        // Veritabanı bağlantısını test et
        const dbConnected = await testConnection();
        if (!dbConnected) {
            console.error('❌ Veritabanı bağlantısı kurulamadı. Bot başlatılamıyor.');
            return;
        }

        // Kullanıcılar tablosunu oluştur
        const tableCreated = await createUsersTable();
        if (!tableCreated) {
            console.error('❌ Kullanıcılar tablosu oluşturulamadı. Bot başlatılamıyor.');
            return;
        }

        // Deysis API modülü hazır (her işlemde yeni instance oluşturulacak)
        console.log('🌐 Deysis API modülü hazır');

        console.log('✅ Bot başarıyla başlatıldı ve hazır!');
        console.log('📱 Telegram\'da botunuzu test edebilirsiniz.');
    }

    async stop() {
        console.log('🛑 Bot durduruluyor...');
        this.bot.stopPolling();
        
        // API modülü için kapatma işlemi gerekmiyor (stateless)
        console.log('✅ Bot başarıyla durduruldu.');
    }
}

module.exports = DeysisBot;