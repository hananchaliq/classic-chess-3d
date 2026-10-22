'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type {
  ArenaVisualSettings,
  BoardPiece,
  CaptureDuelEvent,
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
  Camera,
  RotateCcw,
  FlipHorizontal2,
  Eye,
  Sparkles,
  Grid,
  Swords,
  Crown,
  Search,
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
  visualSettings?: ArenaVisualSettings;
  onUpdateVisualSettings?: (partial: Partial<ArenaVisualSettings>) => void;
}

// Module-level pre-allocated vectors to avoid GC inside render loop
const _camTargetPos = new THREE.Vector3();
const _camLookAtPos = new THREE.Vector3(0, 0, 0);
const _planeIntersect = new THREE.Vector3();
const _dragBoardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25);

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

function squareToWorldXZ(square: string): { x: number; z: number } {
  const { fileIndex, rankIndex } = squareToIndices(square);
  return {
    x: fileIndex - 3.5,
    z: 3.5 - rankIndex,
  };
}

function createCoordinateFrameTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 1024, 1024);
    ctx.fillStyle = '#C7A66A';
    ctx.font = '600 28px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const files = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

    for (let i = 0; i < 8; i++) {
      const center = 96 + i * 104 + 52;
      ctx.fillText(files[i], center, 976);
      ctx.save();
      ctx.translate(center, 48);
      ctx.rotate(Math.PI);
      ctx.fillText(files[i], 0, 0);
      ctx.restore();

      ctx.fillText(ranks[i], 48, center);
      ctx.save();
      ctx.translate(976, center);
      ctx.rotate(Math.PI);
      ctx.fillText(ranks[i], 0, 0);
      ctx.restore();
    }

    ctx.strokeStyle = '#C7A66A';
    ctx.lineWidth = 4;
    ctx.strokeRect(92, 92, 840, 840);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

interface AnimatedPieceEntry {
  key: string;
  type: PieceSymbol;
  color: PieceColor;
  square: string;
  group: THREE.Group;
  rig: LivingCharacterRig | null;
  currentX: number;
  currentZ: number;
  currentY: number;
  targetX: number;
  targetZ: number;
  isKnightJump: boolean;
}

interface DefeatedDuelGhost {
  group: THREE.Group;
  rig: LivingCharacterRig | null;
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
  const [activeDuelBanner, setActiveDuelBanner] = useState<CaptureDuelEvent | null>(null);

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
  ]);

  const triggerSceneSyncRef = useRef<(() => void) | null>(null);
  const triggerCameraPresetRef = useRef<((preset: CameraViewPreset) => void) | null>(null);
  const triggerDuelSequenceRef = useRef<((duel: CaptureDuelEvent) => void) | null>(null);

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
      triggerSceneSyncRef.current();
    }
  }, [fen, selectedSquare, legalMoves, lastMove, hintMove, kingSquareInCheck, visualSettings.pieceStyle]);

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
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, [lastCaptureDuel, visualSettings.cinematicCaptures]);

  const isLowQuality = visualSettings.graphicsQuality === 'low';
  const pieceStyle = visualSettings.pieceStyle;
  const shadowsEnabled = visualSettings.shadows !== 'off' && !isLowQuality;

  useEffect(() => {
    if (use2DBoard) return;
    const container = mountRef.current;
    if (!container) return;

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
        antialias: !isSoftwareGl && !isLowQuality,
        powerPreference: 'high-performance',
      });
    } catch {
      queueMicrotask(() => setWebglFallback(true));
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    const maxDpr =
      visualSettings.graphicsQuality === 'ultra'
        ? 2
        : visualSettings.graphicsQuality === 'high'
        ? 1.75
        : visualSettings.graphicsQuality === 'medium'
        ? 1.25
        : 1;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, maxDpr)
    );
    renderer.shadowMap.enabled = !isSoftwareGl && shadowsEnabled;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    renderer.setSize(width, height);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Scene, Fog & Studio Environment
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#14110F');
    scene.fog = new THREE.FogExp2('#14110F', 0.022);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    // 3. Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.5, 68);
    const initialZ = propsRef.current.orientation === 'w' ? 8.6 : -8.6;
    camera.position.set(0, 7.6, initialZ);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.minPolarAngle = 0.08;
    controls.minDistance = 4.5;
    controls.maxDistance = 19.5;
    controls.enablePan = false;
    controls.target.set(0, 0, 0);

    // 4. Grand Chess Chamber Lighting Rig
    const hemiLight = new THREE.HemisphereLight('#FFF3E0', '#261810', 0.78);
    hemiLight.position.set(0, 15, 0);
    scene.add(hemiLight);

    // Overhead Chandelier Warm Key Light
    const keyLight = new THREE.DirectionalLight('#FFE4B8', 1.9);
    keyLight.position.set(5.2, 11.8, 6.2);
    if (!isSoftwareGl && shadowsEnabled) {
      keyLight.castShadow = true;
      const mapDim = visualSettings.graphicsQuality === 'ultra' ? 2048 : 1024;
      keyLight.shadow.mapSize.width = mapDim;
      keyLight.shadow.mapSize.height = mapDim;
      const d = 5.8;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.camera.near = 2;
      keyLight.shadow.camera.far = 26;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    // Cathedral Window Side Sunlight Beam
    const windowLight = new THREE.DirectionalLight('#FFD99B', 0.85);
    windowLight.position.set(-12.5, 8.5, 2.0);
    scene.add(windowLight);

    // Cool Rim Light for Obsidian Black Armor separation
    const rimLight = new THREE.DirectionalLight('#9AC2E8', 0.65);
    rimLight.position.set(4.0, 6.5, -9.5);
    scene.add(rimLight);

    // 5. Materials, Grand Chess Chamber, & Character Caches
    const materials = createChessMaterialSet(renderer, isSoftwareGl);
    const stauntonCache = createStauntonGeometryCache();
    const livingCache = createLivingCharacterGeometryCache();
    const grandChamber = createGrandChessChamber(materials);
    grandChamber.setQualityVisibility(
      visualSettings.graphicsQuality,
      visualSettings.showChamberRoom
    );
    scene.add(grandChamber.group);

    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    // Outer Walnut Frame (9.2 x 0.36 x 9.2)
    const outerFrameGeo = new THREE.BoxGeometry(9.2, 0.36, 9.2);
    outerFrameGeo.translate(0, -0.18, 0);
    const outerFrameMesh = new THREE.Mesh(outerFrameGeo, materials.walnutFrame);
    outerFrameMesh.receiveShadow = true;
    boardGroup.add(outerFrameMesh);

    // Lower Stepped Mahogany/Wood Plinth (9.6 x 0.16 x 9.6)
    const plinthGeo = new THREE.BoxGeometry(9.6, 0.16, 9.6);
    plinthGeo.translate(0, -0.44, 0);
    const plinthMesh = new THREE.Mesh(plinthGeo, materials.mediumWoodPlinth);
    plinthMesh.receiveShadow = true;
    boardGroup.add(plinthMesh);

    // Coordinate & Brass Frame Overlay Plane
    const coordTex = createCoordinateFrameTexture(renderer.capabilities.getMaxAnisotropy());
    const coordPlaneGeo = new THREE.PlaneGeometry(9.12, 9.12);
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
    coordPlaneMesh.position.y = 0.004;
    boardGroup.add(coordPlaneMesh);

    // 64 Board Squares
    const squareGeo = new THREE.BoxGeometry(1.0, 0.06, 1.0);
    for (let rankIdx = 0; rankIdx < 8; rankIdx++) {
      for (let fileIdx = 0; fileIdx < 8; fileIdx++) {
        const isLight = (rankIdx + fileIdx) % 2 !== 0;
        const sqName = indicesToSquare(fileIdx, rankIdx);
        const mesh = new THREE.Mesh(
          squareGeo,
          isLight ? materials.mapleSquare : materials.walnutSquare
        );
        mesh.position.set(fileIdx - 3.5, 0.0, 3.5 - rankIdx);
        mesh.receiveShadow = true;
        mesh.userData = { square: sqName, isSquare: true };
        mesh.layers.enable(1);
        boardGroup.add(mesh);
      }
    }

    // Highlight Overlays Group
    const highlightsGroup = new THREE.Group();
    scene.add(highlightsGroup);

    const highlightPlaneGeo = new THREE.PlaneGeometry(0.94, 0.94);
    highlightPlaneGeo.rotateX(-Math.PI / 2);

    const legalDotGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.03, 24);
    const legalRingGeo = new THREE.RingGeometry(0.34, 0.44, 32);
    legalRingGeo.rotateX(-Math.PI / 2);

    const checkRingGeo = new THREE.RingGeometry(0.36, 0.47, 32);
    checkRingGeo.rotateX(-Math.PI / 2);

    const duelImpactRingGeo = new THREE.RingGeometry(0.18, 0.46, 28);
    duelImpactRingGeo.rotateX(-Math.PI / 2);

    // Active 3D Pieces Group & Duel Ghosts Group
    const piecesRootGroup = new THREE.Group();
    piecesRootGroup.position.y = 0.03;
    scene.add(piecesRootGroup);

    const duelGhostsGroup = new THREE.Group();
    duelGhostsGroup.position.y = 0.03;
    scene.add(duelGhostsGroup);

    const activePieces = new Map<string, AnimatedPieceEntry>();
    const defeatedGhosts: DefeatedDuelGhost[] = [];

    // Camera Transition & Duel Cut-in State
    let activeCameraTransition = false;
    let savedPreDuelCamPos: THREE.Vector3 | null = null;
    let savedPreDuelTarget: THREE.Vector3 | null = null;
    let duelCameraReturnDeadlineSec = 0;

    function setCameraGoal(preset: CameraViewPreset) {
      savedPreDuelCamPos = null;
      savedPreDuelTarget = null;
      _camLookAtPos.set(0, 0, 0);

      if (preset === 'white') {
        _camTargetPos.set(0, 7.4, 8.5);
      } else if (preset === 'black') {
        _camTargetPos.set(0, 7.4, -8.5);
      } else if (preset === 'top') {
        const zOffset = propsRef.current.orientation === 'w' ? 0.9 : -0.9;
        _camTargetPos.set(0, 12.4, zOffset);
      } else if (preset === 'cinema') {
        const zSide = propsRef.current.orientation === 'w' ? 7.6 : -7.6;
        _camTargetPos.set(5.8, 5.4, zSide);
      } else if (preset === 'inspection') {
        const zSide = propsRef.current.orientation === 'w' ? 5.6 : -5.6;
        _camTargetPos.set(-3.4, 3.1, zSide);
        _camLookAtPos.set(0, 0.45, 0);
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
    } {
      if (propsRef.current.visualSettings.pieceStyle === 'living') {
        const rig = buildLivingCharacterRig(
          type,
          color,
          materials,
          livingCache,
          Math.random() * Math.PI * 2,
          !isSoftwareGl && shadowsEnabled
        );
        return { group: rig.rootGroup, rig };
      }
      const group = stauntonCache.createPieceGroup(type, color, materials);
      return { group, rig: null };
    }

    // Trigger a short (~1.2s) duel sequence when a piece captures an opponent
    function triggerDuelSequence(duel: CaptureDuelEvent) {
      const nowSec = performance.now() / 1000;
      const mode = propsRef.current.visualSettings.cinematicCaptures;
      if (mode === 'off') return;

      const { x: toX, z: toZ } = squareToWorldXZ(duel.to);
      const { x: fromX, z: fromZ } = squareToWorldXZ(duel.from);

      // 1. Find the attacking piece that moved to `duel.to` and set its state to 'attack'
      for (const entry of activePieces.values()) {
        if (entry.square === duel.to && entry.color === duel.attackerColor) {
          // Face the direction of attack
          const angle = Math.atan2(toX - fromX, toZ - fromZ);
          entry.group.rotation.y = angle;
          if (entry.rig) {
            entry.rig.animState = 'attack';
            entry.rig.stateStartTime = nowSec;
          }
          break;
        }
      }

      // 2. Spawn a temporary defeated defender rig on the target square for 0.85s
      const { group: defGroup, rig: defRig } = buildPieceVisual(
        duel.defenderType,
        duel.defenderColor
      );
      defGroup.position.set(toX, 0, toZ);
      // Face the attacker
      defGroup.rotation.y = Math.atan2(fromX - toX, fromZ - toZ);
      if (defRig) {
        defRig.animState = 'defeat';
        defRig.stateStartTime = nowSec;
      }
      duelGhostsGroup.add(defGroup);

      // 3. Impact shockwave ring on the capture square
      const impactMat = new THREE.MeshBasicMaterial({
        color: duel.attackerColor === 'w' ? '#38BDF8' : '#F43F5E',
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const impactRing = new THREE.Mesh(duelImpactRingGeo, impactMat);
      impactRing.position.set(toX, 0.05, toZ);
      duelGhostsGroup.add(impactRing);

      defeatedGhosts.push({
        group: defGroup,
        rig: defRig,
        impactRing,
        startTimeSec: nowSec,
        durationSec: 0.9,
      });

      // 4. Optional brief Cinematic Camera focus (~1.15s) if mode === 'on'
      if (mode === 'on') {
        if (!savedPreDuelCamPos) {
          savedPreDuelCamPos = camera.position.clone();
          savedPreDuelTarget = controls.target.clone();
        }
        const zDir = propsRef.current.orientation === 'w' ? 4.2 : -4.2;
        const sideOffset = toX >= 0 ? -2.6 : 2.6;
        _camTargetPos.set(toX + sideOffset, 3.8, toZ + zDir);
        _camLookAtPos.set(toX, 0.45, toZ);
        activeCameraTransition = true;
        duelCameraReturnDeadlineSec = nowSec + 1.15;
      }

      requestRender();
    }
    triggerDuelSequenceRef.current = triggerDuelSequence;

    // Synchronize 3D pieces and square highlights with current FEN & selection
    function syncSceneWithProps() {
      const {
        fen: currentFen,
        selectedSquare: selSq,
        legalMoves: legMoves,
        lastMove: lstMove,
        hintMove: hntMove,
        kingSquareInCheck: checkSq,
      } = propsRef.current;

      // 1. Rebuild highlights
      while (highlightsGroup.children.length > 0) {
        highlightsGroup.remove(highlightsGroup.children[0]);
      }

      if (selSq) {
        const { x, z } = squareToWorldXZ(selSq);
        const m = new THREE.Mesh(highlightPlaneGeo, materials.selectedHighlight);
        m.position.set(x, 0.036, z);
        highlightsGroup.add(m);
      }

      if (lstMove) {
        [lstMove.from, lstMove.to].forEach((sq) => {
          const { x, z } = squareToWorldXZ(sq);
          const m = new THREE.Mesh(highlightPlaneGeo, materials.lastMoveHighlight);
          m.position.set(x, 0.035, z);
          highlightsGroup.add(m);
        });
      }

      if (hntMove) {
        [hntMove.from, hntMove.to].forEach((sq) => {
          const { x, z } = squareToWorldXZ(sq);
          const m = new THREE.Mesh(highlightPlaneGeo, materials.hintHighlight);
          m.position.set(x, 0.038, z);
          highlightsGroup.add(m);
        });
      }

      if (checkSq) {
        const { x, z } = squareToWorldXZ(checkSq);
        const m = new THREE.Mesh(checkRingGeo, materials.checkAlertRing);
        m.position.set(x, 0.04, z);
        highlightsGroup.add(m);
      }

      for (const mv of legMoves) {
        const { x, z } = squareToWorldXZ(mv.to);
        const isCap = Boolean(mv.captured) || mv.isEnPassant;
        const indicator = new THREE.Mesh(
          isCap ? legalRingGeo : legalDotGeo,
          isCap ? materials.legalCaptureRing : materials.legalMoveDot
        );
        indicator.position.set(x, isCap ? 0.042 : 0.045, z);
        indicator.userData = { square: mv.to, isSquare: true };
        indicator.layers.enable(1);
        highlightsGroup.add(indicator);
      }

      // 2. Reconcile Pieces for smooth movement & articulated animations
      const nextPieces: BoardPiece[] = parseBoardFromFen(currentFen);
      const matchedOldKeys = new Set<string>();
      const nextMap = new Map<string, AnimatedPieceEntry>();
      const nowSec = performance.now() / 1000;

      // First pass: pieces that stayed on the exact same square with same type & color
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
          entry.group.userData = { square: np.square, isPiece: true };
          entry.group.traverse((child) => {
            child.userData = { square: np.square, isPiece: true };
            child.layers.enable(1);
          });
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
            (oldEntry.type === np.type ||
              (lstMove && oldEntry.square === lstMove.from && np.square === lstMove.to))
          ) {
            foundKey = k;
            break;
          }
        }

        const { x, z } = squareToWorldXZ(np.square);

        if (foundKey) {
          matchedOldKeys.add(foundKey);
          const entry = activePieces.get(foundKey)!;
          // Handle pawn promotion changing piece type
          if (entry.type !== np.type) {
            piecesRootGroup.remove(entry.group);
            const built = buildPieceVisual(np.type, np.color);
            built.group.position.set(entry.currentX, 0, entry.currentZ);
            piecesRootGroup.add(built.group);
            entry.group = built.group;
            entry.rig = built.rig;
            entry.type = np.type;
          }
          // Rotate piece toward movement direction
          const moveDx = x - entry.currentX;
          const moveDz = z - entry.currentZ;
          if (Math.hypot(moveDx, moveDz) > 0.05) {
            entry.group.rotation.y = Math.atan2(moveDx, moveDz);
          }
          if (entry.rig && entry.rig.animState !== 'attack') {
            entry.rig.animState = np.type === 'n' ? 'leap' : 'walk';
            entry.rig.stateStartTime = nowSec;
          }
          entry.square = np.square;
          entry.targetX = x;
          entry.targetZ = z;
          entry.isKnightJump = np.type === 'n';
          entry.group.userData = { square: np.square, isPiece: true };
          entry.group.traverse((child) => {
            child.userData = { square: np.square, isPiece: true };
            child.layers.enable(1);
          });
          nextMap.set(foundKey, entry);
        } else {
          const newKey = `${np.color}-${np.type}-${np.square}-${Math.random().toString(36).slice(2, 7)}`;
          const built = buildPieceVisual(np.type, np.color);
          built.group.position.set(x, 0, z);
          built.group.userData = { square: np.square, isPiece: true };
          built.group.traverse((child) => {
            child.userData = { square: np.square, isPiece: true };
            child.layers.enable(1);
          });
          piecesRootGroup.add(built.group);
          nextMap.set(newKey, {
            key: newKey,
            type: np.type,
            color: np.color,
            square: np.square,
            group: built.group,
            rig: built.rig,
            currentX: x,
            currentZ: z,
            currentY: 0,
            targetX: x,
            targetZ: z,
            isKnightJump: false,
          });
        }
      }

      // Remove captured or unused pieces
      for (const [k, oldEntry] of activePieces.entries()) {
        if (!matchedOldKeys.has(k)) {
          piecesRootGroup.remove(oldEntry.group);
        }
      }

      activePieces.clear();
      for (const [k, v] of nextMap.entries()) {
        activePieces.set(k, v);
      }

      requestRender();
    }

    triggerSceneSyncRef.current = syncSceneWithProps;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting & Dragging Logic
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();

    let pointerDownPos: { x: number; y: number } | null = null;
    let draggedPieceEntry: AnimatedPieceEntry | null = null;
    let isDraggingPiece = false;
    let lastHoverTime = 0;

    function getSquareFromEvent(e: PointerEvent): string | null {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(
        [...piecesRootGroup.children, ...boardGroup.children, ...highlightsGroup.children],
        true
      );
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.userData?.square) {
            return obj.userData.square as string;
          }
          obj = obj.parent;
        }
      }
      return null;
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
              0.28,
              THREE.MathUtils.clamp(_planeIntersect.z, -3.8, 3.8)
            );
            requestRender();
          }
          return;
        }
      }

      const now = performance.now();
      if (now - lastHoverTime < 45) return;
      lastHoverTime = now;
      const hoveredSq = getSquareFromEvent(e);
      renderer.domElement.style.cursor = hoveredSq ? 'pointer' : 'grab';
    }

    function onPointerUp(e: PointerEvent) {
      if (e.button !== 0 || !propsRef.current.interactive) return;

      const targetSq = getSquareFromEvent(e);

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

    // 6. Render Loop & Software WebGL Frame Pacing
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastFrameTime = performance.now();

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

        // Keep continuous animation running when Living Characters are active on hardware WebGL
        let needsMoreFrames =
          !isSoftwareGl && propsRef.current.visualSettings.pieceStyle === 'living';

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

        // Update floating chamber dust motes on High/Ultra
        if (!isSoftwareGl) {
          grandChamber.update(nowSec, propsRef.current.visualSettings.graphicsQuality);
        }

        // Update defeated duel ghosts & shockwave rings
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
            if (g.rig) {
              updateLivingCharacterRigAnimation(g.rig, nowSec, false);
            }
            const scale = Math.max(0.01, 1 - Math.pow(p, 2) * 0.85);
            g.group.scale.setScalar(scale);
            g.group.position.y = -p * 0.22;

            const ringScale = 1 + p * 2.4;
            g.impactRing.scale.setScalar(ringScale);
            (g.impactRing.material as THREE.MeshBasicMaterial).opacity = Math.max(
              0,
              0.85 * (1 - p)
            );
          }
        }

        // Smooth piece movement interpolation & Living Character joint animation
        const checkSq = propsRef.current.kingSquareInCheck;
        for (const entry of activePieces.values()) {
          if (isDraggingPiece && draggedPieceEntry === entry) continue;
          const dx = entry.targetX - entry.currentX;
          const dz = entry.targetZ - entry.currentZ;
          const distSq = dx * dx + dz * dz;

          if (distSq > 0.0002) {
            needsMoreFrames = true;
            entry.currentX = THREE.MathUtils.damp(
              entry.currentX,
              entry.targetX,
              13.5,
              dt
            );
            entry.currentZ = THREE.MathUtils.damp(
              entry.currentZ,
              entry.targetZ,
              13.5,
              dt
            );
            const distRem = Math.sqrt(distSq);
            const maxLift = entry.isKnightJump ? 0.68 : 0.16;
            entry.currentY = Math.sin(Math.min(1, distRem / 2.2) * Math.PI) * maxLift;
            entry.group.position.set(entry.currentX, entry.currentY, entry.currentZ);
          } else {
            if (entry.currentY !== 0) {
              entry.currentX = entry.targetX;
              entry.currentZ = entry.targetZ;
              entry.currentY = 0;
              entry.group.position.set(entry.targetX, 0, entry.targetZ);
            }
            if (entry.rig) {
              if (
                entry.rig.animState === 'walk' ||
                entry.rig.animState === 'leap' ||
                (entry.rig.animState === 'attack' && nowSec - entry.rig.stateStartTime > 0.95)
              ) {
                entry.rig.animState = 'idle';
                const defaultYaw = entry.color === 'w' ? Math.PI : 0;
                entry.group.rotation.y = THREE.MathUtils.damp(
                  entry.group.rotation.y,
                  defaultYaw,
                  8,
                  dt
                );
              }
            }
          }

          if (entry.rig) {
            const isKingChecked = Boolean(checkSq && entry.square === checkSq);
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

    syncSceneWithProps();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      domEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domEl.removeEventListener('webglcontextlost', handleContextLost);
      controls.dispose();
      outerFrameGeo.dispose();
      plinthGeo.dispose();
      coordTex.dispose();
      coordPlaneGeo.dispose();
      coordPlaneMat.dispose();
      squareGeo.dispose();
      highlightPlaneGeo.dispose();
      legalDotGeo.dispose();
      legalRingGeo.dispose();
      checkRingGeo.dispose();
      duelImpactRingGeo.dispose();
      envTarget.dispose();
      grandChamber.dispose();
      materials.dispose();
      stauntonCache.dispose();
      livingCache.dispose();
      renderer.dispose();
    };
  }, [
    use2DBoard,
    isLowQuality,
    shadowsEnabled,
    visualSettings.graphicsQuality,
    visualSettings.showChamberRoom,
  ]);

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
                  } ${isSelected ? 'ring-2 ring-inset ring-[#C7A66A] bg-[#C7A66A]/40' : ''} ${
                    isHint ? 'ring-2 ring-inset ring-[#38BDF8] bg-[#38BDF8]/30' : ''
                  } ${
                    isLastMove ? 'after:absolute after:inset-0 after:bg-[#C7A66A]/25' : ''
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
                          ? 'w-9 h-9 rounded-full border-4 border-[#C7A66A]/90'
                          : 'w-3.5 h-3.5 rounded-full bg-[#C7A66A]/90'
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
    <div className="relative w-full h-full min-h-[420px] bg-[#14110F] overflow-hidden select-none rounded-xl border border-[#38251C]">
      {webglFallback || use2DBoard ? (
        render2DFallbackBoard()
      ) : (
        <div ref={mountRef} className="w-full h-full" />
      )}

      {/* Cinematic Duel Capture Callout Banner */}
      {activeDuelBanner && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg bg-[#1D1612] border border-[#C7A66A] shadow-2xl flex items-center gap-2.5 pointer-events-none">
          <Swords className="w-4 h-4 text-[#C7A66A] shrink-0" />
          <span className="text-xs font-semibold text-[#F2E9DC] whitespace-nowrap">
            <strong className="text-[#C7A66A]">
              {CHARACTER_CLASS_NAMES[activeDuelBanner.attackerType]} (
              {activeDuelBanner.attackerColor === 'w' ? 'Putih' : 'Hitam'})
            </strong>{' '}
            mengeliminasi{' '}
            <strong className="text-[#E7D5B5]">
              {CHARACTER_CLASS_NAMES[activeDuelBanner.defenderType]}
            </strong>{' '}
            di petak <span className="font-mono uppercase">{activeDuelBanner.to}</span>!
          </span>
        </div>
      )}

      {/* Collapsible Bottom Control Dock (Zero Viewport Occlusion, No backdrop-filter over WebGL) */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[96vw]">
        <button
          type="button"
          onClick={() => setHudCollapsed((prev) => !prev)}
          className="px-3 py-1 text-[11px] font-medium tracking-wide text-[#F2E9DC]/80 bg-[#221D19] hover:text-[#F2E9DC] border border-b-0 border-[#38251C] rounded-t-md transition-colors whitespace-nowrap shrink-0"
        >
          {hudCollapsed ? '▴ Tampilkan Kontrol Kamera & Karakter' : '▾ Sembunyikan Kontrol'}
        </button>

        {!hudCollapsed && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-[#221D19] border border-[#38251C] rounded-lg shadow-xl overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => handleSelectCameraPreset(orientation === 'w' ? 'white' : 'black')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                cameraPreset === 'white' || cameraPreset === 'black'
                  ? 'bg-[#C7A66A] text-[#171513]'
                  : 'text-[#F2E9DC]/80 hover:bg-[#38251C] hover:text-[#F2E9DC]'
              }`}
              title="Sudut Pandang Pemain (Player View)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Sudut Pemain</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectCameraPreset('top')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                cameraPreset === 'top'
                  ? 'bg-[#C7A66A] text-[#171513]'
                  : 'text-[#F2E9DC]/80 hover:bg-[#38251C] hover:text-[#F2E9DC]'
              }`}
              title="Sudut Pandang Papan Atas (Board View)"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Tampak Papan</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectCameraPreset('cinema')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                cameraPreset === 'cinema'
                  ? 'bg-[#C7A66A] text-[#171513]'
                  : 'text-[#F2E9DC]/80 hover:bg-[#38251C] hover:text-[#F2E9DC]'
              }`}
              title="Sudut Ruangan Sinematik (Grand Chamber View)"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Ruang Sinematik</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectCameraPreset('inspection')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                cameraPreset === 'inspection'
                  ? 'bg-[#C7A66A] text-[#171513]'
                  : 'text-[#F2E9DC]/80 hover:bg-[#38251C] hover:text-[#F2E9DC]'
              }`}
              title="Inspeksi Detail Karakter Hidup (Inspection View)"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Inspeksi Karakter</span>
            </button>

            {onUpdateVisualSettings && !use2DBoard && (
              <button
                type="button"
                onClick={() =>
                  onUpdateVisualSettings({
                    pieceStyle: pieceStyle === 'living' ? 'staunton' : 'living',
                  })
                }
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  pieceStyle === 'living'
                    ? 'bg-[#38251C] text-[#C7A66A] border border-[#C7A66A]/60'
                    : 'text-[#F2E9DC]/80 hover:bg-[#38251C] hover:text-[#F2E9DC]'
                }`}
                title="Beralih antara Karakter Hidup 3D dan Bidak Staunton Klasik"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>
                  {pieceStyle === 'living' ? 'Bidak: Karakter Hidup' : 'Bidak: Staunton Klasik'}
                </span>
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
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-[#F2E9DC]/80 hover:bg-[#38251C] hover:text-[#F2E9DC] transition-colors whitespace-nowrap shrink-0"
                title="Pengaturan Kamera & Animasi Duel saat Menangkap Bidak"
              >
                <Swords className="w-3.5 h-3.5 text-[#C7A66A]" />
                <span>
                  Duel:{' '}
                  {visualSettings.cinematicCaptures === 'on'
                    ? 'Sinematik'
                    : visualSettings.cinematicCaptures === 'reduced'
                    ? 'Ringkas'
                    : 'Mati'}
                </span>
              </button>
            )}

            {onFlipOrientation && (
              <button
                type="button"
                onClick={onFlipOrientation}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-[#F2E9DC]/80 hover:bg-[#38251C] hover:text-[#F2E9DC] transition-colors whitespace-nowrap shrink-0"
                title="Putar Sisi Papan (Putih / Hitam)"
              >
                <FlipHorizontal2 className="w-3.5 h-3.5" />
                <span>Sisi: {orientation === 'w' ? 'Putih' : 'Hitam'}</span>
              </button>
            )}

            {onUpdateVisualSettings && !use2DBoard && (
              <button
                type="button"
                onClick={() => {
                  const order: ArenaVisualSettings['graphicsQuality'][] = [
                    'low',
                    'medium',
                    'high',
                    'ultra',
                  ];
                  const nextIdx = (order.indexOf(visualSettings.graphicsQuality) + 1) % order.length;
                  onUpdateVisualSettings({ graphicsQuality: order[nextIdx] });
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-[#F2E9DC]/80 hover:bg-[#38251C] hover:text-[#F2E9DC] transition-colors whitespace-nowrap shrink-0"
                title="Kualitas Grafis Ruangan 3D"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#C7A66A]" />
                <span>Grafis: {visualSettings.graphicsQuality.toUpperCase()}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setUse2DBoard((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                use2DBoard
                  ? 'bg-[#C7A66A] text-[#171513]'
                  : 'text-[#F2E9DC]/80 hover:bg-[#38251C] hover:text-[#F2E9DC]'
              }`}
              title="Beralih antara Papan 3D dan Papan 2D Klasik"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>{use2DBoard ? '2D Aktif' : '2D'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
