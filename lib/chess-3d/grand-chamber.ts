import * as THREE from 'three';
import type { GraphicsQualityPreset } from '../../types/chess.ts';
import type { ChessMaterialSet } from './materials.ts';

export interface GrandChessChamberInstance {
  group: THREE.Group;
  update: (elapsedTime: number, quality: GraphicsQualityPreset) => void;
  setQualityVisibility: (quality: GraphicsQualityPreset, showRoom: boolean) => void;
  dispose: () => void;
}

export function createGrandChessChamber(
  materials: ChessMaterialSet
): GrandChessChamberInstance {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const extraMaterials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  // =========================================================================
  // 1. CARVED WALNUT PEDESTAL TABLE (Always visible under the chessboard)
  // =========================================================================
  const tableGroup = new THREE.Group();
  group.add(tableGroup);

  // Table Octagonal / Beveled Top Apron under board (Y = -0.52 to -1.1)
  const tableApronGeo = trackGeo(new THREE.BoxGeometry(11.6, 0.52, 11.6));
  tableApronGeo.translate(0, -0.78, 0);
  const tableApron = new THREE.Mesh(tableApronGeo, materials.walnutFrame);
  tableApron.receiveShadow = true;
  tableGroup.add(tableApron);

  // Brass inlay rim around the table edge
  const tableBrassRimGeo = trackGeo(new THREE.BoxGeometry(11.72, 0.08, 11.72));
  tableBrassRimGeo.translate(0, -0.62, 0);
  const tableBrassRim = new THREE.Mesh(tableBrassRimGeo, materials.brassInlay);
  tableGroup.add(tableBrassRim);

  // Central Sculpted Pedestal Column (LatheGeometry from Y = -5.2 to -1.04)
  const pedestalPoints = [
    new THREE.Vector2(0.0, -5.2),
    new THREE.Vector2(3.4, -5.2),
    new THREE.Vector2(3.2, -4.85),
    new THREE.Vector2(2.1, -4.5),
    new THREE.Vector2(1.45, -3.2),
    new THREE.Vector2(1.75, -2.5),
    new THREE.Vector2(1.35, -1.6),
    new THREE.Vector2(2.4, -1.04),
    new THREE.Vector2(0.0, -1.04),
  ];
  const pedestalGeo = trackGeo(new THREE.LatheGeometry(pedestalPoints, 28));
  pedestalGeo.computeVertexNormals();
  const pedestalMesh = new THREE.Mesh(pedestalGeo, materials.mediumWoodPlinth);
  pedestalMesh.receiveShadow = true;
  tableGroup.add(pedestalMesh);

  // =========================================================================
  // 2. FULL GRAND CHESS CHAMBER (Floor, Library Walls, Pillars, Window, Chandelier)
  // =========================================================================
  const roomArchitectureGroup = new THREE.Group();
  group.add(roomArchitectureGroup);

  // Reflective Marble & Walnut Floor at Y = -5.2
  const floorGeo = trackGeo(new THREE.PlaneGeometry(46, 46));
  floorGeo.rotateX(-Math.PI / 2);
  const floorMesh = new THREE.Mesh(floorGeo, materials.chamberMarbleFloor);
  floorMesh.position.y = -5.2;
  floorMesh.receiveShadow = true;
  roomArchitectureGroup.add(floorMesh);

  // Circular Brass Inlay Medallion on Floor under the Table
  const floorRingGeo = trackGeo(new THREE.RingGeometry(4.2, 4.45, 48));
  floorRingGeo.rotateX(-Math.PI / 2);
  const floorRing = new THREE.Mesh(floorRingGeo, materials.brassInlay);
  floorRing.position.y = -5.18;
  roomArchitectureGroup.add(floorRing);

  // 4 Classical Fluted Corner Pillars + 4 Mid-Wall Pillars
  const pillarGeo = trackGeo(new THREE.CylinderGeometry(0.68, 0.78, 18, 16));
  const pillarBaseGeo = trackGeo(new THREE.BoxGeometry(1.85, 0.9, 1.85));
  const pillarPositions: Array<[number, number]> = [
    [-16, -16],
    [16, -16],
    [-16, 16],
    [16, 16],
    [-16, 0],
    [16, 0],
    [0, -16],
    [0, 16],
  ];

  for (const [px, pz] of pillarPositions) {
    const col = new THREE.Mesh(pillarGeo, materials.chamberColumnStone);
    col.position.set(px, 3.8, pz);
    const base = new THREE.Mesh(pillarBaseGeo, materials.walnutFrame);
    base.position.set(px, -4.75, pz);
    const cap = new THREE.Mesh(pillarBaseGeo, materials.brassInlay);
    cap.position.set(px, 12.6, pz);
    roomArchitectureGroup.add(col, base, cap);
  }

  // Library Walls (Back Z = -18, Front Z = +18, Left X = -18, Right X = +18)
  const wallGeo = trackGeo(new THREE.BoxGeometry(36, 19, 0.6));
  const backWall = new THREE.Mesh(wallGeo, materials.chamberWalnutWall);
  backWall.position.set(0, 4.2, -18);
  const frontWall = new THREE.Mesh(wallGeo, materials.chamberWalnutWall);
  frontWall.position.set(0, 4.2, 18);

  const sideWallGeo = trackGeo(new THREE.BoxGeometry(0.6, 19, 36));
  const leftWall = new THREE.Mesh(sideWallGeo, materials.chamberWalnutWall);
  leftWall.position.set(-18, 4.2, 0);
  const rightWall = new THREE.Mesh(sideWallGeo, materials.chamberWalnutWall);
  rightWall.position.set(18, 4.2, 0);

  roomArchitectureGroup.add(backWall, frontWall, leftWall, rightWall);

  // Library Bookshelves along Back & Left Walls + InstancedMesh Leather Books
  const shelfFrameGeo = trackGeo(new THREE.BoxGeometry(9.0, 11.0, 0.9));
  const shelf1 = new THREE.Mesh(shelfFrameGeo, materials.mediumWoodPlinth);
  shelf1.position.set(-8, 0.5, -17.3);
  const shelf2 = new THREE.Mesh(shelfFrameGeo, materials.mediumWoodPlinth);
  shelf2.position.set(8, 0.5, -17.3);
  roomArchitectureGroup.add(shelf1, shelf2);

  // Instanced Books on the Library Shelves (120 books in a single draw call)
  const bookGeo = trackGeo(new THREE.BoxGeometry(0.24, 1.1, 0.65));
  const bookMat = new THREE.MeshStandardMaterial({
    roughness: 0.6,
    metalness: 0.1,
  });
  extraMaterials.push(bookMat);

  const bookCount = 96;
  const booksInstanced = new THREE.InstancedMesh(bookGeo, bookMat, bookCount);
  const dummy = new THREE.Object3D();
  const palette = [
    new THREE.Color('#6B1D1D'),
    new THREE.Color('#1E3A5F'),
    new THREE.Color('#1B4332'),
    new THREE.Color('#8A6236'),
    new THREE.Color('#4A2C40'),
    new THREE.Color('#C7A66A'),
  ];

  let idx = 0;
  for (const shelfX of [-8, 8]) {
    for (let row = 0; row < 4; row++) {
      const yPos = -3.2 + row * 2.2;
      for (let b = 0; b < 12; b++) {
        if (idx >= bookCount) break;
        const xOffset = shelfX - 3.6 + b * 0.62;
        dummy.position.set(xOffset, yPos, -16.95);
        dummy.scale.set(1, 0.85 + ((idx * 17) % 30) / 100, 1);
        dummy.rotation.set(0, 0, ((idx % 5) - 2) * 0.02);
        dummy.updateMatrix();
        booksInstanced.setMatrixAt(idx, dummy.matrix);
        booksInstanced.setColorAt(idx, palette[idx % palette.length]);
        idx++;
      }
    }
  }
  booksInstanced.instanceMatrix.needsUpdate = true;
  if (booksInstanced.instanceColor) booksInstanced.instanceColor.needsUpdate = true;
  booksInstanced.computeBoundingSphere();
  roomArchitectureGroup.add(booksInstanced);

  // Tall Cathedral Window on Right Wall (X = +17.5) + Volumetric Sunbeams
  const windowFrameGeo = trackGeo(new THREE.BoxGeometry(0.3, 12.5, 6.5));
  const windowGlowMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#FFF1D0'),
  });
  extraMaterials.push(windowGlowMat);

  const windowPane = new THREE.Mesh(windowFrameGeo, windowGlowMat);
  windowPane.position.set(17.5, 4.8, 0);
  roomArchitectureGroup.add(windowPane);

  // Sunbeam shafts slanting from the right window onto the arena
  const sunbeamsGroup = new THREE.Group();
  const beamGeo = trackGeo(new THREE.PlaneGeometry(18, 4.2));
  for (let i = -1; i <= 1; i++) {
    const beam = new THREE.Mesh(beamGeo, materials.windowSunbeam);
    beam.position.set(7.5, 3.6, i * 2.4);
    beam.rotation.z = -0.42;
    beam.rotation.y = 0.08 * i;
    sunbeamsGroup.add(beam);
  }
  roomArchitectureGroup.add(sunbeamsGroup);

  // Grand Brass & Crystal Chandelier above the Chessboard (Y = 9.5)
  const chandelierGroup = new THREE.Group();
  chandelierGroup.position.set(0, 9.8, 0);

  const chainGeo = trackGeo(new THREE.CylinderGeometry(0.06, 0.06, 4.5, 8));
  chainGeo.translate(0, 2.25, 0);
  const chainMesh = new THREE.Mesh(chainGeo, materials.brassInlay);
  chandelierGroup.add(chainMesh);

  const chandelierRingGeo = trackGeo(new THREE.TorusGeometry(2.4, 0.09, 12, 36));
  chandelierRingGeo.rotateX(Math.PI / 2);
  const chandelierRing = new THREE.Mesh(chandelierRingGeo, materials.brassInlay);
  chandelierGroup.add(chandelierRing);

  const candleGeo = trackGeo(new THREE.SphereGeometry(0.16, 12, 12));
  for (let c = 0; c < 8; c++) {
    const angle = (c / 8) * Math.PI * 2;
    const bulb = new THREE.Mesh(candleGeo, materials.chandelierCrystal);
    bulb.position.set(Math.cos(angle) * 2.4, 0.22, Math.sin(angle) * 2.4);
    chandelierGroup.add(bulb);
  }
  roomArchitectureGroup.add(chandelierGroup);

  // =========================================================================
  // 3. FLOATING ATMOSPHERIC DUST MOTES (High / Ultra Quality)
  // =========================================================================
  const dustCount = 140;
  const dustGeo = trackGeo(new THREE.BufferGeometry());
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 14;
    dustPositions[i * 3 + 1] = Math.random() * 7.5 - 0.2;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 14;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

  const dustMat = new THREE.PointsMaterial({
    color: new THREE.Color('#FFE6B3'),
    size: 0.065,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  extraMaterials.push(dustMat);

  const dustPoints = new THREE.Points(dustGeo, dustMat);
  group.add(dustPoints);

  function setQualityVisibility(quality: GraphicsQualityPreset, showRoom: boolean) {
    roomArchitectureGroup.visible = showRoom;
    sunbeamsGroup.visible = showRoom && (quality === 'high' || quality === 'ultra');
    dustPoints.visible = showRoom && (quality === 'high' || quality === 'ultra');
    chandelierGroup.visible = showRoom && quality !== 'low';
  }

  function update(elapsedTime: number, quality: GraphicsQualityPreset) {
    if (!dustPoints.visible || (quality !== 'high' && quality !== 'ultra')) return;
    dustPoints.rotation.y = elapsedTime * 0.025;
    dustPoints.position.y = Math.sin(elapsedTime * 0.4) * 0.12;
  }

  return {
    group,
    update,
    setQualityVisibility,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      extraMaterials.forEach((m) => m.dispose());
    },
  };
}
