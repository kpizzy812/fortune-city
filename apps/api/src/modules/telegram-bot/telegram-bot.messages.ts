export type Lang = 'ru' | 'en';

export function getLang(languageCode?: string): Lang {
  if (!languageCode) return 'en';
  return languageCode.startsWith('ru') ? 'ru' : 'en';
}

interface BotMessages {
  welcome: {
    text: string;
    openMiniApp: string;
    openBrowser: string;
  };
  connected: {
    text: (name: string) => string;
    openMiniApp: string;
    openBrowser: string;
  };
  alreadyConnected: string;
  connectionFailed: {
    notFound: string;
    error: string;
  };
  help: string;
  notifications: {
    notConnected: string;
    settings: (enabled: boolean) => string;
  };
  disconnect: {
    notConnected: string;
    success: string;
  };
  unknownCommand: string;
}

const ru: BotMessages = {
  welcome: {
    text:
      '🏙 <b>Fortune City</b>\n\n' +
      'Построй свою крипто-империю и зарабатывай $FORTUNE!\n\n' +
      '🎰 Покупай машины — пассивный доход каждый час\n' +
      '🎡 Крути Колесо Фортуны — выигрывай джекпоты\n' +
      '👥 Приглашай друзей — бонусы до 3-х уровней\n' +
      '💰 Выводи заработок в USDT\n\n' +
      'Открой приложение и начни зарабатывать!',
    openMiniApp: '🎰 Открыть приложение',
    openBrowser: '🌐 Открыть в браузере',
  },

  connected: {
    text: (name: string) =>
      `🎉 <b>Успешно подключено!</b>\n\n` +
      `Добро пожаловать, ${name}! Telegram привязан к Fortune City.\n\n` +
      `Теперь ты будешь получать уведомления:\n` +
      `• 💰 Депозиты и выводы\n` +
      `• 🎰 Статус машин\n` +
      `• 📦 Заполненные Coin Box\n` +
      `• 👥 Новые рефералы\n` +
      `• 🎡 Джекпоты колеса\n\n` +
      `<b>Команды:</b>\n` +
      `/help — список команд\n` +
      `/notifications — настройки уведомлений\n` +
      `/disconnect — отключить Telegram`,
    openMiniApp: '🎰 Открыть приложение',
    openBrowser: '🌐 Открыть в браузере',
  },

  alreadyConnected:
    '✅ <b>Уже подключено!</b>\n\n' +
    'Telegram привязан к Fortune City.\n\n' +
    'Ты получаешь уведомления:\n' +
    '• 💰 Депозиты и выводы\n' +
    '• 🎰 Статус машин\n' +
    '• 📦 Заполненные Coin Box\n' +
    '• 👥 Новые рефералы\n' +
    '• 🎡 Джекпоты колеса',

  connectionFailed: {
    notFound:
      '❌ <b>Ошибка подключения</b>\n\n' +
      'Пользователь не найден. Попробуй снова из приложения.',
    error:
      '❌ <b>Ошибка подключения</b>\n\n' + 'Произошла ошибка. Попробуй позже.',
  },

  help:
    '📖 <b>Команды Fortune City</b>\n\n' +
    '/start — главное меню\n' +
    '/help — эта справка\n' +
    '/notifications — настройки уведомлений\n' +
    '/disconnect — отключить Telegram',

  notifications: {
    notConnected:
      '❌ <b>Не подключено</b>\n\n' +
      'Telegram не привязан к аккаунту.\n' +
      'Используй /start для подключения.',
    settings: (enabled: boolean) =>
      `🔔 <b>Настройки уведомлений</b>\n\n` +
      `Статус: <b>${enabled ? 'Включены ✅' : 'Выключены ❌'}</b>\n\n` +
      `Ты получаешь уведомления:\n` +
      `• 💰 Депозиты и выводы\n` +
      `• 🎰 Статус машин\n` +
      `• 📦 Заполненные Coin Box\n` +
      `• 👥 Новые рефералы\n` +
      `• 🎡 Джекпоты колеса\n\n` +
      `Изменить настройки можно в приложении.`,
  },

  disconnect: {
    notConnected:
      '❌ <b>Не подключено</b>\n\n' + 'Telegram не привязан к аккаунту.',
    success:
      '✅ <b>Успешно отключено</b>\n\n' +
      'Telegram отключён от Fortune City.\n' +
      'Уведомления больше приходить не будут.\n\n' +
      'Используй /start для повторного подключения.',
  },

  unknownCommand:
    '❓ <b>Неизвестная команда</b>\n\n' + 'Используй /help для списка команд.',
};

const en: BotMessages = {
  welcome: {
    text:
      '🏙 <b>Fortune City</b>\n\n' +
      'Build your crypto casino empire and earn $FORTUNE!\n\n' +
      '🎰 Buy machines — passive income every hour\n' +
      '🎡 Spin the Fortune Wheel — win jackpots\n' +
      '👥 Invite friends — bonuses up to 3 levels deep\n' +
      '💰 Withdraw earnings in USDT\n\n' +
      'Open the app and start earning!',
    openMiniApp: '🎰 Open App',
    openBrowser: '🌐 Open in Browser',
  },

  connected: {
    text: (name: string) =>
      `🎉 <b>Connected Successfully!</b>\n\n` +
      `Welcome, ${name}! Telegram is now linked to Fortune City.\n\n` +
      `You will receive notifications:\n` +
      `• 💰 Deposits and withdrawals\n` +
      `• 🎰 Machine status\n` +
      `• 📦 Full Coin Boxes\n` +
      `• 👥 New referrals\n` +
      `• 🎡 Wheel jackpots\n\n` +
      `<b>Commands:</b>\n` +
      `/help — list commands\n` +
      `/notifications — notification settings\n` +
      `/disconnect — unlink Telegram`,
    openMiniApp: '🎰 Open App',
    openBrowser: '🌐 Open in Browser',
  },

  alreadyConnected:
    '✅ <b>Already Connected!</b>\n\n' +
    'Your Telegram is linked to Fortune City.\n\n' +
    'You receive notifications:\n' +
    '• 💰 Deposits and withdrawals\n' +
    '• 🎰 Machine status\n' +
    '• 📦 Full Coin Boxes\n' +
    '• 👥 New referrals\n' +
    '• 🎡 Wheel jackpots',

  connectionFailed: {
    notFound:
      '❌ <b>Connection Failed</b>\n\n' +
      'User not found. Please try again from the app.',
    error:
      '❌ <b>Connection Failed</b>\n\n' +
      'An error occurred. Please try again later.',
  },

  help:
    '📖 <b>Fortune City Commands</b>\n\n' +
    '/start — main menu\n' +
    '/help — this help message\n' +
    '/notifications — notification settings\n' +
    '/disconnect — unlink Telegram',

  notifications: {
    notConnected:
      '❌ <b>Not Connected</b>\n\n' +
      'Your Telegram is not linked to any account.\n' +
      'Use /start to connect.',
    settings: (enabled: boolean) =>
      `🔔 <b>Notification Settings</b>\n\n` +
      `Status: <b>${enabled ? 'Enabled ✅' : 'Disabled ❌'}</b>\n\n` +
      `You receive notifications:\n` +
      `• 💰 Deposits and withdrawals\n` +
      `• 🎰 Machine status\n` +
      `• 📦 Coin Box alerts\n` +
      `• 👥 New referrals\n` +
      `• 🎡 Wheel jackpots\n\n` +
      `To change settings, visit the app.`,
  },

  disconnect: {
    notConnected:
      '❌ <b>Not Connected</b>\n\n' +
      'Your Telegram is not linked to any account.',
    success:
      '✅ <b>Disconnected Successfully</b>\n\n' +
      'Your Telegram has been unlinked from Fortune City.\n' +
      'You will no longer receive notifications.\n\n' +
      'Use /start to reconnect.',
  },

  unknownCommand:
    '❓ <b>Unknown Command</b>\n\n' +
    'Use /help to see all available commands.',
};

const messages: Record<Lang, BotMessages> = { ru, en };

export function getMessages(lang: Lang): BotMessages {
  return messages[lang];
}

// ============ Wheel notification messages ============

interface WheelMessages {
  jackpotBroadcast: (winnerName: string, amount: string) => string;
  jackpotPersonal: (amount: string) => string;
  spinButton: string;
  spinAgainButton: string;
}

const wheelRu: WheelMessages = {
  jackpotBroadcast: (winnerName, amount) =>
    `🎰 <b>ДЖЕКПОТ!</b> 🎉\n\n` +
    `${winnerName} сорвал <b>$${amount}</b> на Колесе Фортуны!\n\n` +
    `Испытай удачу! 🍀`,
  jackpotPersonal: (amount) =>
    `🎰 <b>ПОЗДРАВЛЯЕМ!</b> 🎉\n\n` +
    `Вы выиграли ДЖЕКПОТ <b>$${amount}</b> на Колесе Фортуны!\n\n` +
    `Ваш выигрыш уже на балансе. Удачи! 🍀`,
  spinButton: '🎡 Крутить!',
  spinAgainButton: '🎡 Крутить ещё!',
};

const wheelEn: WheelMessages = {
  jackpotBroadcast: (winnerName, amount) =>
    `🎰 <b>JACKPOT HIT!</b> 🎉\n\n` +
    `${winnerName} just won <b>$${amount}</b> on the Fortune Wheel!\n\n` +
    `Try your luck now! 🍀`,
  jackpotPersonal: (amount) =>
    `🎰 <b>CONGRATULATIONS!</b> 🎉\n\n` +
    `You won the JACKPOT <b>$${amount}</b> on the Fortune Wheel!\n\n` +
    `Your winnings are in your balance. Good luck! 🍀`,
  spinButton: '🎡 Spin Now!',
  spinAgainButton: '🎡 Spin Again!',
};

const wheelMessages: Record<Lang, WheelMessages> = { ru: wheelRu, en: wheelEn };

export function getWheelMessages(lang: Lang): WheelMessages {
  return wheelMessages[lang];
}

// ============ Notification templates (for Telegram) ============

export function formatNotificationLocalized(
  type: string,
  data: Record<string, any>,
  lang: Lang,
): { title: string; message: string } {
  if (lang === 'ru') return formatNotificationRu(type, data);
  return formatNotificationEn(type, data);
}

function formatNotificationEn(
  type: string,
  data: Record<string, any>,
): { title: string; message: string } {
  switch (type) {
    case 'machine_expired_soon':
      return {
        title: '⏰ Machine Expiring Soon',
        message: `Your ${data.tierName || 'machine'} will expire in 24 hours! Don't forget to collect your earnings.`,
      };
    case 'machine_expired':
      return {
        title: '🎰 Machine Expired',
        message: `Your ${data.tierName || 'machine'} has completed its cycle. Total earned: $${data.totalEarned || 0}`,
      };
    case 'coin_box_full':
      return {
        title: '📦 Coin Box Full!',
        message: `Your ${data.tierName || 'machine'} coin box is full! Collect now or earnings will stop.`,
      };
    case 'coin_box_almost_full':
      return {
        title: '📦 Coin Box Almost Full',
        message: `Your ${data.tierName || 'machine'} coin box is 90% full. Collect soon!`,
      };
    case 'referral_joined':
      return {
        title: '👥 New Referral!',
        message: `${data.referralName || 'Someone'} joined using your referral link! You'll earn ${data.bonusPercent || 5}% from their deposits.`,
      };
    case 'deposit_credited':
      return {
        title: '💰 Deposit Credited',
        message: `$${data.amountUsd || data.amount || 0} has been added to your balance!`,
      };
    case 'deposit_rejected':
      return {
        title: '❌ Deposit Rejected',
        message: `Your deposit was rejected. Reason: ${data.reason || 'Unknown'}`,
      };
    case 'wheel_jackpot_won':
      return {
        title: '🎉 JACKPOT!',
        message: `Congratulations! You won $${data.amount || 0} on the Fortune Wheel!`,
      };
    case 'wheel_jackpot_alert':
      return {
        title: '🎰 Jackpot Won!',
        message: `${data.winnerName || 'Someone'} just won $${data.amount || 0} on the Wheel! Try your luck!`,
      };
    case 'withdrawal_approved':
      return {
        title: '✅ Withdrawal Approved',
        message: `Your withdrawal of $${data.netAmount || data.amount || 0} has been approved and is being processed.`,
      };
    case 'withdrawal_completed':
      return {
        title: '✅ Withdrawal Completed',
        message: `Your withdrawal of $${data.netAmount || data.amount || 0} has been sent successfully!`,
      };
    case 'withdrawal_rejected':
      return {
        title: '❌ Withdrawal Rejected',
        message: `Your withdrawal was rejected. Reason: ${data.reason || 'Unknown'}`,
      };
    default:
      return { title: 'Notification', message: 'You have a new notification' };
  }
}

function formatNotificationRu(
  type: string,
  data: Record<string, any>,
): { title: string; message: string } {
  switch (type) {
    case 'machine_expired_soon':
      return {
        title: '⏰ Машина скоро истечёт',
        message: `Ваша ${data.tierName || 'машина'} истечёт через 24 часа! Не забудьте собрать заработок.`,
      };
    case 'machine_expired':
      return {
        title: '🎰 Машина истекла',
        message: `Ваша ${data.tierName || 'машина'} завершила цикл. Всего заработано: $${data.totalEarned || 0}`,
      };
    case 'coin_box_full':
      return {
        title: '📦 Coin Box полон!',
        message: `Coin Box вашей ${data.tierName || 'машины'} полон! Соберите заработок, иначе доход остановится.`,
      };
    case 'coin_box_almost_full':
      return {
        title: '📦 Coin Box почти полон',
        message: `Coin Box вашей ${data.tierName || 'машины'} заполнен на 90%. Соберите скорее!`,
      };
    case 'referral_joined':
      return {
        title: '👥 Новый реферал!',
        message: `${data.referralName || 'Кто-то'} присоединился по вашей ссылке! Вы будете получать ${data.bonusPercent || 5}% от их депозитов.`,
      };
    case 'deposit_credited':
      return {
        title: '💰 Депозит зачислен',
        message: `$${data.amountUsd || data.amount || 0} зачислено на ваш баланс!`,
      };
    case 'deposit_rejected':
      return {
        title: '❌ Депозит отклонён',
        message: `Ваш депозит отклонён. Причина: ${data.reason || 'Неизвестно'}`,
      };
    case 'wheel_jackpot_won':
      return {
        title: '🎉 ДЖЕКПОТ!',
        message: `Поздравляем! Вы выиграли $${data.amount || 0} на Колесе Фортуны!`,
      };
    case 'wheel_jackpot_alert':
      return {
        title: '🎰 Джекпот сорван!',
        message: `${data.winnerName || 'Кто-то'} выиграл $${data.amount || 0} на Колесе! Испытай удачу!`,
      };
    case 'withdrawal_approved':
      return {
        title: '✅ Вывод одобрен',
        message: `Ваш вывод $${data.netAmount || data.amount || 0} одобрен и обрабатывается.`,
      };
    case 'withdrawal_completed':
      return {
        title: '✅ Вывод завершён',
        message: `Ваш вывод $${data.netAmount || data.amount || 0} успешно отправлен!`,
      };
    case 'withdrawal_rejected':
      return {
        title: '❌ Вывод отклонён',
        message: `Ваш вывод отклонён. Причина: ${data.reason || 'Неизвестно'}`,
      };
    default:
      return { title: 'Уведомление', message: 'У вас новое уведомление' };
  }
}
