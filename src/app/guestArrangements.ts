import afterTheLeaves from "../../artifacts/fable-guest/after-the-leaves.garden.json";
import theWaterBetween from "../../artifacts/parasol-leaf/the-water-between-garden.json";
import moonRise from "../../artifacts/argon-guest/bowl-1-moon-rise-over-dark-water.garden.json";
import lanterns from "../../artifacts/argon-guest/bowl-2-lanterns-across-the-ford.garden.json";
import lastFerry from "../../artifacts/guest-astra/astra-last-ferry.json";
import copperBeech from "../../artifacts/guest-astra/astra-copper-beech.json";

export interface GuestArrangement {
  artist: string;
  backup: { gardenVersion: number; entries: { id: string; title: string; thumbnail: string | null }[] };
}

// Each artist's original Garden export supplies the cover, camera and editable graphs.
export const guestArrangements = [
  { artist: "Fable", backup: afterTheLeaves },
  { artist: "Fable", backup: theWaterBetween },
  { artist: "Gemini Argon", backup: moonRise },
  { artist: "Gemini Argon", backup: lanterns },
  { artist: "Astra", backup: lastFerry },
  { artist: "Astra", backup: copperBeech },
] satisfies GuestArrangement[];
