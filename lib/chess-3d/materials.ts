import * as THREE from 'three';

export interface ChessMaterialSet {
  mapleSquare: THREE.MeshStandardMaterial;
  walnutSquare: THREE.MeshStandardMaterial;
  walnutFrame: THREE.MeshPhysicalMaterial;
  mediumWoodPlinth: THREE.MeshStandardMaterial;
  brassInlay: THREE.MeshPhysicalMaterial;
  whiteIvoryPiece: THREE.MeshPhysicalMaterial;
  blackEbonyPiece: THREE.MeshPhysicalMaterial;
  greenBaizeFelt: THREE.MeshStandardMaterial;
  // Living Faction Materials (White: Ivory/Silver/Royal Gold, Black: Obsidian/Gunmetal/Crimson)
  whiteArmor: THREE.MeshPhysicalMaterial;
  whiteSteel: THREE.MeshPhysicalMaterial;
  whiteRoyalCape: THREE.MeshStandardMaterial;
  whiteArcaneGlow: THREE.MeshStandardMaterial;
  blackArmor: THREE.MeshPhysicalMaterial;
  blackSteel: THREE.MeshPhysicalMaterial;
  blackCrimsonCape: THREE.MeshStandardMaterial;
  blackArcaneGlow: THREE.MeshStandardMaterial;
  // Grand Chamber Materials
  chamberMarbleFloor: THREE.MeshPhysicalMaterial;
  chamberWalnutWall: THREE.MeshStandardMaterial;
  chamberColumnStone: THREE.MeshStandardMaterial;
  windowSunbeam: THREE.MeshBasicMaterial;
  chandelierCrystal: THREE.MeshBasicMaterial;
  // Board Interactive Highlights
  selectedHighlight: THREE.MeshBasicMaterial;
  lastMoveHighlight: THREE.MeshBasicMaterial;
  hintHighlight: THREE.MeshBasicMaterial;
  legalMoveDot: THREE.MeshStandardMaterial;
  legalCaptureRing: THREE.MeshStandardMaterial;
  checkAlertRing: THREE.MeshBasicMaterial;
  dispose: () => void;
}

function createProceduralWoodTexture(
  baseHex: string,
  grainHex: string,
  maxAnisotropy: number,
  scale = 1
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = grainHex;
    ctx.globalAlpha = 0.16;

    for (let i = 0; i < 110; i++) {
      const y = (i / 110) * 512;
      ctx.lineWidth = 1 + (i % 3) * 0.8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) {
        const wave =
          Math.sin(x * 0.014 * scale + i * 0.45) * 6 +
          Math.cos(x * 0.03 * scale - i * 0.2) * 3;
        ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }

    ctx.fillStyle = grainHex;
    ctx.globalAlpha = 0.06;
    for (let j = 0; j < 700; j++) {
      const rx = (j * 73) % 512;
      const ry = (j * 137) % 512;
      ctx.fillRect(rx, ry, 6, 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

function createMarbleFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#191512';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle inlaid marble tiles & brass border veins
    ctx.fillStyle = '#211B17';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillRect(256, 256, 256, 256);

    ctx.strokeStyle = '#382B21';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 252, 252);
    ctx.strokeRect(258, 258, 252, 252);

    // Fine marble veining
    ctx.strokeStyle = '#4A382B';
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 32);
      ctx.bezierCurveTo(160, i * 28 + 20, 340, i * 34 - 20, 512, i * 30);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createChessMaterialSet(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean
): ChessMaterialSet {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const mapleTex = createProceduralWoodTexture('#E7D5B5', '#C7B08B', maxAniso, 1.0);
  const walnutSquareTex = createProceduralWoodTexture('#9A6A45', '#684327', maxAniso, 1.2);
  const darkWalnutFrameTex = createProceduralWoodTexture('#38251C', '#1F130D', maxAniso, 0.8);
  const mediumWoodTex = createProceduralWoodTexture('#79543A', '#4E3320', maxAniso, 1.1);
  const ivoryTex = createProceduralWoodTexture('#F2E9DC', '#DFCCB5', maxAniso, 0.5);
  const ebonyTex = createProceduralWoodTexture('#2B1B13', '#140B07', maxAniso, 1.4);
  const marbleFloorTex = createMarbleFloorTexture(maxAniso);

  const mapleSquare = new THREE.MeshStandardMaterial({
    map: mapleTex,
    roughness: 0.34,
    metalness: 0.02,
  });

  const walnutSquare = new THREE.MeshStandardMaterial({
    map: walnutSquareTex,
    roughness: 0.36,
    metalness: 0.03,
  });

  const walnutFrame = new THREE.MeshPhysicalMaterial({
    map: darkWalnutFrameTex,
    roughness: 0.26,
    metalness: 0.05,
    clearcoat: isSoftwareGl ? 0 : 0.45,
    clearcoatRoughness: 0.2,
  });

  const mediumWoodPlinth = new THREE.MeshStandardMaterial({
    map: mediumWoodTex,
    roughness: 0.4,
    metalness: 0.04,
  });

  const brassInlay = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#C7A66A'),
    roughness: 0.2,
    metalness: 0.88,
    anisotropy: isSoftwareGl ? 0 : 0.65,
  });

  const whiteIvoryPiece = new THREE.MeshPhysicalMaterial({
    map: ivoryTex,
    color: new THREE.Color('#F5EDE0'),
    roughness: 0.22,
    metalness: 0.03,
    clearcoat: isSoftwareGl ? 0 : 0.55,
    clearcoatRoughness: 0.16,
  });

  const blackEbonyPiece = new THREE.MeshPhysicalMaterial({
    map: ebonyTex,
    color: new THREE.Color('#342117'),
    roughness: 0.25,
    metalness: 0.08,
    clearcoat: isSoftwareGl ? 0 : 0.6,
    clearcoatRoughness: 0.18,
  });

  const greenBaizeFelt = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1B4332'),
    roughness: 0.92,
    metalness: 0.0,
  });

  // Living Faction Materials
  const whiteArmor = new THREE.MeshPhysicalMaterial({
    map: ivoryTex,
    color: new THREE.Color('#F6EFE2'),
    roughness: 0.22,
    metalness: 0.28,
    clearcoat: isSoftwareGl ? 0 : 0.5,
    clearcoatRoughness: 0.15,
  });

  const whiteSteel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#E2E8F0'),
    roughness: 0.18,
    metalness: 0.9,
    anisotropy: isSoftwareGl ? 0 : 0.6,
  });

  const whiteRoyalCape = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#C7A66A'),
    roughness: 0.55,
    metalness: 0.25,
    side: THREE.DoubleSide,
  });

  const whiteArcaneGlow = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FFF0B3'),
    emissive: new THREE.Color('#E6AF4B'),
    emissiveIntensity: 1.2,
    roughness: 0.15,
    metalness: 0.1,
  });

  const blackArmor = new THREE.MeshPhysicalMaterial({
    map: ebonyTex,
    color: new THREE.Color('#241E1C'),
    roughness: 0.24,
    metalness: 0.72,
    clearcoat: isSoftwareGl ? 0 : 0.55,
    clearcoatRoughness: 0.18,
  });

  const blackSteel = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#4A3F3B'),
    roughness: 0.22,
    metalness: 0.88,
    anisotropy: isSoftwareGl ? 0 : 0.6,
  });

  const blackCrimsonCape = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#801B1B'),
    roughness: 0.6,
    metalness: 0.15,
    side: THREE.DoubleSide,
  });

  const blackArcaneGlow = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#FF6B4A'),
    emissive: new THREE.Color('#D9381E'),
    emissiveIntensity: 1.2,
    roughness: 0.15,
    metalness: 0.1,
  });

  // Grand Chamber Materials
  const chamberMarbleFloor = new THREE.MeshPhysicalMaterial({
    map: marbleFloorTex,
    roughness: 0.26,
    metalness: 0.08,
    clearcoat: isSoftwareGl ? 0 : 0.35,
  });

  const chamberWalnutWall = new THREE.MeshStandardMaterial({
    map: darkWalnutFrameTex,
    color: new THREE.Color('#2D1E16'),
    roughness: 0.48,
    metalness: 0.05,
  });

  const chamberColumnStone = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#3F2D21'),
    roughness: 0.42,
    metalness: 0.12,
  });

  const windowSunbeam = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#FFE4B5'),
    transparent: true,
    opacity: 0.065,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const chandelierCrystal = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#FFF4D9'),
  });

  // Board Highlights
  const selectedHighlight = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#C7A66A'),
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const lastMoveHighlight = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#D4A359'),
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const hintHighlight = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#48BB78'),
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const legalMoveDot = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#C7A66A'),
    emissive: new THREE.Color('#8A6D3B'),
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.6,
    transparent: true,
    opacity: 0.88,
  });

  const legalCaptureRing = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#E09F3E'),
    emissive: new THREE.Color('#9E5A14'),
    emissiveIntensity: 0.45,
    roughness: 0.25,
    metalness: 0.7,
    transparent: true,
    opacity: 0.92,
  });

  const checkAlertRing = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#D9534F'),
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  return {
    mapleSquare,
    walnutSquare,
    walnutFrame,
    mediumWoodPlinth,
    brassInlay,
    whiteIvoryPiece,
    blackEbonyPiece,
    greenBaizeFelt,
    whiteArmor,
    whiteSteel,
    whiteRoyalCape,
    whiteArcaneGlow,
    blackArmor,
    blackSteel,
    blackCrimsonCape,
    blackArcaneGlow,
    chamberMarbleFloor,
    chamberWalnutWall,
    chamberColumnStone,
    windowSunbeam,
    chandelierCrystal,
    selectedHighlight,
    lastMoveHighlight,
    hintHighlight,
    legalMoveDot,
    legalCaptureRing,
    checkAlertRing,
    dispose: () => {
      mapleTex.dispose();
      walnutSquareTex.dispose();
      darkWalnutFrameTex.dispose();
      mediumWoodTex.dispose();
      ivoryTex.dispose();
      ebonyTex.dispose();
      marbleFloorTex.dispose();
      mapleSquare.dispose();
      walnutSquare.dispose();
      walnutFrame.dispose();
      mediumWoodPlinth.dispose();
      brassInlay.dispose();
      whiteIvoryPiece.dispose();
      blackEbonyPiece.dispose();
      greenBaizeFelt.dispose();
      whiteArmor.dispose();
      whiteSteel.dispose();
      whiteRoyalCape.dispose();
      whiteArcaneGlow.dispose();
      blackArmor.dispose();
      blackSteel.dispose();
      blackCrimsonCape.dispose();
      blackArcaneGlow.dispose();
      chamberMarbleFloor.dispose();
      chamberWalnutWall.dispose();
      chamberColumnStone.dispose();
      windowSunbeam.dispose();
      chandelierCrystal.dispose();
      selectedHighlight.dispose();
      lastMoveHighlight.dispose();
      hintHighlight.dispose();
      legalMoveDot.dispose();
      legalCaptureRing.dispose();
      checkAlertRing.dispose();
    },
  };
}
