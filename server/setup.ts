/**
 * Одноразовая настройка бота через Bot API: описание, короткое описание,
 * команды и кнопка меню, открывающая Mini App.
 *
 *   npm run bot:setup
 *
 * Токен берётся из .env (BOT_TOKEN) и никуда не выводится.
 */
import { config } from './config';
import { configureBot, getMe } from './bot';
import { BOT_COMMANDS, BOT_SHORT_DESCRIPTION, MENU_BUTTON_TEXT } from './botTexts';

const me = await getMe();
await configureBot();

console.log(`✅ Бот @${me.username} настроен:`);
console.log(`   • описание («Что умеет этот бот?») обновлено`);
console.log(`   • короткое описание: ${BOT_SHORT_DESCRIPTION}`);
console.log(`   • команды: ${BOT_COMMANDS.map((c) => '/' + c.command).join(', ')}`);
console.log(`   • кнопка меню «${MENU_BUTTON_TEXT}» → ${config.webAppUrl}`);
console.log('');
console.log('Первое сообщение воронки бот отправляет на /start, когда запущен сервер: npm run server');
