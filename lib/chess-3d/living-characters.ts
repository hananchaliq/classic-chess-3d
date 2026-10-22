import * as THREE from 'three';
import type { PieceColor, PieceSymbol } from '../../types/chess.ts';
import type { ChessMaterialSet } from './materials.ts';

export type CharacterAnimState =
  | 'idle'
  | 'walk'
  | 'leap'
  | 'attack'
  | 'hit_reaction'
  | 'defeat'
  | 'check_reaction';

export interface LivingCharacterRig {
  rootGroup: THREE.Group;
  pelvisGroup: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  rightArmGroup: THREE.Group;
  leftArmGroup: THREE.Group;
  leftLegGroup: THREE.Group;
  rightLegGroup: THREE.Group;
  capeGroup: THREE.Group | null;
  arcaneOrb: THREE.Mesh | null;
  pieceType: PieceSymbol;
  color: PieceColor;
  phaseOffset: number;
  animState: CharacterAnimState;
  stateStartTime: number;
}

export interface LivingCharacterGeometryCache {
  sharedGeometries: THREE.BufferGeometry[];
  dispose: () => void;
}

export function createLivingCharacterGeometryCache(): LivingCharacterGeometryCache {
  const sharedGeometries: THREE.BufferGeometry[] = [];
  return {
    sharedGeometries,
    dispose: () => {
      sharedGeometries.forEach((g) => g.dispose());
    },
  };
}

function getFactionMaterials(color: PieceColor, palette: ChessMaterialSet) {
  if (color === 'w') {
    return {
      armor: palette.whiteArmor,
      steel: palette.whiteSteel,
      cape: palette.whiteRoyalCape,
      trim: palette.brassInlay,
      glow: palette.whiteArcaneGlow,
      base: palette.whiteIvoryPiece,
    };
  }
  return {
    armor: palette.blackArmor,
    steel: palette.blackSteel,
    cape: palette.blackCrimsonCape,
    trim: palette.brassInlay,
    glow: palette.blackArcaneGlow,
    base: palette.blackEbonyPiece,
  };
}

/**
 * Builds an articulated 3D Living Chess Character rig with distinct silhouette,
 * armor, weapon, and hierarchy for real-time procedural animation and duel captures.
 */
export function buildLivingCharacterRig(
  type: PieceSymbol,
  color: PieceColor,
  palette: ChessMaterialSet,
  cache: LivingCharacterGeometryCache,
  phaseOffset = 0,
  castShadow = true
): LivingCharacterRig {
  const f = getFactionMaterials(color, palette);
  const track = <T extends THREE.BufferGeometry>(geom: T): T => {
    cache.sharedGeometries.push(geom);
    return geom;
  };

  const rootGroup = new THREE.Group();

  // 1. Tactical Base Pedestal with Felt & Faction Ring
  const basePedestal = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.35, 0.4, 0.08, 24)),
    f.armor
  );
  basePedestal.position.y = 0.04;
  basePedestal.castShadow = castShadow;
  basePedestal.receiveShadow = true;
  rootGroup.add(basePedestal);

  const trimRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.365, 0.016, 10, 28)),
    f.trim
  );
  trimRing.rotation.x = Math.PI / 2;
  trimRing.position.y = 0.075;
  rootGroup.add(trimRing);

  const pelvisGroup = new THREE.Group();
  pelvisGroup.position.y = 0.08;
  rootGroup.add(pelvisGroup);

  // Legs
  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.11, 0.24, 0);
  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.11, 0.24, 0);
  pelvisGroup.add(leftLegGroup, rightLegGroup);

  const legWidth = type === 'r' ? 0.11 : 0.075;
  const legGeom = track(new THREE.CylinderGeometry(legWidth * 0.9, legWidth, 0.28, 12));
  const leftLegMesh = new THREE.Mesh(legGeom, f.steel);
  leftLegMesh.position.y = -0.12;
  leftLegMesh.castShadow = castShadow;
  leftLegGroup.add(leftLegMesh);

  const rightLegMesh = new THREE.Mesh(legGeom, f.steel);
  rightLegMesh.position.y = -0.12;
  rightLegMesh.castShadow = castShadow;
  rightLegGroup.add(rightLegMesh);

  // Torso
  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 0.26;
  pelvisGroup.add(torsoGroup);

  const headGroup = new THREE.Group();
  const rightArmGroup = new THREE.Group();
  const leftArmGroup = new THREE.Group();
  let capeGroup: THREE.Group | null = null;
  let arcaneOrb: THREE.Mesh | null = null;

  // Class-specific anatomy, armor, and weapons
  if (type === 'p') {
    // INFANTRY VANGUARD FOOTMAN (Shield + Spear)
    const cuirass = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.17, 0.14, 0.34, 16)),
      f.armor
    );
    cuirass.position.y = 0.17;
    cuirass.castShadow = castShadow;
    cuirass.receiveShadow = true;
    torsoGroup.add(cuirass);

    const belt = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.155, 0.155, 0.05, 16)),
      f.trim
    );
    belt.position.y = 0.04;
    torsoGroup.add(belt);

    headGroup.position.y = 0.38;
    const helm = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.135, 18, 16)),
      f.armor
    );
    helm.position.y = 0.09;
    helm.castShadow = castShadow;
    headGroup.add(helm);

    const visor = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.18, 0.045, 0.12)),
      f.glow
    );
    visor.position.set(0, 0.09, 0.09);
    headGroup.add(visor);

    const crest = new THREE.Mesh(
      track(new THREE.ConeGeometry(0.045, 0.14, 10)),
      f.trim
    );
    crest.position.set(0, 0.24, 0);
    headGroup.add(crest);

    rightArmGroup.position.set(0.21, 0.3, 0);
    leftArmGroup.position.set(-0.21, 0.3, 0);

    // Right arm + Spear
    const rArm = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.05, 0.045, 0.26, 10)),
      f.steel
    );
    rArm.position.y = -0.11;
    rightArmGroup.add(rArm);

    const spearShaft = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.018, 0.018, 0.88, 8)),
      f.steel
    );
    spearShaft.position.set(0.03, 0.08, 0.12);
    spearShaft.rotation.x = 0.25;
    rightArmGroup.add(spearShaft);

    const spearTip = new THREE.Mesh(
      track(new THREE.ConeGeometry(0.042, 0.18, 8)),
      f.trim
    );
    spearTip.position.set(0.03, 0.52, 0.23);
    spearTip.rotation.x = 0.25;
    rightArmGroup.add(spearTip);

    // Left arm + Tower Buckler Shield
    const lArm = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.05, 0.045, 0.24, 10)),
      f.steel
    );
    lArm.position.y = -0.1;
    leftArmGroup.add(lArm);

    const shield = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.04, 0.36, 0.26)),
      f.armor
    );
    shield.position.set(-0.06, -0.08, 0.1);
    shield.rotation.y = 0.35;
    shield.castShadow = castShadow;
    leftArmGroup.add(shield);

    const shieldTrim = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.048, 0.22, 0.14)),
      f.trim
    );
    shieldTrim.position.set(-0.065, -0.08, 0.1);
    shieldTrim.rotation.y = 0.35;
    leftArmGroup.add(shieldTrim);
  } else if (type === 'r') {
    // TOWER SIEGE GOLEM (Colossal Armored Juggernaut with Warhammer + Battlement Shoulders)
    const chest = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.42, 0.46, 0.3)),
      f.armor
    );
    chest.position.y = 0.23;
    chest.castShadow = castShadow;
    chest.receiveShadow = true;
    torsoGroup.add(chest);

    const coreRune = new THREE.Mesh(
      track(new THREE.OctahedronGeometry(0.075, 0)),
      f.glow
    );
    coreRune.position.set(0, 0.25, 0.16);
    torsoGroup.add(coreRune);

    // Battlement shoulder pauldrons
    for (const side of [-1, 1]) {
      const pauldron = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.16, 0.2, 0.26)),
        f.steel
      );
      pauldron.position.set(side * 0.26, 0.38, 0);
      pauldron.castShadow = castShadow;
      torsoGroup.add(pauldron);
    }

    headGroup.position.y = 0.48;
    const fortressHelm = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.16, 0.15, 0.22, 8)),
      f.armor
    );
    fortressHelm.position.y = 0.11;
    fortressHelm.castShadow = castShadow;
    headGroup.add(fortressHelm);

    const helmVisor = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.2, 0.04, 0.18)),
      f.glow
    );
    helmVisor.position.set(0, 0.12, 0.08);
    headGroup.add(helmVisor);

    rightArmGroup.position.set(0.28, 0.38, 0);
    leftArmGroup.position.set(-0.28, 0.38, 0);

    const rGauntlet = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.12, 0.34, 0.12)),
      f.steel
    );
    rGauntlet.position.y = -0.14;
    rightArmGroup.add(rGauntlet);

    // Siege Warhammer
    const hammerShaft = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 10)),
      f.steel
    );
    hammerShaft.position.set(0.02, 0.1, 0.14);
    hammerShaft.rotation.x = 0.2;
    rightArmGroup.add(hammerShaft);

    const hammerHead = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.22, 0.16, 0.32)),
      f.trim
    );
    hammerHead.position.set(0.02, 0.5, 0.22);
    hammerHead.rotation.x = 0.2;
    hammerHead.castShadow = castShadow;
    rightArmGroup.add(hammerHead);

    const lGauntlet = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.14, 0.38, 0.22)),
      f.armor
    );
    lGauntlet.position.set(-0.02, -0.14, 0.06);
    leftArmGroup.add(lGauntlet);
  } else if (type === 'n') {
    // CAVALRY WAR STEED & ROYAL DRAGOON LANCER
    const steedBody = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.28, 0.32, 0.52)),
      f.armor
    );
    steedBody.position.set(0, 0.18, 0);
    steedBody.castShadow = castShadow;
    torsoGroup.add(steedBody);

    // Armored Steed Neck & Head forward
    const steedNeck = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.18, 0.38, 0.22)),
      f.armor
    );
    steedNeck.position.set(0, 0.4, 0.16);
    steedNeck.rotation.x = -0.35;
    steedNeck.castShadow = castShadow;
    torsoGroup.add(steedNeck);

    const steedMuzzle = new THREE.Mesh(
      track(new THREE.ConeGeometry(0.11, 0.28, 8)),
      f.steel
    );
    steedMuzzle.position.set(0, 0.54, 0.32);
    steedMuzzle.rotation.x = Math.PI / 2 + 0.35;
    torsoGroup.add(steedMuzzle);

    const steedCrest = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.04, 0.32, 0.12)),
      f.trim
    );
    steedCrest.position.set(0, 0.48, 0.08);
    steedCrest.rotation.x = -0.3;
    torsoGroup.add(steedCrest);

    // Mounted Dragoon Rider Helm
    headGroup.position.set(0, 0.42, -0.06);
    const riderTorso = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.12, 0.11, 0.26, 12)),
      f.steel
    );
    riderTorso.position.y = 0.08;
    headGroup.add(riderTorso);

    const riderHelm = new THREE.Mesh(
      track(new THREE.ConeGeometry(0.11, 0.24, 12)),
      f.armor
    );
    riderHelm.position.y = 0.3;
    headGroup.add(riderHelm);

    rightArmGroup.position.set(0.22, 0.44, 0.02);
    leftArmGroup.position.set(-0.22, 0.44, 0.02);

    // Jousting War Lance
    const lance = new THREE.Mesh(
      track(new THREE.ConeGeometry(0.055, 1.05, 12)),
      f.trim
    );
    lance.position.set(0.04, 0.06, 0.36);
    lance.rotation.x = Math.PI / 2 - 0.18;
    lance.castShadow = castShadow;
    rightArmGroup.add(lance);
  } else if (type === 'b') {
    // MYSTIC ARCH-PRELATE / WAR CLERIC (Mitre Crown + Flowing Robes + Crosier Staff)
    const robeSkirt = new THREE.Mesh(
      track(new THREE.ConeGeometry(0.26, 0.56, 18)),
      f.armor
    );
    robeSkirt.position.y = 0.24;
    robeSkirt.castShadow = castShadow;
    torsoGroup.add(robeSkirt);

    const stoleTrim = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.1, 0.46, 0.26)),
      f.trim
    );
    stoleTrim.position.set(0, 0.24, 0.03);
    torsoGroup.add(stoleTrim);

    headGroup.position.y = 0.52;
    const mitreHead = new THREE.Mesh(
      track(new THREE.ConeGeometry(0.13, 0.32, 14)),
      f.armor
    );
    mitreHead.position.y = 0.14;
    mitreHead.castShadow = castShadow;
    headGroup.add(mitreHead);

    const mitreHalo = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.14, 0.015, 8, 24)),
      f.glow
    );
    mitreHalo.position.set(0, 0.2, -0.04);
    headGroup.add(mitreHalo);

    rightArmGroup.position.set(0.2, 0.44, 0);
    leftArmGroup.position.set(-0.2, 0.44, 0);

    // Radiant Crosier Staff
    const staffShaft = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.018, 0.018, 1.02, 10)),
      f.trim
    );
    staffShaft.position.set(0.04, 0.08, 0.12);
    rightArmGroup.add(staffShaft);

    const staffHead = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.08, 0.018, 10, 20)),
      f.trim
    );
    staffHead.position.set(0.04, 0.62, 0.12);
    rightArmGroup.add(staffHead);

    arcaneOrb = new THREE.Mesh(
      track(new THREE.OctahedronGeometry(0.055, 0)),
      f.glow
    );
    arcaneOrb.position.set(-0.06, 0.05, 0.18);
    leftArmGroup.add(arcaneOrb);

    capeGroup = new THREE.Group();
    capeGroup.position.set(0, 0.48, -0.12);
    const capeMesh = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.32, 0.54, 0.03)),
      f.cape
    );
    capeMesh.position.y = -0.25;
    capeMesh.rotation.x = 0.15;
    capeGroup.add(capeMesh);
    torsoGroup.add(capeGroup);
  } else if (type === 'q') {
    // ARCANE SOVEREIGN EMPRESS (Regal Armored Gown + Floating Scepter + Coronet)
    const gownBodice = new THREE.Mesh(
      track(new THREE.ConeGeometry(0.27, 0.68, 22)),
      f.armor
    );
    gownBodice.position.y = 0.3;
    gownBodice.castShadow = castShadow;
    torsoGroup.add(gownBodice);

    const collar = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.22, 0.14, 0.14, 16, 1, true)),
      f.trim
    );
    collar.position.y = 0.58;
    torsoGroup.add(collar);

    headGroup.position.y = 0.64;
    const queenHead = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.125, 18, 16)),
      f.armor
    );
    queenHead.position.y = 0.09;
    headGroup.add(queenHead);

    const coronet = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.15, 0.11, 0.14, 10)),
      f.trim
    );
    coronet.position.y = 0.2;
    headGroup.add(coronet);

    const crownGem = new THREE.Mesh(
      track(new THREE.OctahedronGeometry(0.055, 0)),
      f.glow
    );
    crownGem.position.y = 0.31;
    headGroup.add(crownGem);

    rightArmGroup.position.set(0.21, 0.54, 0);
    leftArmGroup.position.set(-0.21, 0.54, 0);

    // Royal Scepter
    const scepter = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.016, 0.014, 0.96, 10)),
      f.trim
    );
    scepter.position.set(0.04, 0.04, 0.14);
    rightArmGroup.add(scepter);

    const scepterStar = new THREE.Mesh(
      track(new THREE.OctahedronGeometry(0.08, 1)),
      f.glow
    );
    scepterStar.position.set(0.04, 0.55, 0.14);
    rightArmGroup.add(scepterStar);

    // Floating Arcane Focus Orb in Left Hand
    arcaneOrb = new THREE.Mesh(
      track(new THREE.OctahedronGeometry(0.075, 0)),
      f.glow
    );
    arcaneOrb.position.set(-0.08, 0.12, 0.22);
    leftArmGroup.add(arcaneOrb);

    capeGroup = new THREE.Group();
    capeGroup.position.set(0, 0.58, -0.12);
    const capeMesh = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.38, 0.68, 0.03)),
      f.cape
    );
    capeMesh.position.y = -0.32;
    capeMesh.rotation.x = 0.18;
    capeGroup.add(capeMesh);
    torsoGroup.add(capeGroup);
  } else {
    // 'k' - HIGH MONARCH KNIGHT-KING (Plate Armor + Royal Mantle + Greatsword + Imperial Crown)
    const breastplate = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.24, 0.19, 0.66, 18)),
      f.armor
    );
    breastplate.position.y = 0.31;
    breastplate.castShadow = castShadow;
    torsoGroup.add(breastplate);

    // Royal Pauldrons
    for (const side of [-1, 1]) {
      const pauldron = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.13, 14, 12)),
        f.trim
      );
      pauldron.position.set(side * 0.24, 0.56, 0);
      torsoGroup.add(pauldron);
    }

    headGroup.position.y = 0.66;
    const kingHelm = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.135, 0.13, 0.22, 16)),
      f.armor
    );
    kingHelm.position.y = 0.1;
    headGroup.add(kingHelm);

    const imperialCrown = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.16, 0.135, 0.12, 12)),
      f.trim
    );
    imperialCrown.position.y = 0.22;
    headGroup.add(imperialCrown);

    // Cross finial
    const crossVert = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.05, 0.2, 0.05)),
      f.trim
    );
    crossVert.position.y = 0.36;
    headGroup.add(crossVert);

    const crossHoriz = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.15, 0.05, 0.05)),
      f.trim
    );
    crossHoriz.position.y = 0.38;
    headGroup.add(crossHoriz);

    rightArmGroup.position.set(0.26, 0.56, 0);
    leftArmGroup.position.set(-0.26, 0.56, 0);

    // Sovereign Greatsword
    const swordBlade = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.05, 0.92, 0.02)),
      f.steel
    );
    swordBlade.position.set(0.04, 0.05, 0.18);
    swordBlade.rotation.x = 0.15;
    swordBlade.castShadow = castShadow;
    rightArmGroup.add(swordBlade);

    const crossguard = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.24, 0.04, 0.05)),
      f.trim
    );
    crossguard.position.set(0.04, -0.18, 0.14);
    crossguard.rotation.x = 0.15;
    rightArmGroup.add(crossguard);

    // Royal Aegis Shield on Left Arm
    const royalShield = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.05, 0.44, 0.3)),
      f.trim
    );
    royalShield.position.set(-0.06, -0.12, 0.12);
    royalShield.rotation.y = 0.3;
    leftArmGroup.add(royalShield);

    capeGroup = new THREE.Group();
    capeGroup.position.set(0, 0.62, -0.15);
    const capeMesh = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.44, 0.74, 0.04)),
      f.cape
    );
    capeMesh.position.y = -0.35;
    capeMesh.rotation.x = 0.16;
    capeGroup.add(capeMesh);
    torsoGroup.add(capeGroup);
  }

  torsoGroup.add(headGroup, rightArmGroup, leftArmGroup);

  // Face opponent direction by default (White faces -Z or +Z depending on board coordinates:
  // rank 8 is at z = -3.5, rank 1 is at z = +3.5. So White at +3.5 faces -Z (rotation.y = Math.PI),
  // Black at -3.5 faces +Z (rotation.y = 0)).
  rootGroup.rotation.y = color === 'w' ? Math.PI : 0;

  return {
    rootGroup,
    pelvisGroup,
    torsoGroup,
    headGroup,
    rightArmGroup,
    leftArmGroup,
    leftLegGroup,
    rightLegGroup,
    capeGroup,
    arcaneOrb,
    pieceType: type,
    color,
    phaseOffset,
    animState: 'idle',
    stateStartTime: 0,
  };
}

/**
 * Updates a LivingCharacterRig's skeletal joints on each animation frame.
 * Zero allocations inside the hot loop.
 */
export function updateLivingCharacterRigAnimation(
  rig: LivingCharacterRig,
  nowSec: number,
  isInCheck: boolean
): void {
  const t = nowSec * 2.2 + rig.phaseOffset;

  // Reset base transforms
  rig.pelvisGroup.position.y = 0.08;
  rig.torsoGroup.rotation.set(0, 0, 0);
  rig.headGroup.rotation.set(0, 0, 0);
  rig.rightArmGroup.rotation.set(0, 0, 0);
  rig.leftArmGroup.rotation.set(0, 0, 0);
  rig.leftLegGroup.rotation.set(0, 0, 0);
  rig.rightLegGroup.rotation.set(0, 0, 0);

  if (rig.arcaneOrb) {
    rig.arcaneOrb.position.y = 0.12 + Math.sin(t * 1.8) * 0.035;
    rig.arcaneOrb.rotation.y = t * 1.4;
    rig.arcaneOrb.rotation.x = t * 0.9;
  }

  if (rig.capeGroup) {
    rig.capeGroup.rotation.x = 0.06 + Math.sin(t * 1.1) * 0.04;
    rig.capeGroup.rotation.z = Math.cos(t * 0.8) * 0.025;
  }

  const stateElapsed = Math.max(0, nowSec - rig.stateStartTime);

  if (rig.animState === 'walk' || rig.animState === 'leap') {
    const stride = Math.sin(nowSec * 14);
    rig.leftLegGroup.rotation.x = stride * 0.55;
    rig.rightLegGroup.rotation.x = -stride * 0.55;
    rig.rightArmGroup.rotation.x = -0.35 + Math.cos(nowSec * 14) * 0.25;
    rig.leftArmGroup.rotation.x = -stride * 0.3;
    rig.torsoGroup.rotation.x = 0.14;
    rig.pelvisGroup.position.y = 0.08 + Math.abs(stride) * 0.035;
    return;
  }

  if (rig.animState === 'attack') {
    // Windup (0 - 0.22s) -> Cleave Strike (0.22 - 0.52s) -> Follow-through (0.52s+)
    if (stateElapsed < 0.22) {
      const p = stateElapsed / 0.22;
      rig.torsoGroup.rotation.y = -0.45 * p;
      rig.torsoGroup.rotation.x = -0.18 * p;
      rig.rightArmGroup.rotation.x = -1.65 * p;
      rig.rightArmGroup.rotation.z = 0.25 * p;
    } else if (stateElapsed < 0.55) {
      const p = (stateElapsed - 0.22) / 0.33;
      const easeOut = 1 - Math.pow(1 - p, 3);
      rig.torsoGroup.rotation.y = -0.45 + 0.85 * easeOut;
      rig.torsoGroup.rotation.x = -0.18 + 0.48 * easeOut;
      rig.rightArmGroup.rotation.x = -1.65 + 2.65 * easeOut;
    } else {
      const p = Math.min(1, (stateElapsed - 0.55) / 0.4);
      rig.torsoGroup.rotation.y = 0.4 * (1 - p);
      rig.torsoGroup.rotation.x = 0.3 * (1 - p);
      rig.rightArmGroup.rotation.x = 1.0 * (1 - p);
    }
    return;
  }

  if (rig.animState === 'hit_reaction') {
    const recoil = Math.sin(Math.min(1, stateElapsed / 0.35) * Math.PI);
    rig.torsoGroup.rotation.x = -0.42 * recoil;
    rig.headGroup.rotation.x = -0.35 * recoil;
    rig.rightArmGroup.rotation.z = 0.5 * recoil;
    rig.leftArmGroup.rotation.z = -0.5 * recoil;
    return;
  }

  if (rig.animState === 'defeat') {
    const p = Math.min(1, stateElapsed / 0.55);
    rig.pelvisGroup.position.y = 0.08 * (1 - p * 0.65);
    rig.torsoGroup.rotation.x = 0.75 * p;
    rig.headGroup.rotation.x = 0.45 * p;
    rig.rightArmGroup.rotation.z = 0.65 * p;
    rig.leftArmGroup.rotation.z = -0.65 * p;
    return;
  }

  if (isInCheck && rig.pieceType === 'k') {
    // Alert defensive stance when King is in check
    const pulse = Math.sin(nowSec * 7.5);
    rig.torsoGroup.rotation.x = 0.12;
    rig.leftArmGroup.rotation.x = -0.65;
    rig.rightArmGroup.rotation.x = -0.45 + pulse * 0.12;
    rig.headGroup.rotation.y = pulse * 0.18;
    return;
  }

  // Default 'idle' breathing & subtle vigilant posture
  const breath = Math.sin(t);
  rig.pelvisGroup.position.y = 0.08 + breath * 0.01;
  rig.torsoGroup.rotation.x = breath * 0.025;
  rig.headGroup.rotation.y = Math.sin(t * 0.55) * 0.06;
  rig.rightArmGroup.rotation.x = Math.cos(t * 0.9) * 0.035;
  rig.leftArmGroup.rotation.x = -Math.sin(t * 0.9) * 0.025;
}
