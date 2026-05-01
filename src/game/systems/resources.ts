// =============================================================
// RESOURCE EXTRACTION SYSTEM
// Mining nodes scattered across the map
// =============================================================

import * as THREE from "three";

export type ResourceType = "metal" | "crystal" | "energy";

export interface MiningNode {
  id: number;
  type: ResourceType;
  x: number;
  z: number;
  amount: number;           // remaining resources
  maxAmount: number;
  mesh: THREE.Group;
  lastMined: number;
}

const NODE_COLORS: Record<ResourceType, number> = {
  metal: 0x556677,
  crystal: 0x00e5ff,
  energy: 0xff2bd6,
};

export function createMiningNode(type: ResourceType, x: number, z: number): MiningNode {
  const group = new THREE.Group();
  const maxAmount = type === "crystal" ? 80 : type === "energy" ? 60 : 120;
  const amount = maxAmount;

  if (type === "metal") {
    // Scrap metal pile
    for (let i = 0; i < 5; i++) {
      const size = 0.4 + Math.random() * 0.3;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(size, size * 0.6, size * 0.8),
        new THREE.MeshStandardMaterial({ color: NODE_COLORS.metal, metalness: 0.7, roughness: 0.5 })
      );
      box.position.set((i % 3 - 1) * 0.35, size * 0.3, Math.floor(i / 3) * 0.4);
      box.rotation.y = Math.random() * 2;
      group.add(box);
    }
  } else if (type === "crystal") {
    // Glowing crystal cluster
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.6, 0),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: NODE_COLORS.crystal,
        emissiveIntensity: 1.8,
        metalness: 0.3,
        roughness: 0.2,
      })
    );
    group.add(core);
    for (let i = 0; i < 4; i++) {
      const shard = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.7, 4),
        new THREE.MeshStandardMaterial({ color: 0xaaffff, emissive: NODE_COLORS.crystal, emissiveIntensity: 1.2 })
      );
      const a = (i / 4) * Math.PI * 2;
      shard.position.set(Math.cos(a) * 0.5, 0.2, Math.sin(a) * 0.5);
      shard.rotation.x = 0.8;
      group.add(shard);
    }
  } else {
    // Energy orb
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 10, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: NODE_COLORS.energy,
        emissiveIntensity: 2.5,
        metalness: 0.1,
        roughness: 0.3,
      })
    );
    group.add(orb);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.06, 6, 16),
      new THREE.MeshBasicMaterial({ color: NODE_COLORS.energy, transparent: true, opacity: 0.6 })
    );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
  }

  // Base plate
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.0, 0.1, 6),
    new THREE.MeshStandardMaterial({ color: 0x0a0a12, metalness: 0.5, roughness: 0.7 })
  );
  base.position.y = 0.05;
  group.add(base);

  group.position.set(x, 0, z);

  return {
    id: Math.floor(Math.random() * 100000),
    type,
    x,
    z,
    amount,
    maxAmount,
    mesh: group,
    lastMined: 0,
  };
}

export function mineNode(node: MiningNode, amount: number = 5): number {
  const now = performance.now();
  if (now - node.lastMined < 120) return 0; // rate limit

  const take = Math.min(amount, node.amount);
  node.amount -= take;
  node.lastMined = now;

  // Dim the emissive when depleted
  if (node.amount <= 0) {
    node.mesh.traverse((c) => {
      const m = (c as any).material;
      if (m && m.emissiveIntensity !== undefined) {
        m.emissiveIntensity = Math.max(0.1, m.emissiveIntensity * 0.3);
      }
    });
  }

  return take;
}
