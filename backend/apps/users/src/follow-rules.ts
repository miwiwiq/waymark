export type FollowStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

/** How the viewer relates to a profile. */
export type Relationship = 'self' | 'none' | 'requested' | 'following';

/**
 * Status after a follow request (decision G1): public profiles accept at once,
 * private ones need approval. A request after a rejection counts as a first
 * request, so it follows the profile's current visibility. Repeating a pending
 * or accepted request changes nothing.
 */
export function statusAfterFollow(
  current: FollowStatus | null,
  targetIsPrivate: boolean,
): FollowStatus {
  if (current === 'PENDING' || current === 'ACCEPTED') {
    return current;
  }
  return targetIsPrivate ? 'PENDING' : 'ACCEPTED';
}

/** A rejected request shows as 'none', so the viewer can ask again. */
export function relationshipOf(
  viewerId: string | undefined,
  ownerId: string,
  status: FollowStatus | null,
): Relationship {
  if (viewerId === ownerId) return 'self';
  if (status === 'ACCEPTED') return 'following';
  if (status === 'PENDING') return 'requested';
  return 'none';
}

/** Decision G3: a private profile's posts and follower lists are for accepted followers only. */
export function canViewContent(isPrivate: boolean, relationship: Relationship): boolean {
  return !isPrivate || relationship === 'self' || relationship === 'following';
}
