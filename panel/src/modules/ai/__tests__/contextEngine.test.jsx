import { render, screen, act } from '@testing-library/react';
import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { ContextEngine } from '../contextEngine.js';

// --- MOCK AI ASSISTANT BİLEŞENİ ---
const MemoryAIAssistant = ({ apiClient }) => {
  const [response, setResponse] = useState('');
  const [isFallback, setIsFallback] = useState(false);
  const contextEngine = new ContextEngine(apiClient);

  const askAI = async () => {
    const memory = await contextEngine.searchContext('test query');
    if (memory.isFallback) {
      setIsFallback(true);
      setResponse('Hafızasız Standart Mod Cevabı');
    } else {
      setIsFallback(false);
      setResponse('Hafızalı Cevap: ' + memory.context);
    }
  };

  return (
    <div>
      <div data-testid="fallback-status">{isFallback ? 'Standart Mod' : 'Vektörel Mod'}</div>
      <div data-testid="ai-response">{response}</div>
      <button onClick={askAI}>Sor</button>
    </div>
  );
};

describe('Paket 09: Frontend Graceful Degradation Testi', () => {
  it('4. Fail-Safe (Graceful Degradation): Vektör DB çöktüğünde UI çökmez, Asistan Standart Mod a (Hafızasız) geçer', async () => {
    // API'nin tamamen koptuğunu (Network Error) simüle et
    const mockApiClient = {
      get: vi.fn().mockRejectedValue(new Error('Network Error - Vektor DB Offline'))
    };

    render(<MemoryAIAssistant apiClient={mockApiClient} />);
    
    await act(async () => {
      screen.getByText('Sor').click();
    });
    
    // UI çökmedi, beyaz ekran olmadı, Asistan fallback moda geçip standart cevap verdi.
    expect(screen.getByTestId('fallback-status')).toHaveTextContent('Standart Mod');
    expect(screen.getByTestId('ai-response')).toHaveTextContent('Hafızasız Standart Mod Cevabı');
  });
});
