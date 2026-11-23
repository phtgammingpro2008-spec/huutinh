import { expect, test } from 'bun:test';
import { DEFAULT_QUOTE_MESSAGE, QUOTE_KEYS, dict, t } from '../../src/shared/i18n';
import { createTestEnv } from '../helpers/env';

test('every QuoteKey exists in vi, en and km', () => {
  for (const lang of ['vi', 'en', 'km'] as const) {
    for (const k of QUOTE_KEYS) {
      expect(typeof dict[lang][k]).toBe('string');
      expect(dict[lang][k].length).toBeGreaterThan(0);
    }
  }
});

test('t replaces vars and the changed message is localized', () => {
  expect(t('vi', 'quote.changed')).toBe('Báo giá đã thay đổi, vui lòng tải lại trang');
  expect(t('en', 'quote.changed')).toBe('This quote has changed, please reload');
  expect(t('km', 'quote.changed')).not.toBe(t('en', 'quote.changed'));
  expect(t('en', 'accept')).toBe('Accept quote');
  expect(t('vi', 'accept')).toBe('Đồng ý báo giá');
  expect(t('vi', 'version', { n: 3 })).toContain('3');
});

test('default quote messages equal the schema seed', async () => {
  const env = await createTestEnv();
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'quote_message'").first<{ value: string }>();
  expect(JSON.parse(row!.value)).toEqual(DEFAULT_QUOTE_MESSAGE);
  for (const m of Object.values(DEFAULT_QUOTE_MESSAGE)) for (const v of ['{code}', '{url}', '{total}']) expect(m).toContain(v);
});

test('every uiT key exists in vi, en and km', async () => {
  const { uiDict } = await import('../../src/shared/i18n-ui');
  const keys = Object.keys(uiDict.vi);
  for (const lang of ['en', 'km'] as const) {
    expect(Object.keys(uiDict[lang]).sort()).toEqual([...keys].sort());
    for (const k of keys) expect((uiDict[lang] as Record<string, string>)[k].length).toBeGreaterThan(0);
  }
});
