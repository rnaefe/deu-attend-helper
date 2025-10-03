/**
 * Telegram MarkdownV2 için güvenli mesaj formatı yardımcıları
 */

class MarkdownHelper {
    /**
     * MarkdownV2 için güvenli escape fonksiyonu
     * @param {string} text - Escape edilecek metin
     * @returns {string} - Escape edilmiş metin
     */
    static escape(text) {
        if (!text) return '';
        
        return text.toString()
            .replace(/\\/g, '\\\\')    // \ -> \\
            .replace(/\*/g, '\\*')     // * -> \*
            .replace(/_/g, '\\_')      // _ -> \_
            .replace(/\[/g, '\\[')     // [ -> \[
            .replace(/\]/g, '\\]')     // ] -> \]
            .replace(/\(/g, '\\(')     // ( -> \(
            .replace(/\)/g, '\\)')     // ) -> \)
            .replace(/~/g, '\\~')      // ~ -> \~
            .replace(/`/g, '\\`')      // ` -> \`
            .replace(/>/g, '\\>')      // > -> \>
            .replace(/#/g, '\\#')      // # -> \#
            .replace(/\+/g, '\\+')     // + -> \+
            .replace(/-/g, '\\-')      // - -> \-
            .replace(/=/g, '\\=')      // = -> \=
            .replace(/\|/g, '\\|')     // | -> \|
            .replace(/\{/g, '\\{')     // { -> \{
            .replace(/\}/g, '\\}')     // } -> \}
            .replace(/\./g, '\\.')     // . -> \.
            .replace(/!/g, '\\!')      // ! -> \!
            .replace(/\?/g, '\\?')     // ? -> \?
            .replace(/\$/g, '\\$')     // $ -> \$
            .replace(/\^/g, '\\^')     // ^ -> \^
            .replace(/\&/g, '\\&');    // & -> \&
    }

    /**
     * Kullanıcı bilgilerini güvenli şekilde formatla
     * @param {Object} user - Kullanıcı objesi
     * @returns {Object} - Escape edilmiş kullanıcı bilgileri
     */
    static formatUserInfo(user) {
        return {
            first_name: this.escape(user.first_name || ''),
            last_name: this.escape(user.last_name || ''),
            username: this.escape(user.username || 'Belirtilmemiş'),
            school_email: this.escape(user.school_email || ''),
            created_at: user.created_at,
            updated_at: user.updated_at
        };
    }

    /**
     * E-posta adresini güvenli şekilde formatla
     * @param {string} email - E-posta adresi
     * @returns {string} - Escape edilmiş e-posta
     */
    static formatEmail(email) {
        return this.escape(email);
    }

    /**
     * Tarihi güvenli şekilde formatla
     * @param {string|Date} date - Tarih
     * @returns {string} - Escape edilmiş tarih
     */
    static formatDate(date) {
        const dateStr = new Date(date).toLocaleDateString('tr-TR');
        return this.escape(dateStr);
    }

    /**
     * Mesaj gönderme için güvenli seçenekler
     * @returns {Object} - Telegram mesaj seçenekleri
     */
    static getMessageOptions() {
        return {
            parse_mode: 'MarkdownV2'
        };
    }

    /**
     * Basit metin mesajı için seçenekler (Markdown olmadan)
     * @returns {Object} - Basit mesaj seçenekleri
     */
    static getSimpleMessageOptions() {
        return {};
    }
}

module.exports = MarkdownHelper;
