import { expect, test } from 'bun:test';
import worker from '../../src/worker/index';
import { createTestEnv } from '../helpers/env';

const get = async (url: string, method = 'GET', appUrl = 'https://hluxurystore.com') => {
  const env = await createTestEnv();
  env.APP_URL = appUrl;
  return worker.fetch(new Request(url, { method, redirect: 'manual' }), env);
};

test('www and the old workers.dev address move to the main domain, keeping path and query', async () => {
  for (const from of ['https://www.hluxurystore.com/san-pham?lang=en', 'https://xuong-dep.abc.workers.dev/san-pham?lang=en']) {
    const r = await get(from);
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('https://hluxurystore.com/san-pham?lang=en');
  }
  // an old quote link sent over Zalo still opens
  expect((await get('https://xuong-dep.abc.workers.dev/q/abc123')).headers.get('location')).toBe('https://hluxurystore.com/q/abc123');
});

test('the main domain itself, API calls and form posts are never redirected', async () => {
  expect((await get('https://hluxurystore.com/robots.txt')).status).toBe(200);
  expect((await get('https://xuong-dep.abc.workers.dev/api/setup-status')).status).toBe(200);
  expect((await get('https://xuong-dep.abc.workers.dev/api/login', 'POST')).status).not.toBe(301);
});

test('without APP_URL (local dev, tests) nothing moves', async () => {
  expect((await get('http://127.0.0.1:8787/robots.txt', 'GET', '')).status).toBe(200);
});
