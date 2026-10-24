import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GraphicsQualityPreset, PieceColor, PieceSymbol } from '../../types/chess.ts';

export type GlbPieceAnimState = 'idle' | 'move' | 'attack' | 'shatter';

export interface GlbPieceInstance {
  rootGroup: THREE.Group;
  staticRoot: THREE.Group;
  skinnedRoot: THREE.Object3D | null;
  mixer: THREE.AnimationMixer | null;
  actions: Record<GlbPieceAnimState, THREE.AnimationAction | null>;
  currentState: GlbPieceAnimState;
  basePedestalRing: THREE.Mesh;
  contactShadowDisc: THREE.Mesh;
  selectionHalo: THREE.Mesh;
  setAnimState: (nextState: GlbPieceAnimState, timeScale?: number) => void;
  setSelected: (selected: boolean) => void;
  update: (dt: number, elapsedSec: number, isKingInCheck: boolean, animateIdle: boolean) => void;
}

export interface CathedralSceneInstance {
  group: THREE.Group;
  flameMeshes: THREE.Object3D[];
  brazierLights: THREE.PointLight[];
  applyQuality: (quality: GraphicsQualityPreset, showRoom: boolean, isSoftwareGl: boolean) => void;
  update: (elapsedSec: number, quality: GraphicsQualityPreset) => void;
}

const PIECE_MODEL_NAMES: Record<PieceSymbol, string> = {
  p: 'pawn_white',
  r: 'rook_white',
  n: 'knight_white',
  b: 'bishop_white',
  q: 'queen_white',
  k: 'king_white',
};

interface StaticPrimitiveDef {
  geometry: THREE.BufferGeometry;
  materialSlot: 'marble' | 'gold' | 'glow' | 'steel';
}

// Module-level caches so parsed GLTFs and static bind-pose primitives persist across re-renders
const gltfCache = new Map<string, GLTF>();
const staticPrimitivesCache = new Map<string, StaticPrimitiveDef[]>();
const loadingPromises = new Map<string, Promise<GLTF>>();

function classifyMaterialSlot(matName: string): 'marble' | 'gold' | 'glow' | 'steel' {
  if (matName.includes('AntiqueGold')) return 'gold';
  if (matName.includes('Glow_Gold')) return 'glow';
  if (matName.includes('Steel_Silver')) return 'steel';
  return 'marble';
}

function cacheStaticPrimitivesForPiece(modelName: string, gltf: GLTF) {
  if (staticPrimitivesCache.has(modelName)) return;
  const defs: StaticPrimitiveDef[] = [];
  gltf.scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const slot = classifyMaterialSlot(mat?.name || '');
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
    defs.push({
      geometry: mesh.geometry,
      materialSlot: slot,
    });
  });
  staticPrimitivesCache.set(modelName, defs);
}

async function fetchAndDecompressGlb(modelName: string): Promise<ArrayBuffer> {
  const gzUrl = `/models/${modelName}.glb.gz`;

  if (typeof DecompressionStream !== 'undefined') {
    try {
      const res = await fetch(gzUrl, { cache: 'force-cache' });
      if (res.ok && res.body) {
        const ds = new DecompressionStream('gzip');
        const decompressedStream = res.body.pipeThrough(ds);
        return await new Response(decompressedStream).arrayBuffer();
      }
    } catch {
      // Fallback to server API below if stream decompression fails
    }
  }

  const fallbackRes = await fetch(`/api/models/${modelName}`);
  if (!fallbackRes.ok) {
    throw new Error(`Failed to fetch model ${modelName}: ${fallbackRes.status}`);
  }
  return await fallbackRes.arrayBuffer();
}

export function loadCachedGlb(modelName: string): Promise<GLTF> {
  const cached = gltfCache.get(modelName);
  if (cached) return Promise.resolve(cached);

  const existingPromise = loadingPromises.get(modelName);
  if (existingPromise) return existingPromise;

  const promise = (async () => {
    const buffer = await fetchAndDecompressGlb(modelName);
    const loader = new GLTFLoader();
    const gltf = await new Promise<GLTF>((resolve, reject) => {
      loader.parse(buffer, '', resolve, reject);
    });
    if (modelName !== 'option8_cathedral') {
      cacheStaticPrimitivesForPiece(modelName, gltf);
    }
    gltfCache.set(modelName, gltf);
    loadingPromises.delete(modelName);
    return gltf;
  })();

  loadingPromises.set(modelName, promise);
  return promise;
}

/**
 * Stage 1: Fast preload of the 6 optimized chess piece GLBs (~2.2 MB total compressed)
 * so the board is playable almost immediately even on low-end devices.
 */
export async function preloadPieceGlbAssets(
  onProgress?: (loadedCount: number, totalCount: number, label: string) => void
): Promise<void> {
  const items: { name: string; label: string }[] = [
    { name: 'pawn_white', label: 'Infanteri Pion' },
    { name: 'rook_white', label: 'Golem Benteng' },
    { name: 'knight_white', label: 'Kavaleri Kuda' },
    { name: 'bishop_white', label: 'Uskup Mistik' },
    { name: 'queen_white', label: 'Ratu Penguasa' },
    { name: 'king_white', label: 'Raja Monarki' },
  ];

  let completed = 0;
  onProgress?.(0, items.length + 1, items[0].label);

  await Promise.all(
    items.map(async (item) => {
      await loadCachedGlb(item.name);
      completed += 1;
      onProgress?.(completed, items.length + 1, item.label);
    })
  );
}

/**
 * Stage 2: Load the Gothic Cathedral & Obsidian Altar environment GLB.
 */
export async function preloadCathedralGlbAsset(
  onProgress?: (loadedCount: number, totalCount: number, label: string) => void
): Promise<void> {
  onProgress?.(6, 7, 'Katedral Gotik & Altar Obsidian');
  await loadCachedGlb('option8_cathedral');
  onProgress?.(7, 7, 'Selesai');
}

/**
 * Builds the Option 8 Gothic Cathedral & Obsidian Altar Table 3D environment
 * with frozen world matrices (`matrixAutoUpdate = false`) so static architecture has zero CPU cost per frame.
 */
export function buildCathedralEnvironmentInstance(
  maxAnisotropy: number,
  quality: GraphicsQualityPreset,
  isSoftwareGl: boolean
): CathedralSceneInstance | null {
  const gltf = gltfCache.get('option8_cathedral');
  if (!gltf) return null;

  const group = new THREE.Group();
  const clonedScene = gltf.scene.clone(true);

  const scale = 2.88;
  clonedScene.scale.setScalar(scale);
  clonedScene.position.set(0, -0.72 * scale, -0.65 * scale);
  clonedScene.updateMatrix();

  const flameMeshes: THREE.Object3D[] = [];
  const savedNormalMaps = new WeakMap<THREE.MeshStandardMaterial, THREE.Texture | null>();

  clonedScene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      child.matrixAutoUpdate = false;
      child.updateMatrix();
      return;
    }

    const name = mesh.name || '';
    const isFlame = name.includes('Flame');
    const isGlass = name.includes('Glass');
    const isRune = name.includes('Golden_Runes');

    // Only flame meshes animate their scale on High/Ultra; all other cathedral meshes are 100% static!
    mesh.matrixAutoUpdate = isFlame;
    mesh.updateMatrix();

    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat) {
      const clonedMat = mat.clone();
      savedNormalMaps.set(clonedMat, clonedMat.normalMap || null);
      clonedMat.envMapIntensity = 0.24;

      const targetAniso = quality === 'low' ? 1 : maxAnisotropy;
      if (clonedMat.map) {
        clonedMat.map.anisotropy = targetAniso;
      }
      if (clonedMat.emissiveMap) {
        clonedMat.emissiveMap.anisotropy = targetAniso;
      }

      if (name.includes('Flame_Core')) {
        clonedMat.emissive = new THREE.Color('#FFD97D');
        clonedMat.emissiveIntensity = 1.35;
        flameMeshes.push(mesh);
      } else if (name.includes('Flame_Mid')) {
        clonedMat.emissive = new THREE.Color('#F58220');
        clonedMat.emissiveIntensity = 0.95;
        flameMeshes.push(mesh);
      } else if (name.includes('Flame_Outer')) {
        clonedMat.emissive = new THREE.Color('#C83E1D');
        clonedMat.emissiveIntensity = 0.65;
        flameMeshes.push(mesh);
      } else if (isRune) {
        clonedMat.emissive = new THREE.Color('#C88A2B');
        clonedMat.emissiveIntensity = 0.52;
        clonedMat.polygonOffset = true;
        clonedMat.polygonOffsetFactor = -1;
        clonedMat.polygonOffsetUnits = -1;
      } else if (isGlass) {
        clonedMat.emissiveIntensity = 0.72;
      } else if (name.includes('Embers_Logs')) {
        clonedMat.emissive = new THREE.Color('#D9480F');
        clonedMat.emissiveIntensity = 0.65;
      } else {
        clonedMat.emissiveIntensity = 0.16;
      }

      mesh.material = clonedMat;
    }
  });

  group.add(clonedScene);
  group.updateMatrixWorld(true);

  // Flickering point lights at the two Gothic Braziers (active on High & Ultra)
  const brazierLights: THREE.PointLight[] = [];
  if (!isSoftwareGl) {
    const leftLight = new THREE.PointLight('#FF7B29', 1.65, 20, 1.6);
    leftLight.position.set(-3.95 * scale, 0.92 * scale, 0);
    leftLight.matrixAutoUpdate = false;
    leftLight.updateMatrix();
    group.add(leftLight);
    brazierLights.push(leftLight);

    const rightLight = new THREE.PointLight('#FF7B29', 1.65, 20, 1.6);
    rightLight.position.set(3.95 * scale, 0.92 * scale, 0);
    rightLight.matrixAutoUpdate = false;
    rightLight.updateMatrix();
    group.add(rightLight);
    brazierLights.push(rightLight);
  }

  const instance: CathedralSceneInstance = {
    group,
    flameMeshes,
    brazierLights,
    applyQuality(q: GraphicsQualityPreset, showRoom: boolean, softGl: boolean) {
      group.visible = showRoom;
      const isLow = q === 'low';
      const isHighOrUltra = (q === 'high' || q === 'ultra') && !softGl;

      for (const light of brazierLights) {
        light.visible = isHighOrUltra;
      }

      clonedScene.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const name = mesh.name || '';
        const isAltar = name.includes('Altar');
        const isFlame = name.includes('Flame');
        const isGlass = name.includes('Glass');

        if (isAltar || name.includes('Floor')) {
          mesh.receiveShadow = !isLow && !softGl;
          mesh.castShadow = false;
        } else {
          mesh.castShadow = q === 'ultra' && !softGl && !isFlame && !isGlass;
          mesh.receiveShadow = isHighOrUltra && !isFlame && !isGlass;
        }

        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && savedNormalMaps.has(mat)) {
          const origNormal = savedNormalMaps.get(mat) || null;
          const nextNormal = isLow ? null : origNormal;
          if (mat.normalMap !== nextNormal) {
            mat.normalMap = nextNormal;
            mat.needsUpdate = true;
          }
          mat.envMapIntensity = q === 'ultra' ? 0.34 : isLow ? 0.18 : 0.25;
        }
      });
    },
    update(elapsedSec: number, q: GraphicsQualityPreset) {
      if (q === 'low' || q === 'medium') return;
      for (let i = 0; i < flameMeshes.length; i++) {
        const fm = flameMeshes[i];
        const flicker =
          1 +
          Math.sin(elapsedSec * 9.5 + i * 1.7) * 0.055 +
          Math.cos(elapsedSec * 15.2 + i) * 0.035;
        fm.scale.set(1, flicker, 1);
      }
      for (let i = 0; i < brazierLights.length; i++) {
        const light = brazierLights[i];
        if (!light.visible) continue;
        const baseInt = q === 'ultra' ? 1.85 : 1.4;
        light.intensity =
          baseInt +
          Math.sin(elapsedSec * 8.3 + i * 2.1) * 0.22 +
          Math.cos(elapsedSec * 13.7 + i * 0.9) * 0.14;
      }
    },
  };

  instance.applyQuality(quality, true, isSoftwareGl);
  return instance;
}

// ============================================================================
// SHARED GEOMETRIES & MATERIAL POOLS (Eliminates 128 duplicate shader programs)
// ============================================================================
let sharedBaseRingGeo: THREE.RingGeometry | null = null;
let sharedSelectionHaloGeo: THREE.RingGeometry | null = null;
let sharedContactShadowGeo: THREE.PlaneGeometry | null = null;
let sharedContactShadowMat: THREE.MeshBasicMaterial | null = null;
let sharedHaloMat: THREE.MeshBasicMaterial | null = null;
let sharedWhiteRingMat: THREE.MeshBasicMaterial | null = null;
let sharedBlackRingMat: THREE.MeshBasicMaterial | null = null;
let sharedCheckRingMat: THREE.MeshBasicMaterial | null = null;

function createSoftContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
    grad.addColorStop(0, 'rgba(5, 3, 2, 0.72)');
    grad.addColorStop(0.55, 'rgba(8, 5, 4, 0.38)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function getSharedPieceOverlays() {
  if (!sharedBaseRingGeo) {
    sharedBaseRingGeo = new THREE.RingGeometry(0.35, 0.42, 24);
    sharedBaseRingGeo.rotateX(-Math.PI / 2);
  }
  if (!sharedSelectionHaloGeo) {
    sharedSelectionHaloGeo = new THREE.RingGeometry(0.39, 0.48, 28);
    sharedSelectionHaloGeo.rotateX(-Math.PI / 2);
  }
  if (!sharedContactShadowGeo) {
    sharedContactShadowGeo = new THREE.PlaneGeometry(0.92, 0.92);
    sharedContactShadowGeo.rotateX(-Math.PI / 2);
  }
  if (!sharedContactShadowMat) {
    sharedContactShadowMat = new THREE.MeshBasicMaterial({
      map: createSoftContactShadowTexture(),
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  }
  if (!sharedHaloMat) {
    sharedHaloMat = new THREE.MeshBasicMaterial({
      color: '#38BDF8',
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }
  if (!sharedWhiteRingMat) {
    sharedWhiteRingMat = new THREE.MeshBasicMaterial({
      color: '#E5C158',
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }
  if (!sharedBlackRingMat) {
    sharedBlackRingMat = new THREE.MeshBasicMaterial({
      color: '#E11D48',
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }
  if (!sharedCheckRingMat) {
    sharedCheckRingMat = new THREE.MeshBasicMaterial({
      color: '#FF2A2A',
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }
  return {
    sharedBaseRingGeo,
    sharedSelectionHaloGeo,
    sharedContactShadowGeo,
    sharedContactShadowMat,
    sharedHaloMat,
    sharedWhiteRingMat,
    sharedBlackRingMat,
    sharedCheckRingMat,
  };
}

interface FactionMaterialPool {
  marble: THREE.Material;
  gold: THREE.Material;
  glow: THREE.Material;
  steel: THREE.Material;
}

const factionMaterialCache = new Map<string, FactionMaterialPool>();

function getSharedFactionMaterials(
  color: PieceColor,
  quality: GraphicsQualityPreset,
  isSoftwareGl: boolean
): FactionMaterialPool {
  const tier = isSoftwareGl || quality === 'low' ? 'low' : quality === 'ultra' ? 'ultra' : 'std';
  const cacheKey = `${color}_${tier}`;
  const existing = factionMaterialCache.get(cacheKey);
  if (existing) return existing;

  if (color === 'w') {
    const marble =
      tier === 'ultra'
        ? new THREE.MeshPhysicalMaterial({
            color: new THREE.Color('#E5DAC8'),
            roughness: 0.28,
            metalness: 0.04,
            clearcoat: 0.38,
            clearcoatRoughness: 0.2,
            sheen: 0.25,
            sheenColor: new THREE.Color('#FFF3DF'),
            envMapIntensity: 0.42,
          })
        : new THREE.MeshStandardMaterial({
            color: new THREE.Color('#DFD3C0'),
            roughness: 0.36,
            metalness: 0.04,
            envMapIntensity: 0.28,
          });

    const gold =
      tier === 'ultra'
        ? new THREE.MeshPhysicalMaterial({
            color: new THREE.Color('#CFA34A'),
            metalness: 0.88,
            roughness: 0.24,
            clearcoat: 0.25,
            envMapIntensity: 0.52,
          })
        : new THREE.MeshStandardMaterial({
            color: new THREE.Color('#C49A45'),
            metalness: 0.8,
            roughness: 0.32,
            envMapIntensity: 0.35,
          });

    const glow = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#E5B85B'),
      emissive: new THREE.Color('#D99B26'),
      emissiveIntensity: tier === 'ultra' ? 0.65 : 0.45,
      roughness: 0.3,
      metalness: 0.1,
    });

    const steel = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#BCC6D0'),
      metalness: 0.86,
      roughness: tier === 'ultra' ? 0.22 : 0.28,
      envMapIntensity: tier === 'ultra' ? 0.48 : 0.32,
    });

    const pool = { marble, gold, glow, steel };
    factionMaterialCache.set(cacheKey, pool);
    return pool;
  } else {
    // Black Faction: Deep Volcanic Obsidian + Burnished Bronze + Crimson-Amber Rune Glow
    const marble =
      tier === 'ultra'
        ? new THREE.MeshPhysicalMaterial({
            color: new THREE.Color('#1B1615'),
            emissive: new THREE.Color('#080504'),
            emissiveIntensity: 0.06,
            roughness: 0.22,
            metalness: 0.36,
            clearcoat: 0.52,
            clearcoatRoughness: 0.18,
            sheen: 0.3,
            sheenColor: new THREE.Color('#4A251D'),
            envMapIntensity: 0.55,
          })
        : new THREE.MeshStandardMaterial({
            color: new THREE.Color('#1E1917'),
            emissive: new THREE.Color('#080504'),
            emissiveIntensity: 0.08,
            roughness: 0.3,
            metalness: 0.32,
            envMapIntensity: 0.35,
          });

    const gold =
      tier === 'ultra'
        ? new THREE.MeshPhysicalMaterial({
            color: new THREE.Color('#B86E3E'),
            metalness: 0.88,
            roughness: 0.24,
            clearcoat: 0.25,
            envMapIntensity: 0.52,
          })
        : new THREE.MeshStandardMaterial({
            color: new THREE.Color('#AD683B'),
            metalness: 0.8,
            roughness: 0.32,
            envMapIntensity: 0.35,
          });

    const glow = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#E0533C'),
      emissive: new THREE.Color('#C93B2B'),
      emissiveIntensity: tier === 'ultra' ? 0.78 : 0.55,
      roughness: 0.28,
      metalness: 0.1,
    });

    const steel = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#485060'),
      metalness: 0.88,
      roughness: tier === 'ultra' ? 0.22 : 0.28,
      envMapIntensity: tier === 'ultra' ? 0.48 : 0.32,
    });

    const pool = { marble, gold, glow, steel };
    factionMaterialCache.set(cacheKey, pool);
    return pool;
  }
}

/**
 * Builds an articulated GLB Chess Piece instance with Hybrid Static/Skinned LOD:
 * - Stationary pieces render via `staticRoot` (shared static `THREE.Mesh` primitives with 0 bones,
 *   0 `skeleton.update()`, and 0 vertex-skinning shader overhead).
 * - Moving, attacking, shattering, or ULTRA-idle pieces seamlessly activate `skinnedRoot` (`SkinnedMesh` + `AnimationMixer`).
 */
export function buildGlbPieceInstance(
  type: PieceSymbol,
  color: PieceColor,
  enableShadows: boolean,
  isSoftwareGl: boolean,
  quality: GraphicsQualityPreset = 'low'
): GlbPieceInstance | null {
  const modelName = PIECE_MODEL_NAMES[type];
  const gltf = gltfCache.get(modelName);
  if (!gltf) return null;

  cacheStaticPrimitivesForPiece(modelName, gltf);
  const staticDefs = staticPrimitivesCache.get(modelName) || [];

  const rootGroup = new THREE.Group();
  const pieceScale = type === 'k' || type === 'q' ? 0.94 : type === 'n' ? 0.88 : 0.92;
  const sharedMats = getSharedFactionMaterials(color, quality, isSoftwareGl);
  const castReceiveShadow = !isSoftwareGl && enableShadows;

  // 1. Lightweight Static Mesh Group (used whenever piece is stationary on the board)
  const staticRoot = new THREE.Group();
  staticRoot.scale.setScalar(pieceScale);
  staticRoot.matrixAutoUpdate = false;
  staticRoot.updateMatrix();

  for (const def of staticDefs) {
    const m = new THREE.Mesh(def.geometry, sharedMats[def.materialSlot]);
    m.castShadow = castReceiveShadow;
    m.receiveShadow = castReceiveShadow;
    m.matrixAutoUpdate = false;
    staticRoot.add(m);
  }
  rootGroup.add(staticRoot);

  const {
    sharedBaseRingGeo: baseGeo,
    sharedSelectionHaloGeo: haloGeo,
    sharedContactShadowGeo: shadowGeo,
    sharedContactShadowMat: shadowMat,
    sharedHaloMat: haloMat,
    sharedWhiteRingMat: whiteRingMat,
    sharedBlackRingMat: blackRingMat,
    sharedCheckRingMat: checkRingMat,
  } = getSharedPieceOverlays();

  const defaultRingMat = color === 'w' ? whiteRingMat : blackRingMat;

  // Soft radial Contact AO Shadow Disc directly under the piece base
  const contactShadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadowDisc.position.y = 0.005;
  contactShadowDisc.matrixAutoUpdate = false;
  contactShadowDisc.updateMatrix();
  rootGroup.add(contactShadowDisc);

  // Faction Base Ring
  const basePedestalRing = new THREE.Mesh(baseGeo, defaultRingMat);
  basePedestalRing.position.y = 0.012;
  basePedestalRing.matrixAutoUpdate = false;
  basePedestalRing.updateMatrix();
  rootGroup.add(basePedestalRing);

  // Selection Halo
  const selectionHalo = new THREE.Mesh(haloGeo, haloMat);
  selectionHalo.position.y = 0.022;
  selectionHalo.visible = false;
  rootGroup.add(selectionHalo);

  // 2. Lazy Articulated SkinnedMesh Rig (instantiated only when piece moves, attacks, shatters, or in Ultra mode)
  const actions: Record<GlbPieceAnimState, THREE.AnimationAction | null> = {
    idle: null,
    move: null,
    attack: null,
    shatter: null,
  };

  function ensureSkinnedRig() {
    if (instance.skinnedRoot && instance.mixer) return;

    const clonedRoot = SkeletonUtils.clone(gltf!.scene);
    clonedRoot.scale.setScalar(pieceScale);

    clonedRoot.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;

      mesh.castShadow = castReceiveShadow;
      mesh.receiveShadow = castReceiveShadow;
      mesh.frustumCulled = false;

      const mapMaterial = (origMat: THREE.Material): THREE.Material => {
        const slot = classifyMaterialSlot(origMat.name || '');
        return sharedMats[slot];
      };

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(mapMaterial);
      } else if (mesh.material) {
        mesh.material = mapMaterial(mesh.material);
      }
    });

    const mixer = new THREE.AnimationMixer(clonedRoot);
    const findClip = (name: string) =>
      gltf!.animations.find((c) => c.name.toLowerCase() === name.toLowerCase()) || null;

    const idleClip = findClip('Idle');
    const moveClip = findClip('Move');
    const attackClip = findClip('Attack');
    const shatterClip = findClip('Shatter');

    actions.idle = idleClip ? mixer.clipAction(idleClip) : null;
    actions.move = moveClip ? mixer.clipAction(moveClip) : null;
    actions.attack = attackClip ? mixer.clipAction(attackClip) : null;
    actions.shatter = shatterClip ? mixer.clipAction(shatterClip) : null;

    if (actions.idle) {
      actions.idle.loop = THREE.LoopRepeat;
      actions.idle.time = Math.random() * (idleClip?.duration || 1.5);
    }
    if (actions.move) {
      actions.move.loop = THREE.LoopRepeat;
    }
    if (actions.attack) {
      actions.attack.loop = THREE.LoopOnce;
      actions.attack.clampWhenFinished = true;
    }
    if (actions.shatter) {
      actions.shatter.loop = THREE.LoopOnce;
      actions.shatter.clampWhenFinished = true;
    }

    instance.skinnedRoot = clonedRoot;
    instance.mixer = mixer;
    rootGroup.add(clonedRoot);
  }

  const instance: GlbPieceInstance = {
    rootGroup,
    staticRoot,
    skinnedRoot: null,
    mixer: null,
    actions,
    currentState: 'idle',
    basePedestalRing,
    contactShadowDisc,
    selectionHalo,
    setAnimState(nextState: GlbPieceAnimState, timeScale = 1) {
      if (instance.currentState === nextState && nextState !== 'attack' && nextState !== 'shatter') {
        return;
      }

      if (nextState === 'idle') {
        instance.currentState = 'idle';
        if (instance.skinnedRoot) {
          const prevAction = instance.actions.move || instance.actions.attack;
          prevAction?.stop();
          if (instance.actions.idle) {
            instance.actions.idle.reset();
            instance.actions.idle.play();
            instance.mixer?.update(0.016);
          }
        }
        return;
      }

      // Moving, attacking, or shattering requires the articulated SkinnedMesh rig
      ensureSkinnedRig();
      if (instance.skinnedRoot) {
        instance.skinnedRoot.visible = true;
      }
      staticRoot.visible = false;

      const prevAction = instance.actions[instance.currentState];
      const nextAction = instance.actions[nextState];
      instance.currentState = nextState;

      if (nextAction) {
        nextAction.reset();
        nextAction.timeScale = timeScale;
        nextAction.play();
        if (prevAction && prevAction !== nextAction && prevAction.isRunning()) {
          prevAction.crossFadeTo(nextAction, 0.14, false);
        }
        instance.mixer?.update(0.016);
      }
    },
    setSelected(selected: boolean) {
      selectionHalo.visible = selected;
    },
    update(dt: number, elapsedSec: number, isKingInCheck: boolean, animateIdle: boolean) {
      const needsSkinnedRig =
        instance.currentState !== 'idle' || animateIdle || selectionHalo.visible;

      if (needsSkinnedRig) {
        if (!instance.skinnedRoot) {
          ensureSkinnedRig();
          if (instance.actions.idle && instance.currentState === 'idle') {
            instance.actions.idle.play();
          }
        }
        if (instance.skinnedRoot) {
          instance.skinnedRoot.visible = true;
        }
        staticRoot.visible = false;
        instance.mixer?.update(dt);
      } else {
        // Stationary piece: use zero-overhead static mesh!
        staticRoot.visible = true;
        if (instance.skinnedRoot) {
          instance.skinnedRoot.visible = false;
        }
      }

      if (selectionHalo.visible) {
        const pulse = 1 + Math.sin(elapsedSec * 6.0) * 0.06;
        selectionHalo.scale.setScalar(pulse);
      }

      const targetMat = isKingInCheck ? checkRingMat : defaultRingMat;
      if (basePedestalRing.material !== targetMat) {
        basePedestalRing.material = targetMat;
      }
    },
  };

  return instance;
}
