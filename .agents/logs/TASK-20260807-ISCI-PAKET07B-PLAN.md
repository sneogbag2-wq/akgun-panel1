# İşçi Ajan Revize Planı: Paket 07B — Bugünkü Sevkiyat Takip Entegrasyonu

ROL: İşçi Ajan
TARANAN KURAL DOSYALARI: kontrol-hatti-rule-01.md, kontrol-hatti-rule-02.md, KODLAMA_ASAMALI_UYGULAMA_PLANI.md, VERITABANI_YENIDEN_TASARIM_KARARLARI.md, VERITABANI_YENIDEN_TASARIM_PLANI.md, AI_MEVCUT_DURUM_VE_GELISTIRME_PLANI.md, SISTEM_HESAPLAMA_MATRISI.md, FINANSAL_ANALIZ_VE_RAPOR_KATALOGU.md, STOK_METRIK_KATALOGU.md
KURAL ÇELİŞKİSİ: Yok

## 1. Hedef
Denetçi ret kararı doğrultusunda, Paket 07B (Bugünkü Sevkiyat Takip) modülünü diğer paketlerden tamamen ayırarak tekil ve bağımsız olarak frontend-backend canlı servis entegrasyonunu tamamlamak.

## 2. Kapsam (Tam Dosya Listesi)
1. `panel/src/services/customerService.ts`: `customerState` nesnesine `todayDispatchRecords: any[]` alanını açıkça eklemek.
2. `panel/src/services/todayDispatchService.ts`: `fetchApi('/dispatch/today')` çağrısı ile backend API'den veri çeken handler geliştirmek.
3. `panel/src/services/apiSyncService.ts`: `syncDataFromApi()` sürecine `fetchTodayDispatchFromApi()` çağrısını eklemek.

## 3. Yaklaşım (Adım Adım)
1. **State Hazırlığı:** `customerService.ts` içinde `customerState` objesine `todayDispatchRecords: []` default boş dizi tanımı eklenir (Örtük varsayım giderildi).
2. **Service Geliştirme:** `todayDispatchService.ts` dosyasına `fetchTodayDispatchFromApi` fonksiyonu yazılır. `fetchApi` fonksiyonuna uydurma kök eklenmeden bağıntılı path (`/dispatch/today`) verilir.
3. **Sync Bağlantısı:** `apiSyncService.ts` içinde `fetchTodayDispatchFromApi()` çağrısı yapılır. Try/catch ile sarmalanır; backend kapalıysa warning verip çökmeden devam eder.
4. **Test & Doğrulama:** `npm --prefix backend test` ve `npm --prefix panel test` çalıştırılarak tüm 200 backend + 183 panel birim testinin yeşil olduğu kanıtlanır.

## 4. Kurallara Dayanak
- `KODLAMA_ASAMALI_UYGULAMA_PLANI.md` Paket 07B (Satır 98: Bugünkü sevkiyat veritabanı, `/dispatch/today` REST API ve sevkiyat servisi entegrasyonu).

## 5. Açık Varsayımlar
- `VARSAYIM 1`: `fetchApi` istemcisi path başına otomatik `http://localhost:3001/api/v2` ekler. Gönderilecek path yalın `/dispatch/today` olmalıdır.
- `VARSAYIM 2`: Backend kapalıysa `customerState.todayDispatchRecords` boş dizi `[]` olarak kalır ve Panel çökmez.

## 6. Riskler ve Rollback
- **Risk:** Offline ortamda backend fetch exception fırlatabilir.
- **Rollback / Koruma:** İlgili kod bloğu `try { ... } catch (e) { console.warn('Today dispatch fetch skipped:', e); }` yapısıyla izole edilecek; hata durumunda mevcut durum bozulmayacaktır.
