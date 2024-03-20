import bot from "./connection";
import connection from "../db";

class TgMethod {
//Проверка строки на число
    isNumeric(str) {
        if (typeof str != "string") return false // Убедитесь, что передана строка
        return !isNaN(str) && !isNaN(parseFloat(str)) // Проверьте, является ли строка числом
    }

//Отправка сообщений с options и повторная отправка при ошибке
    async sendMessageWithRetry(chatId, messageText, retryCount = 3) {
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
                await this.sendMessageWithRetry(chatId, messageText, retryCount - 1);
            } else {
                console.error('Достигнуто максимальное количество попыток. Сообщение не было отправлено.');
            }
        }
    }

//Преобразование даты
    async formatDate(dateString) {
        const date = new Date(dateString);

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Плюс 1, так как месяцы начинаются с 0
        const year = date.getFullYear();

        return `${day}.${month}.${year}`;
    }

//Задержка при отправки сообщений
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    //Добавление медиа в БД
    async addMedia(owner_id, type, url, filling){
        const sql = 'INSERT INTO media(owner_id, type, url, filling) VALUES($1, $2, $3, $4)';
        await connection.query(sql, [owner_id, type, url, filling], async (err) => {
            if (err) console.log(err);
        });
    }
    //Отправка фото пользователю
    async sendMedia(chatId, requestId, status){
        console.log(chatId, requestId, status)
        const sqlMedia = 'SELECT * FROM media WHERE owner_id = $1 AND type = $2';
        const mediaResults = await new Promise(async (resolve, reject) => {
            await connection.query(sqlMedia, [requestId, status], async (err, results) => {
                console.log(results)
                if (err) {
                    reject(err);
                } else {
                    resolve(results);
                }
            });
        });
        if (mediaResults.rows.length > 0) {
            if(mediaResults.rows[0].filling === 'photo') {
                await bot.sendPhoto(chatId, mediaResults.rows[0].url, {caption: "Приложенное фото."});
                await new Promise(resolve => setTimeout(resolve, 1000)); // Задержка в миллисекундах
            } else if(mediaResults.rows[0].filling === 'doc') {
                await bot.sendDocument(chatId, mediaResults.rows[0].url, {caption: "Приложенный документ."});
                await new Promise(resolve => setTimeout(resolve, 1000)); // Задержка в миллисекундах
            } else if(mediaResults.rows[0].filling === 'video') {
                await bot.sendVideo(chatId, mediaResults.rows[0].url, {caption: "Приложенное видео."});
                await new Promise(resolve => setTimeout(resolve, 1000)); // Задержка в миллисекундах
            } else if(mediaResults.rows[0].filling === 'videoNote') {
                await bot.sendVideo(chatId, mediaResults.rows[0].url, {caption: "Приложенное видеосообщение."});
                await new Promise(resolve => setTimeout(resolve, 1000)); // Задержка в миллисекундах
            } else if(mediaResults.rows[0].filling === 'voice') {
                await bot.sendVoice(chatId, mediaResults.rows[0].url, {caption: "Приложенное голосовое сообщение."});
                await new Promise(resolve => setTimeout(resolve, 1000)); // Задержка в миллисекундах
            }
        }
    }
}

export default TgMethod;
