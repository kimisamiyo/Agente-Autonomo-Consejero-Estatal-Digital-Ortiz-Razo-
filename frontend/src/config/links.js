/** Enlaces públicos CEDIT — Discord, Telegram y web */
export const DISCORD_CLIENT_ID = '1503228806406733844';

export const DISCORD_BOT_INVITE =
  `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}` +
  '&permissions=2147601408&integration_type=0&scope=bot+applications.commands';

export const DISCORD_SERVER_INVITE = 'https://discord.gg/QANgqeZuJU';
export const TELEGRAM_BOT_URL = 'https://t.me/iCEDIT_BOT';
export const TELEGRAM_BOT_USERNAME = 'iCEDIT_BOT';

/** Vacío = aún no desplegada; mostrar texto “próximamente” */
export const WEB_APP_URL = import.meta.env.VITE_CEDIT_WEB_URL || '';
