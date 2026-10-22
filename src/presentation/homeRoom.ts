import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { createPerchSurface } from "./perchSurfaces.ts";
import { HOME_ROOM as R, HOME_PLACES } from "./homePlaces.ts";

/**
 * A six-mat washitsu built from boxes and small CPU-authored maps: tatami with
 * cloth borders, a raised tokonoma with its post and lintel, staggered
 * chigaidana shelves under a little cupboard, a shoji-lit window desk, fusuma
 * on the right wall, a low table and two cushions. No image files, no network.
 *
 * Everything here is static scenery. It owns its materials and maps, and is
 * merged by material before display so the whole room costs a handful of draws.
 */

// Same frozen value noise as the perch surfaces, local to the tatami weave.
function lattice(ix: number, iy: number, period: number, seed: number) {
  ix = ((ix % period) + period) % period; iy = ((iy % period) + period) % period;
  let n = Math.imul(ix + seed, 374761393) ^ Math.imul(iy + 17, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function noise(x: number, y: number, period: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = lattice(ix, iy, period, seed) * (1 - sx) + lattice(ix + 1, iy, period, seed) * sx;
  const b = lattice(ix, iy + 1, period, seed) * (1 - sx) + lattice(ix + 1, iy + 1, period, seed) * sx;
  return a * (1 - sy) + b * sy;
}

/** Igusa weave: fine rush lines along the mat's length, warp stitches across. */
export function createTatamiMaterial(alongZ: boolean): THREE.MeshStandardMaterial {
  const width = 128, height = 256;
  const rgb = new Uint8Array(width * height * 4), relief = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    const rush = Math.sin(v * Math.PI * 2 * 96) * .5 + .5;
    const stitch = Math.pow(Math.max(0, Math.sin(u * Math.PI * 2 * 7)), 24);
    const cloud = noise(u * 4, v * 4, 4, 23) - .5, fine = noise(u * 48, v * 96, 48, 7) - .5;
    const tone = rush * 9 + cloud * 12 + fine * 6 - stitch * 10;
    const index = y * width + x;
    const base = [196, 186, 134];
    for (let c = 0; c < 3; c++) rgb[index * 4 + c] = Math.max(0, Math.min(255, Math.round(base[c]! + tone * (c === 2 ? .7 : 1))));
    rgb[index * 4 + 3] = 255;
    relief[index] = Math.round(128 + rush * 40 - stitch * 30 + fine * 10);
  }
  const map = new THREE.DataTexture(rgb, width, height, THREE.RGBAFormat);
  const bumpMap = new THREE.DataTexture(relief, width, height, THREE.RedFormat);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [map, bumpMap]) {
    texture.name = `home-tatami-${texture === map ? "color" : "relief"}`;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true; texture.anisotropy = 4;
    // Box top faces map u along x and v along z; one tile per mat, rush along its length.
    texture.center.set(.5, .5);
    texture.rotation = alongZ ? 0 : Math.PI / 2;
    texture.needsUpdate = true;
  }
  const material = new THREE.MeshStandardMaterial({ map, bumpMap, bumpScale: .01, roughness: .9, metalness: 0 });
  material.name = alongZ ? "home-tatami-z" : "home-tatami-x";
  return material;
}

export interface HomeRoomParts {
  group: THREE.Group;
  /** Paper mount and photo plane of the hanging scroll. */
  scroll: { group: THREE.Group; photo: THREE.Mesh; mountWidth: number; maxPhoto: { width: number; height: number } };
  dispose(): void;
}

export function buildHomeRoom(): HomeRoomParts {
  const group = new THREE.Group(); group.name = "home-room";
  const hinoki = createPerchSurface("wood", [190, 152, 108]); hinoki.name = "home-hinoki";
  const darkWood = createPerchSurface("wood", [86, 62, 44]); darkWood.name = "home-dark-wood";
  const post = createPerchSurface("wood", [150, 116, 80]); post.name = "home-post";
  const plaster = createPerchSurface("plaster", [206, 184, 146]); plaster.name = "home-juraku";
  const alcovePlaster = createPerchSurface("plaster", [196, 176, 140]); alcovePlaster.name = "home-alcove-plaster";
  const tatamiX = createTatamiMaterial(false), tatamiZ = createTatamiMaterial(true);
  const heri = new THREE.MeshStandardMaterial({ color: 0x34433b, roughness: .78, name: "home-heri" });
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x1c1714, roughness: .28, metalness: .05, name: "home-lacquer" });
  const washi = new THREE.MeshStandardMaterial({ color: 0xf6f0e0, emissive: 0xfff2d8, emissiveIntensity: .62, roughness: .95, name: "home-washi" });
  const fusumaPaper = new THREE.MeshStandardMaterial({ color: 0xe7dcc2, roughness: .92, name: "home-fusuma" });
  const fusumaFrame = new THREE.MeshStandardMaterial({ color: 0x2b2420, roughness: .4, name: "home-fusuma-frame" });
  const pull = new THREE.MeshStandardMaterial({ color: 0x5b4a33, roughness: .45, metalness: .35, name: "home-pull" });
  const cushionIndigo = new THREE.MeshStandardMaterial({ color: 0x34405a, roughness: .95, name: "home-zabuton" });
  const cushionOchre = new THREE.MeshStandardMaterial({ color: 0x9a7a45, roughness: .95, name: "home-zabuton-ochre" });
  const mountFabric = new THREE.MeshStandardMaterial({ color: 0x7c7462, roughness: .9, name: "home-scroll-fabric" });
  const mountInner = new THREE.MeshStandardMaterial({ color: 0xb69a62, roughness: .7, metalness: .1, name: "home-scroll-ichimonji" });
  const rollerEnd = new THREE.MeshStandardMaterial({ color: 0x2a211b, roughness: .35, name: "home-scroll-roller" });

  const box = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, parent: THREE.Object3D = group) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); return mesh;
  };
  /** Axis-aligned box from min/max corners. */
  const span = (name: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, material: THREE.Material, parent?: THREE.Object3D) =>
    box(name, x1 - x0, y1 - y0, z1 - z0, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, material, parent);

  const W = .9; // post section
  // ---- Floor: six mats, laid so no four corners meet.
  const mat = (x0: number, x1: number, z0: number, z1: number) => {
    const alongZ = z1 - z0 > x1 - x0;
    span("home-tatami", x0 + .03, x1 - .03, -.32, 0, z0 + .03, z1 - .03, alongZ ? tatamiZ : tatamiX).castShadow = false;
    // Cloth borders run along the long edges.
    if (alongZ) for (const x of [x0 + .33, x1 - .33]) span("home-heri", x - .3, x + .3, -.31, .012, z0 + .03, z1 - .03, heri).castShadow = false;
    else for (const z of [z0 + .33, z1 - .33]) span("home-heri", x0 + .03, x1 - .03, -.31, .012, z - .3, z + .3, heri).castShadow = false;
  };
  mat(-22, 0, -12, -1); mat(0, 22, -12, -1);
  mat(-22, -11, -1, 21); mat(-11, 11, -1, 10); mat(-11, 11, 10, 21); mat(11, 22, -1, 21);
  // Polished engawa boards at the open front.
  for (let i = 0; i < 6; i++) span("home-engawa", -26, 26, -.5, -.12, R.front + .1 + i * 1.02, R.front + 1.08 + i * 1.02, hinoki).castShadow = false;

  // ---- Back wall above the alcoves, lintel and nageshi rail.
  span("home-back-upper", R.left, R.right, R.lintel + .5, R.ceiling, R.back - .3, R.back, plaster);
  span("home-otoshigake", R.left, R.right, R.lintel - .1, R.lintel + .5, R.back - .25, R.back + .15, hinoki);
  span("home-nageshi-left", R.left, R.left + .3, R.lintel + 1.4, R.lintel + 2, R.back, R.front, hinoki);
  span("home-nageshi-right", R.right - .3, R.right, R.lintel + 1.4, R.lintel + 2, R.back, R.front, hinoki);
  span("home-nageshi-back", R.left, R.right, R.lintel + 1.4, R.lintel + 2, R.back, R.back + .3, hinoki);
  // Tokobashira: the alcove post, darker and a little heavier than the rest.
  span("home-tokobashira", R.post - W * .6, R.post + W * .6, 0, R.ceiling, R.back - W * .6, R.back + W * .6, post);
  for (const x of [R.left + W / 2, R.right - W / 2]) for (const z of [R.back + W / 2, R.front - W / 2])
    span("home-hashira", x - W / 2, x + W / 2, 0, R.ceiling, z - W / 2, z + W / 2, hinoki);
  // Ceiling boards and battens.
  span("home-ceiling", R.left, R.right, R.ceiling, R.ceiling + .3, R.back, R.front, hinoki).castShadow = false;
  for (let z = R.back + 2.4; z < R.front; z += 2.4) span("home-saobuchi", R.left, R.right, R.ceiling - .35, R.ceiling, z - .18, z + .18, hinoki).castShadow = false;
  // Eaves over the engawa, so a camera standing outside still sees a roof line.
  span("home-kamoi-front", R.left, R.right, R.lintel + 3.2, R.ceiling, R.front - .4, R.front, hinoki);
  span("home-noki", R.left - 4, R.right + 4, R.ceiling + .3, R.ceiling + .7, R.front, R.front + 9, darkWood).castShadow = false;
  for (let x = R.left - 3; x <= R.right + 3; x += 3.2) span("home-taruki", x - .22, x + .22, R.ceiling - .1, R.ceiling + .3, R.front, R.front + 9, darkWood).castShadow = false;

  // ---- Tokonoma: raised board floor behind a lacquered rail.
  const alcoveDepth = R.back - R.alcoveBack;
  span("home-tokonoma-back", R.left, R.post, 0, R.ceiling, R.alcoveBack - .3, R.alcoveBack, alcovePlaster);
  span("home-tokonoma-side", R.left - .3, R.left, 0, R.ceiling, R.alcoveBack, R.back, alcovePlaster);
  span("home-tokonoma-ceiling", R.left, R.post, R.alcoveCeiling, R.alcoveCeiling + .3, R.alcoveBack, R.back, hinoki).castShadow = false;
  span("home-tokogamachi", R.left, R.post - W * .6, 0, R.alcoveFloor, R.back - .45, R.back, lacquer);
  span("home-tokoita", R.left, R.post - W * .6, R.alcoveFloor - .2, R.alcoveFloor, R.alcoveBack, R.back - .45, hinoki);
  // Partition between tokonoma and shelf alcove.
  span("home-partition", R.post - .15, R.post + .15, 0, R.ceiling, R.alcoveBack, R.back - W * .6, alcovePlaster);

  // ---- Tokowaki: staggered shelves (chigaidana) under a small cupboard.
  const sx0 = R.post + .45, sx1 = R.right;
  span("home-tokowaki-back", sx0, sx1, 0, R.ceiling, R.alcoveBack - .3, R.alcoveBack, alcovePlaster);
  span("home-tokowaki-side", sx1, sx1 + .3, 0, R.ceiling, R.alcoveBack, R.back, alcovePlaster);
  span("home-tokowaki-ceiling", sx0, sx1, R.alcoveCeiling, R.alcoveCeiling + .3, R.alcoveBack, R.back, hinoki).castShadow = false;
  span("home-jiita", sx0, sx1, 0, .55, R.alcoveBack, R.back - .3, darkWood);
  const shelfLow = HOME_PLACES.find(place => place.id === "shelf-low")!, shelfHigh = HOME_PLACES.find(place => place.id === "shelf-high")!;
  span("home-chigaidana-low", sx0, shelfLow.x + 5.4, R.shelfLowTop - .38, R.shelfLowTop, R.alcoveBack, R.back - .5, darkWood);
  span("home-chigaidana-high", shelfHigh.x - 5.4, sx1, R.shelfHighTop - .38, R.shelfHighTop, R.alcoveBack, R.back - .5, darkWood);
  span("home-ebizuka", shelfLow.x + 4.9, shelfLow.x + 5.2, R.shelfLowTop, R.shelfHighTop - .38, R.back - 2.6, R.back - 2.3, darkWood);
  // Fukurodana: a shallow cupboard with two small paper doors.
  span("home-fukurodana-floor", sx0, sx1, R.cupboardBottom - .35, R.cupboardBottom, R.alcoveBack, R.back - .4, darkWood);
  const doorTop = R.lintel - .2, doorWidth = (sx1 - sx0) / 2;
  for (let i = 0; i < 2; i++) {
    const x0 = sx0 + i * doorWidth;
    span("home-fukurodana-frame", x0 + .05, x0 + doorWidth - .05, R.cupboardBottom, doorTop, R.back - 1.1, R.back - .95, fusumaFrame);
    span("home-fukurodana-paper", x0 + .3, x0 + doorWidth - .3, R.cupboardBottom + .25, doorTop - .25, R.back - .97, R.back - .9, fusumaPaper).castShadow = false;
  }
  span("home-fukurodana-back", sx0, sx1, R.cupboardBottom, R.alcoveCeiling, R.alcoveBack, R.back - 1.1, darkWood).castShadow = false;

  // ---- Left wall with the tsukeshoin (window desk) recess.
  const shoin = HOME_PLACES.find(place => place.id === "shoin")!;
  const z0 = shoin.z - 6.6, z1 = shoin.z + 6.6, deskBack = R.left - R.shoinDepth;
  span("home-left-wall-back", R.left - .3, R.left, 0, R.ceiling, R.back, z0, plaster);
  span("home-left-wall-front", R.left - .3, R.left, 0, R.ceiling, z1, R.front, plaster);
  span("home-left-wall-over", R.left - .3, R.left, R.shojiTop + 2, R.ceiling, z0, z1, plaster);
  span("home-shoin-apron", R.left - .3, R.left, 0, R.shoinTop - .4, z0, z1, plaster);
  span("home-shoin-desk", deskBack, R.left + .5, R.shoinTop - .45, R.shoinTop, z0, z1, hinoki);
  for (const z of [z0 - .3, z1]) span("home-shoin-side", deskBack, R.left, R.shoinTop - .45, R.shojiTop + 2, z, z + .3, alcovePlaster);
  span("home-shoin-head", deskBack, R.left, R.shojiTop, R.shojiTop + 2, z0, z1, hinoki);
  span("home-shoin-ceiling", deskBack, R.left, R.shojiTop + 2, R.shojiTop + 2.3, z0, z1, hinoki).castShadow = false;
  // Four shoji panels: backlit paper and a kumiko lattice.
  const shojiBottom = R.shoinTop + .1, panelWidth = (z1 - z0) / 4;
  for (let i = 0; i < 4; i++) {
    const pz0 = z0 + i * panelWidth, pz1 = pz0 + panelWidth;
    span("home-shoji-paper", deskBack + .1, deskBack + .2, shojiBottom, R.shojiTop, pz0 + .08, pz1 - .08, washi).castShadow = false;
    span("home-shoji-stile", deskBack + .2, deskBack + .45, shojiBottom, R.shojiTop, pz0, pz0 + .22, hinoki);
    for (let k = 1; k < 3; k++) span("home-kumiko", deskBack + .2, deskBack + .32, shojiBottom, R.shojiTop, pz0 + k * panelWidth / 3 - .05, pz0 + k * panelWidth / 3 + .05, hinoki).castShadow = false;
    for (let k = 1; k < 7; k++) {
      const y = shojiBottom + k * (R.shojiTop - shojiBottom) / 7;
      span("home-kumiko", deskBack + .2, deskBack + .32, y - .05, y + .05, pz0, pz1, hinoki).castShadow = false;
    }
  }
  span("home-shoji-rail", deskBack + .2, deskBack + .45, R.shojiTop - .25, R.shojiTop, z0, z1, hinoki);
  span("home-shoji-sill", deskBack + .2, deskBack + .45, shojiBottom, shojiBottom + .25, z0, z1, hinoki);

  // ---- Right wall: plaster with a pair of fusuma.
  span("home-right-wall", R.right, R.right + .3, 0, R.ceiling, R.back, R.front, plaster);
  const fz0 = 1.5, fz1 = 18.5, fusumaTop = R.lintel - .2, fw = (fz1 - fz0) / 2;
  span("home-kamoi", R.right - .35, R.right, fusumaTop, fusumaTop + .55, fz0 - .4, fz1 + .4, hinoki);
  for (let i = 0; i < 2; i++) {
    const pz0 = fz0 + i * fw;
    span("home-fusuma-frame", R.right - .3, R.right - .08, 0, fusumaTop, pz0, pz0 + fw, fusumaFrame);
    span("home-fusuma-paper", R.right - .34, R.right - .3, .35, fusumaTop - .35, pz0 + .35, pz0 + fw - .35, fusumaPaper).castShadow = false;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .06, 24), pull);
    handle.name = "home-hikite"; handle.rotation.z = Math.PI / 2;
    handle.position.set(R.right - .37, 9.5, i === 0 ? pz0 + fw - 1.4 : pz0 + 1.4); group.add(handle);
  }

  // ---- Low table and cushions.
  const top = new THREE.Mesh(new THREE.CylinderGeometry(R.tableRadius, R.tableRadius - .08, .5, 64), darkWood);
  top.name = "home-chabudai"; top.position.set(R.tableX, R.tableTop - .25, R.tableZ); top.castShadow = top.receiveShadow = true; group.add(top);
  for (const angle of [.785, 2.356, 3.927, 5.498]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.55, R.tableTop - .5, .55), darkWood);
    leg.name = "home-chabudai-leg"; leg.castShadow = true;
    leg.position.set(R.tableX + Math.cos(angle) * (R.tableRadius - 1.4), (R.tableTop - .5) / 2, R.tableZ + Math.sin(angle) * (R.tableRadius - 1.4));
    group.add(leg);
  }
  const cushion = (x: number, z: number, angle: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(6.4, .85, 6.9, 4, .38), material);
    mesh.name = "home-zabuton"; mesh.position.set(x, .42, z); mesh.rotation.y = angle; mesh.castShadow = mesh.receiveShadow = true; group.add(mesh);
  };
  cushion(R.tableX + 1, R.tableZ + 10, .06, cushionIndigo);
  cushion(R.tableX - 10.5, R.tableZ + 3.5, -.12, cushionOchre);

  // ---- Hanging scroll (kakejiku): mount, inner border, photograph, rod and roller.
  const scrollPlace = HOME_PLACES.find(place => place.id === "scroll")!;
  const scroll = new THREE.Group(); scroll.name = "home-scroll";
  scroll.position.set(scrollPlace.x, 0, scrollPlace.z);
  const mountWidth = 7.4, mountTop = R.alcoveCeiling - .6, mountBottom = 8.2;
  span("home-scroll-mount", -mountWidth / 2, mountWidth / 2, mountBottom, mountTop, 0, .06, mountFabric, scroll).castShadow = false;
  const maxPhoto = { width: 6, height: 9 };
  const photoCenter = scrollPlace.y;
  span("home-scroll-ichimonji", -maxPhoto.width / 2 - .25, maxPhoto.width / 2 + .25, photoCenter - maxPhoto.height / 2 - .25, photoCenter + maxPhoto.height / 2 + .25, .06, .075, mountInner, scroll).castShadow = false;
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xf2ecdf, toneMapped: false }));
  photo.name = "home-scroll-photo"; photo.position.set(0, photoCenter, .09);
  photo.scale.set(maxPhoto.width, maxPhoto.height, 1); scroll.add(photo);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, mountWidth + .2, 16), mountInner);
  rod.name = "home-scroll-hasso"; rod.rotation.z = Math.PI / 2; rod.position.set(0, mountTop, .12); scroll.add(rod);
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(.26, .26, mountWidth + .3, 20), mountFabric);
  roller.name = "home-scroll-jiku"; roller.rotation.z = Math.PI / 2; roller.position.set(0, mountBottom, .2); scroll.add(roller);
  for (const side of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .7, 20), rollerEnd);
    end.name = "home-scroll-jikugi"; end.rotation.z = Math.PI / 2; end.position.set(side * (mountWidth / 2 + .5), mountBottom, .2); scroll.add(end);
  }
  group.add(scroll);

  const keep = new Set<THREE.Material>([washi]);
  let disposed = false;
  return {
    group, scroll: { group: scroll, photo, mountWidth, maxPhoto },
    dispose() {
      if (disposed) return; disposed = true;
      const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(keep), textures = new Set<THREE.Texture>();
      group.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      });
      for (const material of materials) for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      textures.forEach(texture => texture.dispose()); materials.forEach(material => material.dispose()); geometries.forEach(geometry => geometry.dispose());
      group.clear();
    },
  };
}
