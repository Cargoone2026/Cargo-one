/**
 * BootRecorder — R71.16.5 temporary diagnostic.
 *
 * Singleton in-memory log of the Driver boot checkpoints. Read by
 * `BootDiagnosticApp.tsx` and rendered on-device so we can see *on the
 * iPhone screen itself* whether JS ever executed, and if so, where it
 * stopped. Also mirrors every event to `console.log` under the same
 * `[Driver:boot]` prefix already used by the Xcode-console diagnostic.
 *
 * DELETE THIS FILE (and its imports in `index.ts`/`BootDiagnosticApp.tsx`)
 * once the physical-device startup root cause is identified.
 */

export interface BootStep {
  n: number;
  msg: string;
  ok: boolean;
  err?: string;
  ts: number;
}

class BootRecorderImpl {
  steps: BootStep[] = [];
  private listeners: Array<() => void> = [];

  record(n: number, msg: string, ok: boolean, err?: string): void {
    this.steps.push({ n, msg, ok, err, ts: Date.now() });
    // Mirror to Xcode console — keeps existing `[Driver:boot]` grep-based
    // diagnostic working alongside the on-device UI.
    try {
      const tag = ok ? "OK " : "FAIL";
      // eslint-disable-next-line no-console
      console.log(`[Driver:boot] step ${n} ${tag} — ${msg}${err ? " :: " + err : ""}`);
    } catch {
      /* silent */
    }
    for (const l of this.listeners) {
      try {
        l();
      } catch {
        /* silent */
      }
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((x) => x !== listener);
    };
  }

  hasStep(n: number): boolean {
    return this.steps.some((s) => s.n === n && s.ok);
  }

  latestFailure(): BootStep | undefined {
    for (let i = this.steps.length - 1; i >= 0; i--) {
      if (!this.steps[i].ok) return this.steps[i];
    }
    return undefined;
  }
}

export const bootRecorder = new BootRecorderImpl();
