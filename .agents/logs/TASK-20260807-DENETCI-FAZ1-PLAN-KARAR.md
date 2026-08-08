# Denetçi Karar Raporu: Faz 1 - Router & Servis Entegrasyonları (Paket 00, 04, 07B, 10A, 12) Geliştirme Plani

ROL: Denetçi
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, SOZLUK.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md
BAĞIMSIZLIK NOTU: Bağımsız denetçi oturumu üzerinden sıfırdan inceleme yapılmıştır.
ÇAĞRILAN UZMAN SKİLLER: mimari-bekcisi
KURAL ÇELİŞKİSİ: Yok

---

## KARAR: REDDEDİLDİ

---

## Kontrol Listesi Sonuçları

### 1. Kurallara ve Planlama .md Dosyalarına Tam Uyum: **BAŞARISIZ**
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Madde 3.1 & 3.2 uyarınca her kodlama paketi bağımsız girdi/çıktı, şema ve kabul testlerine sahip olmalı ve tekil olarak kabul edilmelidir. İşçi Ajan Paket 00, 04, 07B, 10A ve 12 paketlerini tek bir torbada ("Faz 1") birleştirmiştir.
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Satır 156 uyarınca Paket 10A API rotası `/invoice-controls` (ve `/invoice-controls/summary`, `/invoice-controls/exceptions`) iken İşçi Ajan planda `/api/v2/ledger/delivered-invoice` rotasını koyarak kural belgesindeki API sözleşmesini ihlal etmiştir.

### 2. Kod Doğruluğu / Tip ve İmza Eşleşmesi: **BAŞARISIZ**
- `panel/src/lib/apiClient.ts` istemcisinde `API_BASE_URL = 'http://localhost:3001/api/v2'` tanımlıdır ve `fetchApi` verilen path'in başına bunu otomatik ekler.
- İşçi Ajan planının Kapsam bölümünde `/api/v2/dispatch/today` ve `/api/v2/ledger/delivered-invoice` çağrılacağını yazmıştır. `fetchApi('/api/v2/dispatch/today')` çağrıldığında URL `http://localhost:3001/api/v2/api/v2/dispatch/today` haline gelecek ve **404 Not Found** hatası üretecektir.

### 3. Halüsinasyon ve Kalıp Dışına Çıkma: **BAŞARISIZ**
- Plan belgesi kendi içinde çelişmektedir: Kapsam Madde 2'de `/api/v2/dispatch/today` ve `/api/v2/ledger/delivered-invoice` derken, Yaklaşım Madde 3'te `/dispatch/today` ve `/ledger/delivered-invoice` yazmaktadır.
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` standart rotası `/invoice-controls` yerine uydurma `/ledger/delivered-invoice` rotasının kullanılması halüsinasyonik kalıp dışına çıkmadır.

### 4. Örtük Varsayımlar (VARSAYIM Beyanları): **BAŞARISIZ**
- Planda `apiSyncService.ts` dosyasına eklenecek olan Sevkiyat (07B), Fatura Kontrol (10A) ve Finansal Read Model (12) verilerinin `customerState` içinde nasıl saklanacağı ve tipleştirileceği planlanmamış, `customerState` yapısının buna hazır olduğu örtük varsayılmıştır.
- Paketlerin toplu yapılmasının bağımsız paket kabul kriterlerini bozmayacağı örtük varsayılmıştır.

### 5. Yan Kapı ve Kestirme Yollar: **BAŞARISIZ**
- Bağımsız modül paketlerini (00, 04, 07B, 10A, 12) tek bir "Faz 1" torbasında birleştirmek paket bazlı kabul kapılarını atlatmaya yönelik kestirme yoldur.
- `apiSyncService.ts` içindeki veri haritalama mantığı açıklanmayarak belirsiz bırakılmıştır.

---

## Değiştirilmesi Gereken Noktalar ve Düzeltme Rehberi

1. **Paket Sınırlarını Ayırma**: Geliştirme planını tek bir torba "Faz 1" yerine her paket için (veya Paket 07B ve Paket 10A ayrı ayrı) tekil paket formatında sununuz.
2. **Endpoint / URL Düzeltmesi**:
   - `fetchApi` kullanımında endpoint başına `/api/v2` EKLEMEDEN planlayınız (`/dispatch/today` veya `/invoice-controls`).
   - Kapsam ile Yaklaşım bölümlerindeki URL ifadelerini tutarlı hale getiriniz.
3. **Paket 10A API Sözleşmesi**: Rota ismini `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Satır 156'ya uygun şekilde `/invoice-controls` olarak revize ediniz.
4. **apiSyncService Dönüşüm Detayı**: `apiSyncService.ts` içinde gelen verinin `customerState`'e nasıl map edileceğini açıkça listeleyiniz.
