import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold flex items-center gap-3">
          <Settings className="h-10 w-10" />
          Настройки
        </h1>
        <p className="text-muted-foreground mt-2">
          Конфигурация приложения
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Настройки профиля</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Настройки в разработке</p>
            <p className="text-sm mt-2">Скоро здесь будут доступны параметры приложения</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
