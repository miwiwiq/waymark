import { BadRequestException } from '@nestjs/common';
import { isMongoId, isUUID } from 'class-validator';
import { decodeCursor, encodeCursor } from './cursor.js';

describe('cursor', () => {
  const cursor = { time: '2026-09-25T10:00:00.123456Z', id: '66f3c0a1b2c3d4e5f6a7b8c9' };

  it('round-trips the time and id unchanged', () => {
    expect(decodeCursor(encodeCursor(cursor), isMongoId)).toEqual(cursor);
  });

  it('means "first page" when absent', () => {
    expect(decodeCursor(undefined, isMongoId)).toBeNull();
    expect(decodeCursor('', isMongoId)).toBeNull();
  });

  it('rejects garbage, a bad time and an id of the wrong kind', () => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    expect(() => decodeCursor('not-a-cursor', isMongoId)).toThrow(BadRequestException);
    expect(() => decodeCursor(encode(['yesterday', cursor.id]), isMongoId)).toThrow(BadRequestException);
    expect(() => decodeCursor(encodeCursor(cursor), isUUID)).toThrow(BadRequestException);
  });
});
