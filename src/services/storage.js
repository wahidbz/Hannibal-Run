import { uid } from '../core/utils.js';

const KEYS = {
  language: 'hannibal.language',
  sound: 'hannibal.sound',
  profile: 'hannibal.profile',
  progress: 'hannibal.progress',
  scores: 'hannibal.scores'
};

const safeJSONParse = (value, fallback) => {
  try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
};

export class StorageService {
  getLanguage() {
    return localStorage.getItem(KEYS.language) || 'en';
  }

  setLanguage(language) {
    localStorage.setItem(KEYS.language, language);
  }

  isSoundEnabled() {
    const value = localStorage.getItem(KEYS.sound);
    return value === null ? true : value === 'true';
  }

  setSoundEnabled(enabled) {
    localStorage.setItem(KEYS.sound, String(enabled));
  }

  getProfile() {
    const fallback = {
      id: uid(),
      displayName: 'Guest Runner',
      piName: null,
      piBalance: 0,
      piLoggedIn: false
    };
    const profile = safeJSONParse(localStorage.getItem(KEYS.profile), fallback);
    if (!profile.id) profile.id = uid();
    return { ...fallback, ...profile };
  }

  saveProfile(profile) {
    localStorage.setItem(KEYS.profile, JSON.stringify(profile));
  }

  getProgress() {
    return safeJSONParse(localStorage.getItem(KEYS.progress), {
      bestScore: 0,
      bestDistance: 0,
      totalCoins: 0,
      runs: 0,
      lastScore: 0,
      lastDistance: 0,
      lastCoins: 0,
      unlockedPower: false,
      updatedAt: new Date().toISOString()
    });
  }

  saveProgress(progress) {
    progress.updatedAt = new Date().toISOString();
    localStorage.setItem(KEYS.progress, JSON.stringify(progress));
  }

  getScores() {
    return safeJSONParse(localStorage.getItem(KEYS.scores), []);
  }

  saveScore(entry) {
    const scores = this.getScores();
    scores.push(entry);
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem(KEYS.scores, JSON.stringify(scores.slice(0, 20)));
  }

  clearAll() {
    localStorage.removeItem(KEYS.progress);
    localStorage.removeItem(KEYS.scores);
  }
}
