export function orderMotorsByIds<T extends { id: string }>(
  motors: readonly T[],
  order: readonly string[] = [],
): T[] {
  const positions = new Map<string, number>();
  (Array.isArray(order) ? order : []).forEach((id) => {
    if (typeof id === 'string' && !positions.has(id)) positions.set(id, positions.size);
  });

  return [...motors].sort((first, second) => {
    const firstPosition = positions.get(first.id);
    const secondPosition = positions.get(second.id);
    if (firstPosition === undefined) return secondPosition === undefined ? 0 : 1;
    if (secondPosition === undefined) return -1;
    return firstPosition - secondPosition;
  });
}
