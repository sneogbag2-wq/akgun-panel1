const fs = require('fs');
const path = require('path');

const content = fs.readFileSync('raw_agents.txt', 'utf8');
const targetDir = "C:\\Users\\monds\\.gemini\\config";

function writeSkill(name, text) {
    const formattedName = name.toLowerCase().replace(/_/g, '-');
    const skillDir = path.join(targetDir, 'skills', formattedName);
    fs.mkdirSync(skillDir, { recursive: true });
    
    const skillContent = `---
name: ${formattedName}
description: ${name} Ajanı veya Uzmanı
---

${text}`;
    
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillContent, 'utf-8');
    console.log(`Yazıldı (Skill): ${formattedName}`);
}

function writeRule(name, text) {
    const ruleDir = path.join(targetDir, 'rules');
    fs.mkdirSync(ruleDir, { recursive: true });
    fs.writeFileSync(path.join(ruleDir, `${name}.md`), text, 'utf-8');
    console.log(`Yazıldı (Rule): ${name}`);
}

const pattern = /## `\.agents\/(.*?)\/(.*?)\.md`\s*```markdown\n([\s\S]*?)```\n/g;
let match;
let count = 0;

while ((match = pattern.exec(content)) !== null) {
    const folder = match[1];
    const name = match[2];
    const text = match[3];
    
    if (folder === 'skills') {
        writeSkill(name, text);
    } else {
        writeRule(name, text);
    }
    count++;
}

const coreSystem = content.split('---')[0].trim();
writeRule('HAFIF_OTONOM_SISTEM', coreSystem);

console.log(`\nToplam ${count + 1} dosya global .gemini/config yapısına entegre edildi.`);
