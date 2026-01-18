import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { UserData } from '@/lib/api';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Форматирует отображаемое имя пользователя
 * Приоритет: firstName lastName > username > email (до @) > wallet (сокращенный)
 */
export function formatUserDisplayName(user: UserData): string {
  // 1. Если есть имя/фамилия (TG или заполненные данные)
  if (user.firstName) {
    return user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName;
  }

  // 2. Username из TG
  if (user.username) {
    return user.username;
  }

  // 3. Email - показываем часть до @
  if (user.email) {
    return user.email.split('@')[0];
  }

  // 4. Web3 адрес - сокращаем
  if (user.web3Address) {
    return shortenAddress(user.web3Address);
  }

  return 'User';
}

/**
 * Получает инициал для аватара
 */
export function getUserInitial(user: UserData): string {
  if (user.firstName) {
    return user.firstName[0].toUpperCase();
  }

  if (user.username) {
    return user.username[0].toUpperCase();
  }

  if (user.email) {
    return user.email[0].toUpperCase();
  }

  if (user.web3Address) {
    return user.web3Address.slice(0, 2);
  }

  return '?';
}

/**
 * Сокращает адрес кошелька: первые 4 и последние 4 символа
 */
export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
