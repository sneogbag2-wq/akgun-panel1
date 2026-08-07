import type { AiToolArgs } from './aiReadToolRegistry';
import type { DynamicSubagent, DynamicSubagentInput, DefineSubagentArgs, InvokeSubagentArgs } from '../types/ai';

const DYNAMIC_SUBAGENTS_STORAGE_KEY = 'akgun_dynamic_subagents';

export function getPersistedSubagents(): Record<string, DynamicSubagent> {
  try {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem(DYNAMIC_SUBAGENTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export function savePersistedSubagent(agent: DynamicSubagent) {
  try {
    if (typeof window === 'undefined') return;
    const current = getPersistedSubagents();
    current[agent.name] = agent;
    localStorage.setItem(DYNAMIC_SUBAGENTS_STORAGE_KEY, JSON.stringify(current));
  } catch (e) {}
}

export const dynamicSubagentsRegistry: Record<string, DynamicSubagent> = {
  researchSubagent: {
    name: 'researchSubagent',
    role: 'Research Subagent (Kod & Veri Araştırma Ajanı)',
    description: 'Veritabanında, 3.600+ cari kaydında, ekstrelerde, arşivlerde ve Excel verilerinde milisaniyelik derinlemesine tarama yapar.',
    systemPrompt: 'Sen Research Subagent (Kod & Veri Araştırma Ajanı) rolündesin. Görevin veritabanında, ekstrelerde ve dosyalarda en detaylı bilgiyi arayıp bulmaktır.'
  },
  taskExecutionSubagent: {
    name: 'taskExecutionSubagent',
    role: 'Task Execution Subagent (İşlem & Operasyon İcra Ajanı)',
    description: 'Fatura, tahsilat, virman, silme ve veri değiştirme operasyonlarını Admin şifre güvenliğiyle icra eder.',
    systemPrompt: 'Sen Task Execution Subagent (İşlem & Operasyon İcra Ajanı) rolündesin. Görevin veritabanı mütasyonlarını ve operasyonları güvenle yönetmektir.'
  },
  visualDesignerSubagent: {
    name: 'visualDesignerSubagent',
    role: 'Visual Designer & Image Generator Subagent (Görsel & UI Tasarım Ajanı)',
    description: 'Grafikler (renderChart), harita konumları (googleMapsLinkMarkdown) ve görsel Markdown tabloları tasarlar.',
    systemPrompt: 'Sen Visual Designer Subagent rolündesin. Görevin yanıtları en şık grafiklerle, harita linkleriyle ve harika tablolarla görselleştirmektir.'
  },
  schedulerSubagent: {
    name: 'schedulerSubagent',
    role: 'Scheduler & Background Cron Subagent (Zamanlayıcı ve Arka Plan Ajanı)',
    description: 'Vadesi yaklaşan çek/senet takibi, periyodik borç/tahsilat kontrolleri ve zamanlı hatırlatmaları yönetir.',
    systemPrompt: 'Sen Scheduler & Background Cron Subagent rolündesin. Görevin vade tarihlerini ve periyodik finansal takipleri yönetmektir.'
  },
  dynamicFactorySubagent: {
    name: 'dynamicFactorySubagent',
    role: 'Dynamic Subagent Factory (Dinamik Alt-Ajan Üretici)',
    description: 'Runtime\'da sıfırdan yeni uzman ajanlar tanımlar (defineSubagent) ve çalıştırır (invokeSubagent).',
    systemPrompt: 'Sen Dynamic Subagent Factory rolündesin. Görevin sıradışı isteklerde sıfırdan yeni alt-ajanlar tanımlayıp göreve başlatmaktır.'
  },
  interactiveAlignmentSubagent: {
    name: 'interactiveAlignmentSubagent',
    role: 'Interactive Modal & Aligning Subagent (Kullanıcı Mülakat & Karar Ajanı)',
    description: 'Değişiklikler öncesi iki aşamalı önizleme sunar, kullanıcı onayını alır; ⚠️ Stratejik Risk Uyarısı ve 💡 Aksiyon Önerileri ekler.',
    systemPrompt: 'Sen Interactive Alignment Subagent rolündesin. Görevin mütasyon öncesi kullanıcı onayı almak, risk uyarısı ve aksiyon tavsiyesi vermektir.'
  },
  ...getPersistedSubagents()
};

const builtInSubagentNames = new Set(Object.keys(dynamicSubagentsRegistry));

export function listDynamicSubagents(): DynamicSubagent[] {
  return Object.values({ ...dynamicSubagentsRegistry, ...getPersistedSubagents() })
    .map((agent) => ({ ...agent, isBuiltIn: builtInSubagentNames.has(agent.name) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

export function upsertDynamicSubagent(input: DynamicSubagentInput): DynamicSubagent {
  const name = input.name.trim();
  const role = input.role.trim();
  if (!name || !role) throw new Error('Alt-ajan ismi ve rolü zorunludur.');
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{2,63}$/.test(name)) throw new Error('Alt-ajan ismi 3-64 karakter olmalı ve yalnızca harf, sayı, _ veya - içermelidir.');

  const existing = dynamicSubagentsRegistry[name] || getPersistedSubagents()[name];
  const agent: DynamicSubagent = {
    name,
    role,
    description: input.description.trim() || role,
    systemPrompt: input.systemPrompt.trim() || role,
    createdTime: existing?.createdTime || new Date().toISOString(),
    updatedTime: new Date().toISOString()
  };
  dynamicSubagentsRegistry[name] = agent;
  savePersistedSubagent(agent);
  return agent;
}

export function deleteDynamicSubagent(name: string): boolean {
  if (builtInSubagentNames.has(name)) return false;
  if (!dynamicSubagentsRegistry[name] && !getPersistedSubagents()[name]) return false;
  delete dynamicSubagentsRegistry[name];
  try {
    if (typeof window === 'undefined') return true;
    const persisted = getPersistedSubagents();
    delete persisted[name];
    localStorage.setItem(DYNAMIC_SUBAGENTS_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    return false;
  }
  return true;
}

type AgentToolHandler = (args: any) => Promise<any> | any;
const agentToolHandlers = new Map<string, AgentToolHandler>();

agentToolHandlers.set('defineSubagent', (args: DefineSubagentArgs) => {
  const { name, role, description, systemPrompt } = args || {};
  if (!name || !role) {
    return { status: 'ERROR', message: 'Alt-ajan ismi ve rolü belirtilmelidir.' };
  }
  const newAgentObj = {
    name,
    role,
    description: description || role,
    systemPrompt: systemPrompt || role,
    createdTime: new Date().toISOString()
  };
  dynamicSubagentsRegistry[name] = newAgentObj;
  savePersistedSubagent(newAgentObj);
  return {
    status: 'SUCCESS',
    subagentName: name,
    role,
    message: `🤖 "${role}" (${name}) alt-ajan tipi başarıyla dinamik olarak oluşturuldu ve kalıcı sisteme kaydedildi.`
  };
});

agentToolHandlers.set('invokeSubagent', (args: InvokeSubagentArgs) => {
  const { subagentName, taskPrompt } = args || {};
  const persisted = getPersistedSubagents();
  const nameStr = subagentName as string;
  const agent = dynamicSubagentsRegistry[nameStr] || persisted[nameStr];
  if (!agent) {
    return {
      status: 'ERROR',
      message: `"${subagentName}" adında tanımlı bir alt-ajan bulunamadı. Lütfen önce defineSubagent aracı ile alt-ajanı tanımlayın.`
    };
  }
  return {
    status: 'SUCCESS',
    isSubagentInvocation: true,
    subagentName,
    role: agent.role,
    systemPrompt: agent.systemPrompt,
    taskPrompt,
    summary: `🚀 [Alt-Ajan: ${agent.role}] Görev icra ediliyor: "${taskPrompt || agent.description}"`
  };
});

export function getAgentToolHandler(toolName: string): AgentToolHandler | undefined {
  return agentToolHandlers.get(toolName);
}
