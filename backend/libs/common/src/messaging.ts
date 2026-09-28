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

const ATTEMPTS = 3;
const logger = new Logger('Messaging');

/**
 * Runs an event handler with manual acks: up to 3 attempts, then the message
 * is rejected into the DLQ. Nest doesn't reject a message when a handler
 * throws, so every path here must ack or nack.
 */
export async function handleWithRetry(
  context: RmqContext,
  handler: () => Promise<void>,
): Promise<void> {
  const channel = context.getChannelRef() as Channel;
  const message = context.getMessage() as Message;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      await handler();
      channel.ack(message);
      return;
    } catch (error) {
      logger.warn(
        `${context.getPattern()} attempt ${attempt}/${ATTEMPTS} failed: ${String(error)}`,
      );
      if (attempt < ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }

  await channel.assertQueue(USERS_EVENTS_DLQ, { durable: true });
  channel.nack(message, false, false);
}
