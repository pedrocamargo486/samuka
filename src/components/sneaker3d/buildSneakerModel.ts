import * as THREE from 'three';
import type { SneakerType } from '../../types';
import {
  createMeshWeaveTexture,
  createTonguePatchTexture,
  type SneakerPalette,
} from './sneakerPalette';

export interface SneakerModelParts {
  root: THREE.Group;
  layers: {
    outsole: THREE.Group;
    midsole: THREE.Group;
    upper: THREE.Group;
    overlays: THREE.Group;
    laces: THREE.Group;
  };
  materials: {
    upperMat: THREE.MeshStandardMaterial;
    overlayMat: THREE.MeshStandardMaterial;
    accentMat: THREE.MeshPhysicalMaterial;
    midsoleMat: THREE.MeshStandardMaterial;
    outsoleMat: THREE.MeshStandardMaterial;
    laceMat: THREE.MeshStandardMaterial;
    airPodMat: THREE.MeshPhysicalMaterial;
    tonguePatchMat: THREE.MeshStandardMaterial;
  };
  updatePalette: (palette: SneakerPalette, brandName: string, maxAnisotropy: number) => void;
  dispose: () => void;
}

/**
 * Sculpts extruded side-profile geometry into an anatomical athletic shoe last
 * (tapered toe, arch waist cinch, heel cup, and upper ankle inward taper).
 */
function sculptShoeLast(
  geometry: THREE.BufferGeometry,
  minX: number,
  maxX: number,
  topTaperStartY: number,
  topTaperStrength: number
) {
  const pos = geometry.attributes.position;
  const spanX = Math.max(0.001, maxX - minX);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    const u = THREE.MathUtils.clamp((x - minX) / spanX, 0, 1);

    // Foot width curve: heel -> arch waist -> ball -> rounded toe tip
    let widthFactor = 1.0;
    if (u < 0.14) {
      // Rounded heel cup
      const t = u / 0.14;
      widthFactor = 0.56 + 0.28 * Math.sin(t * (Math.PI / 2));
    } else if (u < 0.44) {
      // Midfoot arch cinch
      const t = (u - 0.14) / 0.3;
      widthFactor = 0.84 - 0.1 * Math.sin(t * Math.PI);
    } else if (u < 0.76) {
      // Wide forefoot / metatarsal flare
      const t = (u - 0.44) / 0.32;
      widthFactor = 0.84 + 0.18 * Math.sin(t * (Math.PI / 2));
    } else {
      // Tapered toe box
      const t = (u - 0.76) / 0.24;
      widthFactor = 1.02 * Math.sqrt(Math.max(0.03, 1 - t * t * 0.94));
    }

    // Subtle lateral/medial anatomical asymmetry (slight curve)
    const medialOffset = Math.sin(u * Math.PI) * 0.035;

    // Upper ankle/instep inward taper
    let verticalTaper = 1.0;
    if (y > topTaperStartY) {
      const yProgress = THREE.MathUtils.clamp((y - topTaperStartY) / 0.75, 0, 1);
      verticalTaper = 1.0 - yProgress * topTaperStrength;
    }

    const sculptedZ = z * widthFactor * verticalTaper + medialOffset;
    pos.setZ(i, sculptedZ);
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
  if (geometry.attributes.uv && geometry.index) {
    geometry.computeTangents();
  }
}

export function buildProceduralSneakerGroup(params: {
  palette: SneakerPalette;
  sneakerType: SneakerType;
  brandName: string;
  isSoftwareGl: boolean;
  maxAnisotropy: number;
}): SneakerModelParts {
  const { palette, sneakerType, brandName, isSoftwareGl, maxAnisotropy } = params;
  const isRunner = sneakerType === 'corrida' || sneakerType === 'academia';
  const heelLift = isRunner ? 0.24 : 0.14;
  const collarHeight = sneakerType === 'casual' ? 0.78 : 0.86;

  const root = new THREE.Group();
  const outsoleGroup = new THREE.Group();
  const midsoleGroup = new THREE.Group();
  const upperGroup = new THREE.Group();
  const overlaysGroup = new THREE.Group();
  const lacesGroup = new THREE.Group();

  root.add(outsoleGroup, midsoleGroup, upperGroup, overlaysGroup, lacesGroup);

  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const texturesToDispose: THREE.Texture[] = [];

  // Procedural PBR Materials (roughness contrast >= 0.25 between matte textile, foam, and gloss accent)
  let meshTexture = createMeshWeaveTexture(palette.upper, maxAnisotropy);
  texturesToDispose.push(meshTexture);

  let tongueTexture = createTonguePatchTexture(brandName, palette.accent, maxAnisotropy);
  texturesToDispose.push(tongueTexture);

  const upperMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ffffff'),
    map: meshTexture,
    roughness: isRunner ? 0.78 : 0.45,
    metalness: 0.04,
  });

  const overlayMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.overlay),
    roughness: 0.42,
    metalness: 0.08,
  });

  const accentMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette.accent),
    roughness: 0.22,
    metalness: 0.16,
    clearcoat: 0.9,
    clearcoatRoughness: 0.15,
  });

  const midsoleMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.midsole),
    roughness: 0.66,
    metalness: 0.02,
  });

  const outsoleMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.outsole),
    roughness: 0.88,
    metalness: 0.04,
  });

  const laceMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(palette.laces),
    roughness: 0.82,
    metalness: 0.02,
  });

  const eyeletMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#D4D4D8'),
    roughness: 0.2,
    metalness: 0.9,
  });

  const airPodMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(palette.airPod),
    roughness: 0.12,
    metalness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.76,
    transparent: true,
    opacity: isSoftwareGl ? 0.5 : 1,
    ior: 1.52,
    thickness: 0.4,
    clearcoat: 1.0,
  });

  const tonguePatchMat = new THREE.MeshStandardMaterial({
    map: tongueTexture,
    roughness: 0.55,
    metalness: 0.05,
  });

  // 1. OUTSOLE (Rubber traction sole sitting flush at y = 0)
  const outsoleShape = new THREE.Shape();
  outsoleShape.moveTo(-1.32, 0.02);
  outsoleShape.lineTo(0.85, 0.01);
  outsoleShape.quadraticCurveTo(1.22, 0.02, 1.38, 0.08);
  outsoleShape.lineTo(1.36, 0.12);
  outsoleShape.quadraticCurveTo(1.02, 0.08, 0.45, 0.07);
  outsoleShape.lineTo(-1.28, 0.09);
  outsoleShape.quadraticCurveTo(-1.36, 0.06, -1.32, 0.02);

  const outsoleGeo = new THREE.ExtrudeGeometry(outsoleShape, {
    depth: 0.86,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 3,
    curveSegments: 18,
  });
  outsoleGeo.translate(0, 0, -0.43);
  sculptShoeLast(outsoleGeo, -1.36, 1.4, 0.2, 0.05);
  geometriesToDispose.push(outsoleGeo);

  const outsoleMesh = new THREE.Mesh(outsoleGeo, outsoleMat);
  outsoleMesh.castShadow = true;
  outsoleMesh.receiveShadow = true;
  outsoleGroup.add(outsoleMesh);

  // Traction lugs via InstancedMesh (>20 repeating tread ribs)
  const lugGeo = new THREE.BoxGeometry(0.048, 0.025, 0.48);
  geometriesToDispose.push(lugGeo);
  const lugCount = 24;
  const lugsMesh = new THREE.InstancedMesh(lugGeo, outsoleMat, lugCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < lugCount; i++) {
    const t = i / (lugCount - 1);
    const x = -1.2 + t * 2.35;
    const zScale = t > 0.78 ? 0.55 : t > 0.2 && t < 0.4 ? 0.72 : 0.92;
    dummy.position.set(x, 0.012, 0.02);
    dummy.scale.set(1, 1, zScale);
    dummy.updateMatrix();
    lugsMesh.setMatrixAt(i, dummy.matrix);
  }
  lugsMesh.instanceMatrix.needsUpdate = true;
  lugsMesh.computeBoundingSphere();
  outsoleGroup.add(lugsMesh);

  // 2. MIDSOLE (Sculpted EVA / Cushioned Wedge + Optional Air/Shox Heel Pillars)
  const midsoleShape = new THREE.Shape();
  midsoleShape.moveTo(-1.33, 0.075);
  midsoleShape.lineTo(0.85, 0.065);
  midsoleShape.quadraticCurveTo(1.25, 0.08, 1.38, 0.16);
  midsoleShape.quadraticCurveTo(1.32, 0.25, 0.82, 0.24);
  midsoleShape.quadraticCurveTo(0.1, 0.24, -0.55, 0.26 + heelLift * 0.4);
  midsoleShape.lineTo(-1.35, 0.28 + heelLift);
  midsoleShape.quadraticCurveTo(-1.41, 0.18, -1.33, 0.075);

  const midsoleGeo = new THREE.ExtrudeGeometry(midsoleShape, {
    depth: 0.84,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.025,
    bevelSegments: 4,
    curveSegments: 20,
  });
  midsoleGeo.translate(0, 0, -0.42);
  sculptShoeLast(midsoleGeo, -1.42, 1.4, 0.25, 0.08);
  geometriesToDispose.push(midsoleGeo);

  const midsoleMesh = new THREE.Mesh(midsoleGeo, midsoleMat);
  midsoleMesh.castShadow = true;
  midsoleMesh.receiveShadow = true;
  midsoleGroup.add(midsoleMesh);

  // Athletic heel cushioning columns / translucent air capsule
  if (isRunner) {
    const podCount = 4;
    for (let i = 0; i < podCount; i++) {
      const side = i < 2 ? 1 : -1;
      const offsetX = i % 2 === 0 ? -0.92 : -1.16;
      const podGeo = new THREE.CylinderGeometry(0.065, 0.072, 0.16, 18);
      geometriesToDispose.push(podGeo);
      const pod = new THREE.Mesh(podGeo, airPodMat);
      pod.position.set(offsetX, 0.19, side * 0.24);
      midsoleGroup.add(pod);
    }
  }

  // 3. MAIN UPPER SHELL (Contoured vamp + quarter)
  const upperShape = new THREE.Shape();
  upperShape.moveTo(-1.28, 0.24 + heelLift * 0.72);
  upperShape.lineTo(1.26, 0.16);
  upperShape.quadraticCurveTo(1.36, 0.24, 1.24, 0.35); // rounded toe dome
  upperShape.quadraticCurveTo(0.85, 0.45, 0.42, 0.58); // vamp instep slope
  upperShape.lineTo(-0.08, 0.84); // top eyestay / tongue throat
  upperShape.quadraticCurveTo(-0.24, 0.72, -0.52, 0.68); // ankle collar scoop
  upperShape.quadraticCurveTo(-0.92, 0.68, -1.14, collarHeight); // achilles notch
  upperShape.quadraticCurveTo(-1.32, 0.65, -1.28, 0.24 + heelLift * 0.72);

  const upperGeo = new THREE.ExtrudeGeometry(upperShape, {
    depth: 0.74,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.03,
    bevelSegments: 4,
    curveSegments: 24,
  });
  upperGeo.translate(0, 0, -0.37);
  sculptShoeLast(upperGeo, -1.35, 1.38, 0.32, 0.36);
  geometriesToDispose.push(upperGeo);

  const upperMesh = new THREE.Mesh(upperGeo, upperMat);
  upperMesh.castShadow = true;
  upperMesh.receiveShadow = true;
  upperGroup.add(upperMesh);

  // Inner dark sockliner cavity at ankle opening
  const cavityGeo = new THREE.CylinderGeometry(0.24, 0.2, 0.32, 24);
  geometriesToDispose.push(cavityGeo);
  const cavityMat = new THREE.MeshStandardMaterial({
    color: '#121215',
    roughness: 0.92,
    metalness: 0.0,
  });
  const cavityMesh = new THREE.Mesh(cavityGeo, cavityMat);
  cavityMesh.scale.set(1.55, 1, 0.92);
  cavityMesh.position.set(-0.62, 0.62, 0.02);
  cavityMesh.rotation.z = -0.14;
  upperGroup.add(cavityMesh);

  // 4. PADDED ANKLE COLLAR & TONGUE + BRANDED WOVEN PATCH
  const collarCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.22, 0.72, 0.22),
    new THREE.Vector3(-0.56, 0.68, 0.26),
    new THREE.Vector3(-1.05, collarHeight - 0.04, 0.14),
    new THREE.Vector3(-1.12, collarHeight - 0.02, 0.02),
    new THREE.Vector3(-1.05, collarHeight - 0.04, -0.12),
    new THREE.Vector3(-0.56, 0.68, -0.22),
    new THREE.Vector3(-0.22, 0.72, -0.18),
  ]);
  const collarGeo = new THREE.TubeGeometry(collarCurve, 44, 0.068, 12, false);
  geometriesToDispose.push(collarGeo);
  const collarMesh = new THREE.Mesh(collarGeo, overlayMat);
  collarMesh.castShadow = true;
  upperGroup.add(collarMesh);

  // Sculpted Tongue
  const tongueGeo = new THREE.BoxGeometry(0.56, 0.09, 0.34, 8, 2, 8);
  tongueGeo.rotateZ(0.68);
  geometriesToDispose.push(tongueGeo);
  const tongueMesh = new THREE.Mesh(tongueGeo, upperMat);
  tongueMesh.position.set(-0.08, 0.78, 0.02);
  tongueMesh.castShadow = true;
  upperGroup.add(tongueMesh);

  // Woven Tongue Brand Patch (Procedural CanvasTexture)
  const patchGeo = new THREE.BoxGeometry(0.18, 0.02, 0.22);
  geometriesToDispose.push(patchGeo);
  const patchMesh = new THREE.Mesh(patchGeo, tonguePatchMat);
  patchMesh.position.set(-0.19, 0.92, 0.02);
  patchMesh.rotation.z = 0.68;
  overlaysGroup.add(patchMesh);

  // 5. TOE CAP / MUDGUARD OVERLAY
  const toeShape = new THREE.Shape();
  toeShape.moveTo(0.68, 0.18);
  toeShape.lineTo(1.29, 0.16);
  toeShape.quadraticCurveTo(1.38, 0.24, 1.24, 0.34);
  toeShape.quadraticCurveTo(0.98, 0.38, 0.72, 0.31);
  toeShape.closePath();

  const toeGeo = new THREE.ExtrudeGeometry(toeShape, {
    depth: 0.78,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 3,
    curveSegments: 16,
  });
  toeGeo.translate(0, 0, -0.39);
  sculptShoeLast(toeGeo, -1.35, 1.4, 0.28, 0.25);
  geometriesToDispose.push(toeGeo);
  const toeMesh = new THREE.Mesh(toeGeo, overlayMat);
  toeMesh.castShadow = true;
  overlaysGroup.add(toeMesh);

  // 6. HEEL STABILIZER CUP & PULL TAB
  const heelShape = new THREE.Shape();
  heelShape.moveTo(-1.3, 0.24 + heelLift * 0.7);
  heelShape.lineTo(-0.84, 0.24 + heelLift * 0.55);
  heelShape.quadraticCurveTo(-0.88, 0.54, -1.08, 0.66);
  heelShape.lineTo(-1.26, 0.62);
  heelShape.quadraticCurveTo(-1.35, 0.45, -1.3, 0.24 + heelLift * 0.7);

  const heelGeo = new THREE.ExtrudeGeometry(heelShape, {
    depth: 0.77,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.02,
    bevelSegments: 3,
    curveSegments: 16,
  });
  heelGeo.translate(0, 0, -0.385);
  sculptShoeLast(heelGeo, -1.35, 1.38, 0.3, 0.32);
  geometriesToDispose.push(heelGeo);
  const heelMesh = new THREE.Mesh(heelGeo, overlayMat);
  heelMesh.castShadow = true;
  overlaysGroup.add(heelMesh);

  // Heel pull loop
  const pullCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.14, collarHeight - 0.04, 0.02),
    new THREE.Vector3(-1.27, collarHeight + 0.08, 0.02),
    new THREE.Vector3(-1.22, collarHeight - 0.08, 0.02),
  ]);
  const pullGeo = new THREE.TubeGeometry(pullCurve, 16, 0.022, 8, false);
  geometriesToDispose.push(pullGeo);
  const pullMesh = new THREE.Mesh(pullGeo, accentMat);
  overlaysGroup.add(pullMesh);

  // 7. SIGNATURE SIDE SPEED WING / QUARTER OVERLAY (Both Lateral & Medial)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(-0.82, 0.45);
  wingShape.quadraticCurveTo(-0.22, 0.36, 0.46, 0.42);
  wingShape.quadraticCurveTo(0.18, 0.52, -0.34, 0.56);
  wingShape.quadraticCurveTo(-0.68, 0.58, -0.82, 0.45);

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.045,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.01,
    bevelSegments: 2,
    curveSegments: 16,
  });
  geometriesToDispose.push(wingGeo);

  const lateralWing = new THREE.Mesh(wingGeo, accentMat);
  lateralWing.position.set(0, 0, 0.34);
  lateralWing.rotation.y = -0.05;
  lateralWing.castShadow = true;

  const medialWing = new THREE.Mesh(wingGeo, accentMat);
  medialWing.position.set(0, 0, -0.34);
  medialWing.rotation.y = 0.05;
  medialWing.castShadow = true;

  overlaysGroup.add(lateralWing, medialWing);

  // 8. METALLIC EYELETS (InstancedMesh) & CROSSED 3D SHOELACES (TubeGeometry)
  const eyeletPairs = 5;
  const eyeletGeo = new THREE.TorusGeometry(0.024, 0.008, 8, 16);
  geometriesToDispose.push(eyeletGeo);
  const eyeletsInstanced = new THREE.InstancedMesh(eyeletGeo, eyeletMat, eyeletPairs * 2);

  const lacePointsLeft: THREE.Vector3[] = [];
  const lacePointsRight: THREE.Vector3[] = [];

  for (let i = 0; i < eyeletPairs; i++) {
    const t = i / (eyeletPairs - 1);
    const x = 0.42 - t * 0.52;
    const y = 0.58 + t * 0.26;
    const spreadZ = 0.21 - t * 0.03;

    const leftPos = new THREE.Vector3(x, y, spreadZ + 0.02);
    const rightPos = new THREE.Vector3(x, y, -spreadZ + 0.02);
    lacePointsLeft.push(leftPos);
    lacePointsRight.push(rightPos);

    dummy.position.copy(leftPos);
    dummy.rotation.set(Math.PI / 2 - 0.45, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    eyeletsInstanced.setMatrixAt(i * 2, dummy.matrix);

    dummy.position.copy(rightPos);
    dummy.rotation.set(-Math.PI / 2 + 0.45, 0, 0);
    dummy.updateMatrix();
    eyeletsInstanced.setMatrixAt(i * 2 + 1, dummy.matrix);
  }
  eyeletsInstanced.instanceMatrix.needsUpdate = true;
  eyeletsInstanced.computeBoundingSphere();
  lacesGroup.add(eyeletsInstanced);

  // Build crisscrossed lace segments
  for (let i = 0; i < eyeletPairs - 1; i++) {
    const p1 = lacePointsLeft[i];
    const p2 = lacePointsRight[i + 1];
    const mid1 = new THREE.Vector3().lerpVectors(p1, p2, 0.5);
    mid1.y += 0.032;
    const c1 = new THREE.CatmullRomCurve3([p1, mid1, p2]);
    const g1 = new THREE.TubeGeometry(c1, 14, 0.014, 6, false);
    geometriesToDispose.push(g1);
    const m1 = new THREE.Mesh(g1, laceMat);
    m1.castShadow = true;
    lacesGroup.add(m1);

    const q1 = lacePointsRight[i];
    const q2 = lacePointsLeft[i + 1];
    const mid2 = new THREE.Vector3().lerpVectors(q1, q2, 0.5);
    mid2.y += 0.022;
    const c2 = new THREE.CatmullRomCurve3([q1, mid2, q2]);
    const g2 = new THREE.TubeGeometry(c2, 14, 0.014, 6, false);
    geometriesToDispose.push(g2);
    const m2 = new THREE.Mesh(g2, laceMat);
    m2.castShadow = true;
    lacesGroup.add(m2);
  }

  // Top bow loops
  const bowCurve = new THREE.CatmullRomCurve3([
    lacePointsLeft[eyeletPairs - 1],
    new THREE.Vector3(-0.18, 0.94, 0.18),
    new THREE.Vector3(-0.08, 0.89, 0.02),
    new THREE.Vector3(-0.18, 0.94, -0.14),
    lacePointsRight[eyeletPairs - 1],
  ]);
  const bowGeo = new THREE.TubeGeometry(bowCurve, 28, 0.015, 6, false);
  geometriesToDispose.push(bowGeo);
  lacesGroup.add(new THREE.Mesh(bowGeo, laceMat));

  return {
    root,
    layers: {
      outsole: outsoleGroup,
      midsole: midsoleGroup,
      upper: upperGroup,
      overlays: overlaysGroup,
      laces: lacesGroup,
    },
    materials: {
      upperMat,
      overlayMat,
      accentMat,
      midsoleMat,
      outsoleMat,
      laceMat,
      airPodMat,
      tonguePatchMat,
    },
    updatePalette: (nextPalette, nextBrandName, aniso) => {
      const nextMeshTex = createMeshWeaveTexture(nextPalette.upper, aniso);
      const nextPatchTex = createTonguePatchTexture(nextBrandName, nextPalette.accent, aniso);
      texturesToDispose.push(nextMeshTex, nextPatchTex);

      meshTexture.dispose();
      tongueTexture.dispose();
      meshTexture = nextMeshTex;
      tongueTexture = nextPatchTex;

      upperMat.map = meshTexture;
      upperMat.needsUpdate = true;

      tonguePatchMat.map = tongueTexture;
      tonguePatchMat.needsUpdate = true;

      overlayMat.color.set(nextPalette.overlay);
      accentMat.color.set(nextPalette.accent);
      midsoleMat.color.set(nextPalette.midsole);
      outsoleMat.color.set(nextPalette.outsole);
      laceMat.color.set(nextPalette.laces);
      airPodMat.color.set(nextPalette.airPod);
    },
    dispose: () => {
      geometriesToDispose.forEach((g) => g.dispose());
      texturesToDispose.forEach((t) => t.dispose());
      upperMat.dispose();
      overlayMat.dispose();
      accentMat.dispose();
      midsoleMat.dispose();
      outsoleMat.dispose();
      laceMat.dispose();
      eyeletMat.dispose();
      airPodMat.dispose();
      tonguePatchMat.dispose();
      cavityMat.dispose();
    },
  };
}
