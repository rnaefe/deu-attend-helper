# Chrome DevTools ile GPS’i DEÜ Kampüslerine Sabitleme

Bu doküman, kampüs‑özel bir web/app deneyimini hızlıca test etmek için **Chrome DevTools** üzerinden **geolokasyonu (GPS)** Tınaztepe, İnciraltı Sağlık ve Alsancak Rektörlük konumlarına **elle sabitleme** adımlarını anlatır.

---

## TL;DR (2 dakikada kur)

1. Sayfayı aç → `F12` → **DevTools**.
2. Sağ üst üç nokta → **More tools** → **Sensors**.
3. Sensors paneli → **Location** açılırından **Custom location…** → aşağıdaki enlemi/boylamı gir → **Set**.
4. Üst bardan **Toggle device toolbar (Ctrl+Shift+M)** ile mobil emülasyonu aç → dilediğin cihazı seç.
5. Sekmeyi **yenile** ve sitede GPS istemine **Allow** ver.


---

## Adım Adım: DevTools üzerinden GPS sabitleme

### 1) Sensors panelini aç

- `F12` (veya `Ctrl+Shift+I`) → DevTools sağ üst **⋮** → **More tools** → **Sensors**.
- Alt tarafta **Sensors** paneli görünecek.

### 2) Konum emülasyonunu seç

- **Sensors → Location** açılır menüsünde **Custom location…** seç.
- Aşağıya **Latitude / Longitude** değerlerini gir. **Accuracy (m)** alanına 20–100 yazabilirsin (coarse/fine test için).
- **Set** → Sayfayı **refresh** et.

### 3) Site izinlerini ver

- Tarayıcı adres çubuğu solundaki kilide tıkla → **Site settings** → **Location: Allow**.
- Alternatif: Sayfa geolokasyon istediğinde çıkan prompt’a **Allow**.

### 4) Mobil cihaz emülasyonu (opsiyonel ama önerilir)

- DevTools üst bar → **Toggle device toolbar** (telefon/tablet ikon, `Ctrl+Shift+M`).
- Bir cihaz profili seç (iPhone 15/Pixel vs). Bu, **UA/DPR/viewport** ayarlarını değiştirir.

### 5) Doğrulama (Console testleri)

Aşağıdaki snippet’leri **Console**’a tek tek yapıştırarak doğrulayın.

**5.1 – Hızlı konum oku**

```js
navigator.geolocation.getCurrentPosition(
  pos => console.log('OK:', {
    lat: pos.coords.latitude.toFixed(6),
    lon: pos.coords.longitude.toFixed(6),
    accuracy_m: Math.round(pos.coords.accuracy)
  }),
  err => console.error('ERR:', err),
  { enableHighAccuracy: false, timeout: 5000, maximumAge: 0 }
);
```

**5.2 – İzin durumunu kontrol et**

```js
if (navigator.permissions) {
  navigator.permissions.query({ name: 'geolocation' }).then(s => console.log('Permission:', s.state));
} else {
  console.log('Permission API yok, sayfa prompt ile izin istiyor olabilir.');
}
```


## Kampüs Hızlı Preset’leri (DEÜ)

> Aşağıdaki noktalar kampüs testleri için pratik preset’lerdir. Sensors→**Custom location…** bölümüne girip **Set** edin.

- **Tınaztepe Kampüsü (Buca)**

  - Latitude: **38.3716**
  - Longitude: **27.1970**
  - Accuracy: 50

- **İnciraltı Sağlık Yerleşkesi / DEÜ Hastanesi (Balçova-İnciraltı)**

  - Latitude: **38.3937**
  - Longitude: **27.0342**
  - Accuracy: 50

- **Rektörlük / Cumhuriyet Blv. 144 (Alsancak-Konak)**

  - Latitude: **38.4308**
  - Longitude: **27.1374**
  - Accuracy: 50

---

## Sık Karşılaşılan Sorunlar

- **Konum değişmedi**: Sayfayı **hard refresh** (`Ctrl+F5`) yapın. Service Worker varsa SW’yi unreg edin.
- **Multi‑tab**: Sensors ayarı **sekme bazlıdır**; her yeni sekmede tekrar set edin.

---

## Güvenlik ve Etik

- Bu yöntem **yalnızca geliştirme/QA** amaçlıdır. Üretimde kullanıcı konumu **açık izin** ile ve **amaçla sınırlı** işlenmelidir.
- Kullanıcı verisini KVKK/GDPR kapsamında **minimize** edin; test verilerini gerçek kullanıcılarla karıştırmayın.

---

## Sürüm Geçmişi

- v1.0 (2025‑10‑03): İlk yayın — DevTools örnekleri, DEÜ preset’leri.

