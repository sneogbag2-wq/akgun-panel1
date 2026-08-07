import { render, screen, act } from '@testing-library/react';
import React, { useEffect } from 'react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';

// --- MOCK ZUSTAND STORE & COMPONENT ---
let storeState = { data: 'Sayfa1 Verisi' };
const getStore = () => storeState;
const resetStore = () => { storeState = { data: null }; };

const ModularComponent = ({ useStore }) => {
  const state = useStore();
  
  useEffect(() => {
    // Component unmount olduğunda (Sayfa geçişi vs) cleanup yapılır
    return () => resetStore();
  }, []);

  return <div data-testid="page-data">{state.data}</div>;
};

// Alt bileşen prop drilling test için
const ChildComponent = ({ data }) => {
  if(data === undefined) throw new Error('Prop drilling hatası! Veri eksik.');
  return <span data-testid="child-data">{data}</span>;
};
const ParentComponent = ({ useStore }) => {
  const state = useStore();
  return <ChildComponent data={state.data} />;
};

describe('Dosya 6: Modülerizasyon Testleri', () => {
  it('1. Bileşen İzolasyonu: Sayfa değiştirildiğinde eski sayfanın state i temizlenmeli (Sızıntı Yok)', () => {
    const { unmount } = render(<ModularComponent useStore={getStore} />);
    expect(screen.getByTestId('page-data')).toHaveTextContent('Sayfa1 Verisi');
    
    unmount(); // Router sayfa değişimi simülasyonu
    
    // Cleanup sonrası state sıfırlanmış olmalı
    expect(getStore().data).toBeNull();
  });

  it('2. Prop Drilling Engeli: Alt bileşenler merkezi state ten (Store) veriyi eksiksiz alır', () => {
    storeState = { data: 'Merkezi Veri' };
    render(<ParentComponent useStore={getStore} />);
    
    expect(screen.getByTestId('child-data')).toHaveTextContent('Merkezi Veri');
  });
});
