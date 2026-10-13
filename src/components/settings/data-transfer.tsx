'use client';

import { useRef, useState, useTransition } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function DataTransfer() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function downloadBackup() {
    setError(''); setNotice('');
    try {
      const response = await fetch('/api/data/backup', { cache: 'no-store', headers: { 'x-levelup-export': 'download' } });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error || `Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `levelup-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice('JSON-экспорт скачан. Храните его в приватном месте.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось экспортировать данные'); }
  }

  function restore(file?: File) {
    if (!file) return;
    setError(''); setNotice('');
    startTransition(async () => {
      try {
        if (file.size > 25 * 1024 * 1024) throw new Error('Файл больше лимита 25 МБ');
        const text = await file.text();
        const preview = JSON.parse(text) as { format?: string; version?: number; exportedAt?: string; tables?: Record<string, unknown[]> };
        if (preview.format !== 'levelup-sqlite-json' || preview.version !== 1 || !preview.tables || typeof preview.tables !== 'object') {
          throw new Error('Это не поддерживаемый JSON-экспорт LevelUp');
        }
        const rowCount = Object.values(preview.tables).reduce((sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0), 0);
        const accepted = window.confirm(`Восстановить экспорт от ${preview.exportedAt || 'неизвестной даты'}? Будет заменено локальное содержимое (${rowCount} строк). Перед восстановлением сервер создаст safety-копию текущей SQLite базы.`);
        if (!accepted) return;
        const response = await fetch('/api/data/backup', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-levelup-confirm': 'restore' },
          body: text,
        });
        const result = await response.json() as { error?: string; rowsRestored?: number; safetyBackupPath?: string };
        if (!response.ok) throw new Error(result.error || `Restore failed (${response.status})`);
        setNotice(`Восстановлено строк: ${result.rowsRestored}. Safety-копия текущей базы: ${result.safetyBackupPath}. Перезагрузите страницу.`);
        if (fileInput.current) fileInput.current.value = '';
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось восстановить данные'); }
      finally { if (fileInput.current) fileInput.current.value = ''; }
    });
  }

  return <Card><CardHeader><CardTitle>Экспорт и восстановление</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Экспорт содержит учебный профиль, сессии, заметки, слова, проекты, квесты и историю XP. Файл персональный: он может содержать приватные заметки и должен храниться безопасно. Перед импортом JSON проверяется, а текущая база сохраняется в safety-копию.</p><div className="flex flex-wrap gap-3"><Button onClick={() => void downloadBackup()} disabled={pending}><Download className="mr-2 h-4 w-4" />Экспортировать JSON</Button><Button variant="outline" onClick={() => fileInput.current?.click()} disabled={pending}><Upload className="mr-2 h-4 w-4" />Восстановить JSON</Button><input ref={fileInput} type="file" accept="application/json,.json" className="hidden" aria-label="Файл резервной копии JSON" onChange={(event) => restore(event.target.files?.[0])} /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}{notice && <p role="status" className="break-words text-sm text-green-500">{notice}</p>}</CardContent></Card>;
}
