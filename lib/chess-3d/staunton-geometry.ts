import * as THREE from 'three';
import type { PieceColor, PieceSymbol } from '../../types/chess.ts';
import type { ChessMaterialSet } from './materials.ts';

function buildLatheProfile(coords: Array<[number, number]>, segments = 28): THREE.LatheGeometry {
  const points = coords.map(([r, y]) => new THREE.Vector2(r, y));
  const geo = new THREE.LatheGeometry(points, segments);
  geo.computeVertexNormals();
  return geo;
}

function createKnightHeadGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  // Classical Staunton horse profile (facing +Z / -Z depending on player color)
  shape.moveTo(-0.18, 0.35);
  shape.quadraticCurveTo(-0.24, 0.58, -0.21, 0.82); // Back of neck
  shape.quadraticCurveTo(-0.18, 1.05, -0.08, 1.18); // Upper mane crest
  shape.lineTo(-0.04, 1.30); // Ear tip back
  shape.lineTo(0.03, 1.20); // Forehead bridge
  shape.quadraticCurveTo(0.16, 1.12, 0.25, 0.94); // Snout bridge
  shape.lineTo(0.27, 0.83); // Nose tip
  shape.lineTo(0.19, 0.78); // Mouth cleft
  shape.lineTo(0.21, 0.74); // Lower jaw tip
  shape.quadraticCurveTo(0.11, 0.71, 0.04, 0.77); // Cheekbone
  shape.quadraticCurveTo(0.10, 0.58, 0.16, 0.35); // Chest curve
  shape.closePath();

  const extrude = new THREE.ExtrudeGeometry(shape, {
    steps: 2,
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.04,
    bevelSegments: 3,
  });
  extrude.translate(0, 0, -0.08);
  extrude.computeVertexNormals();
  return extrude;
}

export interface StauntonGeometryCache {
  createPieceGroup: (
    type: PieceSymbol,
    color: PieceColor,
    materials: ChessMaterialSet
  ) => THREE.Group;
  dispose: () => void;
}

export function createStauntonGeometryCache(): StauntonGeometryCache {
  const geometries: THREE.BufferGeometry[] = [];
  const track = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  // Shared base felt pad & brass collar accent
  const feltPadGeo = track(new THREE.CylinderGeometry(0.35, 0.36, 0.03, 24));
  feltPadGeo.translate(0, 0.015, 0);

  const brassRingGeo = track(new THREE.TorusGeometry(0.31, 0.016, 10, 28));
  brassRingGeo.rotateX(Math.PI / 2);

  // 1. PAWN (p)
  const pawnBodyGeo = track(
    buildLatheProfile([
      [0.0, 0.03],
      [0.33, 0.03],
      [0.34, 0.09],
      [0.29, 0.14],
      [0.31, 0.18],
      [0.22, 0.24],
      [0.14, 0.48],
      [0.11, 0.68],
      [0.19, 0.72],
      [0.12, 0.76],
      [0.0, 0.76],
    ])
  );
  const pawnHeadGeo = track(new THREE.SphereGeometry(0.185, 24, 20));
  pawnHeadGeo.translate(0, 0.91, 0);

  // 2. ROOK (r)
  const rookBodyGeo = track(
    buildLatheProfile([
      [0.0, 0.03],
      [0.36, 0.03],
      [0.37, 0.11],
      [0.31, 0.16],
      [0.33, 0.21],
      [0.24, 0.29],
      [0.20, 0.64],
      [0.18, 0.88],
      [0.26, 0.95],
      [0.27, 1.12],
      [0.19, 1.12],
      [0.19, 1.04],
      [0.0, 1.04],
    ])
  );
  const rookMerlonGeo = track(new THREE.BoxGeometry(0.09, 0.11, 0.08));

  // 3. KNIGHT (n)
  const knightPedestalGeo = track(
    buildLatheProfile([
      [0.0, 0.03],
      [0.36, 0.03],
      [0.37, 0.11],
      [0.31, 0.17],
      [0.33, 0.22],
      [0.25, 0.30],
      [0.21, 0.40],
      [0.0, 0.40],
    ])
  );
  const knightHeadGeo = track(createKnightHeadGeometry());
  const knightEyeGeo = track(new THREE.SphereGeometry(0.024, 12, 12));

  // 4. BISHOP (b)
  const bishopBodyGeo = track(
    buildLatheProfile([
      [0.0, 0.03],
      [0.36, 0.03],
      [0.37, 0.11],
      [0.31, 0.17],
      [0.33, 0.22],
      [0.22, 0.30],
      [0.15, 0.66],
      [0.13, 0.86],
      [0.22, 0.91],
      [0.16, 0.96],
      [0.22, 1.12],
      [0.18, 1.28],
      [0.07, 1.38],
      [0.0, 1.40],
    ])
  );
  const bishopFinialGeo = track(new THREE.SphereGeometry(0.055, 16, 16));
  bishopFinialGeo.translate(0, 1.44, 0);
  const bishopMitreBandGeo = track(new THREE.TorusGeometry(0.18, 0.015, 10, 24));
  bishopMitreBandGeo.rotateX(Math.PI / 2);

  // 5. QUEEN (q)
  const queenBodyGeo = track(
    buildLatheProfile([
      [0.0, 0.03],
      [0.38, 0.03],
      [0.39, 0.12],
      [0.33, 0.18],
      [0.35, 0.24],
      [0.24, 0.34],
      [0.17, 0.76],
      [0.14, 1.02],
      [0.24, 1.08],
      [0.18, 1.14],
      [0.26, 1.34],
      [0.28, 1.44],
      [0.16, 1.38],
      [0.0, 1.38],
    ])
  );
  const queenDomeGeo = track(new THREE.SphereGeometry(0.16, 20, 16));
  queenDomeGeo.scale(1, 0.7, 1);
  queenDomeGeo.translate(0, 1.42, 0);
  const queenPearlGeo = track(new THREE.SphereGeometry(0.036, 12, 12));

  // 6. KING (k)
  const kingBodyGeo = track(
    buildLatheProfile([
      [0.0, 0.03],
      [0.39, 0.03],
      [0.40, 0.12],
      [0.34, 0.19],
      [0.36, 0.25],
      [0.25, 0.36],
      [0.18, 0.84],
      [0.15, 1.12],
      [0.26, 1.18],
      [0.20, 1.24],
      [0.18, 1.30],
      [0.27, 1.50],
      [0.22, 1.58],
      [0.0, 1.58],
    ])
  );
  const kingCrossVertGeo = track(new THREE.BoxGeometry(0.065, 0.22, 0.055));
  kingCrossVertGeo.translate(0, 1.69, 0);
  const kingCrossHorizGeo = track(new THREE.BoxGeometry(0.17, 0.06, 0.055));
  kingCrossHorizGeo.translate(0, 1.71, 0);

  // Invisible simplified proxy cylinder for fast raycasting
  const proxyHitboxGeo = track(new THREE.CylinderGeometry(0.4, 0.42, 1.6, 12));
  proxyHitboxGeo.translate(0, 0.8, 0);
  const proxyHitboxMat = new THREE.MeshBasicMaterial({ visible: false });

  function createPieceGroup(
    type: PieceSymbol,
    color: PieceColor,
    materials: ChessMaterialSet
  ): THREE.Group {
    const group = new THREE.Group();
    const mainMat = color === 'w' ? materials.whiteIvoryPiece : materials.blackEbonyPiece;

    // 1. Felt Base Pad
    const feltMesh = new THREE.Mesh(feltPadGeo, materials.greenBaizeFelt);
    feltMesh.receiveShadow = true;
    group.add(feltMesh);

    // 2. Subtle Brass Base Collar Ring
    const brassRing = new THREE.Mesh(brassRingGeo, materials.brassInlay);
    brassRing.position.y = 0.15;
    group.add(brassRing);

    if (type === 'p') {
      const body = new THREE.Mesh(pawnBodyGeo, mainMat);
      const head = new THREE.Mesh(pawnHeadGeo, mainMat);
      body.castShadow = true;
      body.receiveShadow = true;
      head.castShadow = true;
      head.receiveShadow = true;
      group.add(body, head);
    } else if (type === 'r') {
      const body = new THREE.Mesh(rookBodyGeo, mainMat);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);

      // 6 Crenellation merlons around turret top
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const merlon = new THREE.Mesh(rookMerlonGeo, mainMat);
        merlon.position.set(Math.cos(angle) * 0.22, 1.16, Math.sin(angle) * 0.22);
        merlon.rotation.y = -angle;
        merlon.castShadow = true;
        group.add(merlon);
      }
    } else if (type === 'n') {
      const pedestal = new THREE.Mesh(knightPedestalGeo, mainMat);
      pedestal.castShadow = true;
      pedestal.receiveShadow = true;

      const head = new THREE.Mesh(knightHeadGeo, mainMat);
      head.castShadow = true;
      head.receiveShadow = true;
      // Rotate knight to face opponent rank: White faces +Z (or -Z depending on board orientation)
      // Rank 1 is at Z = +3.5, Rank 8 is at Z = -3.5.
      // So White (at +Z) faces -Z (rotation.y = Math.PI / 2), Black (at -Z) faces +Z (rotation.y = -Math.PI / 2)
      const headGroup = new THREE.Group();
      headGroup.add(head);

      const eyeL = new THREE.Mesh(knightEyeGeo, materials.brassInlay);
      eyeL.position.set(0.08, 1.02, 0.09);
      const eyeR = new THREE.Mesh(knightEyeGeo, materials.brassInlay);
      eyeR.position.set(0.08, 1.02, -0.09);
      headGroup.add(eyeL, eyeR);

      headGroup.rotation.y = color === 'w' ? Math.PI / 2 : -Math.PI / 2;
      group.add(pedestal, headGroup);
    } else if (type === 'b') {
      const body = new THREE.Mesh(bishopBodyGeo, mainMat);
      const finial = new THREE.Mesh(bishopFinialGeo, materials.brassInlay);
      const band = new THREE.Mesh(bishopMitreBandGeo, materials.brassInlay);
      band.position.y = 1.15;
      band.rotation.z = 0.35;
      body.castShadow = true;
      body.receiveShadow = true;
      finial.castShadow = true;
      group.add(body, finial, band);
    } else if (type === 'q') {
      const body = new THREE.Mesh(queenBodyGeo, mainMat);
      const dome = new THREE.Mesh(queenDomeGeo, mainMat);
      body.castShadow = true;
      body.receiveShadow = true;
      dome.castShadow = true;
      group.add(body, dome);

      // 8 Coronet pearls
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const pearl = new THREE.Mesh(queenPearlGeo, materials.brassInlay);
        pearl.position.set(Math.cos(angle) * 0.24, 1.47, Math.sin(angle) * 0.24);
        group.add(pearl);
      }
    } else if (type === 'k') {
      const body = new THREE.Mesh(kingBodyGeo, mainMat);
      const crossV = new THREE.Mesh(kingCrossVertGeo, materials.brassInlay);
      const crossH = new THREE.Mesh(kingCrossHorizGeo, materials.brassInlay);
      body.castShadow = true;
      body.receiveShadow = true;
      crossV.castShadow = true;
      crossH.castShadow = true;
      group.add(body, crossV, crossH);
    }

    // Raycast hitbox on layer 1
    const hitbox = new THREE.Mesh(proxyHitboxGeo, proxyHitboxMat);
    hitbox.layers.enable(1);
    group.add(hitbox);

    return group;
  }

  return {
    createPieceGroup,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      proxyHitboxMat.dispose();
    },
  };
}
