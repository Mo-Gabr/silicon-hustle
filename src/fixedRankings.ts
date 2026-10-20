export const FIXED_RANKINGS = [
  { rank: 1, name: 'MOGABR', valuation: 203_718_617_301.68 },
  { rank: 2, name: 'Gabe M.', valuation: 13_493_107_612.08 },
  { rank: 3, name: 'Neural Baron', valuation: 9_847_321_605.44 },
  { rank: 4, name: 'GPU Goblin', valuation: 8_291_470_118.90 },
  { rank: 5, name: 'Token Tycoon', valuation: 7_625_804_391.22 },
  { rank: 6, name: 'The Promptfather', valuation: 6_418_935_207.16 },
  { rank: 7, name: 'Cache Money', valuation: 5_732_180_449.75 },
  { rank: 8, name: 'Silicon Slinger', valuation: 4_286_711_902.38 },
  { rank: 9, name: 'Quantum Hustler', valuation: 3_194_625_810.61 },
  { rank: 10, name: 'Exit Liquidity', valuation: 2_083_417_936.42 },
] as const;

export const rankingMoney = (value: number): string =>
  value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
