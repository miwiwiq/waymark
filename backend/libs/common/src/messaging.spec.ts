import { Logger } from '@nestjs/common';
import type { RmqContext } from '@nestjs/microservices';
import { handleWithRetry, InvalidMessageError } from './messaging.js';

describe('handleWithRetry', () => {
  const message = { content: Buffer.from('{}') };
  let channel: { ack: ReturnType<typeof vi.fn>; nack: ReturnType<typeof vi.fn>; assertQueue: ReturnType<typeof vi.fn> };
  let context: RmqContext;

  beforeAll(() => Logger.overrideLogger(false));
  afterAll(() => Logger.overrideLogger(true));

  beforeEach(() => {
    vi.useFakeTimers();
    channel = { ack: vi.fn(), nack: vi.fn(), assertQueue: vi.fn().mockResolvedValue(undefined) };
    context = {
      getChannelRef: () => channel,
      getMessage: () => message,
      getPattern: () => 'user.created',
    } as unknown as RmqContext;
  });

  afterEach(() => vi.useRealTimers());

  /** Runs the helper to completion, letting every backoff timer fire. */
  async function run(handler: () => Promise<void>): Promise<void> {
    const done = handleWithRetry(context, handler);
    await vi.runAllTimersAsync();
    await done;
  }

  it('acks a message once it is handled', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    await run(handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('sends an invalid message to the DLQ at once, without retrying', async () => {
    const handler = vi.fn().mockRejectedValue(new InvalidMessageError('bad payload'));
    await run(handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(channel.assertQueue).toHaveBeenCalledWith('users_events.dlq', { durable: true });
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('retries other failures until the handler succeeds', async () => {
    const outage = new Error('getaddrinfo ENOTFOUND users-db');
    const handler = vi
      .fn()
      .mockRejectedValueOnce(outage)
      .mockRejectedValueOnce(outage)
      .mockRejectedValueOnce(outage)
      .mockResolvedValue(undefined);
    await run(handler);
    expect(handler).toHaveBeenCalledTimes(4);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('never dead-letters other failures: after 10 attempts with backoff it requeues', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('connection refused'));
    const start = Date.now();
    await run(handler);
    expect(handler).toHaveBeenCalledTimes(10);
    // 1 + 2 + 4 + 8 + 16 s, then capped at 30 s for the remaining four waits.
    expect(Date.now() - start).toBe(151_000);
    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    expect(channel.assertQueue).not.toHaveBeenCalled();
    expect(channel.ack).not.toHaveBeenCalled();
  });
});
