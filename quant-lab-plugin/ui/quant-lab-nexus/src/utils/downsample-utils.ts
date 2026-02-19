/**
 * TICKET_377: Large dataset rendering utilities
 * Copied from back-test-nexus downsample-utils.ts (TICKET_317/358)
 * Tier 1 same-tier import prohibited, so duplicated here.
 */

export const MAX_RENDER_POINTS = 2000;

/** Loop-based min/max to avoid V8 call stack limit on Math.min(...spread) */
export function safeMinMax<T>(arr: T[], accessor: (item: T) => number): { min: number; max: number } {
  if (arr.length === 0) return { min: 0, max: 0 };
  let min = accessor(arr[0]);
  let max = min;
  for (let i = 1; i < arr.length; i++) {
    const v = accessor(arr[i]);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return { min, max };
}

/** Largest-Triangle-Three-Buckets downsampling for line charts */
export function downsampleLTTB<T>(data: T[], maxPoints: number, accessor: (item: T) => number): T[] {
  if (data.length <= maxPoints) return data;
  const result: T[] = [data[0]];
  const bucketSize = (data.length - 2) / (maxPoints - 2);
  let prevSelected = 0;
  for (let i = 1; i < maxPoints - 1; i++) {
    const bucketStart = Math.floor((i - 1) * bucketSize) + 1;
    const bucketEnd = Math.min(Math.floor(i * bucketSize) + 1, data.length - 1);
    const nextBucketStart = Math.floor(i * bucketSize) + 1;
    const nextBucketEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, data.length - 1);
    // Average of next bucket
    let avgY = 0;
    for (let j = nextBucketStart; j < nextBucketEnd; j++) avgY += accessor(data[j]);
    avgY /= (nextBucketEnd - nextBucketStart) || 1;
    const avgX = (nextBucketStart + nextBucketEnd - 1) / 2;
    // Find point in current bucket with largest triangle area
    let maxArea = -1;
    let bestIdx = bucketStart;
    const ax = prevSelected;
    const ay = accessor(data[prevSelected]);
    for (let j = bucketStart; j < bucketEnd; j++) {
      const area = Math.abs((ax - avgX) * (accessor(data[j]) - ay) - (ax - j) * (avgY - ay));
      if (area > maxArea) { maxArea = area; bestIdx = j; }
    }
    result.push(data[bestIdx]);
    prevSelected = bestIdx;
  }
  result.push(data[data.length - 1]);
  return result;
}
