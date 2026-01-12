import { MachineResponseDto } from './machine.dto';

// Response DTO для POST /machines/:id/collect-risky
export class RiskyCollectResponseDto {
  won: boolean; // Выиграл или проиграл
  originalAmount: number; // Сколько было в coin box
  finalAmount: number; // Сколько получил (2x или 0.5x)
  winChance: number; // Шанс на выигрыш (для UI)
  multiplier: number; // 2.0 или 0.5
  machine: MachineResponseDto; // Обновленная машина
  newBalance: number; // Новый баланс пользователя
}

// Response DTO для POST /machines/:id/upgrade-gamble
export class UpgradeFortuneGambleResponseDto {
  machine: MachineResponseDto;
  cost: number;
  newLevel: number;
  newWinChance: number;
  user: {
    fortuneBalance: string;
  };
}

// Response DTO для GET /machines/:id/gamble-info
export class GambleInfoResponseDto {
  currentLevel: number;
  currentWinChance: number;
  currentEV: number;
  canUpgrade: boolean;
  nextLevel: number | null;
  nextWinChance: number | null;
  nextEV: number | null;
  upgradeCost: number | null;
}
