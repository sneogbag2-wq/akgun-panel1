const fs = require('fs');
const content = fs.readFileSync('src/services/customerService.ts', 'utf8');

function extractFunction(name) {
    const startIndex = content.indexOf(`export function ${name}`);
    if (startIndex === -1) return;
    
    let braceCount = 0;
    let endIndex = startIndex;
    let foundFirstBrace = false;
    
    for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{') {
            braceCount++;
            foundFirstBrace = true;
        } else if (content[i] === '}') {
            braceCount--;
        }
        
        if (foundFirstBrace && braceCount === 0) {
            endIndex = i + 1;
            break;
        }
    }
    
    console.log(`--- ${name} ---`);
    console.log(content.substring(startIndex, endIndex));
}

extractFunction("getAllCustomersForReportingSync");
extractFunction("getGlobalFinancialSummarySync");
extractFunction("getMonthlySalesRepPerformanceSync");
