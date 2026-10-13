<div align="center">

# ⚡ LevelUp

### Твой личный центр развития в формате RPG

**Английский · Программирование · LeetCode · GitHub · Проекты**

Локальный трекер, который превращает реальные занятия в XP, уровни, серии и заметный прогресс — без облачного аккаунта и обязательной подписки.

[🚀 Быстрый старт](#-быстрый-старт) · [✨ Возможности](#-возможности) · [💾 Данные](#-данные-и-резервное-копирование) · [🧪 Проверки](#-разработка-и-проверки) · [🔐 Приватность](#-приватность-и-интеграции)

![Node](https://img.shields.io/badge/Node.js-20.9%2B-339933?logo=nodedotjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-local-003B57?logo=sqlite&logoColor=white)
![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/License-MIT-green.svg)

</div>

---

## ✨ Возможности

### 🎮 Прогресс, основанный на реальных действиях
- Учебные сессии английского и программирования, XP-журнал и уровни.
- Исправление и удаление сессий с корректировкой XP и статистики.
- Серии занятий и календарь активности без фиктивных данных.
- Достижения с одноразовыми наградами, квесты и цели.

### 📚 Английский
- Навыки CEFR и категории Vocabulary, Grammar, Listening, Speaking, Reading, Writing.
- Персональный словарь, поиск, CSV импорт/экспорт и повторение SM-2.
- История правильных/неправильных ответов; слово не считается освоенным после одного повтора.

### 💻 Программирование
- Учёт занятий, языков, проектов и учебных тем.
- Практические задачи: тип, сложность, попытки, решение и повторение.
- Карточки заметок: отдельный вопрос и ответ, скрытый ответ и интервальный повтор.

### 📈 Аналитика и фокус
- Графики времени и XP по фактическим сессиям, сравнение периодов.
- Pomodoro/Deep Work таймер с паузой и сохранением состояния после обновления.
- XP начисляется только после явного подтверждения завершённой сессии.

### 🔌 Интеграции
- **GitHub:** репозитории и доступные публичные события; официальный Contributions calendar при настройке серверного токена.
- **LeetCode:** публичные агрегированные счётчики и снимки; личная история задач хранится отдельно.
- Внешняя статистика не считается доказательством знаний и не подменяется вымышленными записями.

### 🧰 Настройки и перенос
- JSON экспорт и проверяемое восстановление с safety-копией.
- SQLite backup/restore с integrity check и SHA-256.
- Одинаковый запуск на Windows, macOS и Linux.

---

## 🚀 Быстрый старт

**Нужно:** Node.js 20.9+ (рекомендуется Node.js 22 LTS), Git для клонирования.

### Windows — PowerShell

```powershell
git clone https://github.com/NOSIS1/LevelUp.git
cd LevelUp
node .\scripts\setup.mjs
```

Или `install.ps1` / `start.ps1`. Если PowerShell запрещает скрипты:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

Также доступен `launch.bat`.

### macOS / Linux

```sh
git clone https://github.com/NOSIS1/LevelUp.git
cd LevelUp
node scripts/setup.mjs
```

Или `./install.sh` (`chmod +x install.sh start.sh`, если нужно).

После запуска откройте **<http://localhost:3000>**. Остановить сервер: `Ctrl+C`.

> Первый запуск устанавливает зависимости, создаёт локальный `.env` только при его отсутствии, применяет схему SQLite без удаления существующей базы и запускает dev-сервер. Setup не очищает пользовательские данные.

### Режимы установщика

```sh
node scripts/setup.mjs --install-only  # установка и схема БД без запуска
node scripts/setup.mjs --check         # проверка типов, тесты и production build
node scripts/setup.mjs --production    # production build и локальный сервер
npm run check                          # типы + тесты + production build
npm run db:push                        # применить изменения схемы SQLite
```

---

## 💾 Данные и резервное копирование

- Главный источник данных: `data/levelup.db`.
- База, SQLite WAL-файлы, `.env`, `node_modules`, `.next` и backups исключены из Git.
- Каждое устройство хранит свою SQLite-базу. **Автоматической облачной синхронизации нет.**
- В приложении: **Настройки → Экспорт и восстановление** — JSON для переноса между устройствами. Перед восстановлением создаётся safety-копия, архив проверяется на формат, таблицы и foreign keys.
- Резервная копия SQLite (поддерживает активный WAL):

  ```sh
  npm run backup
  ```

- Восстановление SQLite-копии:

  ```sh
  npm run restore -- backups/levelup-<timestamp>.db
  ```

Restore проверит целостность и SHA-256, сохранит текущую базу перед заменой. Остановите LevelUp на время восстановления. Не отправляйте экспорт и резервные копии в публичный репозиторий или открытое облако: они содержат личные учебные данные.

---

## 🔐 Приватность и интеграции

Секреты задаются только в локальном `.env`, который Git игнорирует. Пример:

```dotenv
# Необязательно. Используется только сервером для GitHub GraphQL Contributions.
GITHUB_TOKEN=
```

Публичные GitHub REST данные доступны и без токена, но с меньшим лимитом. Для официальной дневной Contributions heatmap задайте серверный fine-grained token с минимальным read-only доступом и перезапустите приложение. Токен не отправляется браузеру.

LeetCode интеграция использует публичный неофициальный GraphQL endpoint. **Не вводите пароль и не передавайте session cookies.** Доступность и схема endpoint могут измениться; ошибки синхронизации показываются явно.

> LevelUp — локальное single-user приложение без входа и сетевой авторизации. Не выставляйте сервер в публичную сеть без отдельной настройки аутентификации и защиты.

---

## 🧪 Разработка и проверки

```sh
npm ci
npm run db:push
npm run dev

npm run type-check
npm test
npm run build
npm audit --omit=dev
```

Тесты охватывают XP/уровни, streaks, интервальные повторения, CSV, задачи, квесты, календарь, GitHub/LeetCode адаптеры и атомарное восстановление SQLite на временной базе.

GitHub Actions запускает install, DB schema, type-check, тесты и production build на **Windows, macOS и Ubuntu**.

Полный `npm audit` может показывать предупреждения в dev-only Tailwind 3 / Drizzle Kit транзитивных зависимостях. `npm audit --omit=dev` проверяет production runtime; major upgrades не выполняются автоматически без тестов миграции.

### Архитектура

- Next.js App Router 15, React 18, TypeScript strict.
- SQLite + Drizzle ORM; данные остаются локальными.
- Zod на границах ввода, Vitest для бизнес-логики.
- Интеграции изолированы адаптерами; внешние метрики не смешиваются с ручными фактами.

---

## 📦 Версия и история

Текущая версия указана в [`package.json`](package.json). История изменений и правила SemVer находятся в [`CHANGELOG.md`](CHANGELOG.md).

## Лицензия

[MIT](LICENSE) © NOSIS1.
