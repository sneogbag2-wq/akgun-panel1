import re

with open('panel/src/services/customerService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix (x) to (x: any)
content = re.sub(r'\(x\)', '(x: any)', content)

# Fix calculateCEI
content = re.sub(r'calculateCEI\(([^,]+),\s*([^,]+),\s*[^)]+\)', r'calculateCEI(\1, \2)', content)

with open('panel/src/services/customerService.ts', 'w', encoding='utf-8') as f:
    f.write(content)

with open('panel/src/services/aiService.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('${res?.skippedDuplicate || skippedDuplicate}', '${skippedDuplicate}')
content = content.replace('${res?.added || added}', '${added}')

with open('panel/src/services/aiService.ts', 'w', encoding='utf-8') as f:
    f.write(content)

with open('panel/src/services/apiSyncService.ts', 'r', encoding='utf-8') as f:
    content = f.read()
content = content.replace('customerState.usingSeedData = false;', '')
content = content.replace('customerState.usingSeedData = true;', '')
with open('panel/src/services/apiSyncService.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
