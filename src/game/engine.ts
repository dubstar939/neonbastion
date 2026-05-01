// =============================================================
// Core game engine: scene, managers, update loop.
// Acts as: GameManager + WaveManager + TowerManager + EnemyManager
// =============================================================

import * as THREE from "three";
import { TOWERS, type TowerKind, type TowerLevelStats } from "./data/towers";
import { ENEMIES, type EnemyDef, buildWaveTable, type WaveDef } from "./data/enemies";
import { PATH_POINTS, totalPathLength, isOnPath } from "./path";
import { buildEnemyMesh, buildTowerMesh } from "./factory";
import { generateCity } from "./city";
import { sfx, playMusic, stopMusic, startAmbience, stopAmbience, initAudio, playTowerSfx } from "./audio";
import { createMiningNode, type MiningNode, mineNode } from "./systems/resources";
import { createUnit, updateUnits, type Unit, type UnitKind } from "./systems/units";
import { applyCrystal, type CrystalType } from "./systems/crystals";
import type { Stats } from "./types";

// ---------- helpers --------------------------------------------------

// Animate any sub-mesh tagged with userData.spinSpeed / pulse / orbit.
// Tags are applied in factory.ts when the mesh is built.
function animateTaggedParts(root: THREE.Object3D, dt: number, t: number) {
  root.traverse((c) => {
    const ud: any = (c as any).userData;
    if (!ud) return;
    if (ud.spinSpeed) {
      c.rotation.z += dt * ud.spinSpeed;
    }
    if (ud.spinChild && ud.spinChild.userData?.spinSpeed) {
      ud.spinChild.rotation.z += dt * ud.spinChild.userData.spinSpeed;
    }
    if (ud.pulse) {
      const k = 1 + Math.sin(t * 4 + c.id) * 0.18;
      c.scale.setScalar(k);
    }
    if (ud.orbit) {
      const o = ud.orbit;
      const r = o.radius ?? 0.7;
      const baseY = o.y ?? c.position.y;
      o.a += dt * (o.speed ?? 1);
      c.position.x = Math.cos(o.a) * r;
      c.position.z = Math.sin(o.a) * r;
      if (o.y !== undefined) c.position.y = baseY + Math.sin(o.a * 1.3) * 0.15;
    }
  });
}

// ---------- Enemy entity --------------------------------------------

interface EnemyEntity {
  id: number;
  def: EnemyDef;
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  armor: number;
  speed: number;
  baseSpeed: number;
  segIndex: number;
  segT: number;        // 0..1 within segment
  totalDistance: number;
  alive: boolean;
  slowUntil: number;
  slowFactor: number;  // 1 - slowPct
  burnUntil: number;
  burnDps: number;
  stunUntil: number;
  shieldRegenAccum: number;
  bounty: number;
  // Boss state
  bossPhase?: number;
  lastSummon?: number;
}

// ---------- Tower entity --------------------------------------------

interface TowerEntity {
  id: number;
  kind: TowerKind;
  level: number;       // 1..5
  group: THREE.Group;
  head?: THREE.Object3D;
  cooldown: number;    // seconds until next shot
  position: THREE.Vector3;
  totalSpent: number;  // for sell value
}

// ---------- Projectile entity ---------------------------------------

interface Projectile {
  id: number;
  mesh: THREE.Object3D;
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  target?: EnemyEntity | null;
  damage: number;
  splashRadius?: number;
  pierce: number;
  hitSet: Set<number>;
  ttl: number;
  homing: boolean;
  burnDps?: number;
  burnDuration?: number;
  slowPct?: number;
  slowDuration?: number;
  empStun?: number;
  armorShred?: number;
  chainTargets?: number;
  color: number;
  isBeam?: boolean;
  beamLifetime?: number;
}

// ---------- Engine --------------------------------------------------

export interface EngineCallbacks {
  onStats: (stats: Stats) => void;
  onPlacedChange: (placed: { id: number; kind: TowerKind; level: number; x: number; z: number }[]) => void;
  onSelectionChange: (selectedId: number | null) => void;
}

export class GameEngine {
  // three.js
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  container: HTMLElement;
  raycaster = new THREE.Raycaster();
  ground!: THREE.Mesh;
  pathLine!: THREE.Line;
  hoverMarker!: THREE.Mesh;
  rangeRing!: THREE.Mesh;

  // game state
  callbacks: EngineCallbacks;
  enemies: EnemyEntity[] = [];
  towers: TowerEntity[] = [];
  units: Unit[] = [];
  miningNodes: MiningNode[] = [];
  projectiles: Projectile[] = [];
  projectilePool: Projectile[] = [];
  enemyPool: Map<string, EnemyEntity[]> = new Map();
  nextId = 1;

  waves: WaveDef[] = [];
  currentWaveIndex = -1; // 0-based
  spawnQueue: { def: EnemyDef; spawnAt: number; hpMult: number; speedMult: number; armorBonus: number }[] = [];
  waveActive = false;
  intermissionTime = 0;
  intermissionDuration = 8; // seconds before auto-start

  state: "menu" | "playing" | "paused" | "won" | "lost" = "menu";
  lives = 25;
  cores = 250;
  killCount = 0;
  damageDealt = 0;
  totalLength: number;

  // input/build
  selectedKindToBuild: TowerKind | null = null;
  selectedTowerId: number | null = null;
  selectedUnitKind: UnitKind | null = null;
  crystalMode: boolean = false;
  hoverGrid: { x: number; z: number; valid: boolean } | null = null;
  speedMult = 1;

  // timing
  lastTime = 0;
  rafId = 0;
  clock = new THREE.Clock();

  // pointer
  pointer = new THREE.Vector2();
  resizeObs?: ResizeObserver;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.totalLength = totalPathLength();
    this.waves = buildWaveTable();

    // scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05050d);
    this.scene.fog = new THREE.Fog(0x05050d, 25, 70);

    // camera
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);
    this.camera.position.set(0, 26, 26);
    this.camera.lookAt(0, 0, 0);

    // renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    this.buildWorld();
    this.bindEvents();

    this.resizeObs = new ResizeObserver(() => this.onResize());
    this.resizeObs.observe(container);

    this.lastTime = performance.now();
    this.tick();

    // Initialize audio on first user interaction
    const initOnce = () => { initAudio(); this.renderer.domElement.removeEventListener("pointerdown", initOnce); };
    this.renderer.domElement.addEventListener("pointerdown", initOnce);

    this.emitStats();
  }

  // ---------- world setup -------------------------------------------

  private buildWorld() {
    // ambient + key lights
    this.scene.add(new THREE.AmbientLight(0x4060a0, 0.35));
    const key = new THREE.DirectionalLight(0xff66ff, 0.7);
    key.position.set(10, 20, 10);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x00e5ff, 0.8);
    rim.position.set(-15, 12, -10);
    this.scene.add(rim);

    // ground - dark gridded plate
    const groundGeo = new THREE.PlaneGeometry(50, 50, 1, 1);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a18, metalness: 0.3, roughness: 0.9,
    });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.scene.add(this.ground);

    // grid
    const grid = new THREE.GridHelper(50, 50, 0x00e5ff, 0x111133);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.25;
    grid.position.y = 0.01;
    this.scene.add(grid);

    // path visualization (glowing tube)
    const curve = new THREE.CatmullRomCurve3(PATH_POINTS, false, "catmullrom", 0.1);
    const tubeGeo = new THREE.TubeGeometry(curve, 200, 0.85, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x140a2a, emissive: 0x6a00ff, emissiveIntensity: 0.7,
      metalness: 0.2, roughness: 0.6,
    });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.position.y = 0.02;
    this.scene.add(tube);

    // path edge line
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 200; i++) {
      const p = curve.getPoint(i / 199);
      p.y = 0.05;
      points.push(p);
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({ color: 0xff2bd6 });
    this.pathLine = new THREE.Line(lineGeo, lineMat);
    this.scene.add(this.pathLine);

    // start spawn pad
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.7, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x002233, emissive: 0x00e5ff, emissiveIntensity: 1 })
    );
    pad.position.copy(PATH_POINTS[0]);
    pad.position.y = 0.15;
    this.scene.add(pad);

    // core (player base) at end
    const coreBase = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 2.4, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x2a0822, emissive: 0xff2bd6, emissiveIntensity: 0.8 })
    );
    coreBase.position.copy(PATH_POINTS[PATH_POINTS.length - 1]);
    coreBase.position.y = 0.2;
    this.scene.add(coreBase);

    const coreOrb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.9, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff2bd6, emissiveIntensity: 2.5 })
    );
    coreOrb.position.copy(PATH_POINTS[PATH_POINTS.length - 1]);
    coreOrb.position.y = 1.2;
    this.scene.add(coreOrb);
    (this as any).coreOrb = coreOrb;

    // ── Procedural city with zoning ──
    generateCity(this.scene);

    // Add mining nodes (metal, crystal, energy)
    const minePositions = [
      [-18, -8], [22, -12], [-25, 18], [18, 22], [-10, 28], [12, -25],
    ];
    minePositions.forEach(([x, z], i) => {
      const type = (["metal", "crystal", "energy"] as const)[i % 3];
      const node = createMiningNode(type, x, z);
      this.scene.add(node.mesh);
      this.miningNodes.push(node);
    });

    // rain particles
    const rainCount = 1500;
    const rainGeo = new THREE.BufferGeometry();
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 80;
      rainPos[i * 3 + 1] = Math.random() * 30;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
    rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
    const rainPoints = new THREE.Points(rainGeo, new THREE.PointsMaterial({
      color: 0x66ccff, size: 0.06, transparent: true, opacity: 0.4,
    }));
    this.scene.add(rainPoints);
    (this as any).rainPoints = rainPoints;

    // hover marker (placement cell)
    const hoverGeo = new THREE.BoxGeometry(1.8, 0.05, 1.8);
    const hoverMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88, emissive: 0x00ff88, emissiveIntensity: 1.2,
      transparent: true, opacity: 0.45,
    });
    this.hoverMarker = new THREE.Mesh(hoverGeo, hoverMat);
    this.hoverMarker.position.y = 0.04;
    this.hoverMarker.visible = false;
    this.scene.add(this.hoverMarker);

    // range ring
    const rangeGeo = new THREE.RingGeometry(0.95, 1.0, 48);
    const rangeMat = new THREE.MeshBasicMaterial({
      color: 0x00ffd5, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
    });
    this.rangeRing = new THREE.Mesh(rangeGeo, rangeMat);
    this.rangeRing.rotation.x = -Math.PI / 2;
    this.rangeRing.position.y = 0.06;
    this.rangeRing.visible = false;
    this.scene.add(this.rangeRing);
  }

  // ---------- input -------------------------------------------------

  private bindEvents() {
    const dom = this.renderer.domElement;
    dom.addEventListener("pointermove", this.onPointerMove);
    dom.addEventListener("pointerdown", this.onPointerDown);
    dom.addEventListener("pointerup", this.onPointerUp);
    dom.addEventListener("wheel", this.onWheel, { passive: false });
    dom.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // camera drag state
  private dragging = false;
  private dragButton = 0;
  private dragLastX = 0;
  private dragLastY = 0;
  private dragMoved = false;

  private onPointerUp = (e: PointerEvent) => {
    const wasDragging = this.dragging;
    const moved = this.dragMoved;
    this.dragging = false;
    this.dragMoved = false;
    // right-click without drag = cancel build / deselect
    if (wasDragging && e.button === 2 && !moved) {
      this.selectedKindToBuild = null;
      this.selectTower(null);
      this.hoverMarker.visible = false;
      this.rangeRing.visible = false;
    }
  };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.camTargetDist = Math.max(14, Math.min(55, this.camTargetDist + e.deltaY * 0.03));
  };

  private updatePointer(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerMove = (e: PointerEvent) => {
    this.updatePointer(e);

    // camera drag (right or middle mouse) — orbit yaw/pitch
    if (this.dragging && (this.dragButton === 2 || this.dragButton === 1)) {
      const dx = e.clientX - this.dragLastX;
      const dy = e.clientY - this.dragLastY;
      this.dragLastX = e.clientX;
      this.dragLastY = e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 1) this.dragMoved = true;
      this.camTargetYaw -= dx * 0.005;
      this.camTargetPitch = Math.max(0.25, Math.min(1.4, this.camTargetPitch - dy * 0.005));
      return;
    }

    if (!this.selectedKindToBuild) {
      this.hoverMarker.visible = false;
      this.hoverGrid = null;
      return;
    }
    const hit = this.raycastGround();
    if (!hit) {
      this.hoverMarker.visible = false;
      return;
    }
    const gx = Math.round(hit.x);
    const gz = Math.round(hit.z);
    const valid = this.canPlaceAt(gx, gz);
    this.hoverMarker.position.set(gx, 0.04, gz);
    this.hoverMarker.visible = true;
    (this.hoverMarker.material as THREE.MeshStandardMaterial).color.setHex(valid ? 0x00ff88 : 0xff3355);
    (this.hoverMarker.material as THREE.MeshStandardMaterial).emissive.setHex(valid ? 0x00ff88 : 0xff3355);
    this.hoverGrid = { x: gx, z: gz, valid };

    // preview range
    if (valid) {
      const def = TOWERS[this.selectedKindToBuild];
      const stats = def.levels[0];
      this.rangeRing.position.set(gx, 0.06, gz);
      this.rangeRing.scale.setScalar(stats.range);
      this.rangeRing.visible = true;
      (this.rangeRing.material as THREE.MeshBasicMaterial).color.setHex(def.color);
    } else {
      this.rangeRing.visible = false;
    }
  };

  private onPointerDown = (e: PointerEvent) => {
    this.updatePointer(e);

    // start camera drag on right or middle mouse
    if (e.button === 1 || e.button === 2) {
      this.dragging = true;
      this.dragButton = e.button;
      this.dragLastX = e.clientX;
      this.dragLastY = e.clientY;
      this.dragMoved = false;
      // For right click, defer "cancel" decision to pointerup
      if (e.button === 2) return;
      return;
    }

    if (this.selectedKindToBuild) {
      const hit = this.raycastGround();
      if (!hit) return;
      const gx = Math.round(hit.x);
      const gz = Math.round(hit.z);
      this.tryBuild(this.selectedKindToBuild, gx, gz);
      return;
    }
    // try select existing tower
    const hit = this.raycastTower();
    if (hit !== null) {
      this.selectTower(hit);
    } else {
      this.selectTower(null);
    }
  };

  private raycastGround(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObject(this.ground);
    if (intersects.length === 0) return null;
    return intersects[0].point;
  }

  private raycastTower(): number | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const t of this.towers) {
      const intersects = this.raycaster.intersectObject(t.group, true);
      if (intersects.length > 0) return t.id;
    }
    return null;
  }

  // ---------- placement / build ------------------------------------

  setBuildKind(kind: TowerKind | null) {
    this.selectedKindToBuild = kind;
    if (kind === null) {
      this.hoverMarker.visible = false;
      if (this.selectedTowerId === null) this.rangeRing.visible = false;
    }
    if (kind !== null) {
      this.selectTower(null);
    }
  }

  canPlaceAt(x: number, z: number): boolean {
    if (Math.abs(x) > 14 || Math.abs(z) > 14) return false;
    if (isOnPath(x, z, 1.5)) return false;
    for (const t of this.towers) {
      if (Math.abs(t.position.x - x) < 1.2 && Math.abs(t.position.z - z) < 1.2) return false;
    }
    if (this.selectedKindToBuild) {
      const cost = TOWERS[this.selectedKindToBuild].levels[0].cost;
      if (this.cores < cost) return false;
    }
    return true;
  }

  tryBuild(kind: TowerKind, x: number, z: number): boolean {
    if (!this.canPlaceAt(x, z)) return false;
    const def = TOWERS[kind];
    const cost = def.levels[0].cost;
    this.cores -= cost;
    const group = buildTowerMesh(kind, 1);
    group.position.set(x, 0, z);
    this.scene.add(group);
    const tower: TowerEntity = {
      id: this.nextId++,
      kind,
      level: 1,
      group,
      head: (group as any).userData.head,
      cooldown: 0,
      position: new THREE.Vector3(x, 0, z),
      totalSpent: cost,
    };
    this.towers.push(tower);
    this.emitPlaced();
    this.emitStats();
    this.selectTower(tower.id);
    return true;
  }

  tryPlaceUnit(kind: UnitKind, x: number, z: number): boolean {
    if (isOnPath(x, z, 1.5)) return false;
    const cost = kind === "colossus" ? 180 : kind === "marauder" ? 120 : 60;
    if (this.cores < cost) return false;
    this.cores -= cost;

    const unit = createUnit(kind, 1);
    unit.mesh.position.set(x, unit.mesh.position.y, z);
    this.scene.add(unit.mesh);
    this.units.push(unit);
    this.emitStats();
    return true;
  }

  selectTower(id: number | null) {
    this.selectedTowerId = id;
    if (id === null) {
      this.rangeRing.visible = false;
    } else {
      const t = this.towers.find((x) => x.id === id);
      if (t) {
        const def = TOWERS[t.kind];
        const stats = def.levels[t.level - 1];
        this.rangeRing.position.set(t.position.x, 0.06, t.position.z);
        this.rangeRing.scale.setScalar(stats.range);
        this.rangeRing.visible = true;
        (this.rangeRing.material as THREE.MeshBasicMaterial).color.setHex(def.color);
      }
    }
    this.callbacks.onSelectionChange(id);
  }

  upgradeSelected(): boolean {
    if (this.selectedTowerId === null) return false;
    const t = this.towers.find((x) => x.id === this.selectedTowerId);
    if (!t) return false;
    if (t.level >= 5) return false;
    const def = TOWERS[t.kind];
    const cost = def.levels[t.level].cost; // next level cost
    if (this.cores < cost) return false;
    this.cores -= cost;
    t.level += 1;
    t.totalSpent += cost;
    // rebuild mesh to show upgrades
    const oldPos = t.group.position.clone();
    this.scene.remove(t.group);
    const ng = buildTowerMesh(t.kind, t.level);
    ng.position.copy(oldPos);
    this.scene.add(ng);
    t.group = ng;
    t.head = (ng as any).userData.head;
    // refresh range ring
    const stats = def.levels[t.level - 1];
    this.rangeRing.scale.setScalar(stats.range);
    this.rangeRing.visible = true;
    this.emitPlaced();
    this.emitStats();
    sfx.upgradeConfirm();

    // Visual upgrade pulse showing new range
    this.showUpgradePulse(t.position.x, t.position.z, def.color, stats.range);
    return true;
  }

  /** Apply a crystal to the selected tower (impactful secondary upgrade) */
  applyCrystalToSelected(type: CrystalType): boolean {
    if (this.selectedTowerId === null) return false;
    const t = this.towers.find((x) => x.id === this.selectedTowerId);
    if (!t) return false;
    const cost = 45 + t.level * 15;
    if (this.cores < cost) return false;

    this.cores -= cost;
    const effect = applyCrystal(t.level, type);

    // Store crystal effect on the tower entity (simple approach)
    (t as any).crystal = type;
    (t as any).crystalEffect = effect;

    sfx.upgradeConfirm();
    this.showUpgradePulse(t.position.x, t.position.z, 0xffffff, 3);
    this.emitStats();
    return true;
  }

  sellSelected(): boolean {
    if (this.selectedTowerId === null) return false;
    const idx = this.towers.findIndex((x) => x.id === this.selectedTowerId);
    if (idx < 0) return false;
    const t = this.towers[idx];
    const refund = Math.floor(t.totalSpent * 0.6);
    this.cores += refund;
    this.scene.remove(t.group);
    this.towers.splice(idx, 1);
    this.selectTower(null);
    this.emitPlaced();
    this.emitStats();
    return true;
  }

  // ---------- waves -------------------------------------------------

  difficulty: "recruit" | "operative" | "nightmare" = "operative";

  startGame(difficulty: "recruit" | "operative" | "nightmare" = "operative") {
    this.difficulty = difficulty;
    // reset to defaults first
    for (const t of this.towers) this.scene.remove(t.group);
    for (const e of this.enemies) this.scene.remove(e.mesh);
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.spawnQueue = [];
    this.killCount = 0;
    this.damageDealt = 0;
    if (difficulty === "recruit") { this.lives = 40; this.cores = 400; }
    else if (difficulty === "operative") { this.lives = 25; this.cores = 250; }
    else { this.lives = 15; this.cores = 200; }
    this.state = "playing";
    this.currentWaveIndex = -1;
    this.intermissionTime = 5;
    this.emitPlaced();
    this.emitStats();
    // Audio
    initAudio();
    playMusic("combat");
    startAmbience();
  }

  startNextWave() {
    if (this.state !== "playing") return;
    if (this.currentWaveIndex >= this.waves.length - 1) return;
    this.currentWaveIndex += 1;
    const wave = this.waves[this.currentWaveIndex];
    this.waveActive = true;
    this.intermissionTime = 0;
    const now = performance.now() / 1000;
    let acc = 0;
    this.spawnQueue = [];
    for (const s of wave.spawns) {
      const def = ENEMIES[s.enemyKind];
      for (let i = 0; i < s.count; i++) {
        this.spawnQueue.push({
          def,
          spawnAt: now + acc,
          hpMult: s.hpMult,
          speedMult: s.speedMult,
          armorBonus: s.armorBonus,
        });
        acc += s.intervalMs / 1000;
      }
    }
    // Audio
    if (wave.isBoss) {
      playMusic("boss");
      sfx.bossRoar();
    } else {
      sfx.waveStart();
    }
    this.emitStats();
  }

  setSpeed(mult: number) {
    this.speedMult = mult;
  }

  pause() { if (this.state === "playing") { this.state = "paused"; this.emitStats(); } }
  resume() { if (this.state === "paused") { this.state = "playing"; this.emitStats(); } }
  reset() {
    // remove all towers / enemies / projectiles
    for (const t of this.towers) this.scene.remove(t.group);
    for (const e of this.enemies) this.scene.remove(e.mesh);
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.spawnQueue = [];
    this.cores = 250;
    this.lives = 25;
    this.killCount = 0;
    this.damageDealt = 0;
    this.currentWaveIndex = -1;
    this.waveActive = false;
    this.intermissionTime = 0;
    this.state = "menu";
    this.selectedKindToBuild = null;
    this.selectedTowerId = null;
    this.rangeRing.visible = false;
    this.hoverMarker.visible = false;
    this.emitPlaced();
    this.emitStats();
    // Audio
    stopMusic();
    stopAmbience();
  }

  // ---------- enemy spawn ------------------------------------------

  private spawnEnemy(def: EnemyDef, hpMult: number, speedMult: number, armorBonus: number) {
    const mesh = buildEnemyMesh(def);
    mesh.position.copy(PATH_POINTS[0]);
    if (def.traits.includes("flying") || def.shape === "hover" || def.shape === "drone") {
      mesh.position.y = 1.4;
    }
    // record original emissive intensity on each material for hit-flash restore
    mesh.traverse((c) => {
      const m = (c as any).material;
      if (m && m.emissiveIntensity !== undefined) {
        (c as any).userData._origEmI = m.emissiveIntensity;
      }
    });
    this.scene.add(mesh);
    const diffHpMult = this.difficulty === "recruit" ? 0.75 : this.difficulty === "nightmare" ? 1.4 : 1.0;
    const diffSpdMult = this.difficulty === "recruit" ? 0.9 : this.difficulty === "nightmare" ? 1.15 : 1.0;
    const hp = Math.round(def.baseHp * hpMult * diffHpMult);
    const e: EnemyEntity = {
      id: this.nextId++,
      def,
      mesh,
      hp,
      maxHp: hp,
      shield: def.shield ? Math.round(def.shield * hpMult * diffHpMult) : 0,
      maxShield: def.shield ? Math.round(def.shield * hpMult * diffHpMult) : 0,
      armor: def.baseArmor + armorBonus,
      speed: def.baseSpeed * speedMult * diffSpdMult,
      baseSpeed: def.baseSpeed * speedMult * diffSpdMult,
      segIndex: 0,
      segT: 0,
      totalDistance: 0,
      alive: true,
      slowUntil: 0,
      slowFactor: 1,
      burnUntil: 0,
      burnDps: 0,
      stunUntil: 0,
      shieldRegenAccum: 0,
      bounty: def.bounty,
      bossPhase: def.traits.includes("boss") ? 1 : undefined,
      lastSummon: 0,
    };
    this.enemies.push(e);
  }

  // ---------- update loop ------------------------------------------

  private tick = () => {
    this.rafId = requestAnimationFrame(this.tick);
    const now = performance.now();
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1;

    if (this.state === "playing") {
      const sdt = dt * this.speedMult;
      this.updateWaves(sdt);
      this.updateEnemies(sdt);
      this.updateTowers(sdt);
      this.updateProjectiles(sdt);
      this.updateBoss(sdt);
      this.updateUnits(sdt);
      this.checkEndConditions();
    }
    this.updateAesthetics(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private updateAesthetics(dt: number) {
    const t = this.clock.getElapsedTime();
    if ((this as any).coreOrb) {
      (this as any).coreOrb.rotation.y += dt * 0.6;
      (this as any).coreOrb.rotation.x += dt * 0.3;
      const s = 1 + Math.sin(t * 2) * 0.08;
      (this as any).coreOrb.scale.setScalar(s);
    }

    // animate every tower's tagged sub-parts
    for (const tw of this.towers) {
      if (tw.group) animateTaggedParts(tw.group, dt, t);
      // evolution aura ring spin
      const aura = (tw.group as any)?.userData?.aura;
      if (aura) aura.rotation.z += dt * 0.6;
    }

    // animate enemy parts (titan halos, hover rings, etc.)
    for (const e of this.enemies) {
      animateTaggedParts(e.mesh, dt, t);
      if (e.def.shape === "drone" || e.def.shape === "hover" || e.def.traits.includes("flying")) {
        const baseY = e.def.shape === "hover" ? 0.4 : 1.2;
        e.mesh.position.y = baseY + Math.sin(t * 3 + e.id) * 0.15;
      }
      // walker / tank slight bob to simulate stomp
      if (e.def.shape === "walker") {
        e.mesh.position.y = Math.abs(Math.sin(t * 6 + e.id)) * 0.05;
      }
      // titan slow rotation in place
      if (e.def.traits.includes("boss")) {
        e.mesh.rotation.y += dt * 0.15;
      }
      // hit-flash decay
      if ((e as any).hitFlash > 0) {
        (e as any).hitFlash -= dt * 4;
        const k = Math.max(0, (e as any).hitFlash);
        e.mesh.traverse((c) => {
          const m = (c as any).material;
          if (m && m.emissiveIntensity !== undefined && (c as any).userData._origEmI !== undefined) {
            m.emissiveIntensity = (c as any).userData._origEmI + k * 3;
          }
        });
      }
    }

    // city ambient glow flicker
    if ((this as any).cityLights) {
      for (const light of (this as any).cityLights) {
        light.material.emissiveIntensity = light.userData.baseEm + Math.sin(t * light.userData.f + light.userData.p) * 0.15;
      }
    }

    // rain particles (simple shader-less point system)
    if ((this as any).rainPoints) {
      const positions = (this as any).rainPoints.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] -= 25 * dt;
        if (positions[i + 1] < 0) {
          positions[i + 1] = 30;
          positions[i] = (Math.random() - 0.5) * 80;
          positions[i + 2] = (Math.random() - 0.5) * 80;
        }
      }
      (this as any).rainPoints.geometry.attributes.position.needsUpdate = true;
    }

    // damped camera orbit (input-driven)
    this.updateCamera(dt);
  }

  // smooth camera orbit
  private camYaw = 0;
  private camPitch = 0.95;
  private camDist = 32;
  private camTargetYaw = 0;
  private camTargetPitch = 0.95;
  private camTargetDist = 32;

  private updateCamera(dt: number) {
    this.camYaw += (this.camTargetYaw - this.camYaw) * Math.min(1, dt * 6);
    this.camPitch += (this.camTargetPitch - this.camPitch) * Math.min(1, dt * 6);
    this.camDist += (this.camTargetDist - this.camDist) * Math.min(1, dt * 6);
    const cy = Math.max(0.3, Math.min(1.4, this.camPitch));
    const x = Math.sin(this.camYaw) * Math.cos(cy) * this.camDist;
    const y = Math.sin(cy) * this.camDist;
    const z = Math.cos(this.camYaw) * Math.cos(cy) * this.camDist;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, 0);
  }

  private updateWaves(dt: number) {
    if (this.waveActive) {
      const now = performance.now() / 1000;
      while (this.spawnQueue.length && this.spawnQueue[0].spawnAt <= now) {
        const s = this.spawnQueue.shift()!;
        this.spawnEnemy(s.def, s.hpMult, s.speedMult, s.armorBonus);
      }
      if (this.spawnQueue.length === 0 && this.enemies.length === 0) {
        // wave finished
        const wave = this.waves[this.currentWaveIndex];
        this.cores += wave.reward;
        this.waveActive = false;
        if (this.currentWaveIndex >= this.waves.length - 1) {
          this.state = "won";
          stopMusic();
          sfx.waveComplete();
        } else {
          this.intermissionTime = this.intermissionDuration;
          sfx.waveComplete();
          // Switch back to combat music if we just finished a boss
          if (wave.isBoss) playMusic("combat");
        }
        this.emitStats();
      }
    } else if (this.intermissionTime > 0) {
      this.intermissionTime -= dt;
      if (this.intermissionTime <= 0) {
        this.intermissionTime = 0;
        this.startNextWave();
      }
      // emit periodically so timer ticks down in UI
      if (Math.random() < 0.1) this.emitStats();
    }
  }

  private updateEnemies(dt: number) {
    const now = performance.now() / 1000;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) {
        this.scene.remove(e.mesh);
        this.enemies.splice(i, 1);
        continue;
      }
      // status effects
      if (e.slowUntil > now) {
        e.speed = e.baseSpeed * e.slowFactor;
      } else {
        e.speed = e.baseSpeed;
        e.slowFactor = 1;
      }
      const stunned = e.stunUntil > now;
      // burn damage
      if (e.burnUntil > now && e.burnDps > 0) {
        this.damageEnemy(e, e.burnDps * dt, true);
        if (!e.alive) continue;
      }
      // shield regen
      if (e.maxShield > 0 && e.shield < e.maxShield && e.def.traits.includes("regen")) {
        e.shieldRegenAccum += dt;
        if (e.shieldRegenAccum > 0.5) {
          e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.02);
          e.shieldRegenAccum = 0;
        }
      }
      // hp regen for regen units
      if (e.def.traits.includes("regen") && e.hp < e.maxHp && !e.def.traits.includes("boss")) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.005 * dt);
      }
      // movement
      if (!stunned) {
        let move = e.speed * dt;
        while (move > 0 && e.segIndex < PATH_POINTS.length - 1) {
          const a = PATH_POINTS[e.segIndex];
          const b = PATH_POINTS[e.segIndex + 1];
          const segLen = a.distanceTo(b);
          const remaining = segLen * (1 - e.segT);
          if (move < remaining) {
            e.segT += move / segLen;
            move = 0;
          } else {
            move -= remaining;
            e.segIndex += 1;
            e.segT = 0;
            if (e.segIndex >= PATH_POINTS.length - 1) {
              // reached the core
              this.lives -= e.def.damageToCore;
              e.alive = false;
              this.scene.remove(e.mesh);
              this.enemies.splice(i, 1);
              this.emitStats();
              break;
            }
          }
        }
        if (e.alive && e.segIndex < PATH_POINTS.length - 1) {
          const a = PATH_POINTS[e.segIndex];
          const b = PATH_POINTS[e.segIndex + 1];
          const x = a.x + (b.x - a.x) * e.segT;
          const z = a.z + (b.z - a.z) * e.segT;
          e.mesh.position.x = x;
          e.mesh.position.z = z;
          // face direction
          e.mesh.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        }
      }
      // recompute total distance for tower targeting (largest progress = first)
      let acc = 0;
      for (let s = 0; s < e.segIndex; s++) acc += PATH_POINTS[s].distanceTo(PATH_POINTS[s + 1]);
      if (e.segIndex < PATH_POINTS.length - 1) {
        acc += PATH_POINTS[e.segIndex].distanceTo(PATH_POINTS[e.segIndex + 1]) * e.segT;
      }
      e.totalDistance = acc;
    }
  }

  // ---------- towers fire ------------------------------------------

  private updateTowers(dt: number) {
    for (const t of this.towers) {
      const def = TOWERS[t.kind];
      const stats = def.levels[t.level - 1];
      t.cooldown -= dt;
      // find target
      const target = this.acquireTarget(t.position, stats.range, t.kind);
      if (target && t.head) {
        // aim head at target
        const dx = target.mesh.position.x - t.position.x;
        const dz = target.mesh.position.z - t.position.z;
        t.head.rotation.y = Math.atan2(dx, dz);
      }
      if (t.cooldown > 0) continue;
      if (!target) continue;
      t.cooldown = 1 / stats.fireRate;
      this.fire(t, target, def, stats);
    }
  }

  private acquireTarget(from: THREE.Vector3, baseRange: number, kind: TowerKind): EnemyEntity | null {
    // Apply crystal range bonus if present
    let range = baseRange;
    const selected = this.towers.find(t => t.id === this.selectedTowerId);
    // For simplicity we check the firing tower later; here we just use base range for now

    let best: EnemyEntity | null = null;
    let bestProgress = -1;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.def.traits.includes("stealth") && kind !== "emp" && kind !== "quantum") continue;
      const dx = e.mesh.position.x - from.x;
      const dz = e.mesh.position.z - from.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > range * range) continue;
      if (e.totalDistance > bestProgress) {
        bestProgress = e.totalDistance;
        best = e;
      }
    }
    return best;
  }

  private fire(t: TowerEntity, target: EnemyEntity, def: typeof TOWERS[TowerKind], stats: TowerLevelStats) {
    const start = t.position.clone();
    start.y = 1.1;
    const end = target.mesh.position.clone();

    // Play tower fire sound
    playTowerSfx(t.kind);

    // Apply crystal effects if present
    let finalDamage = stats.damage;
    let finalRange = stats.range;
    const crystal = (t as any).crystalEffect;
    if (crystal) {
      finalDamage *= crystal.multiplier || 1;
      finalRange += crystal.rangeBonus || 0;
      if (crystal.fireRateMult) {
        // fire rate is handled via cooldown reduction
        t.cooldown *= (2 - crystal.fireRateMult); // rough approximation
      }
    }

    if (t.kind === "quantum") {
      const radius = (stats.splashRadius || 7) + (crystal?.rangeBonus || 0);
      const pulse = this.makePulseMesh(finalRange, def.color);
      pulse.position.copy(t.position);
      pulse.position.y = 0.05;
      this.scene.add(pulse);
      setTimeout(() => this.scene.remove(pulse), 400);

      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = e.mesh.position.x - t.position.x;
        const dz = e.mesh.position.z - t.position.z;
        if (dx * dx + dz * dz <= radius * radius) {
          this.damageEnemy(e, finalDamage);
          if (stats.slowPct) {
            e.slowFactor = Math.min(e.slowFactor, 1 - stats.slowPct);
            e.slowUntil = performance.now() / 1000 + (stats.slowDuration || 1);
          }
          if (stats.armorShred) e.armor = Math.max(0, e.armor - stats.armorShred);
        }
      }
      return;
    }

    if (t.kind === "laser") {
      // beam
      const beam = this.makeBeam(start, end, def.color);
      this.scene.add(beam);
      setTimeout(() => this.scene.remove(beam), 120);
      this.damageEnemy(target, stats.damage);
      if (stats.burnDps) {
        target.burnDps = Math.max(target.burnDps, stats.burnDps);
        target.burnUntil = performance.now() / 1000 + (stats.burnDuration || 2);
      }
      // chain to additional targets
      if (stats.chainTargets && stats.chainTargets > 1) {
        let last = target;
        const hit = new Set<number>([target.id]);
        for (let i = 1; i < stats.chainTargets; i++) {
          let next: EnemyEntity | null = null;
          let bestD = 6 * 6;
          for (const e of this.enemies) {
            if (!e.alive || hit.has(e.id)) continue;
            const dx = e.mesh.position.x - last.mesh.position.x;
            const dz = e.mesh.position.z - last.mesh.position.z;
            const d2 = dx * dx + dz * dz;
            if (d2 < bestD) { bestD = d2; next = e; }
          }
          if (!next) break;
          const b2 = this.makeBeam(last.mesh.position, next.mesh.position, def.color);
          this.scene.add(b2);
          setTimeout(() => this.scene.remove(b2), 120);
          this.damageEnemy(next, stats.damage * 0.7);
          if (stats.burnDps) {
            next.burnDps = Math.max(next.burnDps, stats.burnDps);
            next.burnUntil = performance.now() / 1000 + (stats.burnDuration || 2);
          }
          hit.add(next.id);
          last = next;
        }
      }
      return;
    }

    if (t.kind === "railgun") {
      // instant pierce line
      const beam = this.makeBeam(start, end.clone().setY(1.0).add(end.clone().sub(start).normalize().multiplyScalar(8)), def.color, 0.18);
      this.scene.add(beam);
      setTimeout(() => this.scene.remove(beam), 200);
      // damage in line
      const dir = end.clone().sub(start).setY(0).normalize();
      const hits: EnemyEntity[] = [];
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const v = new THREE.Vector3(e.mesh.position.x - t.position.x, 0, e.mesh.position.z - t.position.z);
        const along = v.dot(dir);
        if (along < 0 || along > stats.range + 6) continue;
        const perp = v.clone().sub(dir.clone().multiplyScalar(along)).length();
        if (perp < 0.6) hits.push(e);
      }
      hits.sort((a, b) => a.mesh.position.distanceToSquared(t.position) - b.mesh.position.distanceToSquared(t.position));
      const max = stats.pierce ?? 1;
      for (let i = 0; i < Math.min(hits.length, max); i++) {
        if (stats.armorShred) hits[i].armor = Math.max(0, hits[i].armor - stats.armorShred);
        this.damageEnemy(hits[i], stats.damage);
      }
      return;
    }

    // projectile-based: pulse, plasma, nano, emp
    const proj = this.acquireProjectile();
    proj.alive = true;
    proj.pos.copy(start);
    proj.target = target;
    proj.damage = stats.damage;
    proj.splashRadius = stats.splashRadius;
    proj.pierce = stats.pierce ?? 0;
    proj.hitSet = new Set();
    proj.ttl = 3;
    proj.homing = t.kind === "nano" || t.kind === "emp";
    proj.burnDps = stats.burnDps;
    proj.burnDuration = stats.burnDuration;
    proj.slowPct = stats.slowPct;
    proj.slowDuration = stats.slowDuration;
    proj.empStun = stats.empStunDuration;
    proj.armorShred = stats.armorShred;
    proj.chainTargets = stats.chainTargets;
    proj.color = def.color;
    proj.isBeam = false;

    const speed = t.kind === "plasma" ? 14 : t.kind === "nano" ? 18 : t.kind === "emp" ? 16 : 28;
    const dir = end.clone().sub(start).normalize();
    proj.vel.copy(dir).multiplyScalar(speed);

    // make/replace mesh
    const meshGeoSize = t.kind === "plasma" ? 0.32 : t.kind === "emp" ? 0.28 : t.kind === "nano" ? 0.18 : 0.14;
    if (!proj.mesh || (proj.mesh as any).userData.kind !== t.kind) {
      if (proj.mesh) this.scene.remove(proj.mesh);
      const geo = new THREE.SphereGeometry(meshGeoSize, 8, 6);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff, emissive: def.color, emissiveIntensity: 3,
      });
      proj.mesh = new THREE.Mesh(geo, mat);
      (proj.mesh as any).userData.kind = t.kind;
    }
    proj.mesh.position.copy(start);
    if (!proj.mesh.parent) this.scene.add(proj.mesh);
    this.projectiles.push(proj);
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (!p.alive) {
        if (p.mesh.parent) this.scene.remove(p.mesh);
        this.releaseProjectile(p);
        this.projectiles.splice(i, 1);
        continue;
      }
      p.ttl -= dt;
      if (p.ttl <= 0) {
        p.alive = false;
        continue;
      }
      // homing
      if (p.homing && p.target && p.target.alive) {
        const dir = p.target.mesh.position.clone().sub(p.pos).normalize();
        const speed = p.vel.length();
        p.vel.lerp(dir.multiplyScalar(speed), 0.2);
      }
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);

      // check hit
      let hitEnemy: EnemyEntity | null = null;
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (p.hitSet.has(e.id)) continue;
        const dx = e.mesh.position.x - p.pos.x;
        const dy = e.mesh.position.y - p.pos.y;
        const dz = e.mesh.position.z - p.pos.z;
        if (dx * dx + dy * dy + dz * dz < 0.7) {
          hitEnemy = e;
          break;
        }
      }
      if (hitEnemy) {
        this.applyProjectileHit(p, hitEnemy);
        p.hitSet.add(hitEnemy.id);
        if (p.pierce <= 0) {
          p.alive = false;
        } else {
          p.pierce -= 1;
        }
      }
    }
  }

  private applyProjectileHit(p: Projectile, e: EnemyEntity) {
    const now = performance.now() / 1000;

    if (p.splashRadius && p.splashRadius > 0) {
      // explode
      const flash = this.makePulseMesh(p.splashRadius * 1.0, p.color);
      flash.position.copy(p.pos);
      flash.position.y = 0.1;
      this.scene.add(flash);
      setTimeout(() => this.scene.remove(flash), 350);
      for (const en of this.enemies) {
        if (!en.alive) continue;
        const dx = en.mesh.position.x - p.pos.x;
        const dz = en.mesh.position.z - p.pos.z;
        if (dx * dx + dz * dz <= p.splashRadius * p.splashRadius) {
          if (p.armorShred) en.armor = Math.max(0, en.armor - p.armorShred);
          this.damageEnemy(en, p.damage);
          if (p.burnDps) {
            en.burnDps = Math.max(en.burnDps, p.burnDps);
            en.burnUntil = now + (p.burnDuration || 2);
          }
          if (p.slowPct) {
            en.slowFactor = Math.min(en.slowFactor, 1 - p.slowPct);
            en.slowUntil = now + (p.slowDuration || 1);
          }
          if (p.empStun) {
            en.stunUntil = Math.max(en.stunUntil, now + p.empStun);
          }
        }
      }
    } else {
      if (p.armorShred) e.armor = Math.max(0, e.armor - p.armorShred);
      this.damageEnemy(e, p.damage);
      if (p.burnDps) {
        e.burnDps = Math.max(e.burnDps, p.burnDps);
        e.burnUntil = now + (p.burnDuration || 2);
      }
      if (p.slowPct) {
        e.slowFactor = Math.min(e.slowFactor, 1 - p.slowPct);
        e.slowUntil = now + (p.slowDuration || 1);
      }
      if (p.empStun) {
        e.stunUntil = Math.max(e.stunUntil, now + p.empStun);
      }
    }
  }

  private damageEnemy(e: EnemyEntity, damage: number, fromDot = false) {
    if (!e.alive) return;
    let dmg = damage;
    if (!fromDot) dmg = Math.max(1, damage - e.armor);
    if (e.shield > 0) {
      const absorb = Math.min(e.shield, dmg);
      e.shield -= absorb;
      dmg -= absorb;
    }
    if (dmg > 0) e.hp -= dmg;
    this.damageDealt += damage;
    // hit flash
    if (!fromDot) (e as any).hitFlash = 1.0;
    if (e.hp <= 0) {
      e.alive = false;
      this.cores += e.bounty;
      this.killCount += 1;
      this.spawnDeathFx(e.mesh.position, e.def.emissive);
      // Death sound (boss gets special sound)
      if (e.def.traits.includes("boss")) sfx.largeExplosion();
      else if (e.def.baseHp > 500) sfx.mediumExplosion();
      else sfx.enemyDeath();
      this.emitStats();
    }
  }

  private updateBoss(dt: number) {
    const now = performance.now() / 1000;
    for (const e of this.enemies) {
      if (!e.def.traits.includes("boss")) continue;
      // multi-phase
      const hpPct = e.hp / e.maxHp;
      const newPhase = hpPct > 0.66 ? 1 : hpPct > 0.33 ? 2 : 3;
      if (e.bossPhase !== newPhase) {
        e.bossPhase = newPhase;
        if (newPhase === 2) {
          // restore shield, speed up
          e.shield = e.maxShield * 0.5;
          e.baseSpeed *= 1.2;
        } else if (newPhase === 3) {
          // enrage: faster fire of summons
          e.shield = e.maxShield * 0.35;
          e.baseSpeed *= 1.15;
        }
      }
      // summon minions periodically
      const summonInterval = e.bossPhase === 3 ? 4 : e.bossPhase === 2 ? 7 : 11;
      if (!e.lastSummon) e.lastSummon = now;
      if (now - e.lastSummon > summonInterval) {
        e.lastSummon = now;
        // summon scout drones at boss position, pushed back along path
        const minionDef = ENEMIES.scout_drone;
        for (let i = 0; i < (e.bossPhase || 1) + 1; i++) {
          const m = buildEnemyMesh(minionDef);
          m.position.copy(e.mesh.position);
          m.position.y = 1.4;
          this.scene.add(m);
          const minion: EnemyEntity = {
            id: this.nextId++,
            def: minionDef,
            mesh: m,
            hp: minionDef.baseHp * 3,
            maxHp: minionDef.baseHp * 3,
            shield: 0, maxShield: 0,
            armor: 5,
            speed: minionDef.baseSpeed * 1.5,
            baseSpeed: minionDef.baseSpeed * 1.5,
            segIndex: e.segIndex,
            segT: e.segT,
            totalDistance: e.totalDistance,
            alive: true,
            slowUntil: 0, slowFactor: 1,
            burnUntil: 0, burnDps: 0,
            stunUntil: 0,
            shieldRegenAccum: 0,
            bounty: 4,
          };
          this.enemies.push(minion);
        }
      }
      // shield regen continuous
      if (e.shield < e.maxShield) {
        e.shield = Math.min(e.maxShield, e.shield + e.maxShield * 0.015 * dt);
      }
      // hp regen weak
      if (e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.001 * dt);
      }
    }
  }

  private checkEndConditions() {
    if (this.lives <= 0 && this.state === "playing") {
      this.state = "lost";
      stopMusic();
      sfx.largeExplosion();
      this.emitStats();
    }
  }

  private updateUnits(dt: number) {
    updateUnits(
      this.units,
      this.enemies.map(e => ({ mesh: e.mesh, hp: e.hp, maxHp: e.maxHp, alive: e.alive })),
      dt,
      (enemyIndex, dmg) => {
        if (enemyIndex >= 0 && enemyIndex < this.enemies.length) {
          this.damageEnemy(this.enemies[enemyIndex], dmg);
        }
      }
    );
  }

  // ---------- visual fx --------------------------------------------

  private makeBeam(a: THREE.Vector3, b: THREE.Vector3, color: number, thickness = 0.08): THREE.Mesh {
    const len = a.distanceTo(b);
    const geo = new THREE.CylinderGeometry(thickness, thickness, len, 6);
    const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(a).lerp(b, 0.5);
    m.lookAt(b);
    m.rotateX(Math.PI / 2);
    return m;
  }

  private makePulseMesh(radius: number, color: number): THREE.Mesh {
    const geo = new THREE.RingGeometry(radius * 0.95, radius, 32);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  private spawnDeathFx(pos: THREE.Vector3, color: number) {
    const geo = new THREE.SphereGeometry(0.3, 8, 6);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(pos);
    this.scene.add(m);
    let life = 0;
    const expand = () => {
      life += 0.04;
      m.scale.setScalar(1 + life * 6);
      mat.opacity = Math.max(0, 0.9 - life * 3);
      if (life < 0.4) requestAnimationFrame(expand);
      else this.scene.remove(m);
    };
    expand();
  }

  /** Visual feedback when a tower is upgraded — expanding range ring */
  private showUpgradePulse(x: number, z: number, color: number, range: number) {
    const geo = new THREE.RingGeometry(range * 0.95, range, 48);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.08, z);
    this.scene.add(ring);

    let life = 0;
    const expand = () => {
      life += 0.05;
      ring.scale.setScalar(1 + life * 1.6);
      mat.opacity = Math.max(0, 0.65 - life * 1.3);
      if (life < 0.55) {
        requestAnimationFrame(expand);
      } else {
        this.scene.remove(ring);
      }
    };
    expand();
  }

  // ---------- pooling ----------------------------------------------

  private acquireProjectile(): Projectile {
    if (this.projectilePool.length) return this.projectilePool.pop()!;
    return {
      id: this.nextId++,
      mesh: null as any,
      alive: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      target: null,
      damage: 0,
      pierce: 0,
      hitSet: new Set(),
      ttl: 0,
      homing: false,
      color: 0xffffff,
    };
  }
  private releaseProjectile(p: Projectile) {
    p.alive = false;
    p.target = null;
    p.hitSet = new Set();
    if (this.projectilePool.length < 200) this.projectilePool.push(p);
  }

  // ---------- callbacks --------------------------------------------

  private emitStats() {
    const remainingInQueue = this.spawnQueue.length;
    this.callbacks.onStats({
      lives: this.lives,
      cores: Math.floor(this.cores),
      wave: this.currentWaveIndex + 1,
      totalWaves: this.waves.length,
      enemiesAlive: this.enemies.length,
      enemiesRemaining: remainingInQueue + this.enemies.length,
      state: this.state,
      intermission: this.intermissionTime > 0,
      intermissionLeft: this.intermissionTime,
      killCount: this.killCount,
      damageDealt: Math.floor(this.damageDealt),
    });
  }
  private emitPlaced() {
    this.callbacks.onPlacedChange(
      this.towers.map((t) => ({ id: t.id, kind: t.kind, level: t.level, x: t.position.x, z: t.position.z }))
    );
  }

  // ---------- public queries ---------------------------------------

  getSelectedTower(): { id: number; kind: TowerKind; level: number } | null {
    if (this.selectedTowerId === null) return null;
    const t = this.towers.find((x) => x.id === this.selectedTowerId);
    if (!t) return null;
    return { id: t.id, kind: t.kind, level: t.level };
  }

  getCurrentWaveDef(): WaveDef | null {
    if (this.currentWaveIndex < 0) return null;
    return this.waves[this.currentWaveIndex];
  }
  getNextWaveDef(): WaveDef | null {
    const idx = this.currentWaveIndex + 1;
    if (idx >= this.waves.length) return null;
    return this.waves[idx];
  }
  getAllWaves(): WaveDef[] { return this.waves; }
  getEnemiesAlive(): { hp: number; max: number; isBoss: boolean; name: string }[] {
    return this.enemies.map((e) => ({ hp: e.hp, max: e.maxHp + e.maxShield, isBoss: !!e.def.traits.includes("boss"), name: e.def.name }));
  }
  getBoss(): { hp: number; max: number; shield: number; maxShield: number; phase: number } | null {
    const b = this.enemies.find((e) => e.def.traits.includes("boss"));
    if (!b) return null;
    return { hp: b.hp, max: b.maxHp, shield: b.shield, maxShield: b.maxShield, phase: b.bossPhase || 1 };
  }

  // ---------- lifecycle --------------------------------------------

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    cancelAnimationFrame(this.rafId);
    this.resizeObs?.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
