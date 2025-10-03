/**
 * Bot mesaj şablonları
 */

class MessageTemplates {
    /**
     * Hoş geldin mesajı (kayıtlı kullanıcı)
     */
    static welcomeRegistered(user) {
        const MarkdownHelper = require('./markdownHelper');
        return `
🎓 *Deysis Yoklama Otomasyonu Botuna Hoş Geldiniz\\!*

👤 *Profil Bilgileriniz:*
• Ad Soyad: ${user.first_name} ${user.last_name}
• Kullanıcı Adı: @${user.username}
• Okul Maili: ${user.school_email}
• Kayıt Tarihi: ${MarkdownHelper.formatDate(user.created_at)}

✅ Zaten kayıtlısınız\\! Bot komutlarını kullanmak için /help komutunu çalıştırabilirsiniz\\.
        `;
    }

    /**
     * Hoş geldin mesajı (yeni kullanıcı)
     */
    static welcomeNew(firstName) {
        return `
🎓 *Deysis Yoklama Otomasyonu Botuna Hoş Geldiniz\\!*

Merhaba ${firstName}\\! 👋

Bu bot, Deysis yoklama platformuna katılımınızı otomatize etmenize yardımcı olur\\.

📋 *Kullanılabilir Komutlar:*
• /register \\- Yeni kullanıcı kaydı
• /help \\- Yardım menüsü

Başlamak için /register komutunu kullanarak kayıt olabilirsiniz\\.
        `;
    }

    /**
     * Kayıt formu mesajı
     */
    static registerForm() {
        return `
📝 *Kullanıcı Kayıt Formu*

Lütfen okul e\\-posta adresinizi giriniz:
\\(Örnek: ogrenci@ogr\\.deu\\.edu\\.tr\\)

⚠️ *Önemli:* 
• Geçerli bir DEÜ okul maili girmeniz gerekmektedir
• Şifre olarak Deysis sistemindeki mevcut şifrenizi kullanın
        `;
    }

    /**
     * Şifre girişi mesajı
     */
    static passwordInput(email) {
        return `
✅ E\\-posta adresi kabul edildi: ${email}

🔐 Şimdi şifrenizi giriniz:

⚠️ *Şifre Bilgisi:*
• Deysis sistemindeki mevcut şifrenizi girin
• En az 3 karakter olmalı
• Şifre boş olamaz
        `;
    }

    /**
     * Başarılı kayıt mesajı
     */
    static registrationSuccess(userData) {
        return `
🎉 *Kayıt Başarılı\\!*

✅ Hesabınız başarıyla oluşturuldu\\.

👤 *Bilgileriniz:*
• Ad Soyad: ${userData.first_name} ${userData.last_name}
• Kullanıcı Adı: @${userData.username}
• Okul Maili: ${userData.school_email}

📋 *Kullanılabilir Komutlar:*
• /profile \\- Profil bilgilerini görüntüle
• /changepassword \\- Şifre değiştir
• /help \\- Yardım menüsü

Artık Deysis yoklama otomasyonu özelliklerini kullanabilirsiniz\\!
        `;
    }

    /**
     * Profil bilgileri mesajı
     */
    static profileInfo(user) {
        const MarkdownHelper = require('./markdownHelper');
        return `
👤 *Profil Bilgileriniz*

• *Ad Soyad:* ${user.first_name} ${user.last_name}
• *Kullanıcı Adı:* @${user.username}
• *Okul Maili:* ${user.school_email}
• *Durum:* ${user.is_active ? '✅ Aktif' : '❌ Pasif'}
• *Admin:* ${user.is_admin ? '✅ Evet' : '❌ Hayır'}
• *Kayıt Tarihi:* ${MarkdownHelper.formatDate(user.created_at)}
• *Son Güncelleme:* ${MarkdownHelper.formatDate(user.updated_at)}

📋 *Kullanılabilir İşlemler:*
• /changepassword \\- Şifre değiştir
        `;
    }

    /**
     * Şifre değiştirme mesajı
     */
    static changePassword() {
        return `
🔐 *Şifre Değiştirme*

Lütfen yeni şifrenizi giriniz:

⚠️ *Şifre Bilgisi:*
• Deysis sistemindeki mevcut şifrenizi girin
• En az 3 karakter olmalı
• Şifre boş olamaz
        `;
    }

    /**
     * Yardım mesajı
     */
    static help() {
        return `
🆘 *Yardım Menüsü*

📋 *Kullanılabilir Komutlar:*

• /start \\- Botu başlat ve hoş geldin mesajını gör
• /register \\- Yeni kullanıcı kaydı yap
• /profile \\- Profil bilgilerini görüntüle
• /changepassword \\- Şifre değiştir
• /attend \\- Yoklamaya katıl
• /help \\- Bu yardım menüsünü göster

🎓 *Deysis Otomasyonu Hakkında:*
Bu bot, DEÜ öğrencilerinin yoklama platformuna katılımını otomatize etmek için tasarlanmıştır\\.

🔑 *Şifre Bilgisi:*
Kayıt sırasında Deysis sistemindeki mevcut şifrenizi kullanın\\.

📞 *Destek:*
Herhangi bir sorun yaşarsanız, lütfen yönetici ile iletişime geçin\\.

🔒 *Gizlilik:*
Kişisel bilgileriniz güvenli bir şekilde saklanmaktadır\\.
        `;
    }

    /**
     * Hata mesajları (Markdown olmadan)
     */
    static errors = {
        alreadyRegistered: '❌ Zaten kayıtlısınız! Profil bilgilerinizi görmek için /profile komutunu kullanabilirsiniz.',
        notRegistered: '❌ Henüz kayıtlı değilsiniz. Kayıt olmak için /register komutunu kullanın.',
        invalidEmail: '❌ Geçersiz e-posta formatı. Lütfen geçerli bir e-posta adresi giriniz.',
        invalidDeuEmail: '❌ Lütfen geçerli bir DEÜ okul maili giriniz. (Örnek: ogrenci@ogr.deu.edu.tr)',
        emailAlreadyExists: '❌ Bu e-posta adresi zaten kullanılıyor. Başka bir e-posta adresi deneyin.',
        passwordTooShort: '❌ Şifre en az 3 karakter olmalıdır.',
        passwordEmpty: '❌ Şifre boş olamaz.',
        registrationError: '❌ Kayıt sırasında hata oluştu: ',
        passwordUpdateError: '❌ Şifre güncelleme hatası: ',
        passwordUpdated: '✅ Şifreniz başarıyla güncellendi!'
    };
}

module.exports = MessageTemplates;
