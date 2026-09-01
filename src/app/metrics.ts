export type ScreenRegion = "top" | "middle" | "bottom";

export type AcquisitionRecord = {
  at: number;
  posture: "arrange" | "inspect";
  tool: "shape" | "prune";
  result: "hit" | "miss";
  operation?: "insert" | "aim" | "bend" | "base" | "prune" | "camera";
  region: ScreenRegion;
};

export class SessionMetrics {
  readonly acquisitions: AcquisitionRecord[] = [];
  cancelledTransactions = 0;
  committedTransactions = 0;

  recordAcquisition(record: Omit<AcquisitionRecord, "at">) {
    this.acquisitions.push({ ...record, at: performance.now() });
  }

  snapshot() {
    return {
      acquisitions: this.acquisitions.map((record) => ({ ...record })),
      cancelledTransactions: this.cancelledTransactions,
      committedTransactions: this.committedTransactions,
    };
  }

  reset() {
    this.acquisitions.length = 0;
    this.cancelledTransactions = 0;
    this.committedTransactions = 0;
  }
}

export function screenRegion(clientY: number, viewportHeight = window.innerHeight): ScreenRegion {
  const ratio = clientY / Math.max(1, viewportHeight);
  return ratio < 1 / 3 ? "top" : ratio < 2 / 3 ? "middle" : "bottom";
}
