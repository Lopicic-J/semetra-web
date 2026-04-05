import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debounce, throttle, LRUCache, measure, getImagePriority, prefetchRoutes } from "../performance";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should debounce function calls", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("should pass arguments to debounced function", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("hello", 42);
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith("hello", 42);
  });

  it("should cancel pending calls", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(100);

    expect(fn).not.toHaveBeenCalled();
  });
});

describe("throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should throttle function calls", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    expect(fn).toHaveBeenCalledOnce();

    throttled();
    throttled();
    expect(fn).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should pass arguments to throttled function", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled("test", 123);
    expect(fn).toHaveBeenCalledWith("test", 123);
  });
});

describe("LRUCache", () => {
  it("should get and set values", () => {
    const cache = new LRUCache<string, number>(3);

    cache.set("a", 1);
    cache.set("b", 2);

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
  });

  it("should return undefined for missing keys", () => {
    const cache = new LRUCache<string, number>(3);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("should evict oldest entry when full", () => {
    const cache = new LRUCache<string, number>(2);

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3); // Should evict 'a'

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  it("should move accessed items to the end", () => {
    const cache = new LRUCache<string, number>(2);

    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // Access 'a', move to end
    cache.set("c", 3); // Should evict 'b', not 'a'

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });

  it("should track size correctly", () => {
    const cache = new LRUCache<string, number>(3);

    expect(cache.size).toBe(0);
    cache.set("a", 1);
    expect(cache.size).toBe(1);
    cache.set("b", 2);
    expect(cache.size).toBe(2);
  });

  it("should clear all entries", () => {
    const cache = new LRUCache<string, number>(3);
    cache.set("a", 1);
    cache.set("b", 2);

    cache.clear();

    expect(cache.size).toBe(0);
    expect(cache.get("a")).toBeUndefined();
  });

  it("should update existing key without changing eviction order", () => {
    const cache = new LRUCache<string, number>(2);

    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 10); // Update 'a' without incrementing size

    expect(cache.size).toBe(2);
    expect(cache.get("a")).toBe(10);
  });
});

describe("measure", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should measure async function execution time", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "development");

    const fn = vi.fn(async () => {
      await new Promise(r => setTimeout(r, 50));
      return "result";
    });

    const promise = measure("test", fn);
    vi.advanceTimersByTime(50);
    const result = await promise;

    expect(result).toBe("result");
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[perf] test:"));

    consoleSpy.mockRestore();
  });

  it("should not log in production", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubEnv("NODE_ENV", "production");

    await measure("test", async () => "result");

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("getImagePriority", () => {
  it("should return eager for first 3 images", () => {
    expect(getImagePriority(0)).toBe("eager");
    expect(getImagePriority(1)).toBe("eager");
    expect(getImagePriority(2)).toBe("eager");
  });

  it("should return lazy for images after index 3", () => {
    expect(getImagePriority(3)).toBe("lazy");
    expect(getImagePriority(4)).toBe("lazy");
    expect(getImagePriority(100)).toBe("lazy");
  });
});

describe("prefetchRoutes", () => {
  it("should create prefetch link elements in DOM", () => {
    // happy-dom provides a real window/document, so prefetchRoutes should work directly
    const appendChildSpy = vi.spyOn(document.head, "appendChild");

    prefetchRoutes(["/page1", "/page2"]);

    expect(appendChildSpy).toHaveBeenCalledTimes(2);
    const firstLink = appendChildSpy.mock.calls[0][0] as HTMLLinkElement;
    expect(firstLink.rel).toBe("prefetch");
    expect(firstLink.href).toContain("/page1");

    appendChildSpy.mockRestore();
  });
});
