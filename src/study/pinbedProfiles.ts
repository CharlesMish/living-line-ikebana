import type { VesselProfile } from "./vesselProfiles.ts";

/** Approved small/medium layouts from the isolated pinbed study. */
export const PINBED_PROFILES: readonly VesselProfile[] = [
  { id: "pinbed-small", label: "Small bed", description: "A small field with a little more room between roots.", scaleX: .54, scaleZ: .54, areas: [{ x: 0, z: 0, rx: .34, rz: .34 }] },
  { id: "pinbed-single", label: "Single small bowl", description: "One half of Separate small bowls, centered and at exactly the same size.", scaleX: .54, scaleZ: .54, areas: [{ x: 0, z: 0, rx: .46, rz: .46 }] },
  { id: "pinbed-medium-oval", label: "Medium oval", description: "A medium lateral field; less depth than the existing Petite round bed.", scaleX: .72, scaleZ: .54, areas: [{ x: -.1, z: 0, rx: .82, rz: .42 }] },
];
