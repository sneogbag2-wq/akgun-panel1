# Paket 01 — Yerel Supabase yükleme omurgası runbook'u

Bu runbook yalnız Docker üzerinde çalışan yerel Supabase içindir. Gerçek müşteri dosyası, uzak proje ref'i, uzak URL, erişim anahtarı veya signed URL hiçbir komuta yapıştırılmaz ve Git'e eklenmez.

## Ön koşullar

PowerShell'de proje kökünden aşağıdaki kontrolleri yapın:

```powershell
$ErrorActionPreference = 'Stop'
Get-Command docker, supabase, node, npm.cmd | Select-Object Name, Source
docker info | Out-Null
supabase --version
node --version
```

Yerel hedef korumasını aynı pencereye ekleyin. Bu koruma başarısız olursa reset veya seed çalıştırmayın.

```powershell
function Assert-Package01LocalTarget {
  param([string]$SupabaseUrl = 'http://127.0.0.1:54321')

  if ($SupabaseUrl -notmatch '^http://(127\.0\.0\.1|localhost):54321$') {
    throw 'Paket 01 yalnız local Supabase URL kabul eder.'
  }
  if ($env:SUPABASE_PROJECT_REF -and $env:SUPABASE_PROJECT_REF -notmatch '^(local|package01-local-only)$') {
    throw 'Uzak Supabase project ref görüldü; reset/seed fail-closed durduruldu.'
  }
  if ($env:SUPABASE_DB_URL -and $env:SUPABASE_DB_URL -notmatch '^(postgres(ql)?://[^@/]+@)?(127\.0\.0\.1|localhost):') {
    throw 'Uzak veritabanı URL görüldü; reset/seed fail-closed durduruldu.'
  }
  $config = Get-Content -Raw -LiteralPath '.\supabase\config.toml'
  if ($config -notmatch 'project_id\s*=\s*"package01-local-only"') {
    throw 'Yerel config project_id koruması geçmedi.'
  }
}

Assert-Package01LocalTarget
```

## Temiz migration ve anonim kabul testi

```powershell
Assert-Package01LocalTarget
supabase start
supabase db reset --local
supabase test db --local supabase/tests/package01_ingestion_foundation_test.sql
```

SQL testi transaction içinde yalnız sentetik `package01-anonymous@example.test`, `ANON_DEALER_0001`, `0000123` ve yapay hash'ler oluşturur; sonunda `ROLLBACK` yapar. Gerçek Excel veya gerçek kullanıcı seed'i yoktur.

Testin tekrarlanabilirlik kontrolü için aynı üç komutu ikinci kez çalıştırın. Test hem kısa hash/byte doğrulamasını hem immutable raw/event zincirini, idempotency çakışmasını, duplicate batch'i, blocking issue rollback'ini, aktif snapshot tekilliğini ve RLS temelini kapsar.

## Yerel environment

`backend/.env.example` dosyasını `backend/.env` olarak kopyalayın. Değerleri yalnız `supabase status -o env` çıktısından yerel olarak alın; bu çıktıyı terminal kaydına veya Git'e yapıştırmayın.

```powershell
Copy-Item .\backend\.env.example .\backend\.env -ErrorAction Stop
supabase status -o env
```

`APP_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` ve `SUPABASE_SERVICE_ROLE_KEY` backend için zorunludur. `APP_SECRET` için kod içi fallback yoktur. Panelde yalnız geliştirme amaçlı Supabase anon anahtarı kullanılabilir; service-role veya Gemini anahtarı panele yazılmaz.

Paket 00 foundation flag'i kapalı kalmalıdır:

```powershell
$env:VITE_DOMAIN_V2_FOUNDATION = 'false'
```

## Backend ve panel smoke testi

İki ayrı PowerShell penceresinde:

```powershell
# Pencere 1
Set-Location .\backend
npm.cmd install --ignore-scripts
npm.cmd test
npm.cmd start
```

```powershell
# Pencere 2 — panel mevcut geliştirme komutunu kullanır
Set-Location .\panel
npm.cmd test
npm.cmd run build
npm.cmd run lint
npm.cmd run dev
```

Üçüncü bir yerel pencerede health ve auth ayrımını kontrol edin:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/health
try {
  Invoke-WebRequest -Method Post -Uri http://127.0.0.1:3001/api/v2/imports/initiate -ContentType 'application/json' -Body '{}' -ErrorAction Stop
  throw 'Bearer olmayan import isteği beklenmedik biçimde kabul edildi.'
} catch {
  if ($_.Exception.Response.StatusCode.value__ -ne 401) { throw }
}
```

Gerçek import smoke yalnız yerel bir test kullanıcısının Supabase Auth bearer token'ı, ilgili `import.*` capability kayıtları ve sentetik dosya ile yapılır. Signed URL sadece response içinde kullanılır; log, ekran görüntüsü veya Git çıktısına eklenmez. Paket 01 gerçek Excel parser'ı içermediği için `HASH_VERIFIED` bir gerçek dosyada `/validate` çağrısı `PARSER_NOT_AVAILABLE` ile fail-closed döner. Bu beklenen durumdur; ilgili parser sonraki kaynak paketinin sorumluluğundadır.

## RLS ve storage smoke kontrolü

- Anon istek herhangi bir import tablosunu veya `/api/v2` route'unu okuyamaz.
- `import.view` kullanıcısı publish yapamaz; `import.audit` olmadan raw payload ve source-file provenance dönmez.
- `source-imports` bucket private'tır. Özgün dosya adı storage path değildir; signed URL tek object path ve kısa TTL ile sınırlıdır.
- Server hash/byte, istemcinin beyanıyla eşleşmezse batch `FAILED` olur ve publish yoluna giremez.

## Güvenli durdurma ve yerel reset

Sadece aynı local-target guard geçtikten sonra:

```powershell
Assert-Package01LocalTarget
supabase stop
supabase db reset --local
```

Backend veya paneli başlattığınız terminalde `Ctrl+C` kullanın. Geniş `taskkill`, uzak `supabase db reset` veya production project link komutu kullanmayın.
