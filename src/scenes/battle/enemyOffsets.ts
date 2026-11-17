/**
 * Screen offsets AiEnemyView adds on top of the pose (pure, no PixiJS). D-K9 (docs/KNEEL_PLAN.md): a floater (or
 * swimmer) already sits on its 2 px bottom margin, so it kneels by drooping in place and sinking `kneelSink` native px,
 * eased with the kneel (0 standing, 1 in the hold: EnemyPoseController.kneelAmount). No sink: 0.
 */
export function kneelSinkPx(sink: number | undefined, amount: number, scale: number): number {
  if (!sink || !(sink > 0) || !(amount > 0)) return 0;
  return Math.round(sink * Math.min(1, amount) * scale);
}
