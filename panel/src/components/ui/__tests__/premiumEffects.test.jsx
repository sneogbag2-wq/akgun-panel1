import { render, screen } from '@testing-library/react';
import React, { useEffect, Component } from 'react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';

// --- MOCK COMPONENTS (UI EFFECTS) ---
const SpotlightEffect = () => {
  useEffect(() => {
    const handleMouseMove = () => {};
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      // Memory Leak engeli: Component ölünce event silinmeli
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return <div data-testid="spotlight">Glow Effect Active</div>;
};

// Error Boundary Simülasyonu
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return <div data-testid="fallback-ui">Görsel Yüklenemedi (Fallback UI)</div>;
    }
    return this.props.children;
  }
}

const BuggyUIComponent = ({ dataProp }) => {
  if (dataProp === undefined) {
    throw new Error('Data is undefined! White screen of death attack!');
  }
  return <div>{dataProp}</div>;
};


describe('Dosya 7: Premium UX/UI Geliştirmeleri Testleri', () => {
  it('1. Event Listener Cleanup: Spotlight efekti unmount olduğunda mouse event leri temizlenir (Memory Leak engeli)', () => {
    const addEventSpy = vi.spyOn(window, 'addEventListener');
    const removeEventSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<SpotlightEffect />);
    
    expect(addEventSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    
    unmount(); // DOM'dan sil
    
    expect(removeEventSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    
    addEventSpy.mockRestore();
    removeEventSpy.mockRestore();
  });

  it('2. Hatalı State Renderme (Error Boundary): Prop undefined gelirse sayfa çökmez, Fallback UI gösterilir', () => {
    // Console error'u testi kirletmesin diye gizleyelim
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <BuggyUIComponent dataProp={undefined} />
      </ErrorBoundary>
    );

    // Beyaz ekran yerine Fallback UI gelmeli
    expect(screen.getByTestId('fallback-ui')).toHaveTextContent('Görsel Yüklenemedi (Fallback UI)');
    
    consoleSpy.mockRestore();
  });
});
