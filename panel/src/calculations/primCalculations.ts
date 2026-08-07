export interface PrimAyarlari {
  agirlikTahsilat: number;
  agirlikYaslandirma: number;
  agirlikCari: number;
  agirlikCiro: number;
  yaslanmaEsigiGun: number;
  hedefNetOran: number;
  primTavan: number;
  barajPuan: number;
}

export const PRIM_VARSAYILAN_AYAR: PrimAyarlari = {
  agirlikTahsilat: 40,
  agirlikYaslandirma: 25,
  agirlikCari: 20,
  agirlikCiro: 15,
  yaslanmaEsigiGun: 30,
  hedefNetOran: 10,
  primTavan: 5000,
  barajPuan: 50,
};

function primClamp(x: number, lo: number = 0, hi: number = 100): number {
  return Math.max(lo, Math.min(hi, x));
}

function puanTahsilatNet(netErime: number, netHedef: number): number {
  if (netHedef <= 0) return 50;
  const o = netErime / netHedef;
  if (o < 0) return 0; // cari büyüdü
  if (o >= 1) return primClamp(85 + (o - 1) / 0.30 * 15);
  return primClamp(o * 85);
}

function puanYaslandirma(basi: number, sonu: number): number {
  if (basi <= 0) return (sonu <= 0) ? 100 : 50;
  const d = (basi - sonu) / basi;
  return primClamp(40 + d / 0.40 * 60);
}

function puanCariAzaltma(basi: number, sonu: number): number {
  if (basi <= 0) return 50;
  const d = (basi - sonu) / basi;
  return primClamp(50 + d / 0.25 * 50);
}

function puanCiro(ciro: number, hedef: number): number {
  if (hedef <= 0) return 50;
  return primClamp((ciro / hedef) * 90);
}

function primOtomatikNetHedef(ayBasiBakiye: number, yaslanmaOrani: number, ayar: PrimAyarlari): number {
  const taban = ayar.hedefNetOran / 100;
  const zorluk = taban * (1 - (yaslanmaOrani || 0) * 0.4);
  return ayBasiBakiye * Math.max(zorluk, taban * 0.5); // en fazla yarıya kadar hafifler
}

function primGerceklesmeCarpani(gecmisOranlar: number[]): number {
  if (!gecmisOranlar || !gecmisOranlar.length) return 1.0;
  const ortalamaOran = gecmisOranlar.reduce((a, b) => a + b, 0) / gecmisOranlar.length;
  const yuzde = ortalamaOran * 100;
  if (yuzde >= 85) return 1.0;
  if (yuzde >= 70) return 1.3;
  if (yuzde >= 50) return 1.8;
  if (yuzde >= 30) return 2.5;
  return 3.5;
}

function primRiskCezasiYeni(ayBasiRisk: number, aySonuRisk: number, ayBasiBakiye: number, aySonuBakiye: number, gerceklesmeCarpani: number): number {
  const aySonuOran = (aySonuBakiye > 0) ? (aySonuRisk || 0) / aySonuBakiye : 0;
  const ayBasiOran = (ayBasiBakiye > 0) ? (ayBasiRisk || 0) / ayBasiBakiye : 0;
  const oranFarki = aySonuOran - ayBasiOran;
  if (oranFarki <= 0) return 0;
  return oranFarki * 100 * 0.4 * gerceklesmeCarpani;
}

export interface PrimHesapData {
  ayBasiBakiye: number;
  aySonuBakiye: number;
  ayBasiYaslanan: number;
  aySonuYaslanan: number;
  tahsilat: number;
  yeniFatura: number;
  ayIciCekSenetRisk: number; // Ay içi kesilen ama tahsil edilmeyen
  ayBasiRisk: number;
  ciro: number;
  gecmisOranlar?: number[];
  ayBasiVar: boolean;
}

export interface PrimSonuc {
  netErime: number;
  netHedef: number;
  pT: number;
  pY: number;
  pC: number;
  pR: number;
  riskCezasi: number;
  toplamPuan: number;
  prim: number;
  harfNotu: string;
}

export function calculateRepPrim(data: PrimHesapData, ayar: PrimAyarlari = PRIM_VARSAYILAN_AYAR): PrimSonuc {
  const netErime = data.tahsilat + data.ayIciCekSenetRisk - data.yeniFatura;
  
  const yaslanmaOrani = data.ayBasiBakiye > 0 ? (data.ayBasiVar ? data.ayBasiYaslanan : data.aySonuYaslanan) / data.ayBasiBakiye : 0;
  const netHedef = primOtomatikNetHedef(data.ayBasiBakiye, yaslanmaOrani, ayar);

  const gerceklesmeCarpani = primGerceklesmeCarpani(data.gecmisOranlar || []);
  const riskCezasi = primRiskCezasiYeni(data.ayBasiRisk, data.ayIciCekSenetRisk, data.ayBasiBakiye, data.aySonuBakiye, gerceklesmeCarpani);

  const pT = puanTahsilatNet(netErime, netHedef);
  const pY = data.ayBasiVar ? puanYaslandirma(data.ayBasiYaslanan, data.aySonuYaslanan) : 50;
  const pC = data.ayBasiVar ? puanCariAzaltma(data.ayBasiBakiye, data.aySonuBakiye) : 50;
  const ciroHedef = data.ayBasiBakiye > 0 ? data.ayBasiBakiye * 0.5 : (data.ciro || 1); // Varsayılan referans
  const pR = puanCiro(data.ciro, ciroHedef);

  const toplamHam = pT * (ayar.agirlikTahsilat / 100) + 
                    pY * (ayar.agirlikYaslandirma / 100) + 
                    pC * (ayar.agirlikCari / 100) + 
                    pR * (ayar.agirlikCiro / 100);
                    
  // NOT: Ağırlıkların toplamı (agirlikTahsilat + agirlikYaslandirma + agirlikCari + agirlikCiro) 100
  // olduğu için toplamHam matematiksel olarak asla 100'ü geçemez (riskCezasi sadece düşürür, artırmaz).
  // Bu yüzden gerçek üst sınır 100'dür; eski kod burada 150'ye kadar izin veriyordu (ulaşılamaz, ölü kod).
  const toplamPuan = Math.max(0, Math.min(100, toplamHam - riskCezasi));

  let prim = 0;
  if (toplamPuan >= ayar.barajPuan) {
    const oran = (toplamPuan - ayar.barajPuan) / (100 - ayar.barajPuan);
    prim = ayar.primTavan * (0.20 + oran * 0.80);
    prim = Math.min(prim, ayar.primTavan);
  }

  const harfNotu = toplamPuan >= 90 ? 'A+' : toplamPuan >= 80 ? 'A' : toplamPuan >= 70 ? 'B' : toplamPuan >= 55 ? 'C' : 'D';

  return {
    netErime,
    netHedef,
    pT,
    pY,
    pC,
    pR,
    riskCezasi,
    toplamPuan,
    prim,
    harfNotu
  };
}
