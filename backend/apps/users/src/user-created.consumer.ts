import {
  handleWithRetry,
  InvalidMessageError,
  isBirthDate,
  USER_CREATED,
  USERNAME_PATTERN,
  type UserCreatedEvent,
} from '@app/common';
import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, type RmqContext } from '@nestjs/microservices';
import { isUUID } from 'class-validator';
import { ProfilesService } from './profiles.service.js';

@Controller()
export class UserCreatedConsumer {
  constructor(private readonly profiles: ProfilesService) {}

  // `<string>` selects the untyped overload: Nest 12's typed-event overload
  // types every parameter after the payload as unknown, which rules out @Ctx().
  @EventPattern<string>(USER_CREATED)
  async handle(@Payload() data: unknown, @Ctx() context: RmqContext): Promise<void> {
    await handleWithRetry(context, () =>
      this.profiles.createFromEvent(parseUserCreated(data)),
    );
  }
}

/** Rejects malformed messages; they go straight to the DLQ. */
function parseUserCreated(data: unknown): UserCreatedEvent {
  const event = data as Partial<UserCreatedEvent> | null;
  const valid =
    typeof event?.userId === 'string' &&
    isUUID(event.userId) &&
    (event.username === null ||
      (typeof event.username === 'string' && USERNAME_PATTERN.test(event.username))) &&
    (event.dateOfBirth === null || isBirthDate(event.dateOfBirth));
  if (!valid) {
    throw new InvalidMessageError(`Invalid ${USER_CREATED} payload: ${JSON.stringify(data)}`);
  }
  return event as UserCreatedEvent;
}
