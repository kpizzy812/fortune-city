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
      '❌ <b>Ошибка подключения</b>\n\n' +
      'Произошла ошибка. Попробуй позже.',
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
      '❌ <b>Не подключено</b>\n\n' +
      'Telegram не привязан к аккаунту.',
    success:
      '✅ <b>Успешно отключено</b>\n\n' +
      'Telegram отключён от Fortune City.\n' +
      'Уведомления больше приходить не будут.\n\n' +
      'Используй /start для повторного подключения.',
  },

  unknownCommand:
    '❓ <b>Неизвестная команда</b>\n\n' +
    'Используй /help для списка команд.',
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
