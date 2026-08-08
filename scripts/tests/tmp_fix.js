const fs = require('fs');

// Fix customerService.ts
let content = fs.readFileSync('panel/src/services/customerService.ts', 'utf-8');
content = content.replace(/\\(x\\)/g, '(x: any)');
content = content.replace(/calculateCEI\\(summary\\.totalCollections \\+ summary\\.totalCreditNotes, summary\\.totalSales, summary\\.netReceivables\\)/g, 'calculateCEI(summary.totalCollections + summary.totalCreditNotes, summary.totalSales)');
fs.writeFileSync('panel/src/services/customerService.ts', content);

// Fix aiService.ts
let aiContent = fs.readFileSync('panel/src/services/aiService.ts', 'utf-8');
aiContent = aiContent.replace('**${res?.skippedDuplicate || skippedDuplicate} Adet**', '**${skippedDuplicate} Adet**');
aiContent = aiContent.replace('**${res?.added || added} Adet**', '**${added} Adet**');
fs.writeFileSync('panel/src/services/aiService.ts', aiContent);

// Fix apiSyncService.ts
let apiContent = fs.readFileSync('panel/src/services/apiSyncService.ts', 'utf-8');
apiContent = apiContent.replace('customerState.usingSeedData', 'false');
fs.writeFileSync('panel/src/services/apiSyncService.ts', apiContent);
