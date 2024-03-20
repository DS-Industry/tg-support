import bot from "../methods/connection";
import connection from "../db";

class AdminMethod {
    //Фиксированное меню для админа
    async menuAdminMainFixed(chatId, text){
        await bot.sendMessage(chatId,
            `${text} К клавиатуре прикреплено меню для выбора действий.`, {
                reply_markup: {
                    keyboard: [
                        [
                            'Активные запросы',
                            'Завершенные запросы',
                        ], [
                            'Сделать рассылку'
                        ]
                    ],
                    resize_keyboard: true
                }
            }
        )
    }
    //Вывод всех запросов для админа с учетом статуса обращения
    async adminRequest(chatId, check, checkStatus, tgMethod){
        let inequality = '!'
        let stringStatus = 'Активные'
        if (Number(checkStatus) === 1){
            inequality = ''
            stringStatus = 'Завершенные'
        }
        const sql = `SELECT * FROM request WHERE status ${inequality}= $1 ORDER BY id`;
        await connection.query(sql, ["Закрыто"], async (err, results) => {
            if (results.rows.length > 0) {
                if (check === 0) {
                    await tgMethod.sendMessageWithRetry(chatId, `<b>${stringStatus} запросы:</b>`)
                }
                if (check !== 0) {
                    check = results.rows.findIndex(item => item.id === Number(check));
                }
                let delayMs = 5000;
                for (const [index, item] of results.rows.slice(check, check+3).entries()) {
                    await tgMethod.delay(delayMs*index); // Умножаем индекс на 1000, чтобы увеличивать задержку для каждой итерации
                    try {
                        await this.showAdminRequest(
                            chatId,
                            item.id,
                            item.status,
                            item.client_name,
                            item.type,
                            item.address,
                            item.description,
                            item.client_username,
                            item.date,
                            tgMethod
                        );
                    } catch (error) {
                        if (error.response && error.response.status === 429) {
                            delayMs += 1000; // Увеличиваем задержку на 1 секунду при получении ошибки 429
                        }
                    }
                }
                if (check + 3 < results.rows.length) {
                    await bot.sendMessage(chatId,
                        `Следующие ${stringStatus} запросы`, {
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        {
                                            text: 'Смотреть',
                                            callback_data: `adminRequest:${results.rows[check + 3].id}:${checkStatus}`
                                        }
                                    ]
                                ]
                            }
                        }
                    )
                } else {
                    await tgMethod.sendMessageWithRetry(chatId, `<i>${stringStatus} запросы закончились.</i>`)
                }
            } else {
                await bot.sendMessage(chatId, `${stringStatus} запросы остутсвуют.`);
            }
        });
    }
    //Отображение обращения на стороне администратора
    async showAdminRequest(chatId, requestId, status, clientName, type, address, description, clientUsername, date, tgMethod) {
        const formattedDate = await tgMethod.formatDate(date);
        const messageText = `<b>Номер запроса:</b> ${requestId}\n<b>Тип проблемы: </b>${type}\n<b>Дата создания: </b>${formattedDate}\n<b>Статус: </b>${status}\n<b>Имя клиента: </b>${clientName}\n<b>Ник клиента: </b>${clientUsername}\n<b>Адрес мойки: </b>${address}\n<b>Описание: </b>${description}\n`;

        await tgMethod.sendMessageWithRetry(chatId, messageText);
        await tgMethod.sendMedia(chatId, requestId, "request");

        await this.menuAdminRequest(chatId, requestId, status);
    }
    //Выпадающее меню к обращению для администратора
    async menuAdminRequest(chatId, text, status){
        if(status === 'Закрыто'){
            await bot.sendMessage(chatId,
                `Выберите действие для запроса ${text}:`, {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {text: 'Посмотреть все комментарии', callback_data: `historyComment:${text}`}
                            ]
                        ]
                    }
                }
            )
        } else {
            await bot.sendMessage(chatId,
                `Выберите действие для запроса ${text}:`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{text: 'Добавить комментарий', callback_data: `addComment:${text}`}],
                            [{text: 'Посмотреть все комментарии', callback_data: `historyComment:${text}`}],
                            //[{text: 'Изменить статус запроса', callback_data: `changeAdminStatus:${text}`}],
                            [{text: 'Закрыть запрос', callback_data: `closeAdminStatus:${text}`}]
                        ]
                    }
                }
            )
        }
    }
    //Отправка нового запроса адину
    async addRequestAdmin(chatId, request_id, tgMethod){
        const sql = 'SELECT * FROM REQUEST WHERE ID = $1';
        await connection.query(sql, [request_id], async (err, result) => {
            await tgMethod.sendMessageWithRetry(chatId, `<b>Добавлен новый запрос:</b>`);
            await this.showAdminRequest(chatId, request_id, result.rows[0].status, result.rows[0].client_name, result.rows[0].type, result.rows[0].address, result.rows[0].description, result.rows[0].client_username, result.rows[0].date, tgMethod);
        });
    }
    //Создает рассылку по всем клиентам, которые отправляли сообщения
    async makeNewsletter(chatId, clientMethod, tgMethod){
        const clients = await clientMethod.getAllClient()
        if(clients.length > 0){
            await tgMethod.sendMessageWithRetry(chatId, `<i>Напишите текст и вставьте фото для создания рассылки:</i>`);
            const protectionNews = async (msg) => {
                if (msg.chat.id === chatId) {
                    if (msg.photo && msg.photo.length > 0) {
                        if (msg.caption !== undefined){
                            for (const [, item] of clients.entries()) {
                                await bot.sendPhoto(item, msg.photo[msg.photo.length-1].file_id, { caption: msg.caption });
                            }
                        } else {
                            for (const [, item] of clients.entries()) {
                                await bot.sendPhoto(item, msg.photo[msg.photo.length-1].file_id);
                            }
                        }
                    } else {
                        for (const [, item] of clients.entries()) {
                            await tgMethod.sendMessageWithRetry(item, msg.text);
                        }
                    }
                    await tgMethod.sendMessageWithRetry(chatId, `<i>Готово!</i>`);
                    bot.removeListener('message', protectionNews);
                } else {
                    console.log("Ожидание нужного пользователя для создания рассылки.")
                }
            }
            bot.on('message', protectionNews);
        } else {
            await tgMethod.sendMessageWithRetry(chatId, `<i>Клиентов, сделавших обращение, нету.</i>`);
        }
    }
    //Поиск запроса по id
    async searchRequestById(chatId, msgText, tgMethod) {
        const sql = 'SELECT * FROM request WHERE id = $1';
        await connection.query(sql, [msgText], async (err, result) => {
            if (err) {
                console.error('Ошибка выполнения запроса:', err);
            } else {
                if (result.rows.length > 0) {
                    const row = result.rows[0];
                    await this.showAdminRequest(
                        chatId,
                        msgText,
                        row.status,
                        row.client_name,
                        row.type,
                        row.address,
                        row.description,
                        row.client_username,
                        row.date,
                        tgMethod,
                    );
                } else {
                    await tgMethod.sendMessageWithRetry(chatId, `<i>Запроса с таким номером нету.</i>`);
                }
            }
        });
    }
    //Изменение статуса запроса для админа
    async changeStatusRequest(chatId, requestId, tgMethod, clientMethod){
        await bot.sendMessage(chatId, `Напишите новый статус для запроса ${requestId}: `);
        const protectionStatus = async (msg) => {                                         //Принимаем сообщения только от нужного пользователя
            if (msg.chat.id === chatId) {
                const sql = 'UPDATE request SET status = $1 WHERE id = $2 ';
                await connection.query(sql, [msg.text, requestId], async (err) => {
                    if (err) {
                        console.log(err);
                    }
                    await tgMethod.sendMessageWithRetry(msg.chat.id, `<i>Статус изменен</i>`);
                    await clientMethod.changeCommunicationMode(requestId, 0)
                    if (msg.text === 'Закрыто') {
                        const sqlClient = 'SELECT client_id FROM request WHERE id = $1';
                        await connection.query(sqlClient, [requestId], async (err, result) => {
                            if (err) {
                                console.log(err);
                            }
                            const clientID = result.rows[0].client_id;
                            await tgMethod.sendMessageWithRetry(clientID, `<i>Оператор перевел обращение ${requestId} в статус завершенных. Режим общения закрыт для данного запроса.</i>`);
                        });
                    }
                });
                bot.removeListener('message', protectionStatus);
            } else {
                console.log("Ожидание нужного пользователя для смены статуса.")
            }
        }
        bot.on('message', protectionStatus);
    }
    //Изменение статуса запроса для админа на "Закрыто"
    async closeStatusRequest(chatId, requestId, tgMethod, clientMethod){
        const sql = 'UPDATE request SET status = $1 WHERE id = $2 ';
        await connection.query(sql, ['Закрыто', requestId], async (err) => {
            if (err) {
                console.log(err);
            }
            await tgMethod.sendMessageWithRetry(chatId, `<i>Статус изменен</i>`);
            await clientMethod.changeCommunicationMode(requestId, 0)
            const sqlClient = 'SELECT client_id FROM request WHERE id = $1';
            await connection.query(sqlClient, [requestId], async (err, result) => {
                if (err) {
                    console.log(err);
                }
                const clientID = result.rows[0].client_id;
                await tgMethod.sendMessageWithRetry(clientID, `<i>Оператор перевел обращение ${requestId} в статус завершенных. Режим общения закрыт для данного запроса.</i>`);
            });
        });
    }

}
export default AdminMethod;