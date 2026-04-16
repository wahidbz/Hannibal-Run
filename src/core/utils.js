export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (min, max) => Math.random() * (max - min) + min;
export const randInt = (min, max) => Math.floor(rand(min, max + 1));
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeInOutSine = (t) => -(Math.cos(Math.PI * clamp(t, 0, 1)) - 1) / 2;
export const mapRange = (value, inMin, inMax, outMin, outMax) => {
  const ratio = clamp((value - inMin) / (inMax - inMin || 1), 0, 1);
  return lerp(outMin, outMax, ratio);
};
export const formatNumber = (value) => new Intl.NumberFormat().format(Math.round(value || 0));
export const uid = () => `han-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
