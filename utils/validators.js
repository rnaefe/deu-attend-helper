/**
 * Validasyon fonksiyonları
 */

class Validators {
    /**
     * E-posta validasyonu
     * @param {string} email - E-posta adresi
     * @returns {Object} - Validasyon sonucu
     */
    static validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!email || typeof email !== 'string') {
            return { isValid: false, message: 'E-posta adresi gerekli.' };
        }

        const trimmedEmail = email.trim();
        
        if (!emailRegex.test(trimmedEmail)) {
            return { isValid: false, message: 'Geçersiz e-posta formatı.' };
        }

        // DEÜ mail kontrolü
        if (!trimmedEmail.endsWith('@ogr.deu.edu.tr') && !trimmedEmail.endsWith('@deu.edu.tr')) {
            return { isValid: false, message: 'Lütfen geçerli bir DEÜ okul maili giriniz.' };
        }

        return { isValid: true, email: trimmedEmail };
    }

    /**
     * Şifre validasyonu (Deysis sistemi için basitleştirilmiş)
     * @param {string} password - Şifre
     * @returns {Object} - Validasyon sonucu
     */
    static validatePassword(password) {
        if (!password || typeof password !== 'string') {
            return { isValid: false, message: 'Şifre gerekli.' };
        }

        const trimmedPassword = password.trim();
        
        if (trimmedPassword.length === 0) {
            return { isValid: false, message: 'Şifre boş olamaz.' };
        }

        if (trimmedPassword.length < 3) {
            return { isValid: false, message: 'Şifre en az 3 karakter olmalıdır.' };
        }

        return { isValid: true, password: trimmedPassword };
    }

    /**
     * Telegram kullanıcı bilgileri validasyonu
     * @param {Object} userInfo - Telegram kullanıcı bilgileri
     * @returns {Object} - Validasyon sonucu
     */
    static validateTelegramUser(userInfo) {
        if (!userInfo || !userInfo.id) {
            return { isValid: false, message: 'Geçersiz kullanıcı bilgileri.' };
        }

        if (!userInfo.first_name) {
            return { isValid: false, message: 'Ad bilgisi gerekli.' };
        }

        return { isValid: true };
    }
}

module.exports = Validators;
