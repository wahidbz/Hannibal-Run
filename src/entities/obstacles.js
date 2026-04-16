import { pick, rand, randInt } from '../core/utils.js';

export const createObstacle = (spawnDistance) => ({
  lane: randInt(0, 2),
  z: rand(spawnDistance.min, spawnDistance.max),
  type: pick(['crate', 'crate', 'low', 'high'])
});

export const createCoinTrail = () => {
  const lane = randInt(0, 2);
  const start = rand(72, 108);
  const count = randInt(3, 5);
  return Array.from({ length: count }, (_, index) => ({
    type: 'coin',
    lane,
    z: start + index * 7,
    airborne: false,
    throwT: 1,
    throwDuration: 1,
    magnetized: false,
    wobble: Math.random() * Math.PI * 2
  }));
};

export const createElephantCoinBurst = () => {
  const lane = randInt(0, 2);
  const count = randInt(3, 4);
  return Array.from({ length: count }, (_, index) => ({
    type: 'coin',
    lane,
    z: 80 + index * 8,
    airborne: true,
    throwT: 0,
    throwDuration: 0.82 + index * 0.06,
    magnetized: false,
    wobble: Math.random() * Math.PI * 2
  }));
};

export const createElephantPower = () => ({
  type: 'power',
  powerType: Math.random() > 0.5 ? 'shield' : 'magnet',
  lane: randInt(0, 2),
  z: 86,
  airborne: true,
  throwT: 0,
  throwDuration: 1,
  magnetized: false,
  wobble: Math.random() * Math.PI * 2
});
