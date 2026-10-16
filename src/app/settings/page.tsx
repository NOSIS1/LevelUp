import { Settings } from 'lucide-react';
import { DataTransfer } from '@/components/settings/data-transfer';
import { ProfileSettings } from '@/components/settings/profile-settings';
import { getProfileSettings } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const profile = await getProfileSettings();
  return <div className="space-y-6"><div><h1 className="flex items-center gap-3 text-4xl font-bold"><Settings className="h-10 w-10" />Настройки</h1><p className="mt-2 text-muted-foreground">Профиль, приватность, интеграции и перенос данных.</p></div><ProfileSettings initial={profile} /><DataTransfer /></div>;
}
