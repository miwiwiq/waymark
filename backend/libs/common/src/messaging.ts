import { Logger } from '@nestjs/common';
import { Transport, type RmqContext, type RmqOptions } from '@nestjs/microservices';
import type { Channel, Message } from 'amqplib';

export const USER_CREATED = 'user.created';

/** Auth passes the profile data on without storing it (clarification 7). */
export type UserCreatedEvent = {
  userId: string;
  /** null for Google sign-ups, who choose a username on /onboarding. */
  username: string | null;
  /** YYYY-MM-DD; null for Google sign-ups. */
  dateOfBirth: string | null;
};

const USERS_EVENTS_QUEUE = 'users_events';
const USERS_EVENTS_DLQ = `${USERS_EVENTS_QUEUE}.dlq`;

/**
 * The users_events queue (decision A5). Auth and Users both declare it, so
 * they must use these exact options; a mismatch fails with
 * PRECONDITION_FAILED. Declaring it on both sides keeps messages sent before
 * Users first starts.
 */
function usersEventsQueue(url: string) {
  return {
    urls: [url],
    queue: USERS_EVENTS_QUEUE,
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': USERS_EVENTS_DLQ,
      },
    },
  };
}

export function usersEventsPublisher(url: string): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: { ...usersEventsQueue(url), persistent: true },
  };
}

// Manual acks for the consumer only: Nest's client listens on RabbitMQ's
// direct reply-to queue, which requires auto-ack.
export function usersEventsConsumer(url: string): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: { ...usersEventsQueue(url), noAck: false, prefetchCount: 10 },
  };
}

/**
 * A message no retry can fix, such as a malformed payload. handleWithRetry
 * sends it straight to the DLQ.
 */
export class InvalidMessageError extends Error {}

// 10 attempts with delays of 1, 2, 4, 8, 16, then 30 s: about 2.5 minutes per
// delivery, far below RabbitMQ's 30-minute acknowledgement timeout.
const ATTEMPTS_PER_DELIVERY = 10;
const FIRST_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;
const logger = new Logger('Messaging');

/**
 * Runs an event handler with manual acks (decision A5). Nest doesn't reject a
 * message when a handler throws, so every path here must ack or nack.
 *
 * An InvalidMessageError goes to the DLQ at once. Any other failure, typically
 * an unreachable database, is retried with exponential backoff; if it still
 * fails, the message goes back to the queue and is retried again on
 * redelivery. It is never dropped, so an outage delays the work but doesn't
 * lose it.
 */
export async function handleWithRetry(
  context: RmqContext,
  handler: () => Promise<void>,
): Promise<void> {
  const channel = context.getChannelRef() as Channel;
  const message = context.getMessage() as Message;
  const pattern = context.getPattern();

  for (let attempt = 1; attempt <= ATTEMPTS_PER_DELIVERY; attempt++) {
    try {
      await handler();
      channel.ack(message);
      return;
    } catch (error) {
      if (error instanceof InvalidMessageError) {
        logger.error(`${pattern} rejected into ${USERS_EVENTS_DLQ}: ${error.message}`);
        await channel.assertQueue(USERS_EVENTS_DLQ, { durable: true });
        channel.nack(message, false, false);
        return;
      }
      logger.warn(
        `${pattern} attempt ${attempt}/${ATTEMPTS_PER_DELIVERY} failed: ${String(error)}`,
      );
      if (attempt < ATTEMPTS_PER_DELIVERY) {
        const delay = Math.min(FIRST_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.warn(`${pattern} still failing after ${ATTEMPTS_PER_DELIVERY} attempts; requeued`);
  channel.nack(message, false, true);
}
