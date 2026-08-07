/**
 * Paket 00 para sözleşmesi.
 *
 * V1 yalnız TRY ve iki ondalık basamak içindir. Kaynak-adapter normalizasyonu,
 * çarpma, bölme ve yuvarlama politikaları sonraki paketlere bırakılmıştır.
 */

export const TRY_CURRENCY = 'TRY' as const;
export type Currency = typeof TRY_CURRENCY;

export interface MoneyJson {
  readonly currency: Currency;
  readonly amount: string;
}

const DECIMAL_AMOUNT_PATTERN = /^-?\d+(?:\.\d{1,2})?$/;
const MINOR_UNITS_PER_TRY = 100n;

function assertCurrency(currency: unknown): asserts currency is Currency {
  if (currency !== TRY_CURRENCY) {
    throw new TypeError(`Paket 00 Money yalnız ${TRY_CURRENCY} para birimini destekler.`);
  }
}

function parseMinorUnits(value: string): bigint {
  if (typeof value !== 'string' || !DECIMAL_AMOUNT_PATTERN.test(value)) {
    throw new TypeError('Money amount kanonik ondalık metin olmalıdır.');
  }

  const negative = value.startsWith('-');
  const unsignedValue = negative ? value.slice(1) : value;
  const [wholePart, fractionalInput = ''] = unsignedValue.split('.');
  const fractionalPart = fractionalInput.padEnd(2, '0');
  const absoluteMinorUnits = BigInt(wholePart) * MINOR_UNITS_PER_TRY + BigInt(fractionalPart);

  return negative ? -absoluteMinorUnits : absoluteMinorUnits;
}

function formatMinorUnits(minorUnits: bigint): string {
  const negative = minorUnits < 0n;
  const absoluteMinorUnits = negative ? -minorUnits : minorUnits;
  const wholePart = absoluteMinorUnits / MINOR_UNITS_PER_TRY;
  const fractionalPart = (absoluteMinorUnits % MINOR_UNITS_PER_TRY).toString().padStart(2, '0');

  return `${negative ? '-' : ''}${wholePart.toString()}.${fractionalPart}`;
}

export class Money {
  readonly currency: Currency;
  private readonly minorUnits: bigint;

  private constructor(minorUnits: bigint, currency: Currency) {
    this.minorUnits = minorUnits;
    this.currency = currency;
  }

  static fromDecimalString(value: string, currency: Currency = TRY_CURRENCY): Money {
    assertCurrency(currency);
    return new Money(parseMinorUnits(value), currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits + other.minorUnits, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits - other.minorUnits, this.currency);
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.minorUnits < other.minorUnits) return -1;
    if (this.minorUnits > other.minorUnits) return 1;
    return 0;
  }

  toDecimalString(): string {
    return formatMinorUnits(this.minorUnits);
  }

  toJSON(): MoneyJson {
    return {
      currency: this.currency,
      amount: this.toDecimalString()
    };
  }

  private assertSameCurrency(other: Money): void {
    if (!other || other.currency !== this.currency) {
      throw new TypeError('Farklı para birimleri ile Money işlemi yapılamaz.');
    }
  }
}
