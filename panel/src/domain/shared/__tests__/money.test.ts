import { describe, expect, it } from 'vitest';
import { Money } from '../money';

describe('P00-MNY — exact TRY Money value object', () => {
  it('keeps zero, negative and very large amounts exact', () => {
    expect(Money.fromDecimalString('0').toDecimalString()).toBe('0.00');
    expect(Money.fromDecimalString('-19.50').toDecimalString()).toBe('-19.50');
    expect(Money.fromDecimalString('9007199254740993.01').toDecimalString()).toBe('9007199254740993.01');
    expect(Money.fromDecimalString('-0.00').toDecimalString()).toBe('0.00');
  });

  it('adds, subtracts and compares with integer minor-unit precision', () => {
    const total = Money.fromDecimalString('0.10').add(Money.fromDecimalString('0.20'));

    expect(total.toDecimalString()).toBe('0.30');
    expect(total.subtract(Money.fromDecimalString('0.45')).toDecimalString()).toBe('-0.15');
    expect(Money.fromDecimalString('4.00').compare(Money.fromDecimalString('3.99'))).toBe(1);
    expect(Money.fromDecimalString('4.00').compare(Money.fromDecimalString('4.00'))).toBe(0);
  });

  it('serializes through the canonical decimal JSON boundary, never bigint', () => {
    const money = Money.fromDecimalString('1234.5');

    expect(money.toJSON()).toEqual({ currency: 'TRY', amount: '1234.50' });
    expect(JSON.stringify(money)).toBe('{"currency":"TRY","amount":"1234.50"}');
  });

  it('rejects non-canonical input and unsupported/future currency mixing', () => {
    for (const invalid of ['1,23', '₺1.23', '1.234', '1e3', 'NaN', 'Infinity', '']) {
      expect(() => Money.fromDecimalString(invalid)).toThrow();
    }

    expect(() => Money.fromDecimalString('1.00', 'USD' as never)).toThrow();
    const foreignMoney = { currency: 'USD' } as unknown as Money;
    expect(() => Money.fromDecimalString('1.00').add(foreignMoney)).toThrow();
  });
});
