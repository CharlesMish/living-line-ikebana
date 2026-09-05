export class CraftSound {
  private context: AudioContext | null = null;
  private unavailable = false;

  unlock() {
    if (this.unavailable) return;
    try {
      if (!this.context) this.context = new AudioContext();
      if (this.context.state === "suspended") {
        void this.context.resume().catch(() => { this.unavailable = true; });
      }
    } catch {
      // Sound is optional. An unavailable audio device must never block a
      // pointer acquisition, a committed edit, or its visual feedback.
      this.unavailable = true;
    }
  }

  seat() {
    this.pulse(156, 0.055, 0.035, "sine");
    window.setTimeout(() => this.pulse(238, 0.035, 0.018, "triangle"), 28);
  }

  cut() {
    this.pulse(620, 0.018, 0.028, "triangle");
    window.setTimeout(() => this.pulse(270, 0.026, 0.017, "sine"), 16);
  }

  private pulse(frequency: number, duration: number, gainValue: number, type: OscillatorType) {
    const context = this.context;
    if (this.unavailable || !context || context.state !== "running") return;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(gainValue, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch {
      this.unavailable = true;
    }
  }
}
