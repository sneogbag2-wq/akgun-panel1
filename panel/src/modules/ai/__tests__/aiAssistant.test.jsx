import { render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import React, { useState } from 'react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';

// --- MOCK COMPONENT (AI ASSISTANT) ---
const AIAssistant = ({ apiMock }) => {
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  const sendMessage = async (prompt) => {
    try {
      if (!prompt || prompt.length > 5000) {
        setError('400 Bad Request');
        return;
      }
      const stream = await apiMock.sendPrompt(prompt);
      
      let currentMsg = '';
      setMessages(prev => [...prev, { role: 'ai', text: '' }]);
      
      for await (const chunk of stream) {
        currentMsg += chunk;
        setMessages(prev => {
          const newArr = [...prev];
          newArr[newArr.length - 1].text = currentMsg;
          return newArr;
        });
      }
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        setError('Oturum süreniz doldu'); // Hata maskeleme (Stack trace gizlenir)
      } else {
        setError('Bilinmeyen bir hata oluştu');
      }
    }
  };

  return (
    <div>
      <div data-testid="error-banner">{error}</div>
      <div data-testid="chat-window">
        {messages.map((m, i) => <div key={i} data-testid="message">{m.text}</div>)}
      </div>
      <button onClick={() => sendMessage('Hello')}>Send Hello</button>
      <button onClick={() => sendMessage(null)}>Send Toxic</button>
    </div>
  );
};

describe('Dosya 4: AI Asistan Geliştirmeleri Testleri', () => {
  it('1. RLS/401 Reddi: Yetkisiz çağrılarda (401/403) Stack Trace sızdırılmaz, UI maskelenir', async () => {
    const apiMock = {
      sendPrompt: vi.fn().mockRejectedValue({ status: 401, message: 'Unauthorized DB Access' })
    };
    render(<AIAssistant apiMock={apiMock} />);
    
    await act(async () => {
      fireEvent.click(screen.getByText('Send Hello'));
    });
    
    // Hata mesajı stack trace değil, maskelenmiş kullanıcı dostu metin olmalı
    expect(screen.getByTestId('error-banner')).toHaveTextContent('Oturum süreniz doldu');
  });

  it('2. Streaming Başarısı: Parça parça (chunk) gelen veriler UI ı kırmadan render edilir', async () => {
    const mockStream = {
      async *[Symbol.asyncIterator]() {
        yield 'Merhaba';
        yield ' Dünya';
      }
    };
    const apiMock = {
      sendPrompt: vi.fn().mockResolvedValue(mockStream)
    };
    
    render(<AIAssistant apiMock={apiMock} />);
    
    await act(async () => {
      fireEvent.click(screen.getByText('Send Hello'));
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('message')).toHaveTextContent('Merhaba Dünya');
    });
  });

  it('3. Zehirli Prompt: Null veya anlamsız prompt atıldığında çökmez, 400 Bad Request alır', async () => {
    const apiMock = {
      sendPrompt: vi.fn()
    };
    render(<AIAssistant apiMock={apiMock} />);
    
    await act(async () => {
      fireEvent.click(screen.getByText('Send Toxic'));
    });
    
    expect(screen.getByTestId('error-banner')).toHaveTextContent('400 Bad Request');
    expect(apiMock.sendPrompt).not.toHaveBeenCalled(); // API'ye bile gitmemeli
  });
});
