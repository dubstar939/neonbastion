// Hard-coded path the enemies follow. The map is on a 30x30 grid centered at 0.
// Enemies traverse waypoints from start (spawn) to end (player core).

import * as THREE from "three";

export const PATH_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(-14, 0, -12),
  new THREE.Vector3(-8, 0, -12),
  new THREE.Vector3(-8, 0, -4),
  new THREE.Vector3(2, 0, -4),
  new THREE.Vector3(2, 0, 6),
  new THREE.Vector3(-6, 0, 6),
  new THREE.Vector3(-6, 0, 12),
  new THREE.Vector3(8, 0, 12),
  new THREE.Vector3(8, 0, 0),
  new THREE.Vector3(14, 0, 0),
];

// Width of the path corridor (used to block tower placement)
export const PATH_WIDTH = 2.2;

// Returns true if a point is too close to a path segment
export function isOnPath(x: number, z: number, margin = PATH_WIDTH): boolean {
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    const a = PATH_POINTS[i];
    const b = PATH_POINTS[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    if (len2 === 0) continue;
    let t = ((x - a.x) * dx + (z - a.z) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx;
    const pz = a.z + t * dz;
    const ddx = x - px;
    const ddz = z - pz;
    if (ddx * ddx + ddz * ddz < margin * margin) return true;
  }
  return false;
}

// Total path length (used by enemies for "progress")
export function totalPathLength(): number {
  let total = 0;
  for (let i = 0; i < PATH_POINTS.length - 1; i++) {
    total += PATH_POINTS[i].distanceTo(PATH_POINTS[i + 1]);
  }
  return total;
}
