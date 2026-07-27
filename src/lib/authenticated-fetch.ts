'use client';

import { account } from '@/lib/appwrite';

export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  let jwt: { jwt: string };
  try {
    jwt = await account.createJWT();
  } catch {
    throw new Error('Bạn cần đăng nhập trước khi chấm hoặc mở bài viết.');
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${jwt.jwt}`);
  return fetch(input, { ...init, headers });
}
