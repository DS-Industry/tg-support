const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();
const moment = require('moment-timezone');
const { Pool } = require('pg');

const API_KEY_BOT = process.env.API_KEY_BOT;
const BITRIX_URL = process.env.BITRIX_URL;
const usersWithMenu = [Number(process.env.ADMIN)];
let surveyStates = new Map();

const connection = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

connection.query('CREATE TABLE IF NOT EXISTS MESSAGE (ID SERIAL PRIMARY KEY, REQUEST_ID INTEGER, SENDER TEXT, DATE TIMESTAMP, TEXT TEXT)');
connection.query('CREATE TABLE IF NOT EXISTS REQUEST (ID SERIAL PRIMARY KEY, CLIENT_ID TEXT, DATE TIMESTAMP, STATUS TEXT, TYPE TEXT, DESCRIPTION TEXT, CLIENT_NAME TEXT, CLIENT_USERNAME TEXT, COMMUNICATION_MODE INTEGER)');
connection.query('CREATE TABLE IF NOT EXISTS PHOTO (ID SERIAL PRIMARY KEY, OWNER_ID INTEGER, TYPE TEXT, URL TEXT)');

const bot = new TelegramBot(API_KEY_BOT, {
    polling: true
})
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
bot.on('text', async msg => {
    try {
        if(msg.text === '/start') {                                                                     //Запуск
            if (usersWithMenu.includes(msg.chat.id)){                                                   //Проверка на статус админ
                await menuAdminMainFixed(msg.chat.id, '     Добро пожаловать в админский чат онлайн-поддержки компании Мойка DS! 🚙✨')
            } else {
                await menuMainFixed(msg.chat.id, 'Добро пожаловать в онлайн-поддержку компании Мойка DS! 🚙✨ Я бот технической поддержки и готов помочь вам с любыми вопросами. Создать обращение можно при помощи закрепленного меню. Пожалуйста, не стесняйтесь задавать вопросы или описывать проблемы – мы сделаем все возможное, чтобы помочь вам оперативно и качественно. Спасибо, что выбрали нас! 💬🛠️')
            }
        } else if(msg.text === '/help') {                                                               //Заздел помощи
            if (usersWithMenu.includes(msg.chat.id)){
                await sendMessageWithRetry(msg.chat.id, `     Вы работаете в админском чате по работе с обращниями клиентов. Вам доступны следующие функции:`)
                await sendMessageWithRetry(msg.chat.id, `1) <u>Поиск и просмотр обращений</u> реализован в двух вариантах:\n     <b>Поиск конкретного обращения по номеру.</b> Для этого достаточно отправить сообщением номер нужного запроса;\n     <b>Просмотр истории обращений.</b> К строке чата прикреплено меню: <b>Активные запросы</b> - обращения, которые находятся в работе; <b>Завершенные запросы</b> - обращения со статусом "Закрыто". При таком поиске обращения будут показываться по 3 шт за раз по дате создания.\n     Для поиска обращения рекомендуется использовать первый вариант, так как при большом количестве обращений просмотр истории может затянуться.`)
                await sendMessageWithRetry(msg.chat.id, `2) <u>Добавление комментариев по обращению</u> реализован в двух вариантах:\n     <b>При нажатии на нужную кнопку под активным запросом.</b> Меню отображается вместе с запросом;\n     <b>При нажатии на кнопку "Ответить".</b> Кнопка отобразиться в случае добавления комментария пользователем.\n     В качестве комментария мождо добавлять фото, но только одно за раз. Учитывайте это.`)
                await sendMessageWithRetry(msg.chat.id, `3) <u>Изменять статус обращения:</u>\n     Для этого достаточно нажать на соответствующую кнопку выподающего меню. При указании статуса <b>"Закрыто"</b>, к данному обращению больше нельзя будет добавлять комментарии.`)
                await sendMessageWithRetry(msg.chat.id, `4) <u>Просматривать исторю комментариев по обращению:</u>\n     Для этого достаточно нажать на нужную кнопку выподающего меню.`)
                await sendMessageWithRetry(msg.chat.id, `     Запросы, созданные пользователем, автоматически появляются в данном чате, также как и добавленные комментарии.`)
            } else {
                await sendMessageWithRetry(msg.chat.id, `Вы находитесь в чате технической поддрежки МойКа DS💧🚙\n`)
                await sendMessageWithRetry(msg.chat.id, `❓Для того, чтобы обратиться за помощью к нашим операторам, вам достаточно открыть закрепленное меню и нажать нужную кнопку! Также вы можете просматривать свои прошлые обращения и давать комментарии по ним.`)
                await sendMessageWithRetry(msg.chat.id, `Наши операторы в кратчайшие сроки обработают заявку и дадут обратную связь💪`)
            }
        } else if (msg.text === 'Активные запросы' && usersWithMenu.includes(msg.chat.id)){             //Все активны запросы для админа
            await adminRequest(msg.chat.id, 0, 0)
        } else if (msg.text === 'Завершенные запросы' && usersWithMenu.includes(msg.chat.id)){          //Все закрытые запросы для админа
            await adminRequest(msg.chat.id, 0, 1)
        } else if (msg.text === 'Сделать рассылку' && usersWithMenu.includes(msg.chat.id)){          //Все закрытые запросы для админа
            await makeNewsletter()
        } else if (msg.text === '✏ Создать запрос'){
            surveyStates.set(msg.chat.id, true);                                                             //Создание запроса для пользователя
            const ch = await getCommunicationMode(msg.chat.id)
            if(ch !== 0){await changeCommunicationMode(ch, 0)}
            await addRequestType(msg.chat.id);
        }else if (msg.text === '📋 Посмотреть предыдущие запросы'){                                      //Просмотр всех предыдущих запрсов для данного пользователя
            await requestHistory(msg.chat.id, msg.from.id);
        }else if (msg.chat.id === usersWithMenu[0] && isNumeric(msg.text)){                              //Поиск конкретного запроса по id для админа
            const sql = 'SELECT * FROM request WHERE id = $1';
            await connection.query(sql, [msg.text], async (err, result) => {
                if (err) {
                    console.error('Ошибка выполнения запроса:', err);
                } else {
                    if (result.rows.length > 0) {
                        const row = result.rows[0];
                        await showAdminRequest(
                            msg.chat.id,
                            msg.text,
                            row.status,
                            row.client_name,
                            row.type,
                            row.description,
                            row.client_username,
                            row.date
                        );
                    } else {
                        await sendMessageWithRetry(msg.chat.id, `<i>Запроса с таким номером нету.</i>`);
                    }
                }
            });
        }else if (msg.chat.id !== usersWithMenu[0] && !surveyStates.get(msg.chat.id) && !isNumeric(msg.text)){
            const ch = await getCommunicationMode(msg.chat.id)
            if(ch === 0){
                await sendMessageWithRetry(msg.chat.id, `<i>В данный момент вы не находитесь в режиме общения. Выберите активный запрос или создайте новый.</i>`)
            } else {await communicationMode(msg.chat.id, ch, msg)}
        }
    }
    catch(error) {
        console.log(error);
    }
})

bot.on('photo', async msg => {
    try {
        if (msg.chat.id !== usersWithMenu[0] && !surveyStates.get(msg.chat.id)){
            const ch = await getCommunicationMode(msg.chat.id)
            if(ch === 0){
                await sendMessageWithRetry(msg.chat.id, `<i>В данный момент вы не находитесь в режиме общения. Выберите активный запрос или создайте новый.</i>`)
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
        await adminRequest(callbackQuery.message.chat.id, data[1], data[2]);
    } else if (action[0] === 'r' && action[7] === 'T') {                                                 //Дополнение информации по обращнию для пользователя
        const data = callbackQuery.data.split(':');
        await addRequestDescription(callbackQuery.message.chat.id, data[1]);
    } else if (action[0] === 'c' && action[13] === 'M') {                                                //Включение режима общения для клиента
        const data = callbackQuery.data.split(':');
        const ch = await getCommunicationMode(callbackQuery.message.chat.id)
        if(Number(data[1]) === ch){
            await sendMessageWithRetry(callbackQuery.message.chat.id, `<i>Вы уже находитесь в режиме общения для этого запроса.</i>`);
        } else {
            await changeCommunicationMode(ch, 0)
            await changeCommunicationMode(data[1], 1)
            await sendMessageWithRetry(callbackQuery.message.chat.id, `<i>Теперь вы находитесь в режиме общения для запроса ${data[1]}.</i>`)
        }
    } else if (action[0] === 'c' && action[6] === 'A' && action[11] === 'S') {                            //Изменение статуса запроса для админа
        const data = callbackQuery.data.split(':');
        await bot.sendMessage(callbackQuery.message.chat.id, `Напишите новый статус для запроса ${data[1]}: `);
        bot.once('message', async (msg) => {
            const sql = 'UPDATE request SET status = $1 WHERE id = $2 ';
            await connection.query(sql, [msg.text, data[1]], async (err) => {
                if (err) {
                    console.log(err);
                }
                await sendMessageWithRetry(msg.chat.id, `<i>Статус изменен</i>`);
                await changeCommunicationMode(data[1], 0)
                if (msg.text === 'Закрыто') {
                    const sqlClient = 'SELECT client_id FROM request WHERE id = $1';
                    await connection.query(sqlClient, [data[1]], async (err, result) => {
                        if (err) {
                            console.log(err);
                        }
                        const clientID = result.rows[0].client_id;
                        await sendMessageWithRetry(clientID, `<i>Оператор перевел обращение ${data[1]} в статус завершенных. Режим общения закрыт для данного запроса.</i>`);
                    });
                }
            });
        });
    }
});

//Проверка строки на число
function isNumeric(str) {
    if (typeof str != "string") return false // Убедитесь, что передана строка
    return !isNaN(str) && !isNaN(parseFloat(str)) // Проверьте, является ли строка числом
}

//Отправка сообщений с options и повторная отправка при ошибке
async function sendMessageWithRetry(chatId, messageText, retryCount = 3) {
    const options = {
        parse_mode: "HTML"
    };
    try {
        await bot.sendMessage(chatId, messageText, options);
    } catch (err) {
        console.error('Ошибка при отправке сообщения:', err);
        // Повторяем попытку отправки, если не достигнуто максимальное количество попыток
        if (retryCount > 0) {
            console.log(`Повторная попытка отправки сообщения. Осталось попыток: ${retryCount}`);
            await sendMessageWithRetry(chatId, messageText, retryCount - 1);
        } else {
            console.error('Достигнуто максимальное количество попыток. Сообщение не было отправлено.');
        }
    }
}

//Преобразование даты
async function formatDate(dateString){
    const date = new Date(dateString);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Плюс 1, так как месяцы начинаются с 0
    const year = date.getFullYear();

    return `${day}.${month}.${year}`;
}

//Задержка при отправки сообщений
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getCommunicationMode(clientId) {
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
async function changeCommunicationMode(requestId, communicationMode){
    const sql = 'UPDATE request SET communication_mode = $1 WHERE id = $2 ';
    await connection.query(sql, [communicationMode, requestId], async (err) => {
        if (err) {
            console.log(err);
        }
    });
}

async function getAllClient(){
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

//Добавление фото в БД
async function addPhoto(owner_id, type, url){
    const sql = 'INSERT INTO photo(owner_id, type, url) VALUES($1, $2, $3)';
    await connection.query(sql, [owner_id, type, url], async (err) => {
        if (err) console.log(err);
    });
}

//Отправка фото пользователю
async function sendPhoto(chatId, requestId, status){
    console.log(chatId, requestId, status)
    const sqlPhoto = 'SELECT * FROM photo WHERE owner_id = $1 AND type = $2';
    const photoResults = await new Promise(async (resolve, reject) => {
        await connection.query(sqlPhoto, [requestId, status], async (err, results) => {
            console.log(results)
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
    if (photoResults.rows.length > 0) {
        await bot.sendPhoto(chatId, photoResults.rows[0].url, { caption: "Приложенное фото." });
        await new Promise(resolve => setTimeout(resolve, 1000)); // Задержка в миллисекундах
    }
}

//Фиксированное меню для пользователя
async function  menuMainFixed(chatId, text){
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

//Фиксированное меню для админа
async function menuAdminMainFixed(chatId, text){
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

//Выпадающее меню к активному обращению для администратора
async function menuAdminRequestActive(chatId, text){
    await bot.sendMessage(chatId,
        `Выберите действие для запроса ${text}:`, {
            reply_markup: {
                inline_keyboard: [
                    [
                        {text: 'Добавить комментарий', callback_data: `addComment:${text}`}],
                        [{text: 'Посмотреть все комментарии', callback_data: `historyComment:${text}`}],
                        [{text: 'Изменить статус запроса', callback_data: `changeAdminStatus:${text}`}
                    ]
                ]
            }
        }
    )
}

//Выпадающее меню к закрытому обращению для администратора
async function menuAdminRequestClose(chatId, text){
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
}

//Варианты типа обращения
async function addRequestType(chatId){
    await bot.sendMessage(chatId, `Введите тип проблемы: `,  {
        reply_markup: {
            inline_keyboard: [
                [{text: '⚙ Технические неполадки', callback_data: `requestType:1`}],
                [{text: '📒 Консультация', callback_data: `requestType:2`}],
                [{text: 'Прочее', callback_data: `requestType:3`}]
            ]
        }
    });
}

//Создание обращения
async function addRequestDescription(chatId, typeRequest){
    let data = [];
    if (typeRequest === '1'){
        data.push('Технические неполадки')
    } else if (typeRequest === '2'){
        data.push('Консультация')
    } else {
        data.push('Прочее')
    }
    await sendMessageWithRetry(chatId, `Подробно опишите проблему одним текстовым сообщением💬\n При необходимости добавьте фотографию📷`);
    bot.once('message', async (msg) => {
        if (msg.photo && msg.photo.length > 0) {
            if (msg.caption !== undefined) {
                data.push(msg.caption)
            } else {
                data.push('Добавлено только фото.')
            }
        } else {
            data.push(msg.text)
        }
        const currentDate = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const currentHour = moment().tz('Europe/Moscow').hours();
        const sql = 'INSERT INTO REQUEST (client_id, date, status, type, description, client_name, client_username, communication_mode) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id';
        const values = [
            msg.chat.id,
            currentDate,
            "В процессе",
            data[0],
            data[1],
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
                    await sendMessageWithRetry(msg.chat.id, `Ваш запрос создан и уже направлен оператору! Мы ответим вам в кратчайшие сроки⚡⚡⚡\nНомер обращения: ${insertId}, ожидайте☺`);
                } else {
                    await sendMessageWithRetry(msg.chat.id, `Спасибо за вашу заявку! В данный момент рабочий день операторов закончен, они обязательно ответят вам завтра⭐\nНомер обращения: ${insertId}, ожидайте☺`);
                }
                await sendMessageWithRetry(msg.chat.id, `Теперь вы находитесь в режиме общения для данного запроса и все, что напишите, будет автоматически направлено оператору в качестве дополнительного комментария! Если захотите продолжить общение по другому запросу, то сможете переключится в меню всех обращений📩`);

                if (msg.photo && msg.photo.length > 0) {
                    await addPhoto(insertId, 'request', msg.photo[msg.photo.length - 1].file_id);
                }
                surveyStates.delete(msg.chat.id);
                await addRequestAdmin(usersWithMenu[0], insertId);
                try {
                    await axios.post(BITRIX_URL + 'tasks.task.add.json?fields[TITLE]=test&fields[RESPONSIBLE_ID]=4480')
                } catch (error) {
                    console.error('Ошибка при создании задачи в Битрикс24:', error);
                }
            }
        });
    })
}

//Отправка нового запроса адину
async function addRequestAdmin(chatId, request_id){
    const sql = 'SELECT * FROM REQUEST WHERE ID = $1';
    await connection.query(sql, [request_id], async function (err, result) {
        await sendMessageWithRetry(chatId, `<b>Добавлен новый запрос:</b>`)
        await showAdminRequest(chatId, request_id, result.rows[0].status, result.rows[0].client_name, result.rows[0].type, result.rows[0].description, result.rows[0].client_username, result.rows[0].date);
    });
}

//Отображение обращения на стороне администратора
async function showAdminRequest(chatId, requestId, status, clientName, type, description, clientUsername, date) {
    const formattedDate = await formatDate(date);
    const messageText = `<b>Номер запроса:</b> ${requestId}\n<b>Тип проблемы: </b>${type}\n<b>Дата создания: </b>${formattedDate}\n<b>Статус: </b>${status}\n<b>Имя клиента: </b>${clientName}\n<b>Ник клиента: </b>${clientUsername}\n<b>Описание: </b>${description}\n`;

    await sendMessageWithRetry(chatId, messageText);
    await sendPhoto(chatId, requestId, "request");

    if(status === 'Закрыто'){
        await menuAdminRequestClose(chatId, requestId)
    } else {
        await menuAdminRequestActive(chatId, requestId);
    }
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
            await sendMessageWithRetry(chatId, `<i>Номера всех ваших запросов: ${ids}</i>`);
            await sendMessageWithRetry(chatId, `<i>Для просмотра информации или связи с оператором, напишите номер запроса:</i>`);
            bot.once('message', (msg) => {
                menuRequest(msg.chat.id, msg.text);
            });
        } else {
            // Отправляем сообщение, если запросов не найдено
            await bot.sendMessage(chatId, 'Вы еще не делали запросов.')
        }
    });
}

//Выпадающее меню для обращения у пользователя
async function menuRequest(chatId, text){
    const sql = 'SELECT * FROM request WHERE client_id = $1 AND id = $2';
    await connection.query(sql, [chatId, text], async (err, result) => {
        if (result.rows.length > 0) {
            const formattedDate = await formatDate(result.rows[0].date);
            const messageText = `<b>Номер запроса:</b> ${result.rows[0].id}\n<b>Статус: </b>${result.rows[0].status}\n<b>Дата создания: </b>${formattedDate}\n<b>Тип проблемы: </b>${result.rows[0].type}\n<b>Описание: </b>${result.rows[0].description}\n`;
            await sendMessageWithRetry(chatId, messageText);
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

//Вывод всех запросов для админа с учетом статуса обращения
async function adminRequest(chatId, check, checkStatus){
    let inequality = '!'
    let stringStatus = 'Активные'
    if (Number(checkStatus) === 1){
        inequality = ''
        stringStatus = 'Завершенные'
    }
    const sql = `SELECT * FROM request WHERE status ${inequality}= $1 ORDER BY id`;
    await connection.query(sql, ["Закрыто"], async function (err, results) {
        if (results.rows.length > 0) {
            if (check === 0) {
                await sendMessageWithRetry(chatId, `<b>${stringStatus} запросы:</b>`)
            }
            if (check !== 0) {
                check = results.rows.findIndex(item => item.id === Number(check));
            }
            let delayMs = 5000;
            for (const [index, item] of results.rows.slice(check, check+3).entries()) {
                await delay(delayMs*index); // Умножаем индекс на 1000, чтобы увеличивать задержку для каждой итерации
                try {
                await showAdminRequest(
                    chatId,
                    item.id,
                    item.status,
                    item.client_name,
                    item.type,
                    item.description,
                    item.client_username,
                    item.date
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
                await sendMessageWithRetry(chatId, `<i>${stringStatus} запросы закончились.</i>`)
            }
        } else {
            await bot.sendMessage(chatId, `${stringStatus} запросы остутсвуют.`);
        }
    });
}
//Отправка комментария
async function sendComment(chatId, requestId){
    let photoId = 0;
    await sendMessageWithRetry(chatId, `<i>Добавьте комментарий к запросу ${requestId}:</i> `);
    bot.once('message', async (msg) => {
        let textMsg = msg.text;
        if (msg.photo && msg.photo.length > 0) {
            if (msg.caption !== undefined) {
                textMsg = msg.caption;
            } else {
                textMsg = 'Добавлено только фото.';
            }
        }
        const currentDateTime = moment().tz('Europe/Moscow').format('YYYY-MM-DD HH:mm:ss');
        const sql = 'INSERT INTO message(request_id, sender, date, text) VALUES($1, $2, $3, $4) RETURNING id';
        const values = [requestId, "Оператор", currentDateTime, textMsg];

        await connection.query(sql, values, async (err, result) => {
            if (err) {
                console.log(err);
            }
            photoId = result.rows[0].id;
            await sendMessageWithRetry(msg.chat.id, `<i>Комментарий успешно добавлен!</i>`);
            if (msg.photo && msg.photo.length > 0) {
                await addPhoto(photoId, 'comment', msg.photo[msg.photo.length - 1].file_id)
            }
            if (Number(chatId) !== usersWithMenu[0]) {
                await addCommentAnswer(usersWithMenu[0], requestId, photoId, textMsg);
            } else {
                const sqlClient = 'SELECT * FROM request WHERE id = $1';
                await connection.query(sqlClient, [requestId], async (err, result) => {
                    if (err) {
                        console.log(err);
                    }
                    await addCommentAnswer(result.rows[0].client_id, requestId, photoId, textMsg)
                });
            }
        });
    });
}
//Режим переписки для клиента
async function communicationMode(chatId, requestId, msg){
    let photoId = 0;
        let textMsg = msg.text;
        if (msg.photo && msg.photo.length > 0) {
            if (msg.caption !== undefined){
                textMsg = msg.caption;
            } else {
                textMsg = 'Добавлено только фото.';
            }
        }
        const currentDateTime = moment().tz('Europe/Moscow').format('YYYY-MM-DD HH:mm:ss');
        const sql = 'INSERT INTO message(request_id, sender, date, text) VALUES($1, $2, $3, $4) RETURNING id';
        const values = [requestId, "Клиент", currentDateTime, textMsg];

        await connection.query(sql, values, async (err, result) => {
            if (err) {
                console.log(err);
            }
            photoId = result.rows[0].id;
            if (msg.photo && msg.photo.length > 0) {
                await addPhoto(photoId, 'comment', msg.photo[msg.photo.length-1].file_id)
            }
            if (Number(chatId) !== usersWithMenu[0]) {
                await addCommentAnswer(usersWithMenu[0], requestId, photoId, textMsg);
            } else {
                const sqlClient = 'SELECT client_id FROM request WHERE id = $1';
                await connection.query(sqlClient, [requestId], async (err, result) => {
                    if (err) {
                        console.log(err);
                    }
                    await addCommentAnswer(result.rows[0].client_id, requestId, photoId, textMsg)
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
    await sendMessageWithRetry(chatId, `<b>${sender} добавил комментарий к запросу ${requestId}:</b>\n <i>${text}</i>`)
    await sendPhoto(chatId, commentId, "comment");
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
            await sendMessageWithRetry(chatId, `<b>История комментариев по запросу ${request_id}:</b>`)
            let delayMs = 1000;
            for (const [index, item] of results.rows.entries()) {
                await delay(delayMs*index);
                console.log(item)
                try {
                    const messageText = `<b>${item.date.toLocaleString()}\n ${item.sender}:</b> \n <i>${item.text}</i>`;
                    await sendMessageWithRetry(chatId, messageText);
                    await sendPhoto(chatId, item.id, "comment");
                } catch (error) {
                    if (error.response && error.response.status === 429 && error.response.status === 428) {
                        delayMs += 1000; // Увеличиваем задержку на 1 секунду при получении ошибки 429
                    }
                }
            }
            await sendMessageWithRetry(chatId, `<i>Конец истории комментариев.</i>`);
            if (Number(chatId) !== usersWithMenu[0]) {
                await menuRequest(chatId, request_id);
            }
        } else {
            await sendMessageWithRetry(chatId, `<i>Комментариев по запросу ${request_id} нету.</i>`);
            if (Number(chatId) !== usersWithMenu[0]) {
                await menuRequest(chatId, request_id);
            }
        }
    });
}

async function makeNewsletter(){
    const clients = await getAllClient()
    if(clients.length > 0){
        await sendMessageWithRetry(usersWithMenu[0], `<i>Напишите текст и вставьте фото для создания рассылки:</i>`);
        bot.once('message', async (msg) => {
            if (msg.photo && msg.photo.length > 0) {
                if (msg.caption !== undefined){
                    for (const [index, item] of clients.entries()) {
                        await bot.sendPhoto(item, msg.photo[msg.photo.length-1].file_id, { caption: msg.caption });
                    }
                } else {
                    for (const [index, item] of clients.entries()) {
                        await bot.sendPhoto(item, msg.photo[msg.photo.length-1].file_id);
                    }
                }
            } else {
                for (const [index, item] of clients.entries()) {
                    await sendMessageWithRetry(item, msg.text);
                }
            }
            await sendMessageWithRetry(usersWithMenu[0], `<i>Готово!</i>`);
        })
    } else {
        await sendMessageWithRetry(usersWithMenu[0], `<i>Клиентов, сделавших обращение, нету.</i>`);
    }
}


