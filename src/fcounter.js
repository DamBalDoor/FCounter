const fs = require('fs').promises;
const path = require('path');

/*
Заметки:

# Структура строк в файле:
{Номер_строки} | [{Дата_и_время_добавления}] | {Данные_в_формате_JSON}
1 | 2024-01-01T00:00:00.000Z | {"key":"value"}


 */

class FCounter {
	/**
	 *
	 * @param filePath Путь до json файла.
	 */
	constructor(filePath) {
		this.filePath = this._ensureJsonExtension(filePath);

		this._createFileIfNotExists(this.filePath);

		this._cache = null;  // Кэш данных
	}

	// ========== PRIVATE METHODS ==========
	
	/**
	 * Метод для проверки, что файл имеет расширение .json
	 *
	 * @param filePath - путь до файла.
	 * @return {string} - путь с гарантированным расширением .json
	 * @private
	 */
	_ensureJsonExtension(filePath) {
		if (path.extname(filePath).toLowerCase() !== '.json') {
			throw new Error(`Файл должен иметь расширение .json. Путь: "${filePath}"`);
		}
		return filePath;
	}

	/**
	 * Метод для проверки наличия файла
	 *
	 * @param filePath - путь до файла.
	 * @return {boolean}
	 * @private
	 */
	async _fileExists(filePath) {
		try {
			await fs.access(filePath);
			return true;
		} catch (err) {
			return false;
		}
	}

	/**
	 * Метод для проверки наличия файла и создания его в случае отсутствия
	 *
	 * @param filePath
	 * @return {boolean} true - если файла нет и он был создан, false - если файл уже существует
	 * @private
	 */
	async _createFileIfNotExists(filePath) {
		if (!await this._fileExists(filePath)) {
			try {
				const dir = path.dirname(filePath);
				if (!await this._fileExists(dir)) {
					await fs.mkdir(dir, { recursive: true });
				}
				await fs.writeFile(filePath, JSON.stringify([]));
				console.log(`Файл "${filePath}" создан.`);
			} catch (err) {
				console.error("Ошибка при создании файла:", err);
			}
		} else {
			console.log(`Файл "${filePath}" уже существует.`);
		}
	}

	// ========== PUBLIC METHODS ==========
	
	/**
	 * Метод для записи данных в JSON-файл
	 *
	 * @param newData - объект, который нужно добавить в файл
	 *
	 * @return {boolean}
	 */
	async writeRecord(newData = null) {
		try {
			const data = await this.getAllRecords();

			// Определяем следующий id
			const maxId = data.reduce((max, item) => item.id > max ? item.id : max, 0);
			const newId = maxId + 1;

			// Создаем новый объект с автоматически выставленным id
			const newItem = {
				id: newId,
				created: new Date().toISOString(),
				data: newData
			};
			data.push(newItem);

			// Кешируем новые данные
			this._cache = data;

			// Записываем обновленный массив обратно в файл
			await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
			console.log(`Данные записаны в файл "${this.filePath}".`);

			return true;
		} catch (err) {
			console.error("Ошибка при записи в файл:", err);
			this._cache = null
			return false;
		}
	}

	
	/**
	 * Метод для чтения данных из JSON-файла
	 *
	 * @return {Array}
	 */
	async getAllRecords() {
		if (this._cache) {
			console.log("Возвращаю данные из кэша.");
			return this._cache;
		}
		try {
			const data = await fs.readFile(this.filePath, 'utf8');
			this._cache = JSON.parse(data);
			return this._cache;
		} catch (err) {
			console.error("Ошибка при чтении файла:", err);
			return [];
		}
	}

	/**
	 * Метод для получения количества записей в JSON-файле
	 *
	 * @return {number}
	 */
	async getCountJSON() {
		const data = await this.getAllRecords();
		return data.length;
	}

	/**
	 * Метод для получения первой записи из JSON-файла
	 *
	 * @return {Object|null} - Первая запись или null, если файл пуст
	 */
	async getFirstRecord() {
		try {
			const data = await this.getAllRecords();
			if (data.length > 0) {
				return data[0];
			} else {
				console.log("Файл пуст, нет записей.");
				return null;
			}
		} catch (err) {
			console.error("Ошибка при получении первой записи:", err);
			return null;
		}
	}

	/**
	 * Метод для получения последней записи из JSON-файла
	 *
	 * @return {Object|null} - Последняя запись или null, если файл пуст
	 */
	async getLastRecord() {
		try {
			const data = await this.getAllRecords();
			if (data.length > 0) {
				return data[data.length - 1];
			} else {
				console.log("Файл пуст, нет записей.");
				return null;
			}
		} catch (err) {
			console.error("Ошибка при получении последней записи:", err);
			return null;
		}
	}


	/**
	 * Метод для поиска записи по id
	 *
	 * @param {number} id - id записи для поиска
	 * @return {Object|null} - Запись с указанным id или null, если запись не найдена
	 */
	async findRecordById(id) {
		try {
			const data = await this.getAllRecords();
			return data.find(item => item.id === id) || null;
		} catch (err) {
			console.error("Ошибка при поиске записи по id:", err);
			return null;
		}
	}

	/**
	 * Метод для поиска записей по дате
	 *
	 * Принимает даже часть даты, т.е.
	 * 1. Если передать "2024" - найдет все записи за 2024 год
	 * 2. Если передать "2024-01" - найдет все записи за 2024 год в месяц
	 * 3. Если передать "2024-01-01" - найдет все записи за 2024 год в месяц в день
	 * 5. Если передать "2024-01-01T00" - найдет все записи за 2024 год в месяц в день в час
	 * И т.д.
	 *
	 * @param {String} date - Дата в формате ISO для фильтрации записей (YYYY-MM-DDTHH:MM:SS)
	 * @return {Array} - Массив записей, добавленных в указанную дату
	 */
	async findRecordsByDate(date) {
		try {
			const data = await this.getAllRecords();
			return data.filter(item => item.created.startsWith(date));
		} catch (err) {
			console.error("Ошибка при поиске записей по дате:", err);
			return [];
		}
	}

	/**
	 * Метод для поиска записей, содержащих определенные данные
	 *
	 * @param {String} keyword - Ключевое слово для поиска в поле data
	 * @return {Array} - Массив записей, содержащих ключевое слово
	 */
	async findRecordsByData(keyword) {
		try {
			const data = await this.getAllRecords();
			return data.filter(item => JSON.stringify(item.data).includes(keyword));
		} catch (err) {
			console.error("Ошибка при поиске записей по содержимому:", err);
			return [];
		}
	}

	/**
	 * Метод для поиска записей по диапазону дат
	 *
	 * @param {String} startDateTime - Начало диапазона в формате ISO (YYYY-MM-DDTHH:MM:SS)
	 * @param {String} endDateTime - Конец диапазона в формате ISO (YYYY-MM-DDTHH:MM:SS)
	 * @return {Array} - Массив записей в указанном диапазоне дат
	 */
	async findRecordsByDateRange(startDateTime, endDateTime) {
		try {
			const data = await this.getAllRecords();
			return data.filter(item => new Date(item.created) >= new Date(startDateTime) && new Date(item.created) <= new Date(endDateTime));
		} catch (err) {
			console.error("Ошибка при поиске записей по диапазону дат:", err);
			return [];
		}
	}

	
	/**
	 * Метод для удаления последней записи из JSON-файла
	 *
	 * @return {boolean}
	 */
	async deleteLastRecord() {
		try {
			let data = await this.getAllRecords();

			// Удаляем последнюю запись
			if (data.length > 0) {
				data.pop();

				this._cache = data;

				await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
				console.log(`Последняя запись удалена из файла "${this.filePath}".`);
			} else {
				console.log("Файл пуст, нет записей для удаления.");
			}

			return true;
		} catch (err) {
			this._cache = null;
			console.error("Ошибка при удалении последней записи:", err);
			return false;
		}
	}

	/**
	 * Метод для удаления первой записи из JSON-файла
	 *
	 * @return {boolean}
	 */
	async deleteFirstRecord() {
		try {
			let data = await this.getAllRecords();

			// Удаляем первую запись
			if (data.length > 0) {
				data.shift();

				this._cache = data;

				await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
				console.log(`Первая запись удалена из файла "${this.filePath}".`);
			} else {
				console.log("Файл пуст, нет записей для удаления.");
			}

			return true;
		} catch (err) {
			this._cache = null;
			console.error("Ошибка при удалении первой записи:", err);
			return false;
		}
	}

	/**
	 * Метод для удаления всех записей из JSON-файла
	 *
	 * @return {boolean}
	 */
	async deleteAllRecords() {
		try {
			// Записываем пустой массив в файл
			await fs.writeFile(this.filePath, JSON.stringify([]), 'utf8');
			console.log(`Все записи удалены из файла "${this.filePath}".`)

			this._cache = [];

			return true;
		} catch (err) {
			this._cache = null;
			console.error("Ошибка при удалении всех записей:", err);
			return false;
		}
	}

	/**
	 * Метод для удаления записи по id из JSON-файла
	 *
	 * @param id - id записи для удаления
	 * @return {boolean} - true если запись удалена успешно, false если запись не найдена или произошла ошибка
	 */
	async deleteRecordById(id) {
		try {
			let data = await this.getAllRecords();

			// Находим индекс записи с указанным id
			const index = data.findIndex(item => item.id === id);

			if (index !== -1) {
				// Удаляем запись по найденному индексу
				data.splice(index, 1);

				this._cache = data;

				await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
				console.log(`Запись с id ${id} удалена из файла "${this.filePath}".`);
				return true;
			} else {
				console.log(`Запись с id ${id} не найдена.`);
				return false;
			}
		} catch (err) {
			this._cache = null
			console.error("Ошибка при удалении записи по id:", err);
			return false;
		}
	}


	clearCache() {
		this._cache = null;
		console.log("Кэш очищен.");
	}
}

module.exports = FCounter;