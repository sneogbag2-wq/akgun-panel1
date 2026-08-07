import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '../../utils/formatters';

const SENET_SABIT = {
  aliciUnvan: 'AKGÜN MEŞ.GIDA İNŞ.TUR.VE TİC.LTD.ŞTİ.',
  yetkiliMahkeme: 'BAKIRKÖY',
};

const TR_BIRLER = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'];
const TR_ONLAR = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan'];
const TR_BASAMAK = ['', 'Bin', 'Milyon', 'Milyar', 'Trilyon'];
const TR_AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

function ucBasamakYaziyla(n: number) {
  const yuz = Math.floor(n/100);
  const kalan = n%100;
  const on = Math.floor(kalan/10);
  const bir = kalan%10;
  let s = '';
  if (yuz > 0) s += (yuz === 1 ? '' : TR_BIRLER[yuz]) + 'Yüz';
  s += TR_ONLAR[on];
  s += TR_BIRLER[bir];
  return s;
}

function sayiyiYaziyaCevir(n: number) {
  n = Math.max(0, Math.round(n) || 0);
  if(n === 0) return 'Sıfır';
  const gruplar = [];
  let x = n;
  while (x > 0) { gruplar.push(x%1000); x = Math.floor(x/1000); }
  let sonuc = '';
  for (let i = gruplar.length - 1; i >= 0; i--) {
    const grup = gruplar[i];
    if (grup === 0) continue;
    let parca = ucBasamakYaziyla(grup);
    if (i === 1 && grup === 1) parca = ''; // "Bir Bin" değil sadece "Bin"
    sonuc += parca + TR_BASAMAK[i];
  }
  return sonuc;
}

function tarihUzunYazi(d: Date) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
  return String(d.getDate()).padStart(2,'0') + ' ' + TR_AYLAR[d.getMonth()] + ' ' + d.getFullYear();
}

function fmtDate(d: Date) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '—';
  return String(d.getDate()).padStart(2,'0') + '.' + String(d.getMonth()+1).padStart(2,'0') + '.' + d.getFullYear();
}

function tutarRakamSenet(n: number) {
  return '#' + (n||0).toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2}) + '#';
}

function escapeHtml(str: string) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function senetAdresTamMetin(adres: string, ilce: string, il: string) {
  const temizAdres = String(adres||'').trim();
  const temizIlce = String(ilce||'').trim();
  const temizIl = String(il||'').trim();
  const ilceIl = [temizIlce, temizIl].filter(Boolean).join('/');
  if(!ilceIl) return temizAdres || '—';
  const adresU = temizAdres.toLocaleUpperCase('tr-TR');
  const ilceU = temizIlce.toLocaleUpperCase('tr-TR');
  const ilU = temizIl.toLocaleUpperCase('tr-TR');
  const zatenIcerior = (temizIlce && adresU.includes(ilceU)) && (temizIl && adresU.includes(ilU));
  if(zatenIcerior) return temizAdres || '—';
  return temizAdres ? `${temizAdres}, ${ilceIl}` : ilceIl;
}

function senetBorcluAdiOlustur(tabelaAdi?: string, musteriAdi?: string) {
  const tabela = String(tabelaAdi||'').trim();
  const musteri = String(musteriAdi||'').trim();
  if (tabela && musteri) {
    const tabelaU = tabela.toLocaleUpperCase('tr-TR');
    const musteriU = musteri.toLocaleUpperCase('tr-TR');
    if (tabelaU === musteriU) return tabela;
    if (tabelaU.startsWith(musteriU) || musteriU.startsWith(tabelaU)) {
      return tabela.length >= musteri.length ? tabela : musteri;
    }
    return `${tabela} / ${musteri}`;
  }
  return tabela || musteri || '—';
}

interface SenetPrintModalProps {
  customer: any;
  onClose: () => void;
}

export default function SenetPrintModal({ customer, onClose }: SenetPrintModalProps) {
  const bakiyeTutari = customer?.balance || 0;
  
  const [tutarTipi, setTutarTipi] = useState<'bakiye' | 'manuel'>(bakiyeTutari > 0 ? 'bakiye' : 'manuel');
  const [manuelTutar, setManuelTutar] = useState('');
  
  const [adetStr, setAdetStr] = useState<string>('1');
  const [showVadeForm, setShowVadeForm] = useState(false);
  
  const [vadeler, setVadeler] = useState<string[]>(['']);
  
  const handleAdetDevam = () => {
    let num = parseInt(adetStr);
    if (isNaN(num) || num < 1) num = 1;
    if (num > 12) num = 12;
    
    setAdetStr(num.toString());
    const newVadeler = Array(num).fill('');
    for (let i = 0; i < Math.min(num, vadeler.length); i++) {
      newVadeler[i] = vadeler[i];
    }
    setVadeler(newVadeler);
    setShowVadeForm(true);
  };

  const handleVadeChange = (index: number, val: string) => {
    const arr = [...vadeler];
    arr[index] = val;
    setVadeler(arr);
  };

  const handlePrint = () => {
    if (vadeler.some(v => !v)) {
      alert('Lütfen tüm senetler için vade tarihi giriniz.');
      return;
    }

    let totalAmount = 0;
    if (tutarTipi === 'bakiye') {
      totalAmount = bakiyeTutari;
    } else {
      totalAmount = parseFloat(manuelTutar);
    }

    if (isNaN(totalAmount) || totalAmount <= 0) {
      alert('Geçerli bir tutar belirleyiniz.');
      return;
    }

    const piece = totalAmount / vadeler.length;
    let htmlContent = '';
    const kesideTarihi = new Date();
    
    vadeler.forEach((vadeStr, index) => {
      const currentPiece = index === vadeler.length - 1 
        ? totalAmount - (piece * (vadeler.length - 1)) 
        : piece;

      const vadeDate = new Date(vadeStr + 'T00:00:00');
      const tutarTamsayi = Math.floor(currentPiece);
      const tutarKurus = Math.round((currentPiece % 1) * 100);
      const kurusYazi = tutarKurus > 0 ? ' Lira ' + sayiyiYaziyaCevir(tutarKurus) + ' Kuruş' : '';
      const tutarYazi = '#' + sayiyiYaziyaCevir(tutarTamsayi) + kurusYazi + ' Türk Lirası#';

      const borcluAdi = senetBorcluAdiOlustur(customer?.signName, customer?.customerName);
      const vergiTcNo = customer?.taxNo || customer?.taxId || customer?.tcKimlikNo || '';
      const adres = customer?.address || customer?.district || '';
      const ilce = customer?.district || '';
      const il = customer?.province || '';

      htmlContent += `
        <div class="senet-sayfa"><div class="senet-cerceve"><div class="senet-cerceve-inner">
          <div class="senet-ust">
            <div class="senet-baslik">BONO</div>
            <div class="senet-tutar-damga">
              <div class="senet-tutar-damga-label">Türk Lirası</div>
              <div class="senet-tutar-damga-deger">${tutarRakamSenet(currentPiece)}</div>
            </div>
          </div>
          <div class="senet-alacakli">
            <div class="senet-alacakli-label">Alacaklı</div>
            <div class="senet-alacakli-adi">${escapeHtml(SENET_SABIT.aliciUnvan)}</div>
          </div>
          <div class="senet-meta-serit">
            <div class="senet-meta-item"><div class="senet-meta-label">Keşide Tarihi</div><div class="senet-meta-deger">${fmtDate(kesideTarihi)}</div></div>
            <div class="senet-meta-item"><div class="senet-meta-label">Keşide Yeri</div><div class="senet-meta-deger">${escapeHtml(il || '—')}</div></div>
            <div class="senet-meta-item"><div class="senet-meta-label">Ödeme Tarihi</div><div class="senet-meta-deger">${fmtDate(vadeDate)}</div></div>
          </div>
          <p class="senet-metin">İşbu emre yazılı senet mukabilinde <u>${tarihUzunYazi(vadeDate)}</u> tarihinde <b><u>${escapeHtml(SENET_SABIT.aliciUnvan)}</u></b> veyahut emrühavalesine yukarıda yazılı <b><u>${tutarYazi}</u></b> ödeyeceğim. Bedeli <b>MALEN</b> ahzolunmuştur. İşbu bononun gününde ödenmemesi halinde diğer bonoların da muacceliyet kazanacağını, bu durumda icra masraflarını ve avukatlık ücretini ödeyeceğimi, ihtilaf halinde <b><u>${escapeHtml(SENET_SABIT.yetkiliMahkeme)}</u></b> mahkemeleri ve icra dairelerinin yetkili olduğunu şimdiden kabul ediyorum.</p>
          <div class="senet-taraflar">
            <div class="senet-taraf-box">
              <p class="senet-taraf-baslik">Borçlu</p>
              <p><b>Ad Soyad / Unvan</b> : ${escapeHtml(borcluAdi || '—')}</p>
              <p><b>T.C./Vergi No.</b> : ${escapeHtml(vergiTcNo || '—')}</p>
              <p><b>Adres</b> : ${escapeHtml(senetAdresTamMetin(adres, ilce, il))}</p>
            </div>
            <div class="senet-taraf-box senet-imza-taraf-box">
              <p class="senet-taraf-baslik">Düzenlenme Tarihi : ${fmtDate(kesideTarihi)}</p>
              <div class="senet-imza-blok">İmza / Kaşe</div>
            </div>
          </div>
        </div></div></div>
      `;
    });

    let printArea = document.getElementById('senetYazdirmaAlani');
    if (!printArea) {
      printArea = document.createElement('div');
      printArea.id = 'senetYazdirmaAlani';
      printArea.style.display = 'none';
      document.body.appendChild(printArea);
    }
    printArea.innerHTML = htmlContent;

    document.body.classList.add('senet-yazdiriliyor');
    
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('senet-yazdiriliyor');
        if (printArea) printArea.innerHTML = '';
        onClose();
      }, 500);
    }, 100);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(3, 5, 11, 0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999999, padding: '20px'
    }}>
      <div style={{
        background: '#070a13', border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '24px',
        color: '#fff', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        maxHeight: '90vh', overflowY: 'auto'
      }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'rgba(79, 140, 255, 0.15)', color: '#4F8CFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Senet Yazdır</h2>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '0.85rem', color: '#9BA6BC' }}>
          <strong style={{ color: '#fff' }}>Müşteri:</strong> {customer?.customerName || customer?.customerId}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '12px', fontSize: '0.9rem', color: '#E2E8F0', fontWeight: 500 }}>
            Senet tutarı hangi tutar baz alınarak oluşturulsun?
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="radio" 
                checked={tutarTipi === 'bakiye'} 
                onChange={() => setTutarTipi('bakiye')} 
              />
              <span>Kalan Bakiye <b style={{ color: '#4F8CFF' }}>{formatCurrency(bakiyeTutari)}</b></span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input 
                type="radio" 
                checked={tutarTipi === 'manuel'} 
                onChange={() => { setTutarTipi('manuel'); setShowVadeForm(false); }} 
              />
              <span>Manuel Belirle</span>
            </label>
          </div>
        </div>

        {tutarTipi === 'manuel' && (
          <div style={{ marginBottom: '20px', paddingLeft: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: '#9BA6BC' }}>Tutar (TL) *</label>
            <input 
              type="number" 
              value={manuelTutar} 
              onChange={e => { setManuelTutar(e.target.value); setShowVadeForm(false); }} 
              placeholder="Örn. 15000"
              style={{ width: '100%', maxWidth: '200px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none' }}
            />
          </div>
        )}

        <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', color: '#E2E8F0', fontWeight: 500 }}>
            Kaç senet oluşturulacak?
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input 
              type="number" 
              min="1" max="12"
              value={adetStr} 
              onChange={e => setAdetStr(e.target.value)} 
              style={{ width: '100px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', textAlign: 'center' }}
            />
            <button 
              onClick={handleAdetDevam}
              style={{ padding: '0 20px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}
            >
              Devam
            </button>
          </div>
        </div>

        {showVadeForm && (
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#E2E8F0' }}>Vade Tarihleri</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {vadeler.map((v, i) => (
                <div key={i}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', color: '#9BA6BC' }}>{i + 1}. Senet Vadesi</label>
                  <input 
                    type="date" 
                    value={v} 
                    onChange={e => handleVadeChange(i, e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            onClick={onClose} 
            style={{ padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}
          >İptal</button>
          
          {showVadeForm && (
            <button 
              onClick={handlePrint} 
              style={{ padding: '10px 16px', background: '#4F8CFF', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, boxShadow: '0 0 15px rgba(79, 140, 255, 0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Senetleri Oluştur ve Yazdır
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
