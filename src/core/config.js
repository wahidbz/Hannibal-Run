export const CONFIG = {
  baseSpeed: 22,
  maxSpeed: 41,
  accelerationCurve: 0.06,
  drawDistance: 118,
  spawnDistance: { min: 72, max: 110 },
  obstacleGap: { min: 0.85, max: 1.55 },
  coinGap: { min: 1.05, max: 1.7 },
  elephantCoinGap: { min: 4.8, max: 7.2 },
  elephantPowerGap: { min: 10.5, max: 14.5 },
  tiltThreshold: 18,
  tiltDeadZone: 8,
  tiltCooldown: 320,
  player: {
    jumpVelocity: 16,
    gravity: 33,
    laneLerp: 12,
    slideDuration: 0.72,
    collisionDepth: 8
  },
  powerUps: {
    shield: 5,
    magnet: 6
  },
  environments: [
    {
      key: 'byrsa',
      name: { en: 'Byrsa Heights', ar: 'مرتفعات بيرصا' },
      skyTop: '#4d2f2e',
      skyBottom: '#ca8444',
      haze: '#f0bd76',
      sun: '#ffd07a',
      sand1: '#c89b62',
      sand2: '#7e5b35',
      stone: '#b89e7a',
      accent: '#dcb26f',
      moss: '#6f7b47',
      ruin: '#b6a084'
    },
    {
      key: 'dougga',
      name: { en: 'Dougga Ruins', ar: 'أطلال دقّة' },
      skyTop: '#5a3442',
      skyBottom: '#d28e55',
      haze: '#efb56f',
      sun: '#ffcf8a',
      sand1: '#b58b57',
      sand2: '#705234',
      stone: '#c5b092',
      accent: '#e2bd7e',
      moss: '#708356',
      ruin: '#cbb799'
    },
    {
      key: 'eljem',
      name: { en: 'El Jem Arena', ar: 'مدرّج الجم' },
      skyTop: '#59352a',
      skyBottom: '#de9a59',
      haze: '#f4c17c',
      sun: '#ffd991',
      sand1: '#c49962',
      sand2: '#795230',
      stone: '#d0bc9f',
      accent: '#f0c888',
      moss: '#72734d',
      ruin: '#d7c3a5'
    },
    {
      key: 'sahara',
      name: { en: 'Saharan Causeway', ar: 'طريق الصحراء' },
      skyTop: '#513322',
      skyBottom: '#d08d4d',
      haze: '#f6c977',
      sun: '#ffe3a0',
      sand1: '#d3a768',
      sand2: '#815731',
      stone: '#b79a72',
      accent: '#ffcf82',
      moss: '#6f7041',
      ruin: '#baa27f'
    }
  ]
};
