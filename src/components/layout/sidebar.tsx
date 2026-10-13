'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { APP_VERSION } from '@/lib/app-info';
import {
  Home,
  BookOpen,
  Code,
  FolderGit2,
  Github,
  TrendingUp,
  Trophy,
  Target,
  Calendar,
  BookMarked,
  Focus,
  Settings,
  Zap,
} from 'lucide-react';

const menuItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/english', label: 'Английский', icon: BookOpen },
  { href: '/coding', label: 'Программирование', icon: Code },
  { href: '/leetcode', label: 'LeetCode Arena', icon: Zap },
  { href: '/projects', label: 'Проекты', icon: FolderGit2 },
  { href: '/github', label: 'GitHub', icon: Github },
  { href: '/analytics', label: 'Аналитика', icon: TrendingUp },
  { href: '/achievements', label: 'Достижения', icon: Trophy },
  { href: '/quests', label: 'Квесты', icon: Target },
  { href: '/calendar', label: 'Календарь', icon: Calendar },
  { href: '/journal', label: 'Дневник', icon: BookMarked },
  { href: '/goals', label: 'Цели', icon: Target },
  { href: '/focus', label: 'Фокус', icon: Focus },
  { href: '/settings', label: 'Настройки', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r border-border bg-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-border px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">LevelUp</h1>
              <p className="text-xs text-muted-foreground">RPG Трекер</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-4">
          <div className="rounded-lg bg-secondary/50 p-3">
            <p className="text-xs text-muted-foreground">
              Версия {APP_VERSION}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              © 2026 LevelUp
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
