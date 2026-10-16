# Быстрый запуск LevelUp

Требуется Node.js 20.9+; рекомендуется Node.js 22 LTS. Приложение и SQLite работают локально, без облачной регистрации.

## Windows

```powershell
git clone https://github.com/NOSIS1/LevelUp.git
cd LevelUp
node .\scripts\setup.mjs
```

Можно использовать `install.ps1` / `start.ps1`. При запрете PowerShell scripts: `powershell -ExecutionPolicy Bypass -File .\install.ps1`.

## macOS / Linux

```sh
git clone https://github.com/NOSIS1/LevelUp.git
cd LevelUp
node scripts/setup.mjs
```

Или `./install.sh` (при необходимости: `chmod +x install.sh start.sh`). После первого запуска открыть <http://localhost:3000>. Обычный запуск использует быстрый production server; для hot reload запустите `node scripts/setup.mjs --dev` (Turbopack).

Команды: `node scripts/setup.mjs --install-only`, `node scripts/setup.mjs --check`, `node scripts/setup.mjs --dev`, `npm run backup`, `npm run restore -- <backup.db>`. Все данные находятся в `data/levelup.db`; резервная копия переносится между устройствами вручную.

Подробные требования, приватность и CI: [README.md](README.md). Ошибки: [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
