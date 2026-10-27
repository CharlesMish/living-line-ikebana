import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { createWorkbenchFixture } from "../../src/app/workbench.ts";
import { createKeptGardenDisplay } from "../../src/presentation/GardenVisitStudio.ts";
import { arrangementExtent } from "../../src/presentation/homePlaces.ts";

const CUTTINGS = ["flowering-branch", "bare-branch", "leafy-shoot", "reed", "arching-trailer", "foliage-fan", "blossom-spray",
  "flower-volume", "nodding-flower", "berry-twig", "fern-frond", "lobed-leaf", "broad-blade", "violet-sprig", "indigo-spire",
  "starry-pincushion", "silver-seed", "compact-flower", "single-flower"];

// Seeds the reach table was not measured on.
for (const seed of [8279, 61, 90210]) test(`the reach estimate covers every rendered cutting (seed ${seed})`, () => {
  for (const id of CUTTINGS) {
    const arrangement = createWorkbenchFixture(id, seed, 1);
    const extent = arrangementExtent(arrangement);
    const display = createKeptGardenDisplay({ id: "e", title: "", thumbnail: null, arrangement });
    try {
      display.group.updateMatrixWorld(true);
      // The vessel, water and pins are loose meshes; the botanical material is the one group.
      const plants = display.group.children.find(child => child instanceof THREE.Group);
      assert.ok(plants, `${id} has its plants group`);
      const box = new THREE.Box3();
      plants.traverse(object => {
        if (!(object instanceof THREE.Mesh) || !object.visible || !(object.material as THREE.Material).visible) return;
        // Waterline rings sit inside the bowl, which the vessel footprint already covers.
        const own = new THREE.Box3().setFromObject(object);
        if (own.max.y > .7) box.union(own);
      });
      assert.ok(!box.isEmpty());
      const samples = extent.samples ?? [];
      const reach = {
        top: extent.height,
        px: Math.max(...samples.map(s => s.x + s.side)), nx: Math.min(...samples.map(s => s.x - s.side)),
        pz: Math.max(...samples.map(s => s.z + s.side)), nz: Math.min(...samples.map(s => s.z - s.side)),
      };
      const slack = .02;
      assert.ok(reach.top >= box.max.y - slack, `${id}: estimated top ${reach.top.toFixed(2)} under rendered ${box.max.y.toFixed(2)}`);
      assert.ok(reach.px >= box.max.x - slack && reach.nx <= box.min.x + slack, `${id}: x reach ${reach.nx.toFixed(2)}..${reach.px.toFixed(2)} inside rendered ${box.min.x.toFixed(2)}..${box.max.x.toFixed(2)}`);
      assert.ok(reach.pz >= box.max.z - slack && reach.nz <= box.min.z + slack, `${id}: z reach ${reach.nz.toFixed(2)}..${reach.pz.toFixed(2)} inside rendered ${box.min.z.toFixed(2)}..${box.max.z.toFixed(2)}`);
      // ...without being so cautious that ordinary pieces are turned away.
      assert.ok(reach.top - box.max.y < .5, `${id}: height overestimated by ${(reach.top - box.max.y).toFixed(2)}`);
      for (const over of [reach.px - box.max.x, box.min.x - reach.nx, reach.pz - box.max.z, box.min.z - reach.nz]) {
        assert.ok(over < 1.15, `${id}: sideways reach overestimated by ${over.toFixed(2)}`);
      }
    } finally { display.dispose(); }
  }
});
