import re
file_path = 'KODLAMA_ASAMALI_UYGULAMA_PLANI.md'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

def replace_status(match):
    header = match.group(1)
    
    pkg_match = re.search(r'Paket\s*([0-9A-Z]+)', header)
    if not pkg_match:
        return match.group(0)
    
    pkg = pkg_match.group(1)
    
    if pkg in ['00', '01', '01A', '02', '03', '03A', '04', '04A', '04B']:
        return match.group(0)
    
    status_text = 'DB_AND_BACKEND_IMPLEMENTED_UI_PENDING'
    detail = ''
    
    if pkg in ['05', '06', '06A', '07', '07A', '07B', '08', '08A', '08B', '09', '10', '10A', '11']:
        status_text = 'BACKEND_IMPLEMENTED_UI_PENDING'
        detail = ' (Migration tamamlandı, backend servis/testleri yazıldı. Router bağlantıları eksik, Panel ile entegrasyon yapılmadı.)'
    elif pkg in ['12', '12A', '12B', '12C', '12D', '12E', '12F', '13', '14']:
        status_text = 'DB_SCHEMA_IMPLEMENTED_BACKEND_PENDING'
        detail = ' (Veritabanı tabloları ve RLS politikaları migration olarak eklendi. Backend servis/router tam entegre değil, Panel entegrasyonu yok.)'
    elif pkg == '15':
        status_text = 'BLOCKED'
        detail = ' (Kontrollü geçiş henüz başlamadı, frontend entegrasyonu bekleniyor.)'
    
    new_status_line = f"**Durum:** {status_text}{detail}"
    return header + '\n\n' + new_status_line

pattern = r'(#+ [^\n]*?Paket [0-9A-Z]+[^\n]*?)\s+\*\*Durum:\*\*.*'
new_content, count = re.subn(pattern, replace_status, content)
print(f"Replaced {count} occurrences")
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)
