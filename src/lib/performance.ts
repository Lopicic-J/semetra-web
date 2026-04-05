/**
 * Performance utilities for Semetra
 */

import { logger } from "@/lib/logger";

const log = logger("perf");

/** Debounce function for search inputs */
export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T & { cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => { if (timer) clearTimeout(timer); };
  return debounced as T & { cancel(): void };
}

/** Throttle for scroll/resize handlers */
export function throttle<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null; }
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  }) as T;
}

/** Simple LRU cache for computed data */
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  constructor(private maxSize: number) {}
  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recent)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }
  set(key: K, value: V): void {
    if (this.cache.has(key)) this.cache.delete(key);
    else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  clear(): void { this.cache.clear(); }
  get size(): number { return this.cache.size; }
}

/** Measure execution time */
export async function measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const ms = (performance.now() - start).toFixed(1);
    log.debug(`${label}: ${ms}ms`);
  }
}

/** Image loading with lazy/eager hints */
export function getImagePriority(index: number): "eager" | "lazy" {
  return index < 3 ? "eager" : "lazy";
}

/** Prefetch helper for Next.js navigation */
export function prefetchRoutes(routes: string[]): void {
  if (typeof window === "undefined") return;
  const link = document.createElement("link");
  routes.forEach(route => {
    const el = link.cloneNode() as HTMLLinkElement;
    el.rel = "prefetch";
    el.href = route;
    document.head.appendChild(el);
  });
}
