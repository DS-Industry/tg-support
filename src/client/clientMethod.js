import bot from "../methods/connection";
import connection from "../db";

class ClientMethod {
    //Фиксированное меню для пользователя
    async menuMainFixed(chatId, text){
        await bot.sendMessage(chatId, text, {
                reply_markup: {
                    keyboard: [
                        [
                            '✏ Создать запрос',
                            '📋 Посмотреть предыдущие запросы'
                        ]
                    ],
                    resize_keyboard: true
                }
            }
        )
    }
    //Варианты типа обращения
    async addRequestType(chatId){
        await bot.sendMessage(chatId, `Выберите тип обращения: `,  {
            reply_markup: {
                inline_keyboard: [
                    [{text: '⚙ Технические неполадки', callback_data: `requestType:1`}],
                    [{text: '📒 Консультация', callback_data: `requestType:2`}],
                    [{text: 'Прочее', callback_data: `requestType:3`}]
                ]
            }
        });
    }
    //Выпадающее меню для обращения у пользователя
    async menuRequest(chatId, text, tgMethod){
        const sql = 'SELECT * FROM request WHERE client_id = $1 AND id = $2';
        await connection.query(sql, [chatId, text], async (err, result) => {
            if (result.rows.length > 0) {
                const formattedDate = await tgMethod.formatDate(result.rows[0].date);
                const messageText = `<b>Номер запроса:</b> ${result.rows[0].id}\n<b>Статус: </b>${result.rows[0].status}\n<b>Дата создания: </b>${formattedDate}\n<b>Тип проблемы: </b>${result.rows[0].type}\n<b>Адрес мойки: </b>${result.rows[0].address}\n<b>Описание: </b>${result.rows[0].description}\n`;
                await tgMethod.sendMessageWithRetry(chatId, messageText);
                await tgMethod.sendMedia(chatId, result.rows[0].id, "request");
                if (result.rows[0].status !== 'Закрыто'){
                    await bot.sendMessage(chatId,
                        `Выберите свои действия:`, {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🗒Посмотреть историю комментариев', callback_data: `historyComment:${result.rows[0].id}` }],
                                    [{ text: '📝Перейти в режим общения', callback_data: `communicationMode:${result.rows[0].id}` }],
                                    [{ text: '🗃Посмотреть другие запросы', callback_data: 'requestHistory' },]
                                ]
                            }
                        })
                } else {
                    await bot.sendMessage(chatId,
                        `Выберите свои действия:`, {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🗒Посмотреть историю комментариев', callback_data: `historyComment:${result.rows[0].id}` }],
                                    [{ text: '🗃Посмотреть другие запросы', callback_data: 'requestHistory' },]
                                ]
                            }
                        })
                }
            } else {
                await bot.sendMessage(chatId, `Запроса с таким id нету.`);
            }
        });
    }
    //Получаем всех клиентов, которые делали обращение боту
    async getAllClient(){
        const sql = 'SELECT DISTINCT CLIENT_ID FROM request';
        return new Promise(async (resolve, reject) => {
            await connection.query(sql, async (err, result) => {
                if (err) {
                    console.log(err);
                    reject(err);
                } else {
                    const clientIds = result.rows.map(row => row.client_id);
                    resolve(clientIds);
                }
            });
        });
    }
    //Включение режима общения
    async onCommunicationMode(chatId, requestId, tgMethod){
        const ch = await this.getCommunicationMode(chatId)
        if(Number(requestId) === ch){
            await tgMethod.sendMessageWithRetry(chatId, `<i>Вы уже находитесь в режиме общения для этого запроса.</i>`);
        } else {
            await this.changeCommunicationMode(ch, 0)
            await this.changeCommunicationMode(requestId, 1)
            await tgMethod.sendMessageWithRetry(chatId, `<i>Теперь вы находитесь в режиме общения для запроса ${requestId}.</i>`)
        }
    }
    //Изменение режима общения для клиента
    async changeCommunicationMode(requestId, communicationMode){
        const sql = 'UPDATE request SET communication_mode = $1 WHERE id = $2 ';
        await connection.query(sql, [communicationMode, requestId], async (err) => {
            if (err) {
                console.log(err);
            }
        });
    }
    //Получение статуса режима общения
    async getCommunicationMode(clientId) {
        return new Promise(async (resolve, reject) => {
            const sql = 'SELECT * FROM request WHERE client_id = $1 AND communication_mode = 1';
            await connection.query(sql, [clientId], async (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    if (result.rows.length > 0) {
                        resolve(result.rows[0].id);
                    } else {
                        resolve(0);
                    }
                }
            });
        });
    }
}
export default ClientMethod;