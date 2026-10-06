import { timingSafeEqual } from 'crypto';

export function verifyStaffKey(key) {
  const expected = process.env.STAFF_KEY;
  if (!expected || !key) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}