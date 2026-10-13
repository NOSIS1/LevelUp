# LevelUp

Локальный RPG-трекер прогресса в английском и программировании. Приложение хранит данные на устройстве в SQLite; аккаунт на сервере для обычного использования не нужен.

## Быстрый запуск

Требуется **Node.js 20.9+ (рекомендуется Node.js 22 LTS)**. Git нужен только для клонирования репозитория.

### Windows — PowerShell

```powershell
git clone https://github.com/NOSIS1/LevelUp.git
cd LevelUp
node .\scripts\setup.mjs
```

Либо запустите `install.ps1` / `start.ps1` из папки проекта. Если политика PowerShell запрещает скрипты:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

### macOS / Linux

```sh
git clone https://github.com/NOSIS1/LevelUp.git
cd LevelUp
node scripts/setup.mjs
```

Либо `./install.sh` (если нужно: `chmod +x install.sh start.sh`).

Bootstrap проверяет версию Node, устанавливает npm-зависимости, создаёт `.env` из `.env.example` только если файла ещё нет, применяет схему SQLite без удаления существующей базы и запускает dev-сервер на <http://localhost:3000>.

Полезные режимы:

```sh
node scripts/setup.mjs --install-only  # установка и миграция, без запуска сервера
node scripts/setup.mjs --check         # установка/миграция + типы + тесты
node scripts/setup.mjs --production    # production build и сервер
npm run check                          # типы + тесты + production build
npm run db:push                        # применить изменения схемы SQLite
```

Остановить сервер: `Ctrl+C`.

## Хранение данных и перенос между устройствами

- SQLite-файл: `data/levelup.db`; журналы SQLite могут создавать рядом `-wal` и `-shm` файлы.
- `data/`, `.env`, `node_modules/`, `.next/` и резервные копии исключены из Git.
- Каждый компьютер имеет собственную базу. Автоматической синхронизации между устройствами нет.
- Создать целостную резервную копию (включая активную WAL-базу):

  ```sh
  npm run backup
  ```

- Восстановить проверенную копию:

  ```sh
  npm run restore -- backups/levelup-YYYY-MM-DDTHH-MM-SS-sssZ.db
  ```

  Восстановление создаёт safety backup текущей базы в `backups/` и сохраняет прежний файл как `data/levelup.db.pre-restore`. Перед переносом между компьютерами остановите приложение, скопируйте backup безопасным способом и восстановите его на другом устройстве. Не коммитьте backup в Git и не кладите его в публичное облако.

## Настройка интеграций

Переменные задаются в локальном `.env` (создаётся автоматически из примера):

```dotenv
# Необязательно. Серверный read-only token улучшает лимиты REST API и
# открывает официальный GitHub GraphQL Contributions calendar.
GITHUB_TOKEN=
```

GitHub username без токена даёт публичные репозитории и ограниченный список публичных событий. Официальная heatmap требует серверного fine-grained token с минимальным read-only доступом к публичному профилю. Токен не передаётся в браузер. LeetCode использует публичные агрегированные данные без пароля/cookie; endpoint неофициальный и может меняться. Не добавляйте секреты в исходники или Git.

## Проверки и CI

```sh
npm run type-check
npm test
npm run build
npm run check
```

GitHub Actions выполняет type-check, Vitest и production build на Windows, macOS и Ubuntu. Ручная проверка на macOS/Linux дополнительно рекомендуется перед крупным релизом.

`npm audit --omit=dev` проверяет production-зависимости. На момент подготовки релиза оно проходит без advisories. Полный `npm audit` сообщает advisories в dev-only Tailwind 3 / Drizzle Kit toolchain; автоматический npm fix требует major-перехода Tailwind 4 и Drizzle beta, поэтому он не применяется вслепую. Обновление этих инструментов отслеживается отдельно.

## Если что-то пошло не так

- Проверьте `node --version` (20.9+), затем закройте старые процессы dev-сервера.
- После обновления зависимостей выполните `npm install`, затем заново `node scripts/setup.mjs`.
- Не запускайте production build параллельно с dev-сервером: Next.js использует общую `.next` директорию.
- Если CSS/JS отдают 404 после сборки, остановите Next, удалите только генерируемую `.next` и снова запустите `node scripts/setup.mjs`. Не удаляйте `data/`.
- При проблемах native SQLite на Linux установите инструменты сборки Node.js addon согласно документации вашей ОС; Node.js 22 LTS обычно имеет готовый `better-sqlite3` binary.

## Архитектура

- Next.js App Router, React, TypeScript strict.
- SQLite + Drizzle ORM; локальная база — источник истины.
- Zod валидация server actions, Vitest для логики XP, повторений, календаря и интеграционных адаптеров.
- GitHub/LeetCode API адаптеры изолированы; недоступные данные явно помечаются, не подменяются нулями.

## Приватность

Учебные записи остаются локально. Внешние запросы выполняются только при синхронизации GitHub/LeetCode. GitHub token используется исключительно серверным кодом. Подробнее: `.env.example` и `.gitignore`.
