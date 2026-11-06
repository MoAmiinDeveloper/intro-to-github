/**
 * Customer rules: Group -> Entity -> Person. Pure functions so they can be unit tested.
 */

/** A new entity copies the group's sector and owner when it has none of its own. */
export function applyGroupDefaults<T extends { sectorId: string | null; ownerId: string | null }>(
  entity: T,
  group: { sectorId: string | null; ownerId: string | null } | null,
): T {
  if (!group) return entity;
  return { ...entity, sectorId: entity.sectorId ?? group.sectorId, ownerId: entity.ownerId ?? group.ownerId };
}

/**
 * A person can also work with another entity only if both entities are in the same group.
 * Standalone entities (no group) cannot share people.
 */
export function canLinkPerson(
  home: { id: string; groupId: string | null },
  target: { id: string; groupId: string | null },
): boolean {
  return home.id !== target.id && home.groupId !== null && home.groupId === target.groupId;
}

/** Keep only the link targets that are allowed. */
export function allowedLinks(home: { id: string; groupId: string | null }, targets: readonly { id: string; groupId: string | null }[]): string[] {
  return [...new Set(targets.filter((t) => canLinkPerson(home, t)).map((t) => t.id))];
}
