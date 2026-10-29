'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type {
  ArenaVisualSettings,
  BoardPiece,
  CaptureDuelEvent,
  GraphicsQualityPreset,
  LegalMoveOption,
  PieceColor,
  PieceSymbol,
} from '../../types/chess.ts';
import { DEFAULT_VISUAL_SETTINGS } from '../../types/chess.ts';
import {
  indicesToSquare,
  parseBoardFromFen,
  squareToIndices,
} from '../../lib/chess-rules.ts';
import { createChessMaterialSet } from '../../lib/chess-3d/materials.ts';
import { createStauntonGeometryCache } from '../../lib/chess-3d/staunton-geometry.ts';
import { createGrandChessChamber } from '../../lib/chess-3d/grand-chamber.ts';
import {
  buildLivingCharacterRig,
  createLivingCharacterGeometryCache,
  updateLivingCharacterRigAnimation,
  type LivingCharacterRig,
} from '../../lib/chess-3d/living-characters.ts';
import {
  preloadPieceGlbAssets,
  preloadCathedralGlbAsset,
  buildCathedralEnvironmentInstance,
  buildGlbPieceInstance,
  type GlbPieceInstance,
  type CathedralSceneInstance,
} from '../../lib/chess-3d/glb-assets.ts';
import {
  Camera,
  RotateCcw,
  FlipHorizontal2,
  Eye,
  Sparkles,
  Grid,
  Swords,
  Crown,
  Search,
  Navigation,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export type CameraViewPreset = 'white' | 'black' | 'top' | 'cinema' | 'inspection';

interface ChessBoard3DProps {
  fen: string;
  orientation: PieceColor;
  selectedSquare: string | null;
  legalMoves: LegalMoveOption[];
  lastMove: { from: string; to: string } | null;
  lastCaptureDuel?: CaptureDuelEvent | null;
  hintMove?: { from: string; to: string } | null;
  kingSquareInCheck: string | null;
  interactive: boolean;
  onSquareSelect: (square: string) => void;
  onMoveAttempt: (from: string, to: string) => void;
  onFlipOrientation?: () => void;
  onSwitchTo2D?: () => void;
  visualSettings?: ArenaVisualSettings;
  onUpdateVisualSettings?: (partial: Partial<ArenaVisualSettings>) => void;
}

// Module-level pre-allocated math objects to guarantee zero GC inside the render & input loops
const _camTargetPos = new THREE.Vector3();
const _camLookAtPos = new THREE.Vector3(0, 0, 0);
const _planeIntersect = new THREE.Vector3();
const _boardHitVec = new THREE.Vector3();
const _boxHitVec = new THREE.Vector3();
const _pieceHitBox = new THREE.Box3();
const _dragBoardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25);
const _boardSurfacePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.036);
const _upVec = new THREE.Vector3(0, 1, 0);
const _instanceMatrix = new THREE.Matrix4();

const UNICODE_PIECES: Record<PieceColor, Record<PieceSymbol, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

const CHARACTER_CLASS_NAMES: Record<PieceSymbol, string> = {
  k: 'Raja Monarki',
  q: 'Ratu Penguasa',
  r: 'Golem Benteng',
  b: 'Uskup Mistik',
  n: 'Kavaleri Kuda',
  p: 'Infanteri Pion',
};

const PIECE_HITBOX_HEIGHTS: Record<PieceSymbol, number> = {
  p: 0.92,
  r: 1.15,
  n: 1.25,
  b: 1.28,
  q: 1.32,
  k: 1.38,
};

const QUALITY_LABELS: Record<GraphicsQualityPreset, string> = {
  low: 'LOW',
  medium: 'MED',
  high: 'HIGH',
  ultra: 'ULTRA',
};

function squareToWorldXZ(square: string): { x: number; z: number } {
  const { fileIndex, rankIndex } = squareToIndices(square);
  return {
    x: fileIndex - 3.5,
    z: 3.5 - rankIndex,
  };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function createCoordinateFrameTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 512, 512);
    ctx.fillStyle = '#E5B85B';
    ctx.font = '700 16px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    for (let i = 0; i < 8; i++) {
      const center = 36 + i * 55 + 27.5;
      ctx.fillText(files[i], center, 494);
      ctx.save();
      ctx.translate(center, 18);
      ctx.rotate(Math.PI);
      ctx.fillText(files[i], 0, 0);
      ctx.restore();

      ctx.fillText(ranks[i], 18, center);
      ctx.save();
      ctx.translate(494, center);
      ctx.rotate(Math.PI);
      ctx.fillText(ranks[i], 0, 0);
      ctx.restore();
    }

    ctx.strokeStyle = '#C49A45';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(34, 34, 444, 444);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates a clear 3D arched trajectory ribbon + directional arrowhead cone
 * from `fromSquare` to `toSquare` so piece movements are immediately visible.
 */
function create3DTrajectoryArrow(
  fromSq: string,
  toSq: string,
  colorHex: string,
  opacity = 0.85,
  arcHeight = 0.36
): THREE.Group {
  const group = new THREE.Group();
  const { x: x1, z: z1 } = squareToWorldXZ(fromSq);
  const { x: x2, z: z2 } = squareToWorldXZ(toSq);

  const dx = x2 - x1;
  const dz = z2 - z1;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.05) return group;

  const dirX = dx / dist;
  const dirZ = dz / dist;

  const endX = x2 - dirX * 0.22;
  const endZ = z2 - dirZ * 0.22;

  const startPt = new THREE.Vector3(x1, 0.07, z1);
  const midPt = new THREE.Vector3(
    (x1 + endX) * 0.5,
    0.09 + Math.min(0.62, arcHeight + dist * 0.06),
    (z1 + endZ) * 0.5
  );
  const endPt = new THREE.Vector3(endX, 0.14, endZ);

  const curve = new THREE.QuadraticBezierCurve3(startPt, midPt, endPt);
  const tubeGeo = new THREE.TubeGeometry(curve, 14, 0.04, 6, false);
  const tubeMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
  tubeMesh.matrixAutoUpdate = false;
  tubeMesh.updateMatrix();
  group.add(tubeMesh);

  const tangent = curve.getTangent(1).normalize();
  const coneGeo = new THREE.ConeGeometry(0.125, 0.27, 10);
  const coneMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: Math.min(1, opacity + 0.08),
    depthWrite: false,
  });
  const coneMesh = new THREE.Mesh(coneGeo, coneMat);
  coneMesh.position.copy(endPt);
  coneMesh.quaternion.setFromUnitVectors(_upVec, tangent);
  coneMesh.matrixAutoUpdate = false;
  coneMesh.updateMatrix();
  group.add(coneMesh);

  const originRingGeo = new THREE.RingGeometry(0.18, 0.27, 18);
  originRingGeo.rotateX(-Math.PI / 2);
  const originRingMesh = new THREE.Mesh(originRingGeo, tubeMat);
  originRingMesh.position.set(x1, 0.048, z1);
  originRingMesh.matrixAutoUpdate = false;
  originRingMesh.updateMatrix();
  group.add(originRingMesh);

  group.userData = { disposableArrow: true };
  return group;
}

function disposeArrowGroup(group: THREE.Group) {
  group.traverse((child) => {
    const m = child as THREE.Mesh;
    if (m.isMesh) {
      m.geometry?.dispose();
      if (m.material && !Array.isArray(m.material)) {
        m.material.dispose();
      }
    }
  });
}

interface AnimatedPieceEntry {
  key: string;
  type: PieceSymbol;
  color: PieceColor;
  square: string;
  group: THREE.Group;
  rig: LivingCharacterRig | null;
  glbPiece: GlbPieceInstance | null;
  currentX: number;
  currentZ: number;
  currentY: number;
  moveStartX: number;
  moveStartZ: number;
  targetX: number;
  targetZ: number;
  moveStartTimeSec: number;
  moveDurationSec: number;
  isMoving: boolean;
  isKnightJump: boolean;
  motionTrailRing: THREE.Mesh;
}

interface DefeatedDuelGhost {
  group: THREE.Group;
  rig: LivingCharacterRig | null;
  glbPiece: GlbPieceInstance | null;
  impactRing: THREE.Mesh;
  startTimeSec: number;
  durationSec: number;
}

export default function ChessBoard3D({
  fen,
  orientation,
  selectedSquare,
  legalMoves,
  lastMove,
  lastCaptureDuel = null,
  hintMove = null,
  kingSquareInCheck,
  interactive,
  onSquareSelect,
  onMoveAttempt,
  onFlipOrientation,
  onSwitchTo2D,
  visualSettings = DEFAULT_VISUAL_SETTINGS,
  onUpdateVisualSettings,
}: ChessBoard3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglFallback, setWebglFallback] = useState(false);
  const [use2DBoard, setUse2DBoard] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraViewPreset>(
    orientation === 'w' ? 'white' : 'black'
  );
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [showMoveArrow, setShowMoveArrow] = useState(true);
  const [activeDuelBanner, setActiveDuelBanner] = useState<CaptureDuelEvent | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<{
    loaded: number;
    total: number;
    label: string;
  } | null>({ loaded: 0, total: 7, label: 'Infanteri Pion' });

  const lastProcessedDuelIdRef = useRef<string | null>(null);

  const propsRef = useRef({
    fen,
    orientation,
    selectedSquare,
    legalMoves,
    lastMove,
    lastCaptureDuel,
    hintMove,
    kingSquareInCheck,
    interactive,
    onSquareSelect,
    onMoveAttempt,
    visualSettings,
    showMoveArrow,
  });

  useEffect(() => {
    propsRef.current = {
      fen,
      orientation,
      selectedSquare,
      legalMoves,
      lastMove,
      lastCaptureDuel,
      hintMove,
      kingSquareInCheck,
      interactive,
      onSquareSelect,
      onMoveAttempt,
      visualSettings,
      showMoveArrow,
    };
  }, [
    fen,
    orientation,
    selectedSquare,
    legalMoves,
    lastMove,
    lastCaptureDuel,
    hintMove,
    kingSquareInCheck,
    interactive,
    onSquareSelect,
    onMoveAttempt,
    visualSettings,
    showMoveArrow,
  ]);

  const triggerSceneSyncRef = useRef<((forceRebuildPieces?: boolean) => void) | null>(null);
  const triggerCameraPresetRef = useRef<((preset: CameraViewPreset) => void) | null>(null);
  const triggerDuelSequenceRef = useRef<((duel: CaptureDuelEvent) => void) | null>(null);
  const applyQualitySettingsRef = useRef<(() => void) | null>(null);

  // Keep camera orientation synced when player flips board
  useEffect(() => {
    const nextPreset: CameraViewPreset = orientation === 'w' ? 'white' : 'black';
    queueMicrotask(() => setCameraPreset(nextPreset));
    if (triggerCameraPresetRef.current) {
      triggerCameraPresetRef.current(nextPreset);
    }
  }, [orientation]);

  // Trigger scene piece/highlight update whenever board state props change
  useEffect(() => {
    if (triggerSceneSyncRef.current) {
      triggerSceneSyncRef.current(false);
    }
  }, [fen, selectedSquare, legalMoves, lastMove, hintMove, kingSquareInCheck, showMoveArrow]);

  // Dynamically apply quality/shadow/pieceStyle changes WITHOUT tearing down the WebGL context
  useEffect(() => {
    if (applyQualitySettingsRef.current) {
      applyQualitySettingsRef.current();
    }
    if (triggerSceneSyncRef.current) {
      triggerSceneSyncRef.current(true);
    }
  }, [
    visualSettings.pieceStyle,
    visualSettings.graphicsQuality,
    visualSettings.shadows,
    visualSettings.showChamberRoom,
  ]);

  // Trigger capture duel animation when a new capture event arrives
  useEffect(() => {
    if (!lastCaptureDuel) return;
    if (lastCaptureDuel.id === lastProcessedDuelIdRef.current) return;
    lastProcessedDuelIdRef.current = lastCaptureDuel.id;

    if (visualSettings.cinematicCaptures !== 'off') {
      queueMicrotask(() => setActiveDuelBanner(lastCaptureDuel));
      if (triggerDuelSequenceRef.current) {
        triggerDuelSequenceRef.current(lastCaptureDuel);
      }
      const timer = setTimeout(() => {
        setActiveDuelBanner((prev) => (prev?.id === lastCaptureDuel.id ? null : prev));
      }, 2100);
      return () => clearTimeout(timer);
    }
  }, [lastCaptureDuel, visualSettings.cinematicCaptures]);

  const pieceStyle = visualSettings.pieceStyle;

  useEffect(() => {
    if (use2DBoard) return;
    const container = mountRef.current;
    if (!container) return;

    let disposed = false;
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastFrameTime = performance.now();

    // 1. Software WebGL detection
    const isSoftwareGl = (() => {
      try {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      queueMicrotask(() => setWebglFallback(true));
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    renderer.setSize(width, height);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Scene, Fog & Subdued Studio Reflection Environment
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090706');
    scene.fog = new THREE.FogExp2('#090706', 0.022);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    if ('environmentIntensity' in scene) {
      (scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity = 0.25;
    }
    pmremGenerator.dispose();

    // 3. Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.5, 95);
    const initialZ = propsRef.current.orientation === 'w' ? 8.8 : -8.8;
    camera.position.set(0, 7.8, initialZ);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.1;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minPolarAngle = 0.08;
    controls.minDistance = 4.2;
    controls.maxDistance = 24.0;
    controls.enablePan = false;
    controls.target.set(0, 0.25, 0);

    // 4. Adaptive Lighting Rig (Scales from lightweight LOW to cinematic dual-shadow ULTRA)
    const hemiLight = new THREE.HemisphereLight('#D9C3A3', '#140F0C', 0.36);
    hemiLight.position.set(0, 18, 0);
    hemiLight.matrixAutoUpdate = false;
    hemiLight.updateMatrix();
    scene.add(hemiLight);

    // Sanctuary Key Light
    const keyLight = new THREE.DirectionalLight('#F2CE99', 1.05);
    keyLight.position.set(5.2, 12.2, 6.2);
    keyLight.matrixAutoUpdate = false;
    keyLight.updateMatrix();
    const d = 5.2;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 26;
    keyLight.shadow.radius = 3.5;
    keyLight.shadow.bias = -0.0003;
    keyLight.shadow.normalBias = 0.015;
    scene.add(keyLight);

    // Focused Overhead Altar Pool SpotLight (casts realistic radial contact shadows on ULTRA)
    const altarSpotLight = new THREE.SpotLight('#F5D7A1', 1.3, 22, Math.PI / 3.8, 0.82, 1.5);
    altarSpotLight.position.set(0, 9.6, 0);
    altarSpotLight.target.position.set(0, 0, 0);
    altarSpotLight.matrixAutoUpdate = false;
    altarSpotLight.updateMatrix();
    altarSpotLight.shadow.mapSize.width = 1024;
    altarSpotLight.shadow.mapSize.height = 1024;
    altarSpotLight.shadow.camera.near = 3;
    altarSpotLight.shadow.camera.far = 16;
    altarSpotLight.shadow.bias = -0.0002;
    altarSpotLight.shadow.radius = 4;
    scene.add(altarSpotLight);
    scene.add(altarSpotLight.target);

    // Rose Window Stained-Glass Grazing SpotLight (Active on HIGH / ULTRA for realistic cathedral chiaroscuro)
    const roseWindowSpotLight = new THREE.SpotLight('#E8964A', 1.25, 28, Math.PI / 4, 0.9, 1.4);
    roseWindowSpotLight.position.set(-10.5, 8.4, -7.2);
    roseWindowSpotLight.target.position.set(0, 0.3, 0);
    roseWindowSpotLight.matrixAutoUpdate = false;
    roseWindowSpotLight.updateMatrix();
    scene.add(roseWindowSpotLight);
    scene.add(roseWindowSpotLight.target);

    // Subtle Rose Window Directional Fill (Used on LOW / MEDIUM)
    const windowLight = new THREE.DirectionalLight('#D49B54', 0.36);
    windowLight.position.set(-11.5, 9.0, -8.0);
    windowLight.matrixAutoUpdate = false;
    windowLight.updateMatrix();
    scene.add(windowLight);

    // Soft Cool Rim Light for Obsidian piece silhouette separation
    const rimLight = new THREE.DirectionalLight('#6B96C2', 0.42);
    rimLight.position.set(4.5, 7.2, -9.8);
    rimLight.matrixAutoUpdate = false;
    rimLight.updateMatrix();
    scene.add(rimLight);

    // 5. Materials, Environment Container, & Fallback Caches
    const materials = createChessMaterialSet(renderer, isSoftwareGl);
    const stauntonCache = createStauntonGeometryCache();
    const livingCache = createLivingCharacterGeometryCache();

    const fallbackChamber = createGrandChessChamber(materials);
    scene.add(fallbackChamber.group);

    let cathedralInstance: CathedralSceneInstance | null = null;

    const boardGroup = new THREE.Group();
    boardGroup.matrixAutoUpdate = false;
    scene.add(boardGroup);

    // Sleek Obsidian-Brass Frame (8.62 x 0.08 x 8.62) sized to fit inside Opt8_Altar_Golden_Runes (±4.32)
    const outerFrameGeo = new THREE.BoxGeometry(8.62, 0.08, 8.62);
    outerFrameGeo.translate(0, -0.02, 0);
    const outerFrameMesh = new THREE.Mesh(outerFrameGeo, materials.walnutFrame);
    outerFrameMesh.receiveShadow = true;
    outerFrameMesh.matrixAutoUpdate = false;
    boardGroup.add(outerFrameMesh);

    // Coordinate & Brass Frame Overlay Plane
    const coordTex = createCoordinateFrameTexture(
      Math.min(renderer.capabilities.getMaxAnisotropy(), 4)
    );
    const coordPlaneGeo = new THREE.PlaneGeometry(8.58, 8.58);
    coordPlaneGeo.rotateX(-Math.PI / 2);
    const coordPlaneMat = new THREE.MeshBasicMaterial({
      map: coordTex,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const coordPlaneMesh = new THREE.Mesh(coordPlaneGeo, coordPlaneMat);
    coordPlaneMesh.position.y = 0.022;
    coordPlaneMesh.matrixAutoUpdate = false;
    coordPlaneMesh.updateMatrix();
    boardGroup.add(coordPlaneMesh);

    // 64 Board Squares batched into just 2 InstancedMesh draw calls (32 light + 32 dark)
    const squareGeo = new THREE.BoxGeometry(1.0, 0.05, 1.0);
    const lightSquaresInstanced = new THREE.InstancedMesh(squareGeo, materials.mapleSquare, 32);
    const darkSquaresInstanced = new THREE.InstancedMesh(squareGeo, materials.walnutSquare, 32);
    lightSquaresInstanced.receiveShadow = true;
    darkSquaresInstanced.receiveShadow = true;
    lightSquaresInstanced.matrixAutoUpdate = false;
    darkSquaresInstanced.matrixAutoUpdate = false;

    let lightIdx = 0;
    let darkIdx = 0;
    for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
      for (let fileIdx = 0; fileIdx < 8; fileIdx++) {
        const isLight = (rankIdx + fileIdx) % 2 !== 0;
        _instanceMatrix.makeTranslation(fileIdx - 3.5, 0.01, 3.5 - rankIdx);
        if (isLight) {
          lightSquaresInstanced.setMatrixAt(lightIdx++, _instanceMatrix);
        } else {
          darkSquaresInstanced.setMatrixAt(darkIdx++, _instanceMatrix);
        }
      }
    }
    lightSquaresInstanced.instanceMatrix.needsUpdate = true;
    darkSquaresInstanced.instanceMatrix.needsUpdate = true;
    lightSquaresInstanced.computeBoundingSphere();
    darkSquaresInstanced.computeBoundingSphere();
    boardGroup.add(lightSquaresInstanced);
    boardGroup.add(darkSquaresInstanced);
    boardGroup.updateMatrixWorld(true);

    // Dynamic Quality Configurator (switches LOW potato mode <-> ULTRA realistic mode on the fly)
    function applyQualityToScene() {
      const { graphicsQuality: q, shadows: shMode, showChamberRoom } = propsRef.current.visualSettings;
      const isLow = q === 'low';
      const isUltra = q === 'ultra';
      const isHighOrUltra = q === 'high' || q === 'ultra';
      const enableShadows = !isSoftwareGl && !isLow && shMode !== 'off';

      // Cap pixel ratio aggressively on LOW (0.85) so integrated laptop GPUs never bottleneck on fill-rate
      const targetDpr = isLow ? 0.85 : q === 'medium' ? 1.15 : q === 'high' ? 1.5 : 2.0;
      renderer.setPixelRatio(
        isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, targetDpr)
      );
      renderer.shadowMap.enabled = enableShadows;

      // Calibrate exposure & environment reflection for ULTRA realism vs LOW clarity
      renderer.toneMappingExposure = isUltra ? 0.88 : isLow ? 0.85 : 0.82;
      if ('environmentIntensity' in scene) {
        (scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity = isUltra
          ? 0.34
          : isLow
          ? 0.22
          : 0.26;
      }

      hemiLight.intensity = isUltra ? 0.28 : isLow ? 0.48 : 0.35;
      keyLight.intensity = isUltra ? 1.32 : isLow ? 1.1 : 1.15;
      keyLight.castShadow = enableShadows;

      if (enableShadows) {
        const targetMapDim = isUltra ? 2048 : q === 'high' ? 1536 : 1024;
        if (keyLight.shadow.mapSize.width !== targetMapDim) {
          keyLight.shadow.mapSize.width = targetMapDim;
          keyLight.shadow.mapSize.height = targetMapDim;
          keyLight.shadow.map?.dispose();
          keyLight.shadow.map = null;
        }
      }

      // Overhead Altar SpotLight & Rose Window Grazing Light
      altarSpotLight.visible = !isLow;
      altarSpotLight.intensity = isUltra ? 1.95 : 1.25;
      altarSpotLight.castShadow = !isSoftwareGl && isUltra && enableShadows;

      roseWindowSpotLight.visible = !isSoftwareGl && isHighOrUltra;
      roseWindowSpotLight.intensity = isUltra ? 1.35 : 0.85;

      windowLight.visible = !isHighOrUltra;
      rimLight.intensity = isUltra ? 0.58 : 0.36;

      if (cathedralInstance) {
        cathedralInstance.applyQuality(q, showChamberRoom, isSoftwareGl);
      } else {
        fallbackChamber.setQualityVisibility(q, showChamberRoom);
      }

      requestRender();
    }
    applyQualitySettingsRef.current = applyQualityToScene;

    // Highlight Overlays & Trajectory Arrows Group
    const highlightsGroup = new THREE.Group();
    scene.add(highlightsGroup);

    const hoverPreviewGroup = new THREE.Group();
    scene.add(hoverPreviewGroup);

    const highlightPlaneGeo = new THREE.PlaneGeometry(0.94, 0.94);
    highlightPlaneGeo.rotateX(-Math.PI / 2);

    const squareBorderRingGeo = new THREE.RingGeometry(0.41, 0.48, 4);
    squareBorderRingGeo.rotateX(-Math.PI / 2);
    squareBorderRingGeo.rotateY(Math.PI / 4);

    const destBorderMat = new THREE.MeshBasicMaterial({
      color: '#FBBF24',
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    const legalDotGeo = new THREE.CylinderGeometry(0.17, 0.19, 0.045, 18);
    const legalOuterRingGeo = new THREE.RingGeometry(0.24, 0.31, 20);
    legalOuterRingGeo.rotateX(-Math.PI / 2);

    const legalRingGeo = new THREE.RingGeometry(0.36, 0.46, 24);
    legalRingGeo.rotateX(-Math.PI / 2);

    const checkRingGeo = new THREE.RingGeometry(0.36, 0.48, 24);
    checkRingGeo.rotateX(-Math.PI / 2);

    const duelImpactRingGeo = new THREE.RingGeometry(0.18, 0.48, 24);
    duelImpactRingGeo.rotateX(-Math.PI / 2);

    const motionTrailRingGeo = new THREE.RingGeometry(0.22, 0.42, 20);
    motionTrailRingGeo.rotateX(-Math.PI / 2);

    const whiteTrailMat = new THREE.MeshBasicMaterial({
      color: '#38BDF8',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const blackTrailMat = new THREE.MeshBasicMaterial({
      color: '#F59E0B',
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Active 3D Pieces Group & Duel Ghosts Group
    const piecesRootGroup = new THREE.Group();
    piecesRootGroup.position.y = 0.036;
    scene.add(piecesRootGroup);

    const duelGhostsGroup = new THREE.Group();
    duelGhostsGroup.position.y = 0.036;
    scene.add(duelGhostsGroup);

    const activePieces = new Map<string, AnimatedPieceEntry>();
    const defeatedGhosts: DefeatedDuelGhost[] = [];
    const legalIndicatorMeshes: THREE.Object3D[] = [];

    // Camera Transition & Duel Cut-in State
    let activeCameraTransition = false;
    let savedPreDuelCamPos: THREE.Vector3 | null = null;
    let savedPreDuelTarget: THREE.Vector3 | null = null;
    let duelCameraReturnDeadlineSec = 0;

    function setCameraGoal(preset: CameraViewPreset) {
      savedPreDuelCamPos = null;
      savedPreDuelTarget = null;
      _camLookAtPos.set(0, 0.25, 0);

      if (preset === 'white') {
        _camTargetPos.set(0, 7.6, 8.6);
      } else if (preset === 'black') {
        _camTargetPos.set(0, 7.6, -8.6);
      } else if (preset === 'top') {
        const zOffset = propsRef.current.orientation === 'w' ? 0.9 : -0.9;
        _camTargetPos.set(0, 12.6, zOffset);
      } else if (preset === 'cinema') {
        const zSide = propsRef.current.orientation === 'w' ? 8.2 : -8.2;
        _camTargetPos.set(6.4, 5.6, zSide);
      } else if (preset === 'inspection') {
        const zSide = propsRef.current.orientation === 'w' ? 5.6 : -5.6;
        _camTargetPos.set(-3.4, 3.2, zSide);
        _camLookAtPos.set(0, 0.55, 0);
      }
      activeCameraTransition = true;
      requestRender();
    }
    triggerCameraPresetRef.current = setCameraGoal;

    controls.addEventListener('start', () => {
      activeCameraTransition = false;
      savedPreDuelCamPos = null;
    });
    controls.addEventListener('change', () => {
      requestRender();
    });

    function buildPieceVisual(type: PieceSymbol, color: PieceColor): {
      group: THREE.Group;
      rig: LivingCharacterRig | null;
      glbPiece: GlbPieceInstance | null;
    } {
      const { graphicsQuality: q, shadows: shMode, pieceStyle: pStyle } = propsRef.current.visualSettings;
      const enableShadows = !isSoftwareGl && q !== 'low' && shMode !== 'off';

      if (pStyle === 'living') {
        const glbInst = buildGlbPieceInstance(type, color, enableShadows, isSoftwareGl, q);
        if (glbInst) {
          return { group: glbInst.rootGroup, rig: null, glbPiece: glbInst };
        }
        const rig = buildLivingCharacterRig(
          type,
          color,
          materials,
          livingCache,
          Math.random() * Math.PI * 2,
          enableShadows
        );
        return { group: rig.rootGroup, rig, glbPiece: null };
      }
      const group = stauntonCache.createPieceGroup(type, color, materials);
      return { group, rig: null, glbPiece: null };
    }

    // Trigger a duel sequence when a piece captures an opponent (using GLB Attack + Shatter animations)
    function triggerDuelSequence(duel: CaptureDuelEvent) {
      const nowSec = performance.now() / 1000;
      const mode = propsRef.current.visualSettings.cinematicCaptures;
      if (mode === 'off') return;

      const { x: toX, z: toZ } = squareToWorldXZ(duel.to);
      const { x: fromX, z: fromZ } = squareToWorldXZ(duel.from);

      // 1. Find the attacking piece that moved to `duel.to` and play its Attack animation
      for (const entry of activePieces.values()) {
        if (entry.square === duel.to && entry.color === duel.attackerColor) {
          const angle = Math.atan2(toX - fromX, toZ - fromZ);
          entry.group.rotation.y = angle;
          if (entry.glbPiece) {
            entry.glbPiece.setAnimState('attack', 1.3);
          } else if (entry.rig) {
            entry.rig.animState = 'attack';
            entry.rig.stateStartTime = nowSec;
          }
          break;
        }
      }

      // 2. Spawn defeated defender piece on the target square playing its GLB 'Shatter' animation
      const { group: defGroup, rig: defRig, glbPiece: defGlb } = buildPieceVisual(
        duel.defenderType,
        duel.defenderColor
      );
      defGroup.position.set(toX, 0, toZ);
      defGroup.rotation.y = Math.atan2(fromX - toX, fromZ - toZ);
      if (defGlb) {
        defGlb.setAnimState('shatter', 1.2);
      } else if (defRig) {
        defRig.animState = 'defeat';
        defRig.stateStartTime = nowSec;
      }
      duelGhostsGroup.add(defGroup);

      // 3. Impact shockwave ring on the capture square
      const impactMat = new THREE.MeshBasicMaterial({
        color: duel.attackerColor === 'w' ? '#38BDF8' : '#E11D48',
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const impactRing = new THREE.Mesh(duelImpactRingGeo, impactMat);
      impactRing.position.set(toX, 0.05, toZ);
      duelGhostsGroup.add(impactRing);

      defeatedGhosts.push({
        group: defGroup,
        rig: defRig,
        glbPiece: defGlb,
        impactRing,
        startTimeSec: nowSec,
        durationSec: 1.2,
      });

      // 4. Optional brief Cinematic Camera focus (~1.35s) if mode === 'on'
      if (mode === 'on') {
        if (!savedPreDuelCamPos) {
          savedPreDuelCamPos = camera.position.clone();
          savedPreDuelTarget = controls.target.clone();
        }
        const zDir = propsRef.current.orientation === 'w' ? 4.4 : -4.4;
        const sideOffset = toX >= 0 ? -2.8 : 2.8;
        _camTargetPos.set(toX + sideOffset, 3.9, toZ + zDir);
        _camLookAtPos.set(toX, 0.55, toZ);
        activeCameraTransition = true;
        duelCameraReturnDeadlineSec = nowSec + 1.35;
      }

      requestRender();
    }
    triggerDuelSequenceRef.current = triggerDuelSequence;

    // Synchronize 3D pieces, trajectory arrows, and square highlights with current FEN & selection
    function syncSceneWithProps(forceRebuildPieces = false) {
      const {
        fen: currentFen,
        selectedSquare: selSq,
        legalMoves: legMoves,
        lastMove: lstMove,
        hintMove: hntMove,
        kingSquareInCheck: checkSq,
        showMoveArrow: showArrow,
      } = propsRef.current;

      if (forceRebuildPieces) {
        for (const oldEntry of activePieces.values()) {
          piecesRootGroup.remove(oldEntry.group);
          piecesRootGroup.remove(oldEntry.motionTrailRing);
        }
        activePieces.clear();
      }

      // 1. Rebuild highlights & 3D Trajectory Arrows cleanly
      while (highlightsGroup.children.length > 0) {
        const child = highlightsGroup.children[0];
        if (child.userData?.disposableArrow) {
          disposeArrowGroup(child as THREE.Group);
        }
        highlightsGroup.remove(child);
      }
      legalIndicatorMeshes.length = 0;

      if (selSq) {
        const { x, z } = squareToWorldXZ(selSq);
        const m = new THREE.Mesh(highlightPlaneGeo, materials.selectedHighlight);
        m.position.set(x, 0.042, z);
        m.matrixAutoUpdate = false;
        m.updateMatrix();
        highlightsGroup.add(m);
      }

      if (lstMove) {
        [lstMove.from, lstMove.to].forEach((sq, idx) => {
          const { x, z } = squareToWorldXZ(sq);
          const m = new THREE.Mesh(highlightPlaneGeo, materials.lastMoveHighlight);
          m.position.set(x, 0.039, z);
          m.matrixAutoUpdate = false;
          m.updateMatrix();
          highlightsGroup.add(m);

          if (idx === 1) {
            const destBorder = new THREE.Mesh(squareBorderRingGeo, destBorderMat);
            destBorder.position.set(x, 0.046, z);
            destBorder.matrixAutoUpdate = false;
            destBorder.updateMatrix();
            highlightsGroup.add(destBorder);
          }
        });

        if (showArrow) {
          const arrowGroup = create3DTrajectoryArrow(
            lstMove.from,
            lstMove.to,
            '#FBBF24',
            0.84,
            0.36
          );
          highlightsGroup.add(arrowGroup);
        }
      }

      if (hntMove) {
        [hntMove.from, hntMove.to].forEach((sq) => {
          const { x, z } = squareToWorldXZ(sq);
          const m = new THREE.Mesh(highlightPlaneGeo, materials.hintHighlight);
          m.position.set(x, 0.044, z);
          m.matrixAutoUpdate = false;
          m.updateMatrix();
          highlightsGroup.add(m);
        });
        const hintArrow = create3DTrajectoryArrow(
          hntMove.from,
          hntMove.to,
          '#10B981',
          0.9,
          0.44
        );
        highlightsGroup.add(hintArrow);
      }

      if (checkSq) {
        const { x, z } = squareToWorldXZ(checkSq);
        const m = new THREE.Mesh(checkRingGeo, materials.checkAlertRing);
        m.position.set(x, 0.048, z);
        m.matrixAutoUpdate = false;
        m.updateMatrix();
        highlightsGroup.add(m);
      }

      // Legal Move & Capture Target Beacons
      for (const mv of legMoves) {
        const { x, z } = squareToWorldXZ(mv.to);
        const isCap = Boolean(mv.captured) || mv.isEnPassant;

        if (isCap) {
          const capGroup = new THREE.Group();
          capGroup.position.set(x, 0.048, z);

          const baseRing = new THREE.Mesh(legalRingGeo, materials.legalCaptureRing);
          baseRing.matrixAutoUpdate = false;
          capGroup.add(baseRing);

          const upperRing = new THREE.Mesh(legalRingGeo, materials.legalCaptureRing);
          upperRing.position.y = 0.26;
          upperRing.scale.setScalar(1.08);
          upperRing.matrixAutoUpdate = false;
          upperRing.updateMatrix();
          capGroup.add(upperRing);

          capGroup.userData = { square: mv.to };
          highlightsGroup.add(capGroup);
          legalIndicatorMeshes.push(capGroup);
        } else {
          const moveBeaconGroup = new THREE.Group();
          moveBeaconGroup.position.set(x, 0.052, z);

          const dot = new THREE.Mesh(legalDotGeo, materials.legalMoveDot);
          dot.matrixAutoUpdate = false;
          moveBeaconGroup.add(dot);

          const outerRing = new THREE.Mesh(legalOuterRingGeo, materials.selectedHighlight);
          outerRing.position.y = -0.008;
          outerRing.matrixAutoUpdate = false;
          outerRing.updateMatrix();
          moveBeaconGroup.add(outerRing);

          moveBeaconGroup.userData = { square: mv.to };
          highlightsGroup.add(moveBeaconGroup);
          legalIndicatorMeshes.push(moveBeaconGroup);
        }
      }

      // 2. Reconcile Pieces (Zero scene-graph traversal on existing pieces!)
      const nextPieces: BoardPiece[] = parseBoardFromFen(currentFen);
      const matchedOldKeys = new Set<string>();
      const nextMap = new Map<string, AnimatedPieceEntry>();
      const nowSec = performance.now() / 1000;

      const unmatchedNext: BoardPiece[] = [];
      for (const np of nextPieces) {
        let foundKey: string | null = null;
        for (const [k, oldEntry] of activePieces.entries()) {
          if (
            !matchedOldKeys.has(k) &&
            oldEntry.square === np.square &&
            oldEntry.type === np.type &&
            oldEntry.color === np.color
          ) {
            foundKey = k;
            break;
          }
        }
        if (foundKey) {
          matchedOldKeys.add(foundKey);
          const entry = activePieces.get(foundKey)!;
          const { x, z } = squareToWorldXZ(np.square);
          entry.targetX = x;
          entry.targetZ = z;
          if (entry.glbPiece) {
            entry.glbPiece.setSelected(selSq === np.square);
          }
          nextMap.set(foundKey, entry);
        } else {
          unmatchedNext.push(np);
        }
      }

      // Second pass: match moved pieces
      for (const np of unmatchedNext) {
        let foundKey: string | null = null;
        for (const [k, oldEntry] of activePieces.entries()) {
          if (
            !matchedOldKeys.has(k) &&
            oldEntry.color === np.color &&
            lstMove &&
            oldEntry.square === lstMove.from &&
            np.square === lstMove.to
          ) {
            foundKey = k;
            break;
          }
        }
        if (!foundKey) {
          for (const [k, oldEntry] of activePieces.entries()) {
            if (
              !matchedOldKeys.has(k) &&
              oldEntry.color === np.color &&
              oldEntry.type === np.type
            ) {
              foundKey = k;
              break;
            }
          }
        }

        const { x, z } = squareToWorldXZ(np.square);

        if (foundKey) {
          matchedOldKeys.add(foundKey);
          const entry = activePieces.get(foundKey)!;
          if (entry.type !== np.type) {
            piecesRootGroup.remove(entry.group);
            const built = buildPieceVisual(np.type, np.color);
            built.group.position.set(entry.currentX, 0, entry.currentZ);
            piecesRootGroup.add(built.group);
            entry.group = built.group;
            entry.rig = built.rig;
            entry.glbPiece = built.glbPiece;
            entry.type = np.type;
          }

          const moveDx = x - entry.currentX;
          const moveDz = z - entry.currentZ;
          if (Math.hypot(moveDx, moveDz) > 0.05) {
            entry.group.rotation.y = Math.atan2(moveDx, moveDz);
            entry.moveStartX = entry.currentX;
            entry.moveStartZ = entry.currentZ;
            entry.moveStartTimeSec = nowSec;
            entry.isKnightJump = np.type === 'n';
            entry.moveDurationSec = entry.isKnightJump ? 0.56 : 0.46;
            entry.isMoving = true;
            entry.motionTrailRing.visible = true;

            if (entry.glbPiece && entry.glbPiece.currentState !== 'attack') {
              entry.glbPiece.setAnimState('move', 1.45);
            } else if (entry.rig && entry.rig.animState !== 'attack') {
              entry.rig.animState = np.type === 'n' ? 'leap' : 'walk';
              entry.rig.stateStartTime = nowSec;
            }
          }

          entry.square = np.square;
          entry.targetX = x;
          entry.targetZ = z;
          if (entry.glbPiece) {
            entry.glbPiece.setSelected(selSq === np.square);
          }
          nextMap.set(foundKey, entry);
        } else {
          const newKey = `${np.color}-${np.type}-${np.square}-${Math.random().toString(36).slice(2, 7)}`;
          const built = buildPieceVisual(np.type, np.color);
          const defaultYaw = np.color === 'w' ? Math.PI : 0;
          built.group.position.set(x, 0, z);
          built.group.rotation.y = defaultYaw;
          if (built.glbPiece) {
            built.glbPiece.setSelected(selSq === np.square);
          }
          piecesRootGroup.add(built.group);

          const motionTrailRing = new THREE.Mesh(
            motionTrailRingGeo,
            np.color === 'w' ? whiteTrailMat : blackTrailMat
          );
          motionTrailRing.position.set(x, 0.015, z);
          motionTrailRing.visible = false;
          piecesRootGroup.add(motionTrailRing);

          nextMap.set(newKey, {
            key: newKey,
            type: np.type,
            color: np.color,
            square: np.square,
            group: built.group,
            rig: built.rig,
            glbPiece: built.glbPiece,
            currentX: x,
            currentZ: z,
            currentY: 0,
            moveStartX: x,
            moveStartZ: z,
            targetX: x,
            targetZ: z,
            moveStartTimeSec: 0,
            moveDurationSec: 0.46,
            isMoving: false,
            isKnightJump: false,
            motionTrailRing,
          });
        }
      }

      for (const [k, oldEntry] of activePieces.entries()) {
        if (!matchedOldKeys.has(k)) {
          piecesRootGroup.remove(oldEntry.group);
          piecesRootGroup.remove(oldEntry.motionTrailRing);
        }
      }

      activePieces.clear();
      for (const [k, v] of nextMap.entries()) {
        activePieces.set(k, v);
      }

      requestRender();
    }

    triggerSceneSyncRef.current = syncSceneWithProps;

    // Progressive 2-stage loading:
    // Stage 1: Load 6 Piece GLBs first so the board is immediately playable with 3D GLB characters
    // Stage 2: Stream in the Gothic Cathedral & Obsidian Altar GLB right after
    preloadPieceGlbAssets((loaded, total, label) => {
      if (disposed) return;
      setLoadingProgress({ loaded, total, label });
    })
      .then(async () => {
        if (disposed) return;
        syncSceneWithProps(true);

        await preloadCathedralGlbAsset((loaded, total, label) => {
          if (disposed) return;
          setLoadingProgress(loaded >= total ? null : { loaded, total, label });
        });
        if (disposed) return;
        setLoadingProgress(null);

        const builtCathedral = buildCathedralEnvironmentInstance(
          Math.min(renderer.capabilities.getMaxAnisotropy(), 4),
          propsRef.current.visualSettings.graphicsQuality,
          isSoftwareGl
        );
        if (builtCathedral) {
          scene.remove(fallbackChamber.group);
          cathedralInstance = builtCathedral;
          cathedralInstance.applyQuality(
            propsRef.current.visualSettings.graphicsQuality,
            propsRef.current.visualSettings.showChamberRoom,
            isSoftwareGl
          );
          scene.add(cathedralInstance.group);
          requestRender();
        }
      })
      .catch(() => {
        if (!disposed) {
          setLoadingProgress(null);
        }
      });

    applyQualityToScene();

    // =========================================================================
    // ZERO-MESH O(1) MATHEMATICAL RAY PICKING (0.002ms vs 400ms SkinnedMesh Raycast!)
    // =========================================================================
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    let pointerDownPos: { x: number; y: number } | null = null;
    let draggedPieceEntry: AnimatedPieceEntry | null = null;
    let isDraggingPiece = false;
    let lastHoverTime = 0;
    let lastHoveredLegalSq: string | null = null;

    function getSquareFromEvent(e: PointerEvent): string | null {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;

      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const ray = raycaster.ray;

      // 1. Check board surface plane (y = 0.036)
      let boardSquare: string | null = null;
      let boardDistSq = Infinity;
      if (ray.intersectPlane(_boardSurfacePlane, _boardHitVec)) {
        if (
          _boardHitVec.x >= -4.0 &&
          _boardHitVec.x < 4.0 &&
          _boardHitVec.z >= -4.0 &&
          _boardHitVec.z < 4.0
        ) {
          const fIdx = Math.floor(_boardHitVec.x + 4.0);
          const rIdx = Math.floor(4.0 - _boardHitVec.z);
          if (fIdx >= 0 && fIdx < 8 && rIdx >= 0 && rIdx < 8) {
            boardSquare = indicesToSquare(fIdx, rIdx);
            boardDistSq = ray.origin.distanceToSquared(_boardHitVec);
          }
        }
      }

      // 2. When dragging a piece, always snap directly to the board square under the cursor
      if (isDraggingPiece) {
        return boardSquare;
      }

      // 3. Check lightweight mathematical AABBs of the active pieces (at most 32 boxes, 0 mesh triangles!)
      let closestPieceSquare: string | null = null;
      let closestPieceDistSq = Infinity;
      const halfW = 0.33;

      for (const entry of activePieces.values()) {
        const h = PIECE_HITBOX_HEIGHTS[entry.type] || 1.1;
        _pieceHitBox.min.set(entry.currentX - halfW, 0.036, entry.currentZ - halfW);
        _pieceHitBox.max.set(entry.currentX + halfW, 0.036 + h, entry.currentZ + halfW);

        if (ray.intersectBox(_pieceHitBox, _boxHitVec)) {
          const dSq = ray.origin.distanceToSquared(_boxHitVec);
          if (dSq < closestPieceDistSq) {
            closestPieceDistSq = dSq;
            closestPieceSquare = entry.square;
          }
        }
      }

      if (closestPieceSquare && closestPieceDistSq <= boardDistSq) {
        return closestPieceSquare;
      }

      return boardSquare || closestPieceSquare;
    }

    function updateHoverPreview(hoveredSq: string | null) {
      if (hoveredSq === lastHoveredLegalSq) return;
      lastHoveredLegalSq = hoveredSq;

      while (hoverPreviewGroup.children.length > 0) {
        const child = hoverPreviewGroup.children[0];
        if (child.userData?.disposableArrow) {
          disposeArrowGroup(child as THREE.Group);
        }
        hoverPreviewGroup.remove(child);
      }

      const { selectedSquare: selSq, legalMoves: legMoves } = propsRef.current;
      if (selSq && hoveredSq && selSq !== hoveredSq) {
        const matchingLegal = legMoves.find((m) => m.from === selSq && m.to === hoveredSq);
        if (matchingLegal) {
          const isCap = Boolean(matchingLegal.captured) || matchingLegal.isEnPassant;
          const previewArrow = create3DTrajectoryArrow(
            selSq,
            hoveredSq,
            isCap ? '#E11D48' : '#38BDF8',
            0.9,
            0.42
          );
          hoverPreviewGroup.add(previewArrow);
        }
      }
      requestRender();
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0 || !propsRef.current.interactive) return;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      const sq = getSquareFromEvent(e);
      if (!sq) return;

      for (const entry of activePieces.values()) {
        if (entry.square === sq) {
          draggedPieceEntry = entry;
          break;
        }
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (!propsRef.current.interactive) return;

      if (pointerDownPos && draggedPieceEntry) {
        const dx = e.clientX - pointerDownPos.x;
        const dy = e.clientY - pointerDownPos.y;
        if (!isDraggingPiece && Math.hypot(dx, dy) > 8) {
          isDraggingPiece = true;
          controls.enabled = false;
          if (propsRef.current.selectedSquare !== draggedPieceEntry.square) {
            propsRef.current.onSquareSelect(draggedPieceEntry.square);
          }
        }

        if (isDraggingPiece) {
          const rect = renderer.domElement.getBoundingClientRect();
          pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          if (raycaster.ray.intersectPlane(_dragBoardPlane, _planeIntersect)) {
            draggedPieceEntry.group.position.set(
              THREE.MathUtils.clamp(_planeIntersect.x, -3.8, 3.8),
              0.34,
              THREE.MathUtils.clamp(_planeIntersect.z, -3.8, 3.8)
            );
            const hoverSq = getSquareFromEvent(e);
            updateHoverPreview(hoverSq);
            requestRender();
          }
          return;
        }
      }

      const now = performance.now();
      if (now - lastHoverTime < 65) return;
      lastHoverTime = now;
      const hoveredSq = getSquareFromEvent(e);
      renderer.domElement.style.cursor = hoveredSq ? 'pointer' : 'grab';
      updateHoverPreview(hoveredSq);
    }

    function onPointerUp(e: PointerEvent) {
      if (e.button !== 0 || !propsRef.current.interactive) return;

      const targetSq = getSquareFromEvent(e);
      updateHoverPreview(null);

      if (isDraggingPiece && draggedPieceEntry) {
        const fromSq = draggedPieceEntry.square;
        draggedPieceEntry.group.position.set(
          draggedPieceEntry.currentX,
          0,
          draggedPieceEntry.currentZ
        );
        controls.enabled = true;
        isDraggingPiece = false;
        const movedPiece = draggedPieceEntry;
        draggedPieceEntry = null;
        pointerDownPos = null;

        if (targetSq && targetSq !== fromSq) {
          const isLegal = propsRef.current.legalMoves.some(
            (m) => m.from === movedPiece.square && m.to === targetSq
          );
          if (isLegal) {
            propsRef.current.onMoveAttempt(fromSq, targetSq);
            requestRender();
            return;
          }
        }
        requestRender();
        return;
      }

      if (pointerDownPos) {
        const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
        if (dist <= 8 && targetSq) {
          const { selectedSquare: selSq, legalMoves: legMoves } = propsRef.current;
          const isLegalTarget =
            selSq && legMoves.some((m) => m.from === selSq && m.to === targetSq);
          if (selSq && isLegalTarget) {
            propsRef.current.onMoveAttempt(selSq, targetSq);
          } else {
            propsRef.current.onSquareSelect(targetSq);
          }
        }
      }

      pointerDownPos = null;
      draggedPieceEntry = null;
      isDraggingPiece = false;
      controls.enabled = true;
    }

    const domEl = renderer.domElement;
    domEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    function handleContextLost(event: Event) {
      event.preventDefault();
      setWebglFallback(true);
    }
    domEl.addEventListener('webglcontextlost', handleContextLost);

    // 6. On-Demand + Adaptive Render Loop (0% Idle CPU/GPU on LOW, MEDIUM, & HIGH)
    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((now) => {
        renderDirty = false;
        const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
        lastFrameTime = now;
        const nowSec = now / 1000;

        const currentQuality = propsRef.current.visualSettings.graphicsQuality;
        const isUltra = !isSoftwareGl && currentQuality === 'ultra';
        const isHighOrUltra =
          !isSoftwareGl && (currentQuality === 'high' || currentQuality === 'ultra');

        // Only loop continuously in ULTRA mode; in LOW, MEDIUM, and HIGH modes,
        // render strictly on-demand when an animation, duel, or camera movement is active!
        let needsMoreFrames = isUltra;

        // Return camera to player view after duel focus completes
        if (savedPreDuelCamPos && savedPreDuelTarget && nowSec >= duelCameraReturnDeadlineSec) {
          _camTargetPos.copy(savedPreDuelCamPos);
          _camLookAtPos.copy(savedPreDuelTarget);
          savedPreDuelCamPos = null;
          savedPreDuelTarget = null;
          activeCameraTransition = true;
        }

        // Smooth camera preset / duel transition
        if (activeCameraTransition) {
          camera.position.x = THREE.MathUtils.damp(
            camera.position.x,
            _camTargetPos.x,
            7.5,
            dt
          );
          camera.position.y = THREE.MathUtils.damp(
            camera.position.y,
            _camTargetPos.y,
            7.5,
            dt
          );
          camera.position.z = THREE.MathUtils.damp(
            camera.position.z,
            _camTargetPos.z,
            7.5,
            dt
          );
          controls.target.lerp(_camLookAtPos, 1 - Math.exp(-8 * dt));
          if (camera.position.distanceToSquared(_camTargetPos) < 0.002) {
            camera.position.copy(_camTargetPos);
            activeCameraTransition = false;
          } else {
            needsMoreFrames = true;
          }
        }

        if (!isSoftwareGl) {
          const controlsChanged = controls.update();
          if (controlsChanged) needsMoreFrames = true;
        } else {
          camera.lookAt(controls.target);
        }

        // Update Cathedral Brazier Flames & Dust Motes only on High / Ultra
        if (isHighOrUltra) {
          if (cathedralInstance) {
            cathedralInstance.update(nowSec, currentQuality);
          } else {
            fallbackChamber.update(nowSec, currentQuality);
          }
        }

        // Scale legal move indicators on hover (and pulse on Ultra)
        for (let i = 0; i < legalIndicatorMeshes.length; i++) {
          const ind = legalIndicatorMeshes[i];
          const isHovered = ind.userData?.square === lastHoveredLegalSq;
          const baseScale = isHovered
            ? 1.24
            : isUltra
            ? 1.0 + Math.sin(nowSec * 5.2 + i * 0.5) * 0.07
            : 1.0;
          ind.scale.setScalar(baseScale);
        }

        // Update defeated duel ghosts & Shatter animation
        for (let i = defeatedGhosts.length - 1; i >= 0; i--) {
          const g = defeatedGhosts[i];
          const elapsed = nowSec - g.startTimeSec;
          if (elapsed >= g.durationSec) {
            duelGhostsGroup.remove(g.group);
            duelGhostsGroup.remove(g.impactRing);
            (g.impactRing.material as THREE.Material).dispose();
            defeatedGhosts.splice(i, 1);
          } else {
            needsMoreFrames = true;
            const p = elapsed / g.durationSec;
            if (g.glbPiece) {
              g.glbPiece.update(dt, nowSec, false, true);
            } else if (g.rig) {
              updateLivingCharacterRigAnimation(g.rig, nowSec, false);
            }
            if (p > 0.55) {
              const fade = 1 - (p - 0.55) / 0.45;
              g.group.scale.setScalar(Math.max(0.01, fade));
            }
            const ringScale = 1 + p * 2.6;
            g.impactRing.scale.setScalar(ringScale);
            (g.impactRing.material as THREE.MeshBasicMaterial).opacity = Math.max(
              0,
              0.9 * (1 - p)
            );
          }
        }

        // Update piece movement trajectories & Hybrid Static/Skinned GLB animations
        const checkSq = propsRef.current.kingSquareInCheck;
        const selSq = propsRef.current.selectedSquare;

        for (const entry of activePieces.values()) {
          if (isDraggingPiece && draggedPieceEntry === entry) continue;

          if (entry.isMoving) {
            needsMoreFrames = true;
            const elapsedMove = nowSec - entry.moveStartTimeSec;
            const rawT = Math.min(1, elapsedMove / entry.moveDurationSec);
            const easedT = easeInOutCubic(rawT);

            entry.currentX = THREE.MathUtils.lerp(entry.moveStartX, entry.targetX, easedT);
            entry.currentZ = THREE.MathUtils.lerp(entry.moveStartZ, entry.targetZ, easedT);

            const maxLift = entry.isKnightJump ? 0.88 : 0.32;
            entry.currentY = Math.sin(rawT * Math.PI) * maxLift;
            entry.group.position.set(entry.currentX, entry.currentY, entry.currentZ);

            entry.motionTrailRing.position.set(entry.currentX, 0.016, entry.currentZ);
            entry.motionTrailRing.scale.setScalar(1 + Math.sin(rawT * Math.PI) * 0.35);

            if (rawT >= 1) {
              entry.isMoving = false;
              entry.currentX = entry.targetX;
              entry.currentZ = entry.targetZ;
              entry.currentY = 0;
              entry.group.position.set(entry.targetX, 0, entry.targetZ);
              entry.motionTrailRing.visible = false;
              const defaultYaw = entry.color === 'w' ? Math.PI : 0;
              entry.group.rotation.y = defaultYaw;
              if (entry.glbPiece && entry.glbPiece.currentState === 'move') {
                entry.glbPiece.setAnimState('idle', 1);
              }
            }
          } else {
            const targetHoverY = selSq === entry.square ? 0.08 : 0;
            if (Math.abs(entry.currentY - targetHoverY) > 0.002) {
              needsMoreFrames = true;
              entry.currentY = THREE.MathUtils.damp(entry.currentY, targetHoverY, 14, dt);
              entry.group.position.set(entry.targetX, entry.currentY, entry.targetZ);
            } else if (entry.currentY !== targetHoverY) {
              entry.currentY = targetHoverY;
              entry.group.position.set(entry.targetX, targetHoverY, entry.targetZ);
            }

            if (entry.glbPiece && entry.glbPiece.currentState === 'attack') {
              if (entry.glbPiece.actions.attack?.isRunning()) {
                needsMoreFrames = true;
              } else {
                entry.glbPiece.setAnimState('idle', 1);
                entry.group.rotation.y = entry.color === 'w' ? Math.PI : 0;
              }
            }
          }

          const isKingChecked = Boolean(checkSq && entry.square === checkSq);
          if (entry.glbPiece) {
            entry.glbPiece.update(dt, nowSec, isKingChecked, isUltra || entry.isMoving);
          } else if (entry.rig && (isUltra || entry.isMoving)) {
            updateLivingCharacterRigAnimation(entry.rig, nowSec, isKingChecked);
          }
        }

        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty || needsMoreFrames) {
            requestRender();
          }
        };

        if (isSoftwareGl) {
          afterDraw(done);
        } else {
          done();
        }
      });
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
          requestRender();
        }
      }
    });
    resizeObserver.observe(container);

    syncSceneWithProps(false);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      domEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('webglcontextlost', handleContextLost);
      controls.dispose();
      outerFrameGeo.dispose();
      coordTex.dispose();
      coordPlaneGeo.dispose();
      coordPlaneMat.dispose();
      squareGeo.dispose();
      lightSquaresInstanced.dispose();
      darkSquaresInstanced.dispose();
      highlightPlaneGeo.dispose();
      squareBorderRingGeo.dispose();
      destBorderMat.dispose();
      legalDotGeo.dispose();
      legalOuterRingGeo.dispose();
      legalRingGeo.dispose();
      checkRingGeo.dispose();
      duelImpactRingGeo.dispose();
      motionTrailRingGeo.dispose();
      whiteTrailMat.dispose();
      blackTrailMat.dispose();
      envTarget.dispose();
      fallbackChamber.dispose();
      materials.dispose();
      stauntonCache.dispose();
      livingCache.dispose();
      renderer.dispose();
    };
  }, [use2DBoard]);

  const handleSelectCameraPreset = useCallback((preset: CameraViewPreset) => {
    setCameraPreset(preset);
    if (triggerCameraPresetRef.current) {
      triggerCameraPresetRef.current(preset);
    }
  }, []);

  // 2D Accessible Fallback Board Renderer
  const render2DFallbackBoard = () => {
    const pieces = parseBoardFromFen(fen);
    const pieceMap = new Map<string, BoardPiece>();
    pieces.forEach((p) => pieceMap.set(p.square, p));

    const ranks = orientation === 'w' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
    const files = orientation === 'w' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

    return (
      <div className="w-full h-full flex items-center justify-center p-4 bg-[#171513]">
        <div className="w-full max-w-[540px] aspect-square p-3 rounded-xl bg-[#38251C] border border-[#79543A] shadow-2xl grid grid-cols-8 grid-rows-8">
          {ranks.map((rIdx) =>
            files.map((fIdx) => {
              const sq = indicesToSquare(fIdx, rIdx);
              const isLight = (rIdx + fIdx) % 2 !== 0;
              const piece = pieceMap.get(sq);
              const isSelected = selectedSquare === sq;
              const isLastMove = lastMove?.from === sq || lastMove?.to === sq;
              const isHint = hintMove?.from === sq || hintMove?.to === sq;
              const legalOption = legalMoves.find((m) => m.to === sq);
              const isKingCheck = kingSquareInCheck === sq;

              return (
                <button
                  key={sq}
                  type="button"
                  disabled={!interactive}
                  onClick={() => {
                    if (selectedSquare && legalOption) {
                      onMoveAttempt(selectedSquare, sq);
                    } else {
                      onSquareSelect(sq);
                    }
                  }}
                  className={`relative flex items-center justify-center select-none transition-colors ${
                    isLight ? 'bg-[#E7D5B5] text-[#38251C]' : 'bg-[#9A6A45] text-[#F2E9DC]'
                  } ${isSelected ? 'ring-2 ring-inset ring-[#38BDF8] bg-[#38BDF8]/35' : ''} ${
                    isHint ? 'ring-2 ring-inset ring-[#10B981] bg-[#10B981]/30' : ''
                  } ${
                    isLastMove ? 'after:absolute after:inset-0 after:bg-[#F59E0B]/35' : ''
                  } ${isKingCheck ? 'bg-[#D9534F]/75' : ''}`}
                >
                  {piece && (
                    <span
                      className={`z-10 text-3xl sm:text-4xl leading-none drop-shadow ${
                        piece.color === 'w' ? 'text-[#FAF3E8]' : 'text-[#22150E]'
                      }`}
                    >
                      {UNICODE_PIECES[piece.color][piece.type]}
                    </span>
                  )}
                  {legalOption && (
                    <span
                      className={`z-20 pointer-events-none ${
                        legalOption.captured
                          ? 'w-9 h-9 rounded-full border-4 border-[#E11D48]'
                          : 'w-3.5 h-3.5 rounded-full bg-[#38BDF8]'
                      }`}
                    />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full h-full min-h-[420px] bg-[#070E0A] overflow-hidden select-none rounded-xl border border-[#7A9A76]/35">
      {webglFallback || use2DBoard ? (
        render2DFallbackBoard()
      ) : (
        <div ref={mountRef} className="w-full h-full" />
      )}

      {/* GLB Cathedral & Pieces Loading Indicator */}
      {loadingProgress && !use2DBoard && !webglFallback && (
        <div className="absolute top-3 left-3 z-20 px-3.5 py-2 rounded-xl bg-[#0E1B14]/95 border border-[#7A9A76]/45 shadow-xl flex items-center gap-3 pointer-events-none">
          <div className="w-24 h-1.5 bg-[#192E23] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#DFC29B] transition-all duration-200"
              style={{
                width: `${Math.round((loadingProgress.loaded / loadingProgress.total) * 100)}%`,
              }}
            />
          </div>
          <span className="text-[11px] font-medium text-[#EFE6D5]/90 whitespace-nowrap">
            Memuat 3D GLB ({loadingProgress.loaded}/{loadingProgress.total}):{' '}
            <strong className="text-[#DFC29B]">{loadingProgress.label}</strong>
          </span>
        </div>
      )}

      {/* Top-Left Clear Movement & Selection Status Badge */}
      {!loadingProgress && (lastMove || selectedSquare) && !use2DBoard && (
        <div className="absolute top-3 left-3 z-20 px-3 py-1.5 rounded-xl bg-[#0E1B14]/92 border border-[#7A9A76]/35 shadow-lg flex items-center gap-2.5 text-xs text-[#EFE6D5]/90 pointer-events-none">
          {selectedSquare ? (
            <span>
              Petak Aktif:{' '}
              <strong className="font-mono uppercase text-[#DFC29B]">{selectedSquare}</strong>
              <span aria-hidden="true" className="mx-1.5 text-[#7A9A76]/60">
                ·
              </span>
              <span className="text-[#9BB09D]">
                {legalMoves.length} langkah tersedia
              </span>
            </span>
          ) : (
            lastMove && (
              <span>
                Langkah Terakhir:{' '}
                <strong className="font-mono uppercase text-[#DFC29B]">
                  {lastMove.from} → {lastMove.to}
                </strong>
              </span>
            )
          )}
        </div>
      )}

      {/* Cinematic Duel Capture Callout Banner */}
      {activeDuelBanner && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-[#0E1B14]/95 border border-[#DFC29B]/60 shadow-2xl flex items-center gap-2.5 pointer-events-none">
          <Swords className="w-4 h-4 text-[#DFC29B] shrink-0" />
          <span className="text-xs font-semibold text-[#EFE6D5] whitespace-nowrap">
            <strong className="text-[#DFC29B]">
              {CHARACTER_CLASS_NAMES[activeDuelBanner.attackerType]} (
              {activeDuelBanner.attackerColor === 'w' ? 'Putih' : 'Hitam'})
            </strong>{' '}
            mengeliminasi{' '}
            <strong className="text-[#9BB09D]">
              {CHARACTER_CLASS_NAMES[activeDuelBanner.defenderType]}
            </strong>{' '}
            di petak <span className="font-mono uppercase text-[#DFC29B]">{activeDuelBanner.to}</span>!
          </span>
        </div>
      )}

      {/* Ultra-Compact Minimalist Bottom 3D Micro-Pill Dock (Desktop) */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center max-w-[98%]">
        {hudCollapsed ? (
          <button
            type="button"
            onClick={() => setHudCollapsed(false)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-[#0E1B14]/92 text-[#EFE6D5] border border-[#7A9A76]/40 hover:border-[#DFC29B] shadow-lg transition-all whitespace-nowrap"
            title="Tampilkan kontrol 3D minimalis"
          >
            <ChevronUp className="w-3 h-3 text-[#DFC29B]" />
            <span>Kontrol 3D</span>
          </button>
        ) : (
          <div className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded-full bg-[#0E1B14]/95 border border-[#7A9A76]/40 shadow-[0_10px_28px_rgba(0,0,0,0.85)] overflow-x-auto max-w-full [scrollbar-width:thin] [scrollbar-color:#7A9A76_#0E1B14] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-[#0E1B14]/90 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#7A9A76]/65 hover:[&::-webkit-scrollbar-thumb]:bg-[#DFC29B] [&::-webkit-scrollbar-thumb]:rounded-full">
            {/* Compact Camera Presets */}
            <button
              type="button"
              onClick={() => handleSelectCameraPreset(orientation === 'w' ? 'white' : 'black')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                cameraPreset === 'white' || cameraPreset === 'black'
                  ? 'bg-[#DFC29B] text-[#0E1B14] font-bold'
                  : 'text-[#EFE6D5]/80 hover:bg-[#192E23] hover:text-[#EFE6D5]'
              }`}
              title="Sudut Pandang Pemain"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Pemain</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectCameraPreset('top')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                cameraPreset === 'top'
                  ? 'bg-[#DFC29B] text-[#0E1B14] font-bold'
                  : 'text-[#EFE6D5]/80 hover:bg-[#192E23] hover:text-[#EFE6D5]'
              }`}
              title="Sudut Pandang Atas"
            >
              <Eye className="w-3 h-3" />
              <span>Atas</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectCameraPreset('cinema')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                cameraPreset === 'cinema'
                  ? 'bg-[#DFC29B] text-[#0E1B14] font-bold'
                  : 'text-[#EFE6D5]/80 hover:bg-[#192E23] hover:text-[#EFE6D5]'
              }`}
              title="Sudut Katedral Sinematik"
            >
              <Camera className="w-3 h-3" />
              <span>Sinema</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectCameraPreset('inspection')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                cameraPreset === 'inspection'
                  ? 'bg-[#DFC29B] text-[#0E1B14] font-bold'
                  : 'text-[#EFE6D5]/80 hover:bg-[#192E23] hover:text-[#EFE6D5]'
              }`}
              title="Inspeksi Detail Bidak 3D"
            >
              <Search className="w-3 h-3" />
              <span className="hidden xl:inline">Inspeksi</span>
            </button>

            <span className="w-px h-3.5 bg-[#7A9A76]/25 mx-0.5 shrink-0" aria-hidden="true" />

            {/* Compact 3D Feature Toggles */}
            {!use2DBoard && (
              <button
                type="button"
                onClick={() => setShowMoveArrow((prev) => !prev)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  showMoveArrow
                    ? 'bg-[#1A3326] text-[#DFC29B] border border-[#DFC29B]/40'
                    : 'text-[#EFE6D5]/65 hover:bg-[#192E23] hover:text-[#EFE6D5]'
                }`}
                title={`Panah Jalur: ${showMoveArrow ? 'Aktif' : 'Mati'}`}
              >
                <Navigation className="w-3 h-3" />
                <span>Jalur</span>
              </button>
            )}

            {onUpdateVisualSettings && !use2DBoard && (
              <button
                type="button"
                onClick={() =>
                  onUpdateVisualSettings({
                    pieceStyle: pieceStyle === 'living' ? 'staunton' : 'living',
                  })
                }
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  pieceStyle === 'living'
                    ? 'bg-[#1A3326] text-[#DFC29B] border border-[#DFC29B]/40'
                    : 'text-[#EFE6D5]/80 hover:bg-[#192E23] hover:text-[#EFE6D5]'
                }`}
                title="Ganti Model Bidak 3D (Karakter GLB / Staunton Klasik)"
              >
                <Crown className="w-3 h-3" />
                <span>{pieceStyle === 'living' ? 'GLB' : 'Klasik'}</span>
              </button>
            )}

            {onUpdateVisualSettings && !use2DBoard && (
              <button
                type="button"
                onClick={() => {
                  const nextMode =
                    visualSettings.cinematicCaptures === 'on'
                      ? 'reduced'
                      : visualSettings.cinematicCaptures === 'reduced'
                      ? 'off'
                      : 'on';
                  onUpdateVisualSettings({ cinematicCaptures: nextMode });
                }}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  visualSettings.cinematicCaptures !== 'off'
                    ? 'bg-[#1A3326] text-[#EFE6D5]'
                    : 'text-[#EFE6D5]/60 hover:bg-[#192E23]'
                }`}
                title={`Animasi Duel: ${
                  visualSettings.cinematicCaptures === 'on'
                    ? 'Sinematik'
                    : visualSettings.cinematicCaptures === 'reduced'
                    ? 'Ringkas'
                    : 'Mati'
                }`}
              >
                <Swords className="w-3 h-3 text-[#DFC29B]" />
                <span>
                  {visualSettings.cinematicCaptures === 'on'
                    ? 'Duel'
                    : visualSettings.cinematicCaptures === 'reduced'
                    ? 'Ringkas'
                    : 'Off'}
                </span>
              </button>
            )}

            {onUpdateVisualSettings && !use2DBoard && (
              <button
                type="button"
                onClick={() => {
                  const order: GraphicsQualityPreset[] = ['low', 'medium', 'high', 'ultra'];
                  const nextIdx = (order.indexOf(visualSettings.graphicsQuality) + 1) % order.length;
                  onUpdateVisualSettings({ graphicsQuality: order[nextIdx] });
                }}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  visualSettings.graphicsQuality === 'ultra'
                    ? 'bg-[#4E392B] text-[#DFC29B] border border-[#DFC29B]/50'
                    : 'text-[#EFE6D5]/80 hover:bg-[#192E23] hover:text-[#EFE6D5]'
                }`}
                title="Ubah Kualitas Grafis 3D (LOW / MED / HIGH / ULTRA)"
              >
                <Sparkles className="w-3 h-3 text-[#DFC29B]" />
                <span>{QUALITY_LABELS[visualSettings.graphicsQuality]}</span>
              </button>
            )}

            {onFlipOrientation && (
              <button
                type="button"
                onClick={onFlipOrientation}
                className="p-1 rounded-full text-[#EFE6D5]/80 hover:bg-[#192E23] hover:text-[#EFE6D5] transition-colors shrink-0"
                title={`Putar Papan (Sisi: ${orientation === 'w' ? 'Putih' : 'Hitam'})`}
                aria-label="Putar Papan"
              >
                <FlipHorizontal2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (onSwitchTo2D) {
                  onSwitchTo2D();
                } else {
                  setUse2DBoard((prev) => !prev);
                }
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#DFC29B] text-[#0E1B14] hover:bg-[#EAD3B3] transition-colors whitespace-nowrap shrink-0"
              title="Beralih ke Papan Catur 2D"
            >
              <Grid className="w-3 h-3" />
              <span>2D</span>
            </button>

            <button
              type="button"
              onClick={() => setHudCollapsed(true)}
              className="p-1 rounded-full text-[#9BB09D] hover:bg-[#192E23] hover:text-[#EFE6D5] transition-colors shrink-0"
              title="Sembunyikan bar kontrol 3D"
              aria-label="Sembunyikan bar kontrol 3D"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
