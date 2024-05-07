import TgMethod from "./methods/tgMethod";
import ClientMethod from "./client/clientMethod";
import AdminMethod from "./admin/adminMethod";
import bot from "./methods/connection";
import connection from "./db";
import moment from "moment-timezone";
import { differenceInDays } from 'date-fns';

const tgMethod = new TgMethod();
const clientMethod = new ClientMethod();
const adminMethod = new AdminMethod();

require('dotenv').config();

//const BITRIX_URL = process.env.BITRIX_URL;
const usersWithMenu = [Number(process.env.ADMIN)];
let surveyStates = new Map();

connection.query('CREATE TABLE IF NOT EXISTS MESSAGE (ID SERIAL PRIMARY KEY, REQUEST_ID INTEGER, SENDER TEXT, DATE TIMESTAMP, TEXT TEXT)');
connection.query('CREATE TABLE IF NOT EXISTS REQUEST (ID SERIAL PRIMARY KEY, CLIENT_ID TEXT, DATE TIMESTAMP, STATUS TEXT, TYPE TEXT, ADDRESS TEXT, DESCRIPTION TEXT, CLIENT_NAME TEXT, CLIENT_USERNAME TEXT, COMMUNICATION_MODE INTEGER)');
connection.query('CREATE TABLE IF NOT EXISTS MEDIA (ID SERIAL PRIMARY KEY, OWNER_ID INTEGER, TYPE TEXT, URL TEXT, FILLING TEXT)');

bot.on("polling_error", err => console.log(err.data.error.message));
const commands = [
    {
        command: "start",
        description: "Запуск бота"
    },
    {

        command: "help",
        description: "Раздел помощи"

    },
]

bot.setMyCommands(commands);

//Обработчик входящих сообщений
bot.on('message', async msg => {
    try {
        if(msg.text === '/start') {                                                                     //Запуск
            if (usersWithMenu.includes(msg.chat.id)){                                                   //Проверка на статус админ
                await adminMethod.menuAdminMainFixed(msg.chat.id, '     Добро пожаловать в админский чат онлайн-поддержки компании Мойка DS! 🚙✨')
            } else {
                await clientMethod.menuMainFixed(msg.chat.id, '     🚙✨Добро пожаловать в онлайн-поддержку компании Мойка DS!\n     Вас приветствует робот технической поддержки, я помогу решить любые возникающие вопросы!\n     Создать обращение или проверить его статус можно при помощи закрепленного меню.💬🛠️')
            }
        } else if(msg.text === '/help') {                                                               //Заздел помощи
            if (usersWithMenu.includes(msg.chat.id)){
                await tgMethod.sendMessageWithRetry(msg.chat.id, `     Вы работаете в админском чате по работе с обращниями клиентов. Вам доступны следующие функции:`)
                await tgMethod.sendMessageWithRetry(msg.chat.id, `1) <u>Поиск и просмотр обращений</u> реализован в двух вариантах:\n     <b>Поиск конкретного обращения по номеру.</b> Для этого достаточно отправить сообщением номер нужного запроса;\n     <b>Просмотр истории обращений.</b> К строке чата прикреплено меню: <b>Активные запросы</b> - обращения, которые находятся в работе; <b>Завершенные запросы</b> - обращения со статусом "Закрыто". При таком поиске обращения будут показываться по 3 шт за раз по дате создания.\n     Для поиска обращения рекомендуется использовать первый вариант, так как при большом количестве обращений просмотр истории может затянуться.`)
                await tgMethod.sendMessageWithRetry(msg.chat.id, `2) <u>Добавление комментариев по обращению</u> реализован в двух вариантах:\n     <b>При нажатии на нужную кнопку под активным запросом.</b> Меню отображается вместе с запросом;\n     <b>При нажатии на кнопку "Ответить".</b> Кнопка отобразиться в случае добавления комментария пользователем.\n     В качестве комментария мождо добавлять фото, но только одно за раз. Учитывайте это.`)
                await tgMethod.sendMessageWithRetry(msg.chat.id, `3) <u>Изменять статус обращения:</u>\n     Для этого достаточно нажать на соответствующую кнопку выподающего меню. При указании статуса <b>"Закрыто"</b>, к данному обращению больше нельзя будет добавлять комментарии.`)
                await tgMethod.sendMessageWithRetry(msg.chat.id, `4) <u>Просматривать исторю комментариев по обращению:</u>\n     Для этого достаточно нажать на нужную кнопку выподающего меню.`)
                await tgMethod.sendMessageWithRetry(msg.chat.id, `     Запросы, созданные пользователем, автоматически появляются в данном чате, также как и добавленные комментарии.`)
            } else {
                await tgMethod.sendMessageWithRetry(msg.chat.id, `     ❓Для создания запроса или проверки статуса предыдущих вам необходимо выбрать соответствующую кнопку из меню ниже.\n     Оператор в кратчайшие сроки возьмет ваше обращение в работу!💪`)
            }
        } else if (msg.text === 'Активные запросы' && usersWithMenu.includes(msg.chat.id)){             //Все активны запросы для админа
            await adminMethod.adminRequest(msg.chat.id, 0, 0, tgMethod)
        } else if (msg.text === 'Завершенные запросы' && usersWithMenu.includes(msg.chat.id)){          //Все закрытые запросы для админа
            await adminMethod.adminRequest(msg.chat.id, 0, 1, tgMethod)
        } else if (msg.text === 'Сделать рассылку' && usersWithMenu.includes(msg.chat.id)){             //Все закрытые запросы для админа
            await adminMethod.makeNewsletter(usersWithMenu[0], clientMethod, tgMethod)
        } else if (msg.text === '✏ Создать запрос'){                                                    //Создание запроса для пользователя
            const ch = await clientMethod.getCommunicationMode(msg.chat.id)
            if(ch !== 0){
                await tgMethod.sendMessageWithRetry(msg.chat.id, `<i>У вас уже есть активный запрос. Дополнительную информацию можно оставить в качестве комментария.</i>`)
            } else {
                surveyStates.set(msg.chat.id, true);
                await clientMethod.addRequestType(msg.chat.id);
            }

        } else if (msg.text === '📋 Посмотреть предыдущие запросы'){                                      //Просмотр всех предыдущих запрсов для данного пользователя
            await requestHistory(msg.chat.id, msg.from.id);
        } else if (msg.chat.id === usersWithMenu[0] && tgMethod.isNumeric(msg.text)){                     //Поиск конкретного запроса по id для админа
            await adminMethod.searchRequestById(msg.chat.id, msg.text, tgMethod);
        }else if (msg.chat.id !== usersWithMenu[0] && !surveyStates.get(msg.chat.id) && !tgMethod.isNumeric(msg.text)){
            const ch = await clientMethod.getCommunicationMode(msg.chat.id)
            if(ch === 0){
                await tgMethod.sendMessageWithRetry(msg.chat.id, `<i>В данный момент вы не находитесь в режиме общения. Выберите активный запрос или создайте новый.</i>`)
            } else {await communicationMode(msg.chat.id, ch, msg)}
        }
    }
    catch(error) {
        console.log(error);
    }
})
//Обработчик кнопок
bot.on('callback_query', async (callbackQuery) => {
    const action = callbackQuery.data;
    console.log(action)
    if (action === 'requestHistory') {                                                                   //Просмотр всех предыдущих запрсов для данного пользователя
        await requestHistory(callbackQuery.message.chat.id, callbackQuery.from.id);
    } else if (action[0] === 'a' && action[3] === 'C') {                                                 //Добавление комментария к запросу
        const data = callbackQuery.data.split(':');
        await sendComment(callbackQuery.message.chat.id, data[1]);
    } else if (action[0] === 'h' && action[7] === 'C') {                                                 //Просмотр истории комментариев по данному запросу
        const data = callbackQuery.data.split(':');
        await viewComment(callbackQuery.message.chat.id, data[1]);
    } else if (action[0] === 'a' && action[5] === 'R') {                                                 //Просмотр запросов для администратора
        const data = callbackQuery.data.split(':');
        await adminMethod.adminRequest(callbackQuery.message.chat.id, data[1], data[2], tgMethod);
    } else if (action[0] === 'r' && action[7] === 'T') {                                                 //Дополнение информации по обращнию для пользователя
        const data = callbackQuery.data.split(':');
        const dateMsg = new Date(callbackQuery.message.date * 1000).toISOString().slice(0, 19).replace('T', ' ');
        const nowMsg = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const daysDifference = differenceInDays(nowMsg, dateMsg);
        if (daysDifference >= 2) {
            await tgMethod.sendMessageWithRetry(callbackQuery.message.chat.id, `<i>Данное меню уже не действительно. Создайте новый запрос.</i>`)
        } else {
            await bot.deleteMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id);
            const ch = await clientMethod.getCommunicationMode(callbackQuery.message.chat.id)
            if (ch !== 0) {
                await tgMethod.sendMessageWithRetry(callbackQuery.message.chat.id, `<i>У вас уже есть активный запрос. Дополнительную информацию можно оставить в качестве комментария.</i>`)
            } else {
                await addRequestAddress(callbackQuery.message.chat.id, data[1]);
            }
        }
    } else if (action[0] === 'c' && action[13] === 'M') {                                                //Включение режима общения для клиента
        const data = callbackQuery.data.split(':');
        await clientMethod.onCommunicationMode(callbackQuery.message.chat.id, data[1], tgMethod);
    }/* else if (action[0] === 'c' && action[6] === 'A' && action[11] === 'S') {                            //Изменение статуса запроса для админа
        const data = callbackQuery.data.split(':');
        await adminMethod.changeStatusRequest(callbackQuery.message.chat.id, data[1], tgMethod, clientMethod);
    }*/ else if (action[0] === 'c' && action[5] === 'A' && action[10] === 'S') {                            //Изменение статуса запроса для админа на "Закрыто"
        const data = callbackQuery.data.split(':');
        await adminMethod.closeStatusRequest(callbackQuery.message.chat.id, data[1], tgMethod, clientMethod);
    }
});
//Добавление адреса обращения
async function addRequestAddress(chatId, typeRequest){
    let data = [];
    if (typeRequest === '1'){
        data.push('Технические неполадки')
    } else if (typeRequest === '2'){
        data.push('Консультация')
    } else {
        data.push('Прочее')
    }
    await tgMethod.sendMessageWithRetry(chatId, `Напишите адрес вашей автомойки. Обязательно укажите город, улицу и дом🌏`);
    const addAddress = async (msg) => {
        if (msg.chat.id === chatId) {
            data.push(msg.text);
            bot.removeListener('message', addAddress);
            await addRequestDescription(chatId, data)
        } else {
            console.log("Ожидание нужного пользователя для добавления адреса.")
        }
    }
    bot.on('message', addAddress);
}
//Создание обращения
async function addRequestDescription(chatId, data){
    await tgMethod.sendMessageWithRetry(chatId, `Подробно опишите проблему, при необходимости прикрепите фотографию📷`);
    const protectionReq = async (msg) => {
        if (msg.chat.id === chatId) {
            if (msg.photo && msg.photo.length > 0) {
                if (msg.caption !== undefined) {
                    data.push(msg.caption)
                } else {
                    data.push('Добавлено только фото.')
                }
            } else if (msg.document) {
                if (msg.caption !== undefined) {
                    data.push(msg.caption)
                } else {
                    data.push('Добавлен только документ.')
                }
            } else if (msg.video) {
                if (msg.caption !== undefined) {
                    data.push(msg.caption)
                } else {
                    data.push('Добавлено только видео.')
                }
            } else if (msg.video_note) {
                data.push('Добавлено только видеосообщение.')
            } else if (msg.voice) {
                data.push('Добавлено только голосовое сообщение.')
            } else {
                data.push(msg.text)
            }
            const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const currentHour = moment().tz('Europe/Moscow').hours();
            const sql = 'INSERT INTO REQUEST (client_id, date, status, type, address, description, client_name, client_username, communication_mode) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id';
            const values = [
                msg.chat.id,
                currentDate,
                "В процессе",
                data[0],
                data[1],
                data[2],
                msg.chat.first_name,
                msg.chat.username,
                1
            ];

            await connection.query(sql, values, async (err, result) => {
                if (err) {
                    console.log(err);
                } else {
                    const insertId = result.rows[0].id; // Получаем ID последней вставленной записи

                    if (currentHour >= 8 && currentHour < 17) {
                        await tgMethod.sendMessageWithRetry(msg.chat.id, `Ваш запрос создан и направлен оператору.\nНомер обращения: ${insertId}, ожидайте!\nМы ответим вам в ближайшее время☺`);
                    } else {
                        await tgMethod.sendMessageWithRetry(msg.chat.id, `Спасибо за вашу заявку!\nВ данный момент рабочий день операторов закончен, они обязательно ответят вам завтра⭐\nНомер обращения: ${insertId}, ожидайте☺`);
                    }
                    await tgMethod.sendMessageWithRetry(msg.chat.id, `Теперь вы находитесь в ожидании ответа по вашему запросу. Все, что напишете сейчас, будет автоматически направлено оператору в качестве дополнительного комментария!\n Для общения по другому запросу переключитесь в меню всех обращений📩`);

                    if (msg.photo && msg.photo.length > 0) {
                        await tgMethod.addMedia(insertId, 'request', msg.photo[msg.photo.length - 1].file_id, 'photo');
                    } else if (msg.document) {
                        await tgMethod.addMedia(insertId, 'request', msg.document.file_id, 'doc');
                    } else if (msg.video) {
                        await tgMethod.addMedia(insertId, 'request', msg.video.file_id, 'video');
                    } else if (msg.video_note) {
                        await tgMethod.addMedia(insertId, 'request', msg.video_note.file_id, 'videoNote');
                    } else if (msg.voice) {
                        await tgMethod.addMedia(insertId, 'request', msg.voice.file_id, 'voice');
                    }
                    surveyStates.delete(msg.chat.id);
                    await adminMethod.addRequestAdmin(usersWithMenu[0], insertId, tgMethod);
                    /*try {
                        await axios.post(BITRIX_URL + 'tasks.task.add.json?fields[TITLE]=tes12t&fields[RESPONSIBLE_ID]=4480')
                    } catch (error) {
                        console.error('Ошибка при создании задачи в Битрикс24:', error);
                    }*/
                }
            });
            bot.removeListener('message', protectionReq);
        } else {
            console.log("Ожидание нужного пользователя для добавления описания.")
        }
    }
    bot.on('message', protectionReq);
}
//Отображение истории запросов
async function requestHistory(chatId, userId){
    const sql = 'SELECT id FROM request WHERE client_id = $1 ORDER BY date';
    await connection.query(sql, [userId], async (err, results) => {
        if (err) {
            console.error(err);
            return;
        }
        if (results.rows.length > 0) {
            const ids = results.rows.map(result => result.id).join(', ');
            await tgMethod.sendMessageWithRetry(chatId, `<i>Номера всех ваших запросов: ${ids}</i>`);
            await tgMethod.sendMessageWithRetry(chatId, `<i>Для просмотра информации или связи с оператором, выберете номер запроса:</i>`);
            const protectionReqHist = async (msg) => {
                if (msg.chat.id === chatId) {
                    await clientMethod.menuRequest(msg.chat.id, msg.text, tgMethod);
                    bot.removeListener('message', protectionReqHist);
                } else {
                    console.log("Ожидание нужного пользователя для просмотра истории.")
                }
            }
            bot.on('message', protectionReqHist);
        } else {
            // Отправляем сообщение, если запросов не найдено
            await bot.sendMessage(chatId, 'Вы еще не делали запросов.')
        }
    });
}
//Отправка комментария
async function sendComment(chatId, requestId){
    let mediaId = 0;
    await tgMethod.sendMessageWithRetry(chatId, `<i>Добавьте комментарий к запросу ${requestId}:</i> `);
    const protectionSendMes = async (msg) => {
        if (msg.chat.id === chatId) {
            let textMsg = msg.text;
            if (msg.photo && msg.photo.length > 0) {
                if (msg.caption !== undefined) {
                    textMsg = msg.caption;
                } else {
                    textMsg = 'Добавлено только фото.';
                }
            } else if (msg.document) {
                if (msg.caption !== undefined) {
                    textMsg = msg.caption
                } else {
                    textMsg = 'Добавлен только документ.'
                }
            } else if (msg.video) {
                if (msg.caption !== undefined) {
                    textMsg = msg.caption
                } else {
                    textMsg = 'Добавлено только видео.'
                }
            } else if (msg.video_note) {
                textMsg = 'Добавлено только видеосообщение.'
            } else if (msg.voice) {
                textMsg = 'Добавлено только голосовое сообщение.'
            }
            const currentDateTime = moment().tz('Europe/Moscow').format('YYYY-MM-DD HH:mm:ss');
            const sql = 'INSERT INTO message(request_id, sender, date, text) VALUES($1, $2, $3, $4) RETURNING id';
            const values = [requestId, "Оператор", currentDateTime, textMsg];

            await connection.query(sql, values, async (err, result) => {
                if (err) {
                    console.log(err);
                }
                mediaId = result.rows[0].id;
                await tgMethod.sendMessageWithRetry(msg.chat.id, `<i>Комментарий успешно добавлен!</i>`);
                if (msg.photo && msg.photo.length > 0) {
                    await tgMethod.addMedia(mediaId, 'comment', msg.photo[msg.photo.length - 1].file_id, 'photo')
                } else if (msg.document) {
                    await tgMethod.addMedia(mediaId, 'comment', msg.document.file_id, 'doc');
                } else if (msg.video){
                    await tgMethod.addMedia(mediaId, 'comment', msg.video.file_id, 'video');
                } else if (msg.video_note){
                    await tgMethod.addMedia(mediaId, 'comment', msg.video_note.file_id, 'videoNote');
                } else if (msg.voice){
                    await tgMethod.addMedia(mediaId, 'comment', msg.voice.file_id, 'voice');
                }
                if (Number(chatId) !== usersWithMenu[0]) {
                    await addCommentAnswer(usersWithMenu[0], requestId, mediaId, textMsg);
                } else {
                    const sqlClient = 'SELECT * FROM request WHERE id = $1';
                    await connection.query(sqlClient, [requestId], async (err, result) => {
                        if (err) {
                            console.log(err);
                        }
                        await addCommentAnswer(result.rows[0].client_id, requestId, mediaId, textMsg)
                    });
                }
            });
            bot.removeListener('message', protectionSendMes);
        } else {
            console.log("Ожидание нужного пользователя для добавления комментария.")
        }
    }
    bot.on('message', protectionSendMes);
}
//Режим переписки для клиента
async function communicationMode(chatId, requestId, msg){
    let mediaId = 0;
        let textMsg = msg.text;
        if (msg.photo && msg.photo.length > 0) {
            if (msg.caption !== undefined){
                textMsg = msg.caption;
            } else {
                textMsg = 'Добавлено только фото.';
            }
        } else if (msg.document) {
            if (msg.caption !== undefined) {
                textMsg = msg.caption
            } else {
                textMsg = 'Добавлен только документ.'
            }
        } else if (msg.video) {
            if (msg.caption !== undefined) {
                textMsg = msg.caption
            } else {
                textMsg = 'Добавлено только видео.'
            }
        } else if (msg.video_note) {
            textMsg = 'Добавлено только видеосообщение.'
        } else if (msg.voice) {
            textMsg = 'Добавлено только голосовое сообщение.'
        }
        const currentDateTime = moment().tz('Europe/Moscow').format('YYYY-MM-DD HH:mm:ss');
        const sql = 'INSERT INTO message(request_id, sender, date, text) VALUES($1, $2, $3, $4) RETURNING id';
        const values = [requestId, "Клиент", currentDateTime, textMsg];

        await connection.query(sql, values, async (err, result) => {
            if (err) {
                console.log(err);
            }
            mediaId = result.rows[0].id;
            if (msg.photo && msg.photo.length > 0) {
                await tgMethod.addMedia(mediaId, 'comment', msg.photo[msg.photo.length - 1].file_id, 'photo')
            } else if (msg.document) {
                await tgMethod.addMedia(mediaId, 'comment', msg.document.file_id, 'doc');
            } else if (msg.video){
                await tgMethod.addMedia(mediaId, 'comment', msg.video.file_id, 'video');
            } else if (msg.video_note){
                await tgMethod.addMedia(mediaId, 'comment', msg.video_note.file_id, 'videoNote');
            } else if (msg.voice){
                await tgMethod.addMedia(mediaId, 'comment', msg.voice.file_id, 'voice');
            }
            if (Number(chatId) !== usersWithMenu[0]) {
                await addCommentAnswer(usersWithMenu[0], requestId, mediaId, textMsg);
            } else {
                const sqlClient = 'SELECT client_id FROM request WHERE id = $1';
                await connection.query(sqlClient, [requestId], async (err, result) => {
                    if (err) {
                        console.log(err);
                    }
                    await addCommentAnswer(result.rows[0].client_id, requestId, mediaId, textMsg)
                });
            }
        });
}
//Дополнение к комментарию на стороне отвечающего для возможности ответить сразу
async function addCommentAnswer(chatId, requestId, commentId, text){
    let sender = 'Клиент'
    if (Number(chatId) !== usersWithMenu[0]){
        sender = 'Оператор'
    }
    await tgMethod.sendMessageWithRetry(chatId, `<b>${sender} добавил комментарий к запросу ${requestId}:</b>\n <i>${text}</i>`)
    await tgMethod.sendMedia(chatId, commentId, "comment");
    if(sender === 'Клиент') {
        await bot.sendMessage(chatId,
            `Нажмите, чтобы отправить ответ:`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            {text: 'Ответить', callback_data: `addComment:${requestId}`}
                        ]
                    ]
                }
            }
        )
    }
}

//Отображение истории комментариев по обращению
async function viewComment(chatId, request_id){
    const sql = 'SELECT * FROM message WHERE request_id = $1 ORDER BY date';
    await connection.query(sql, [request_id], async (err, results) => {
        if (results.rows.length > 0) {
            await tgMethod.sendMessageWithRetry(chatId, `<b>История комментариев по запросу ${request_id}:</b>`)
            let delayMs = 1000;
            for (const [index, item] of results.rows.entries()) {
                await tgMethod.delay(delayMs*index);
                console.log(item)
                try {
                    const messageText = `<b>${item.date.toLocaleString()}\n ${item.sender}:</b> \n <i>${item.text}</i>`;
                    await tgMethod.sendMessageWithRetry(chatId, messageText);
                    await tgMethod.sendMedia(chatId, item.id, "comment");
                } catch (error) {
                    if (error.response && error.response.status === 429 && error.response.status === 428) {
                        delayMs += 1000; // Увеличиваем задержку на 1 секунду при получении ошибки 429
                    }
                }
            }
            await tgMethod.sendMessageWithRetry(chatId, `<i>Конец истории комментариев.</i>`);
        } else {
            await tgMethod.sendMessageWithRetry(chatId, `<i>Комментариев по запросу ${request_id} нету.</i>`);
        }
        if (Number(chatId) !== usersWithMenu[0]) {
            await clientMethod.menuRequest(chatId, request_id, tgMethod);
        }
    });
}