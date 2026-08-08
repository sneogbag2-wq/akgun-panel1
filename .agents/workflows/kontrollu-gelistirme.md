# /kontrollu-gelistirme
Hedef konum: `.agents/workflows/kontrollu-gelistirme.md` (proje bazlı) ya da `~/.gemini/antigravity/global_workflows/kontrollu-gelistirme.md` (tüm projelerde). Bu, agent chat'te `/kontrollu-gelistirme` yazınca tetiklenen kayıtlı bir komuttur; İşçi Ajan → Denetçi → Yargıç zincirini elle sırayla çağırmak zorunda kalmadan tek seferde başlatır.

Aşağıdaki görevi, İşçi Ajan → Denetçi → Yargıç kontrol hattının tamamından geçirerek yürüt. Hiçbir aşamayı atlama, birleştirme ya da "basit görünüyor" diyerek kısaltma.

Görev: {{görev açıklaması buraya}}
Görev Kimliği: {{örn. paket-1, ozellik-x — .agents/logs/ altındaki kayıt dosyasının adını belirler}}

Adımlar:
1. `isci-ajan` skill'ini kullanarak plan çıkar. Planı tam metin olarak göster.
2. `denetci` skill'ini kullanarak planı denetle. Plan yeni bir modül/klasör/sorumluluk sınırı öneriyorsa, Denetçi bu adımda `mimari-bekcisi` skill'ini de çağırır (bkz. `denetci` skill'inin başındaki Kontrol Haritası) — dar kapsamlı planlarda gerekmez. Kararı (ONAYLANDI/REDDEDİLDİ) ve gerekçesini tam olarak göster. REDDEDİLDİ ise 1. adıma dön, onay gelmeden ilerleme.
3. Onay sonrası `isci-ajan` skill'iyle kodu yaz, kanıt topla.
4. `denetci` skill'iyle kodu denetle. Teslimat migration/finansal hesap/parser/yetkilendirme/AI tool alanlarından birine dokunuyorsa, Denetçi ilgili uzman skill'i (bkz. `denetci` skill'inin başındaki Kontrol Haritası) ek kanıt kaynağı olarak çağırır. REDDEDİLDİ ise 3. adıma dön.
5. `yargic` skill'iyle görevin bütününü bağımsızca doğrula ve nihai durum raporunu kullanıcıya sun.

Her adımın çıktısını (plan, karar, kod kanıtı, rapor) atlamadan, kullanıcının görebileceği şekilde göster. Bu workflow'un kendisi 3 zorunlu rolü listeler; hangi uzman skill'in ne zaman ek olarak devreye gireceğinin tam listesi `denetci` skill'indedir — burada tekrar edilmez, yalnızca varlığı hatırlatılır.

**Not:** Görev `kontrol-hatti-rule-02.md` Madde 12'deki dört koşulu karşılıyorsa İşçi Ajan planında hafif zincir talep edebilir (2. ve 4. adım Denetçi'nin tek onayında birleşir) — ama bu varsayılan değildir, Denetçi'nin açık onayı gerekir. Yüksek riskli görevlerde (şema, güvenlik, ödeme/finansal mantık) Madde 11 gereği mümkünse Denetçi/Yargıç adımlarını `invoke_subagent(self)` ile bağlamsal olarak izole çalıştır; bu mümkün değilse kullanıcıya belirt.

## Çok Paketli / Fazlı Planlar İçin Kullanım
Elinde paket 1, paket 2, paket 3 gibi önceden bölünmüş bir kodlama planı varsa:

1. **Plan dosyasını proje klasörüne koy** (`plan.md`, `roadmap.md` vb.). `kontrol-hatti-rule-01.md` Madde 0 bunu otomatik tarar; içeriğini ayrıca yapıştırman gerekmez.
2. **Her paket ayrı bir "Görev"dir.** Tüm planı tek seferde tek görev olarak verme — her paket bu şablonla ayrı ayrı, sırayla çalıştırılır. Görev Kimliği alanına paket adını yaz (`paket-1` gibi); bu, `.agents/logs/` altındaki kayıt dosyasının adını belirler ve paketleri birbirine karıştırmaz.
3. **Sıra zorunludur.** Paket N'in Yargıç'tan "TAMAMLANDI" raporu almadan Paket N+1 başlatılmaz — Madde 1 ve 2 paket ölçeğinde de geçerlidir.
4. **Süreklilik**: her paketin İşçi Ajan planı, "Kurallara dayanak" bölümünde hem ana plan dosyasına hem de tamamlanmış önceki paketlerin log kayıtlarına (`.agents/logs/paket-<N-1>.md`) atıfta bulunur — paketler birbirinden kopuk değerlendirilmez.
5. **Tüm paketler bittikten sonra (opsiyonel, önerilir)**: `yargic` skill'ini `kontrol-hatti-rule-01.md` Madde 6 kapsamında zincir dışı, standalone çağır — "tüm planın bütünsel olarak [plan.md]'ye uyup uymadığını, paketler arası entegrasyonu karara bağla." Bu, paket bazlı kontrollerin gözden kaçırabileceği çapraz-paket tutarsızlıkları yakalamak içindir; mevcut paket statülerini değiştirmez, yalnızca ek rapor üretir.

### Örnek başlatma
```
/kontrollu-gelistirme
Görev: Paket 1 — plan.md'de tanımlı [paket 1 özeti]
Görev Kimliği: paket-1
```
