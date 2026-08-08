import re

with open('panel/src/services/aiService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the entire block of unused model/key logic
# From export function getApiKeys(): string[] {
# to unction withTimeout<T>(promise: Promise<T>, ms = 45000): Promise<T> { ... }

pattern = r"export function getApiKeys\(\): string\[\] \{.*?export async function sendAiMessage"
content = re.sub(pattern, "export async function sendAiMessage", content, flags=re.DOTALL)

# Remove the mentions of VITE_GEMINI_API_KEY in handleOfflineFallback
content = content.replace("*(İpucu: Canlı AI bağlantısı için .env dosyasına VITE_GEMINI_API_KEY ekleyebilirsiniz)*", "*(Yapay zeka bağlantısı arka planda sağlanmaktadır)*")
content = content.replace("*(İpucu: Canlı AI bağlantısı için \\.env\\ dosyasına \\VITE_GEMINI_API_KEY\\ ekleyebilirsiniz)*", "*(Yapay zeka bağlantısı arka planda sağlanmaktadır)*")
# Fallback replace for the turkish characters that might have been mangled in grep output
content = re.sub(r"\*\(.pucu: Canl. AI ba.lant.s. i.in \.env dosyas.na VITE_GEMINI_API_KEY ekleyebilirsiniz\)\*", "*(Yapay zeka bağlantısı arka planda sağlanmaktadır)*", content)

with open('panel/src/services/aiService.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Cleaned up aiService.ts")
