import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'job4you-theme';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private themeSubject = new BehaviorSubject<Theme>(this.readInitialTheme());
  theme$ = this.themeSubject.asObservable();

  constructor() {
    this.applyTheme(this.themeSubject.value);
  }

  get currentTheme(): Theme {
    return this.themeSubject.value;
  }

  toggleTheme(): void {
    this.setTheme(this.currentTheme === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    this.themeSubject.next(theme);
    localStorage.setItem(STORAGE_KEY, theme);
    this.applyTheme(theme);
  }

  private applyTheme(theme: Theme): void {
    document.body.classList.toggle('dark-mode', theme === 'dark');
  }

  private readInitialTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
}
