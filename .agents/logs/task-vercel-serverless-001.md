# Auditor Decision Log: task-vercel-serverless-001

ROLE: Auditor
RULE FILES SCANNED: control-pipeline-rule-01.md, control-pipeline-rule-02.md
INDEPENDENCE NOTE: Operating as subagent invocation (clean context isolation per Article 11).
SPECIALIST SKILLS INVOKED: None
RULE CONFLICT: None

## Context & Audit Scope
Worker Agent Vercel Serverless Function entegrasyonu kapsamında aşağıdaki dosyaları doğrudan güncelleyip pushlamıştır:
1. `api/index.js`
2. `package.json`
3. `vercel.json`
4. `panel/src/services/aiFinancialReportRegistry.ts`

Ancak bu işlem yapılmadan önce kontrol boru hattı (Plan Gate ve Code Gate) çalıştırılmamış, Auditor'dan onay alınmamıştır.

## Checklist Results

1. **Were the rules applied? (Kurallar Uygulandı mı?)**
   - **İHLAL**: Kural 1 (Kapsam ve Sıra), Kural 2 (Onay Kapısı) ve Kural 5 (Şeffaflık) ihlal edilmiştir. İşçi Ajan (Worker Agent), herhangi bir Plan Gate sunmadan ve Auditor onayı almadan kod/konfigürasyon değişikliklerini uygulamıştır.
   - **İHLAL**: Kural 16 (Ampirik Çalışma Zamanı Doğrulama Kuralı) uyarınca, Vercel Serverless Function canlı veya yerel test çıktısı, build doğrulaması veya ampirik çalışma zamanı kanıtı sunulmamıştır.

2. **Is the code correct? (Kod Doğru mu?)**
   - **HATA 1 (`api/index.js`)**: `createApp()` parametresiz çağrılmaktadır. Vercel Serverless Function ortamında Supabase bağlantıları ve `APP_SECRET` gibi kritik runtime değişkenlerinin yüklenip yüklenmediğine dair ampirik doğrulama veya hata yakalama mekanizması eksiktir.
   - **HATA 2 (`vercel.json`)**: `panel/package.json` yapısında `@vercel/static-build` çıktısı `distDir: "dist"` olarak belirlenmişken, `vercel.json` line 25-27'de `"dest": "/panel/$1"` olarak yönlendirilmiştir. Vercel static build çıktısı `panel/dist` olduğu için `/(.*)` istekleri `/panel/$1` yerine dağıtım dizini ile uyuşmayacak ve 404 hatasına yol açacaktır.
   - **HATA 3 (`panel/src/services/aiFinancialReportRegistry.ts`)**: Line 48'de `API_BASE_URL` üretim ortamı için `/api/v2` varsayılmıştır. Ancak `reportsRouter` gelişmiş rapor servislerinde (`/advanced/reconciliation` vb.) Supabase istemcisi (`req.repository`) beklemektedir. Yetkilendirme header'ları ve repository entegrasyonu Vercel serverless ortamı için test edilmemiştir.

3. **Is there AI-invented content / pattern deviation? (Yapay Zeka Uydurması / Desen Sapması Var mı?)**
   - Projenin mevcut backend mimarisi `backend/server.js` üzerinden yürütülürken, Vercel Serverless yapısı monorepo bağımlılıkları ve modül katmanları göz önüne alınmadan Plan Gate mimari kontrolü (`mimari-bekcisi`) yapılmaksızın kök dizine `api/index.js` eklenerek desen sapmasına yol açılmıştır.

4. **Was an assumption made? (Varsayım Yapıldı mı?)**
   - `ASSUMPTION:` etiketi olmadan yapılan örtük varsayımlar:
     - Express uygulamasının Serverless Vercel Function ortamında adaptörsüz sorunsuz çalışacağı varsayıldı.
     - `vercel.json` statik yönlendirmesinin `panel/dist` build çıktısı ile uyumlu olduğu varsayıldı.
     - `/api/v2` backend rotalarının Vercel deployment ortamında yetkilendirme hatası almayacağı varsayıldı.

5. **Was a loophole taken? (Açık/Kestirme Yol Alındı mı?)**
   - Kontrol boru hattı (Plan Gate / Code Gate) tamamen atlanmış, hiçbir birim/entegrasyon testi veya Vercel build doğrulaması yapılmadan değişiklikler tamamlanmış sayılmıştır (Chain Bypass / Fake Completion).

---

## DECISION: REJECTED

### Değiştirilmesi / Düzeltilmesi Gereken Noktalar:
1. Worker Agent, Kural 1 ve 2 gereğince yapılan tüm Vercel Serverless Function entegrasyonu ve rota değişiklikleri için öncelikle resmi bir **Plan Gate** sunmalıdır.
2. `vercel.json` içerisindeki static build ve serverless routing kuralları (`dest: "/panel/$1"` çelişkisi) düzeltilmelidir.
3. `api/index.js` serverless entrypoint'inin runtime bağımlılıkları ve Supabase yetkilendirme akışı planlanmalıdır.
4. Kural 16 uyarınca, build ve API entegrasyon testlerine dair ampirik çalışma zamanı kanıtları (command output) Plan sonrası Code Gate aşamasında sunulmalıdır.
