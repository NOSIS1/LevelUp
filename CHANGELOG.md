# Changelog

Проект следует [Semantic Versioning](https://semver.org/):

- **MAJOR** — несовместимые изменения данных, интеграций или запуска.
- **MINOR** — новые пользовательские возможности без намеренного нарушения совместимости.
- **PATCH** — исправления, безопасность, документация и совместимые улучшения.

## [1.3.1] - 2026-10-16

### Fixed
- README синхронизирован с фактически доступными XP-настройками и режимами запуска.
- XP-параметры профиля полностью подключены к Settings UI, server validation и новым учебным сессиям.
- Добавлены тесты configurable XP и уровня.

## [1.3.0] - 2026-10-16

### Added
- Настраиваемые правила XP: XP за минуту, бонус длинной сессии, порог бонуса.
- Настраиваемая формула уровней: базовый XP и степень прогрессии.
- Настройки профиля и daily goal отображаются в одном экране Settings.

### Compatibility
- Изменения XP применяются только к новым событиям; существующий XP-журнал не пересчитывается задним числом.
- CI и browser smoke подтверждены на Windows, macOS и Linux для Node.js 20/22.

### Added
- Playwright smoke-тесты пользовательских сценариев.
- Кроссплатформенный production/dev запуск с Node.js 20/22.

### Performance
- Dashboard Radar Chart загружается отдельным lazy chunk.

## [1.2.2] - 2026-10-16

### Fixed
- Dev startup clears stale Next.js build cache before starting, reducing mixed-chunk/runtime errors after rebuilds.
- Malformed JSON tags/topics in stored records no longer crash UI pages.
- Browser smoke coverage confirms core flows after a clean isolated startup.

## [1.2.1] - 2026-10-16

### Added
- Radar Chart для показателей Activity, Practice, Assessment, Confidence и Consistency.
- Честное состояние «Недостаточно данных» для навыков без фактических измерений.

### Performance
- Radar Chart загружается отдельным lazy client chunk, поэтому Dashboard не тянет Recharts в initial bundle.

## [1.2.0] - 2026-10-16

### Added
- Programming Skill Tree with Computer Science, fundamentals, data structures, algorithms, problem solving, and language branches.
- Parent dependencies and per-skill learning/review/mastery states.

### Tests
- Added tree-depth and skill-status coverage; full suite passes.

## [1.1.5] - 2026-10-16

### Fixed
- Ежедневная цель и часовой пояс пользователя подключены к Dashboard, streak, календарю и дневному отчёту.
- Кроссплатформенный CI подтверждён на Node 20/22 для Windows, macOS и Linux.
- Browser smoke tests проходят в CI на Chromium.

## [1.1.4] - 2026-10-16

### Fixed
- macOS diagnostic build job теперь применяет SQLite-схему перед production build, как и основной CI matrix.
- Настройки профиля: имя, CEFR-уровни, ежедневная цель и IANA timezone.
- Ежедневная цель теперь отображается на Dashboard, а timezone учитывается в streak, календаре и дневном отчёте.

## [1.1.3] - 2026-10-16

### Added
- Playwright smoke tests для создания занятия, повторения слова, цели и JSON-экспорта.
- Browser CI job с Chromium и временной изолированной SQLite базой.

### Fixed
- Исправлены строгие селекторы E2E-сценариев, чтобы тесты не путали похожие элементы интерфейса.

## [1.1.2] - 2026-10-16

### Fixed
- Обычный установочный запуск теперь использует оптимизированный production server, что снижает нагрузку на ноутбуки; hot reload включается только через `--dev`.
- Обновлён `better-sqlite3` для Node.js 20/22 на Windows, macOS и Linux.
- Зафиксирован `better-sqlite3` 11.10.0 для стабильной установки native binary на Node.js 20/22 Windows CI.
- CI проверяет обе поддерживаемые LTS-линии Node.js на всех трёх ОС.

## [1.1.1] - 2026-10-13

### Changed
- GitHub Actions обновлены до версий, использующих Node.js 24 runtime.
- README поясняет, где найти скачанный JSON экспорт.

### Fixed
- Исправлены автоматические проверки backup/restore API и транзакционного восстановления SQLite.
- Обычный запуск теперь использует оптимизированный production server; dev-режим включается явно через `--dev`.
- Обновлён native `better-sqlite3` для Node.js 20/22 и разных ОС.

## [1.1.0] - 2026-10-13

### Added
- Кроссплатформенный setup для Node.js на Windows, macOS и Linux.
- CI workflow на трёх ОС.
- SQLite backup/restore и валидируемый JSON экспорт/импорт с safety backup.
- Настоящий дневник, цели, квесты, проекты, аналитика, календарь активности, фокус-таймер.
- Словарь английского и карточки заметок по программированию с интервальным повторением.
- Журнал практических задач, achievements, GitHub и LeetCode интеграции.
- Интеграционные тесты восстановления на временной SQLite базе.

### Changed
- Локальный сервер привязан к loopback адресу по умолчанию.
- Удалена обязательная загрузка Google Fonts во время сборки.
- Документация переработана для чистой кроссплатформенной установки.

### Security
- Локальная база, `.env`, кэш, и backups не попадают в Git.
- Production dependency audit проверяется в CI.

## [1.0.0] - 2026-10-12

### Added
- Первая опубликованная версия локального RPG трекера LevelUp.
