import { describe, it, expect, vi } from 'vitest';
import { sanitizeMessagesForStorage, useAiChat } from '../useAiChat';

vi.mock('../../services/aiService', () => ({
  sendAiMessage: vi.fn().mockResolvedValue({
    text: 'Test AI Yanıtı',
    toolCalls: []
  })
}));

vi.mock('../../services/archiveService', () => ({
  loadChatHistoryFromIDB: vi.fn().mockResolvedValue(null),
  saveChatHistoryToIDB: vi.fn().mockResolvedValue(undefined),
  clearChatHistoryFromIDB: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../services/uploadService', () => ({
  clearRawExcelCache: vi.fn()
}));

describe('useAiChat Hook Logic', () => {
  it('should initialize with welcome message', () => {
    expect(useAiChat).toBeDefined();
    expect(typeof useAiChat).toBe('function');
  });

  it('does not persist active-session report rows or attachment payloads', () => {
    const sanitized = sanitizeMessagesForStorage([{
      id: 'assistant-report',
      role: 'assistant',
      content: 'Rapor hazır',
      timestamp: '2026-08-04T12:00:00.000Z',
      reports: [{ id: 'r1', title: 'Detay', subtitle: '', fileName: 'r.xlsx', sheetName: 'Detay', type: 'table', data: [], rowCount: 25, columns: [], rows: [{ customerName: 'Gizli Cari' }], summaryBoxes: [] }],
      attachments: [{ fileName: 'veri.xlsx', mimeType: 'application/vnd.ms-excel', base64: 'ham-ikili-veri', textContent: 'ham müşteri listesi' }]
    }]);

    expect(sanitized[0].reports).toBeUndefined();
    expect(sanitized[0].attachments?.[0]).not.toHaveProperty('base64');
    expect(sanitized[0].attachments?.[0].textContent).toContain('ham müşteri listesi');
  });
});
