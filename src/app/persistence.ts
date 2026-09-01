const STORAGE_KEY = "ikebana-web-alpha:studio-v1";

export type PersistedStudio<TPlant> = {
  storageVersion: 1;
  savedAt: string;
  nextSuccessfulOrdinal: number;
  plants: TPlant[];
};

export class CommittedStore<TPlant> {
  constructor(private readonly key = STORAGE_KEY) {}

  load(): PersistedStudio<TPlant> | null {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      const value = JSON.parse(raw) as Partial<PersistedStudio<TPlant>>;
      if (
        value.storageVersion !== 1 ||
        !Number.isInteger(value.nextSuccessfulOrdinal) ||
        (value.nextSuccessfulOrdinal ?? 0) < 1 ||
        !Array.isArray(value.plants)
      ) return null;
      return value as PersistedStudio<TPlant>;
    } catch {
      return null;
    }
  }

  save(nextSuccessfulOrdinal: number, plants: TPlant[]) {
    const value: PersistedStudio<TPlant> = {
      storageVersion: 1,
      savedAt: new Date().toISOString(),
      nextSuccessfulOrdinal,
      plants,
    };
    try {
      localStorage.setItem(this.key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  clear() {
    try {
      localStorage.removeItem(this.key);
    } catch {
      // Storage is an optional resilience layer; the toy remains playable.
    }
  }
}
