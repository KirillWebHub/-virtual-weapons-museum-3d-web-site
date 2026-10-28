export interface ProjectedAnnotation { id: string; x: number; y: number; visible: boolean }

/** Hidden or crowded points stay available in the complete, permanent catalogue. */
export function visibleAnnotations(points: readonly ProjectedAnnotation[], width: number, height: number, selected?: string): readonly ProjectedAnnotation[] {
  const ordered = [...points].sort((a, b) => Number(b.id === selected) - Number(a.id === selected));
  const result: ProjectedAnnotation[] = [];
  for (const point of ordered) {
    if (!point.visible || !Number.isFinite(point.x + point.y) || point.x < 22 || point.x > width - 22 || point.y < 22 || point.y > height - 22) continue;
    if (result.some(other => Math.abs(other.x - point.x) < 46 && Math.abs(other.y - point.y) < 46)) continue;
    result.push(point);
  }
  return result;
}
