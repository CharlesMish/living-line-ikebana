export interface PreparedPhoto {
  readonly blob: Blob;
  readonly url: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

type PhotoCanvas = Pick<HTMLCanvasElement, "width" | "height" | "toBlob">;
interface ObjectURLs {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

/** Owns temporary image delivery only. It never receives the working document. */
export class PhotoExport {
  private revision = 0;
  private prepared: PreparedPhoto | null = null;
  private externallyOpened = new Set<string>();
  constructor(private readonly urls: ObjectURLs = URL) {}
  get current(): PreparedPhoto | null { return this.prepared; }

  /** A changed frame/context/session must not deliver an older pending encode. */
  invalidate(): void { this.revision++; }

  async prepare(canvas: PhotoCanvas): Promise<PreparedPhoto | null> {
    const revision = ++this.revision;
    const { width, height } = canvas;
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      (value) => value ? resolve(value) : reject(new Error("This browser could not create the PNG. Try preparing it again.")), "image/png",
    ));
    if (revision !== this.revision) return null;
    const photo = { blob, url: this.urls.createObjectURL(blob), name: `living-line-${width}x${height}.png`, width, height };
    this.releaseImage();
    this.prepared = photo;
    return photo;
  }

  /** An explicitly opened image may outlive this dialog, including its reload.
   * The browser releases these URLs when the originating page itself unloads.
   * Preview-only URLs still get deterministic cleanup on replacement/close.
   */
  preserveOpenedImage(): void {
    if (this.prepared) this.externallyOpened.add(this.prepared.url);
  }

  private releaseImage(): void {
    if (this.prepared && !this.externallyOpened.has(this.prepared.url)) this.urls.revokeObjectURL(this.prepared.url);
    this.prepared = null;
  }
  clear(): void { this.invalidate(); this.releaseImage(); }
}

export interface FileSharing {
  canShare?: (data: ShareData) => boolean;
  share?: (data: ShareData) => Promise<void>;
}

/** Capability-check the actual file; this does not open the share sheet. */
export function photoShareData(photo: PreparedPhoto, sharing: FileSharing, makeFile = (blob: Blob, name: string) => new File([blob], name, { type: "image/png" })): ShareData | null {
  if (!sharing.share || !sharing.canShare) return null;
  try {
    const data = { files: [makeFile(photo.blob, photo.name)] };
    return sharing.canShare(data) ? data : null;
  } catch { return null; }
}

/** Call directly in a Share click handler, before awaiting anything. */
export function sharePhoto(data: ShareData, sharing: FileSharing): Promise<"shared" | "cancelled"> {
  if (!sharing.share) return Promise.reject(new Error("File sharing is unavailable in this browser."));
  const rejected = (error: unknown): "cancelled" => {
    if (error && typeof error === "object" && "name" in error && error.name === "AbortError") return "cancelled";
    throw error;
  };
  try {
    return sharing.share(data).then(() => "shared" as const, rejected);
  } catch (error) { return Promise.reject(error).catch(rejected); }
}
