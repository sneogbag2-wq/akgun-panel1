import { getRawSelloutDataSync, getAllCustomersForReportingSync } from '../services/customerService';
import { ParsedSelloutRecord } from '../parsers/selloutParser';
import { getTargets, SelloutTarget } from '../services/targetService';
import { resolveChannelFromMaster } from '../utils/channelUtils';

export interface RepSelloutPerformance {
  repName: string;
  ssmName: string;
  openChannelTarget: number;
  openChannelRealized: number;
  closedChannelTarget: number;
  closedChannelRealized: number;
  totalTarget: number;
  totalRealized: number;
}

export interface SsmSelloutPerformance {
  ssmName: string;
  reps: RepSelloutPerformance[];
  openChannelTarget: number;
  openChannelRealized: number;
  closedChannelTarget: number;
  closedChannelRealized: number;
  totalTarget: number;
  totalRealized: number;
}

export function getSelloutPerformance(period: string): { ssmList: SsmSelloutPerformance[], companyTotal: SsmSelloutPerformance } {
  const selloutData = getRawSelloutDataSync() as ParsedSelloutRecord[];
  const customers = getAllCustomersForReportingSync();
  const targets = getTargets(period);

  // Müşteri ID'sine göre Temsilci, SSM ve Kanal eşleştirmesi (Single Source of Truth: Customer Master)
  const customerMap = new Map<string, { repName: string, ssmName: string, channel: 'AÇIK' | 'KAPALI' }>();
  for (const c of customers) {
    const chVal = String(c.salesChannel || c.channel || '');
    const channel = resolveChannelFromMaster(chVal);
    customerMap.set(c.customerId, {
      repName: c.salesRepName || 'Belirtilmemiş',
      ssmName: c.ssmName || 'Belirtilmemiş',
      channel
    });
  }

  // Temsilci bazında gerçekleşenleri topla
  const repRealizedMap = new Map<string, { ssmName: string, open: number, closed: number }>();

  // Filter sellout by period (assuming YYYY-MM prefix match on date)
  // Or just take all if period is "All", but for Targets period is usually YYYY-MM
  // NOT: `s.date` boş/parse edilemeyen tarih satırlarında null olabilir (bkz. selloutParser.ts
  // safeIsoDate()). Null-check olmadan `.startsWith()` çağrısı TypeError fırlatıp tüm
  // Sellout Hedef sayfasını çökertiyordu — bu yüzden `s.date &&` koruması eklendi.
  const filteredSellout = selloutData.filter(s => s.date && s.date.startsWith(period));

  for (const s of filteredSellout) {
    const custInfo = customerMap.get(s.customerId) || { 
      repName: 'Belirtilmemiş', 
      ssmName: 'Belirtilmemiş', 
      channel: s.channel === 'KAPALI' ? 'KAPALI' : 'AÇIK' 
    };
    const repKey = custInfo.repName;

    if (!repRealizedMap.has(repKey)) {
      repRealizedMap.set(repKey, { ssmName: custInfo.ssmName, open: 0, closed: 0 });
    }

    const current = repRealizedMap.get(repKey)!;
    // NOT: Dağıtım için müşteri master'daki (tekil) kanal ataması değil, HER SELLOUT
    // KAYDININ KENDİ satırındaki gerçek kanal bilgisi (s.channel) kullanılır. Böylece
    // müşteri master'da KARMA (Açık+Kapalı birleşik) olarak görünen bir müşterinin
    // sellout hacmi, o işlemin gerçekleştiği kanala göre doğru bölünür — tamamı tek bir
    // kanala (örn. hep AÇIK) hatalı şekilde yazılmaz.
    if (s.channel === 'KAPALI') {
      current.closed += s.liters;
    } else if (s.channel === 'AÇIK') {
      current.open += s.liters;
    } else {
      // s.channel belirsiz/boş geldiyse (nadiren), müşteri master atamasına düş
      if (custInfo.channel === 'KAPALI') {
        current.closed += s.liters;
      } else {
        current.open += s.liters;
      }
    }
  }

  // Temsilci listesini oluştur
  const repPerformances: RepSelloutPerformance[] = [];
  
  // Tüm temsilcileri döngüye al (satış yapmayan ama hedefi olanlar da olabilir)
  const repNames = new Set([...Array.from(repRealizedMap.keys()), ...targets.filter(t => t.type === 'REP').map(t => t.name)]);

  for (const repName of repNames) {
    const realized = repRealizedMap.get(repName) || { ssmName: 'Belirtilmemiş', open: 0, closed: 0 };
    let ssmName = realized.ssmName;

    // Eğer temsilci satışı yoksa ssm ismini müşterilerden bulmaya çalış
    if (ssmName === 'Belirtilmemiş') {
      const sampleCust = customers.find(c => c.salesRepName === repName);
      if (sampleCust) ssmName = sampleCust.ssmName || 'Belirtilmemiş';
    }

    const target = targets.find(t => t.type === 'REP' && t.name === repName);
    const openTarget = target ? target.openChannelTarget : 0;
    const closedTarget = target ? target.closedChannelTarget : 0;

    repPerformances.push({
      repName,
      ssmName,
      openChannelTarget: openTarget,
      openChannelRealized: realized.open,
      closedChannelTarget: closedTarget,
      closedChannelRealized: realized.closed,
      totalTarget: openTarget + closedTarget,
      totalRealized: realized.open + realized.closed,
    });
  }

  // SSM'e göre grupla
  const ssmMap = new Map<string, SsmSelloutPerformance>();
  for (const rep of repPerformances) {
    if (!ssmMap.has(rep.ssmName)) {
      ssmMap.set(rep.ssmName, {
        ssmName: rep.ssmName,
        reps: [],
        openChannelTarget: 0,
        openChannelRealized: 0,
        closedChannelTarget: 0,
        closedChannelRealized: 0,
        totalTarget: 0,
        totalRealized: 0
      });
    }

    const ssm = ssmMap.get(rep.ssmName)!;
    ssm.reps.push(rep);
    ssm.openChannelTarget += rep.openChannelTarget;
    ssm.openChannelRealized += rep.openChannelRealized;
    ssm.closedChannelTarget += rep.closedChannelTarget;
    ssm.closedChannelRealized += rep.closedChannelRealized;
    ssm.totalTarget += rep.totalTarget;
    ssm.totalRealized += rep.totalRealized;
  }

  const ssmList = Array.from(ssmMap.values()).sort((a, b) => b.totalRealized - a.totalRealized);

  // Şirket Genel Toplamı
  const companyTotal: SsmSelloutPerformance = {
    ssmName: 'Şirket Geneli',
    reps: repPerformances,
    openChannelTarget: ssmList.reduce((acc, s) => acc + s.openChannelTarget, 0),
    openChannelRealized: ssmList.reduce((acc, s) => acc + s.openChannelRealized, 0),
    closedChannelTarget: ssmList.reduce((acc, s) => acc + s.closedChannelTarget, 0),
    closedChannelRealized: ssmList.reduce((acc, s) => acc + s.closedChannelRealized, 0),
    totalTarget: ssmList.reduce((acc, s) => acc + s.totalTarget, 0),
    totalRealized: ssmList.reduce((acc, s) => acc + s.totalRealized, 0),
  };

  return { ssmList, companyTotal };
}

export interface AdvancedForecastResult {
  daysElapsed: number;
  totalDaysInMonth: number;
  linearForecast: number;
  linearPercent: number;
  weightedForecast: number;
  weightedPercent: number;
  historicalSeasonalityRatio: number; // e.g. 0.35 (35% usually done by this day)
  lateMonthSpikeRatio: number; // e.g. 45% happens in last 10 days historically
  dailyVelocity: number;
  requiredDailyVelocity: number;
  cfoCommentary: string;
}

/**
 * Geçmiş ay kayıtlarından ay-içi mevsimsellik oranını hesaplar.
 * Her geçmiş ay KENDİ gerçek gün sayısına göre normalize edilir (28/29/30/31 gün farkı
 * dikkate alınır) ve aylar arası ORAN bazında eşit ağırlıklı ortalama alınır — böylece
 * hacmi büyük tek bir ay tüm mevsimselliği domine etmez ve farklı ay uzunlukları
 * birbirine karıştırılmaz.
 *
 * @param historicalRecords targetMonth dışındaki geçmiş sellout kayıtları (date: 'YYYY-MM-DD', liters: number)
 * @param targetDayFraction hedef ayın bugüne kadar geçen oranı (0-1 arası, örn. 21/30 = 0.7)
 * @returns { historicalSeasonalityRatio, lateMonthSpikeRatio, histTotalLiters }
 */
export function calculateHistoricalSeasonality(
  historicalRecords: { date: string; liters: number }[],
  targetDayFraction: number
): { historicalSeasonalityRatio: number; lateMonthSpikeRatio: number; histTotalLiters: number } {
  const monthGroups = new Map<string, { total: number; untilFraction: number; last10Pct: number }>();

  for (const rec of historicalRecords) {
    if (!rec.date || rec.date.length < 10) continue;
    const ym = rec.date.slice(0, 7); // "YYYY-MM"
    const recDay = parseInt(rec.date.slice(8, 10), 10);
    if (!recDay || recDay < 1) continue;

    const [ry, rm] = ym.split('-').map(Number);
    if (!ry || !rm) continue;
    const monthLength = new Date(ry, rm, 0).getDate(); // bu geçmiş ayın gerçek gün sayısı
    const dayFractionOfThisMonth = recDay / monthLength;

    if (!monthGroups.has(ym)) {
      monthGroups.set(ym, { total: 0, untilFraction: 0, last10Pct: 0 });
    }
    const g = monthGroups.get(ym)!;
    g.total += rec.liters;
    if (dayFractionOfThisMonth <= targetDayFraction) {
      g.untilFraction += rec.liters;
    }
    if (dayFractionOfThisMonth >= 0.67) {
      g.last10Pct += rec.liters;
    }
  }

  const perMonthRatios: number[] = [];
  const perMonthSpikeRatios: number[] = [];
  let histTotalLiters = 0;
  for (const g of monthGroups.values()) {
    histTotalLiters += g.total;
    if (g.total > 0) {
      perMonthRatios.push(g.untilFraction / g.total);
      perMonthSpikeRatios.push(g.last10Pct / g.total);
    }
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  let historicalSeasonalityRatio = avg(perMonthRatios);
  if (historicalSeasonalityRatio <= 0) {
    historicalSeasonalityRatio = targetDayFraction; // geçmiş veri yoksa eşit dağılım varsay
  }

  const lateMonthSpikeRatio = perMonthSpikeRatios.length > 0
    ? Math.round(avg(perMonthSpikeRatios) * 100) / 100
    : 0.35;

  return { historicalSeasonalityRatio, lateMonthSpikeRatio, histTotalLiters };
}

export function calculateAdvancedSelloutForecast(targetMonth: string, entityName?: string): AdvancedForecastResult {
  const selloutData = getRawSelloutDataSync() as ParsedSelloutRecord[];
  const performance = getSelloutPerformance(targetMonth);

  const d = new Date(targetMonth + '-01');
  const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const currentDay = new Date().getMonth() === d.getMonth() ? new Date().getDate() : endOfMonth;
  const daysElapsed = Math.max(1, currentDay);

  // Kapsam (şirket geneli / SSM / temsilci) açık şekilde belirleniyor. Bu kapsam,
  // hem cari ay hedef/gerçekleşen verisi (targetEntity) hem de aşağıdaki tarihsel
  // mevsimsellik verisi (historicalRecords) için AYNI filtre olarak kullanılır.
  // NOT (B9 düzeltmesi): Önceden yalnızca targetEntity kapsamlanıyor, historicalRecords
  // ise HER ZAMAN şirket genelinden (filtrelenmeden) alınıyordu. Bu; bir temsilci veya
  // SSM seçildiğinde cari ay verisi o kişiye ait olsa bile mevsimsellik eğrisinin şirket
  // genelinden hesaplanmasına, dolayısıyla yanlış bir ağırlıklı tahmine (weightedForecast)
  // yol açıyordu. Artık ikisi de aynı kapsam (scope) parametresiyle üretiliyor.
  type ScopeKind = 'COMPANY' | 'SSM' | 'REP';
  let scopeKind: ScopeKind = 'COMPANY';
  let targetEntity: any = performance.companyTotal;
  let matchedSsmName: string | null = null;
  let matchedRepName: string | null = null;

  if (entityName && entityName !== 'TÜMÜ' && entityName !== 'Şirket Geneli') {
    const ssmMatch = performance.ssmList.find(s => s.ssmName.toLowerCase() === entityName.toLowerCase());
    if (ssmMatch) {
      targetEntity = ssmMatch;
      scopeKind = 'SSM';
      matchedSsmName = ssmMatch.ssmName;
    } else {
      for (const ssm of performance.ssmList) {
        const repMatch = ssm.reps.find(r => r.repName.toLowerCase() === entityName.toLowerCase());
        if (repMatch) {
          targetEntity = repMatch;
          scopeKind = 'REP';
          matchedRepName = repMatch.repName;
          break;
        }
      }
    }
    // NOT: Kısmi ada tam eşleşme bulunamazsa (ör. birden fazla temsilciyle eşleşen
    // kısmi bir ad filtresi), tekil bir kapsam oluşmadığından tahmin şirket geneline
    // SESSİZCE düşürülmez; targetEntity zaten performance.companyTotal olarak kalır
    // ve scopeKind 'COMPANY' olarak işaretlenmiş olur — bu durum cfoCommentary'de de
    // "şirket geneli" olarak doğru şekilde yansıtılır (bkz. aşağıdaki entityName kullanımı).
  }

  const totalRealized = targetEntity ? targetEntity.totalRealized || 0 : 0;
  const totalTarget = targetEntity ? targetEntity.totalTarget || 0 : 0;

  // 1. Düz Çizgisel (Linear) Hesaplama
  const dailyVelocity = totalRealized / daysElapsed;
  const remainingDays = Math.max(0, endOfMonth - daysElapsed);
  const linearForecast = Math.round(totalRealized + (dailyVelocity * remainingDays));
  const linearPercent = totalTarget > 0 ? Math.round((linearForecast / totalTarget) * 100) : 0;

  // 2. Geçmiş Ayların İçi (Intra-Month) Satış Eğrisini Analiz Et
  // Mevcut aydan farklı geçmiş ayları bul
  // NOT: `s.date` null olabilir (bkz. yukarıdaki not, getSelloutPerformance içinde).
  // Null-check olmadan `.startsWith()/.length` erişimi TypeError fırlatabiliyordu.
  let historicalRecords = selloutData.filter(s => s.date && !s.date.startsWith(targetMonth) && s.date.length >= 10);

  // B9 düzeltmesi: targetEntity bir SSM veya temsilciye kapsamlıysa, geçmiş kayıtlar da
  // AYNI kapsama göre filtrelenir (Customer Master üzerinden repName/ssmName eşlemesiyle).
  // Böylece bir temsilci seçildiğinde mevsimsellik eğrisi yalnızca o temsilcinin geçmiş
  // satış deseninden, bir SSM seçildiğinde yalnızca o SSM'nin ekibinden hesaplanır;
  // şirket geneli (scopeKind === 'COMPANY') durumunda önceki davranış (filtresiz) korunur.
  if (scopeKind !== 'COMPANY') {
    const customers = getAllCustomersForReportingSync();
    const customerScopeMap = new Map<string, { repName: string, ssmName: string }>();
    for (const c of customers) {
      customerScopeMap.set(c.customerId, {
        repName: c.salesRepName || 'Belirtilmemiş',
        ssmName: c.ssmName || 'Belirtilmemiş',
      });
    }

    historicalRecords = historicalRecords.filter(s => {
      const info = customerScopeMap.get(s.customerId);
      if (!info) return false;
      if (scopeKind === 'REP') return info.repName.toLowerCase() === (matchedRepName || '').toLowerCase();
      if (scopeKind === 'SSM') return info.ssmName.toLowerCase() === (matchedSsmName || '').toLowerCase();
      return false;
    });
  }

  // NOT: Önceden tüm geçmiş ayların kayıtları TEK bir havuzda birleştirilip
  // "rec.date.slice(8,10)" (ayın günü, 1-31) ile hedef ayın "daysElapsed" değeri
  // doğrudan karşılaştırılıyordu. Bu, farklı ay uzunluklarını (28/29/30/31 gün)
  // hesaba katmadığı için yanlıştı: örn. 31 günlük bir ayın 21. günü ayın %68'i
  // demekken, 28 günlük bir ayın 21. günü ayın %75'idir; ayrıca birden fazla ay
  // karışınca mevsimsellik sinyali bulanıklaşıyordu. Artık her geçmiş AY KENDİ
  // İÇİNDE ayrı ayrı ele alınıp kendi ay uzunluğuna göre normalize ediliyor,
  // sonra aylar arası ORAN bazında ortalama alınıyor (bkz. calculateHistoricalSeasonality).
  const targetDayFraction = daysElapsed / endOfMonth; // hedef ayın bugüne kadar geçen oranı (0-1)
  const { historicalSeasonalityRatio, lateMonthSpikeRatio } = calculateHistoricalSeasonality(historicalRecords, targetDayFraction);

  // Ağırlıklı Projeksiyon
  let weightedForecast = linearForecast;
  if (historicalSeasonalityRatio > 0) {
    weightedForecast = Math.round(totalRealized / historicalSeasonalityRatio);
  }
  const weightedPercent = totalTarget > 0 ? Math.round((weightedForecast / totalTarget) * 100) : 0;

  const requiredDailyVelocity = remainingDays > 0 && totalTarget > totalRealized
    ? Math.round((totalTarget - totalRealized) / remainingDays)
    : 0;

  // CFO Düzeyinde Dinamik Yorum Oluşturma
  const histPercentStr = Math.round(historicalSeasonalityRatio * 100);
  const spikePercentStr = Math.round(lateMonthSpikeRatio * 100);

  let cfoCommentary = '';
  if (totalTarget === 0) {
    cfoCommentary = `Görüntülenen ${entityName || 'şirket geneli'} için bu döneme ait henüz bir hedef tanımlanmamıştır.`;
  } else if (weightedPercent >= 100 && linearPercent < 100) {
    cfoCommentary = `Tarihsel verilerimize göre satışların %${histPercentStr}'si ayın ilk ${daysElapsed} gününde, %${spikePercentStr}'si ise ay sonu kapanış döneminde (son ~1/3'lük dilim) gerçekleşmektedir. Düz hesap %${linearPercent} gösterse de kapanış ivmesiyle hedefin %${weightedPercent} oranında aşılması bekleniyor.`;
  } else if (weightedPercent < 90) {
    cfoCommentary = `Geçmiş aylardaki satış ivmesi katsayısına (%${histPercentStr} tarihsel gerçekleşme) göre ay sonu hedef gerçekleşmesi %${weightedPercent} seviyesinde kalacaktır. Kalan ${remainingDays} günde hedefin tutması için günlük satış hızının ${requiredDailyVelocity} Litre seviyesine çıkarılması şarttır.`;
  } else {
    cfoCommentary = `Satışlar tarihsel ay içi dönemsellik eğrisiyle tam uyumlu ilerliyor. Tarihsel olarak ayın ilk ${daysElapsed} gününde %${histPercentStr} gerçekleşme sağlanıyor ve mevcut tempoyla ay sonu hedefin %${weightedPercent} seviyesinde kapanacağı öngörülüyor.`;
  }

  return {
    daysElapsed,
    totalDaysInMonth: endOfMonth,
    linearForecast,
    linearPercent,
    weightedForecast,
    weightedPercent,
    historicalSeasonalityRatio,
    lateMonthSpikeRatio,
    dailyVelocity: Math.round(dailyVelocity),
    requiredDailyVelocity,
    cfoCommentary
  };
}
