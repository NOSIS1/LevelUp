'use client';

import { useState, useTransition } from 'react';
import { KeyRound, Save, Trash2 } from 'lucide-react';
import { saveGitHubToken } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function GitHubTokenSettings({ initial }: { initial: { configured: boolean; encryptionKeyReady: boolean } }) {
  const [token, setToken] = useState('');
  const [configured, setConfigured] = useState(initial.configured);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();

  function save(event: React.FormEvent) {
    event.preventDefault(); setError(''); setNotice('');
    startTransition(async () => {
      try {
        const result = await saveGitHubToken(token);
        setConfigured(result.configured); setToken(''); setNotice(result.configured ? 'GitHub token сохранён. Полный токен не отображается.' : 'GitHub token удалён.');
      } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось сохранить GitHub token'); }
    });
  }

  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />GitHub token</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">Нужен для официальной Contributions heatmap и увеличения лимита GitHub API. Токен отправляется только на сервер и хранится в SQLite зашифрованным; в браузер он не возвращается.</p>{configured && <p className="text-sm text-emerald-600">Токен настроен. Для замены введите новый, для удаления оставьте поле пустым.</p>}{!initial.encryptionKeyReady && <p className="text-sm text-destructive">Ключ шифрования не настроен. Перезапустите `node scripts/setup.mjs` или добавьте GITHUB_TOKEN_ENCRYPTION_KEY в локальный `.env`.</p>}<form onSubmit={save} className="flex flex-col gap-2 sm:flex-row"><Input aria-label="GitHub token" type="password" autoComplete="new-password" placeholder={configured ? 'Введите новый token для замены' : 'ghp_… или github_pat_…'} value={token} onChange={(event) => setToken(event.target.value)} disabled={pending || !initial.encryptionKeyReady} /><Button type="submit" disabled={pending || !initial.encryptionKeyReady}>{configured && !token ? <Trash2 className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}{pending ? 'Сохранение…' : configured && !token ? 'Удалить token' : 'Сохранить token'}</Button></form>{notice && <p className="text-sm text-emerald-600">{notice}</p>}{error && <p className="text-sm text-destructive">{error}</p>}<p className="text-xs text-muted-foreground">Создайте fine-grained token с минимальными read-only разрешениями. Не вставляйте token в публичные issue, логи или экспорт данных.</p></CardContent></Card>;
}
