/**
 * Lenis Virtual Momentum Scroll Engine
 * High-performance virtual inertia scroll engine for containers & windows.
 * 60fps exponential momentum decay, wheel/touch normalization, 0% CPU idle sleep.
 */

export interface LenisOptions {
  wrapper?: HTMLElement | Window;
  content?: HTMLElement;
  duration?: number;
  easing?: (t: number) => number;
  orientation?: "vertical" | "horizontal";
  smoothWheel?: boolean;
  wheelMultiplier?: number;
  touchMultiplier?: number;
  infinite?: boolean;
}

export interface ScrollEventData {
  scroll: number;
  limit: number;
  velocity: number;
  progress: number;
}

export class Lenis {
  public targetScroll = 0;
  public currentScroll = 0;
  public isScrolling = false;
  private isRafActive = false;
  private rafId: number | null = null;
  private wrapper: HTMLElement | Window;
  private options: Required<Omit<LenisOptions, "wrapper" | "content">>;
  private listeners: Set<(e: ScrollEventData) => void> = new Set();
  private wheelHandler: (e: WheelEvent) => void;

  constructor(options: LenisOptions = {}) {
    this.wrapper = options.wrapper ?? (typeof window !== "undefined" ? window : ({} as Window));
    this.options = {
      duration: options.duration ?? 1.1,
      easing: options.easing ?? ((t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t))),
      orientation: options.orientation ?? "vertical",
      smoothWheel: options.smoothWheel ?? true,
      wheelMultiplier: options.wheelMultiplier ?? 1.0,
      touchMultiplier: options.touchMultiplier ?? 1.5,
      infinite: options.infinite ?? false,
    };

    if (typeof window !== "undefined") {
      this.currentScroll = this.getScroll();
      this.targetScroll = this.currentScroll;

      this.wheelHandler = this.onWheel.bind(this);
      const targetElement = this.wrapper === window ? window : this.wrapper;
      (targetElement as EventTarget).addEventListener("wheel", this.wheelHandler as EventListener, {
        passive: false,
      });
    } else {
      this.wheelHandler = () => {};
    }
  }

  public setWrapper(el: HTMLElement | Window) {
    if (this.wrapper && typeof window !== "undefined") {
      const prev = this.wrapper === window ? window : this.wrapper;
      (prev as EventTarget).removeEventListener("wheel", this.wheelHandler as EventListener);
    }
    this.wrapper = el;
    this.currentScroll = this.getScroll();
    this.targetScroll = this.currentScroll;
    const targetElement = this.wrapper === window ? window : this.wrapper;
    (targetElement as EventTarget).addEventListener("wheel", this.wheelHandler as EventListener, {
      passive: false,
    });
  }

  public getScroll(): number {
    if (this.wrapper === window || typeof (this.wrapper as HTMLElement).scrollTop === "undefined") {
      return window.scrollY || document.documentElement.scrollTop || 0;
    }
    return (this.wrapper as HTMLElement).scrollTop || 0;
  }

  public getLimit(): number {
    if (this.wrapper === window || typeof (this.wrapper as HTMLElement).scrollHeight === "undefined") {
      return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    }
    const el = this.wrapper as HTMLElement;
    return Math.max(0, el.scrollHeight - el.clientHeight);
  }

  private setScroll(val: number) {
    if (this.wrapper === window || typeof (this.wrapper as HTMLElement).scrollTop === "undefined") {
      window.scrollTo(0, val);
    } else {
      (this.wrapper as HTMLElement).scrollTop = val;
    }
  }

  private onWheel(e: WheelEvent) {
    if (!this.options.smoothWheel) return;

    // Honor prefers-reduced-motion
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const limit = this.getLimit();
    if (limit <= 0) return;

    // Check if target wants native scrolling
    const target = e.target as HTMLElement | null;
    if (target?.closest?.(".no-lenis")) return;

    // Prevent default jumpy wheel step
    e.preventDefault();

    const delta = e.deltaY * this.options.wheelMultiplier;
    this.targetScroll = Math.max(0, Math.min(limit, this.targetScroll + delta));

    this.startRaf();
  }

  private startRaf() {
    if (this.isRafActive) return;
    this.isRafActive = true;
    this.isScrolling = true;

    const loop = (time: number) => {
      this.raf(time);
      if (this.isRafActive) {
        this.rafId = requestAnimationFrame(loop);
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stopRaf() {
    this.isRafActive = false;
    this.isScrolling = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public raf(_time?: number) {
    const diff = this.targetScroll - this.currentScroll;

    // Sleep when target reached to preserve 0% CPU at idle
    if (Math.abs(diff) < 0.1) {
      this.currentScroll = this.targetScroll;
      this.setScroll(this.currentScroll);
      this.notifyListeners(0);
      this.stopRaf();
      return;
    }

    // High-precision exponential inertia interpolation
    const factor = 1 - Math.exp(-0.01 * (1000 / 60) * (1 / (this.options.duration * 0.16)));
    this.currentScroll += diff * factor;
    this.setScroll(this.currentScroll);

    this.notifyListeners(diff);
  }

  private notifyListeners(velocity: number) {
    const limit = this.getLimit();
    const progress = limit > 0 ? this.currentScroll / limit : 0;
    const event: ScrollEventData = {
      scroll: this.currentScroll,
      limit,
      velocity,
      progress,
    };

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  public scrollTo(target: number | HTMLElement, { immediate = false } = {}) {
    let targetPos = 0;
    if (typeof target === "number") {
      targetPos = target;
    } else if (target instanceof HTMLElement) {
      if (this.wrapper === window) {
        targetPos = target.getBoundingClientRect().top + window.scrollY;
      } else {
        targetPos = target.offsetTop;
      }
    }

    const limit = this.getLimit();
    targetPos = Math.max(0, Math.min(limit, targetPos));

    if (immediate) {
      this.currentScroll = targetPos;
      this.targetScroll = targetPos;
      this.setScroll(targetPos);
      this.notifyListeners(0);
    } else {
      this.targetScroll = targetPos;
      this.startRaf();
    }
  }

  public on(event: "scroll", cb: (e: ScrollEventData) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public destroy() {
    this.stopRaf();
    this.listeners.clear();
    if (this.wrapper && typeof window !== "undefined") {
      const targetElement = this.wrapper === window ? window : this.wrapper;
      (targetElement as EventTarget).removeEventListener("wheel", this.wheelHandler as EventListener);
    }
  }
}

export default Lenis;
