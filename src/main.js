import { AudioManager } from './core/audio.js';
import { InputController } from './core/input.js';
import { wait } from './core/utils.js';
import { translations } from './data/translations.js';
import { FirebaseService } from './services/firebase-service.js';
import { StorageService } from './services/storage.js';
import { GameEngine } from './systems/game-engine.js';
import { UIController } from './ui/ui.js';

const storage = new StorageService();
const ui = new UIController();
const audio = new AudioManager();
const firebase = new FirebaseService();

let language = storage.getLanguage();
let progress = storage.getProgress();
let profile = storage.getProfile();
let leaderboardCache = [];
let engine;
let input;

const getCopy = (key) => (translations[language] || translations.en)[key] || key;

const refreshHome = () => {
  ui.updateHome(progress, profile, language);
  ui.setSoundButton(storage.isSoundEnabled());
  ui.setSyncMode(firebase.enabled, language);
};

const saveCloudProfile = async () => {
  if (!firebase.enabled) return;
  try { await firebase.saveUser(profile); } catch (error) { console.warn(error); }
};

const loadLeaderboard = async () => {
  const localScores = storage.getScores();
  let cloudScores = [];
  if (firebase.enabled) {
    try { cloudScores = (await firebase.getLeaderboard(12)) || []; } catch (error) { console.warn(error); }
  }
  const combined = [...cloudScores, ...localScores]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 10);
  leaderboardCache = combined;
  ui.renderLeaderboard(combined, language);
};

const persistRun = async (result) => {
  const entry = {
    userId: profile.id,
    displayName: profile.displayName,
    score: result.score,
    distance: result.distance,
    coins: result.coins,
    createdAt: new Date().toISOString()
  };

  progress = {
    ...progress,
    bestScore: Math.max(progress.bestScore || 0, result.score),
    bestDistance: Math.max(progress.bestDistance || 0, result.distance),
    totalCoins: (progress.totalCoins || 0) + result.coins,
    lastScore: result.score,
    lastDistance: result.distance,
    lastCoins: result.coins,
    runs: (progress.runs || 0) + 1,
    unlockedPower: true
  };

  storage.saveProgress(progress);
  storage.saveScore(entry);
  refreshHome();

  if (firebase.enabled) {
    try {
      await Promise.all([
        firebase.saveProgress(profile.id, progress),
        firebase.saveScore(entry),
        firebase.saveUser(profile)
      ]);
    } catch (error) {
      console.warn(error);
    }
  }
};

const startGame = async () => {
  await audio.resume();
  await input.primeMotion();
  audio.startMusic();
  audio.uiTap();
  ui.showScreen('game');
  ui.hideGameOver();
  engine.setLanguage(language);
  ui.setTiltState(input.getMotionState(), language);
  engine.start();
};

const quitToHome = () => {
  engine.stop();
  audio.stopMusic();
  ui.showScreen('home');
  refreshHome();
};

const toggleLanguage = async () => {
  language = language === 'ar' ? 'en' : 'ar';
  storage.setLanguage(language);
  ui.applyLanguage(language);
  engine.setLanguage(language);
  refreshHome();
  ui.updateHud({
    score: engine?.score || 0,
    coins: engine?.coins || 0,
    speedMultiplier: (engine?.speed || 22) / 22,
    environmentName: ui.environmentLabel(engine?.environmentIndex || 0, language)
  });
  ui.setPowerStatus(engine?.activePower, language, engine?.powerTimer || 0);
  ui.setElephantStatus(getCopy('elephantReady'));
  ui.setTiltState(input?.getMotionState?.() || 'idle', language);
  ui.updateBoot(0, getCopy('loading'));
  if (ui.els.screens.leaderboard.classList.contains('active')) await loadLeaderboard();
};

const toggleSound = async () => {
  const next = !storage.isSoundEnabled();
  storage.setSoundEnabled(next);
  audio.setEnabled(next);
  if (next) {
    await audio.resume();
    if (ui.els.screens.game.classList.contains('active')) audio.startMusic();
  }
  ui.setSoundButton(next);
};

const simulatePiLogin = async () => {
  await audio.resume();
  audio.uiTap();
  const tag = Math.floor(Math.random() * 900 + 100);
  profile = {
    ...profile,
    piLoggedIn: true,
    piName: `PiRunner-${tag}`,
    displayName: `PiRunner-${tag}`,
    piBalance: Number((Math.random() * 80 + 15).toFixed(2))
  };
  storage.saveProfile(profile);
  await saveCloudProfile();
  refreshHome();
  window.alert(getCopy('piWelcome'));
};

const resetProgress = async () => {
  const confirmed = window.confirm(language === 'ar' ? 'هل تريد مسح التقدم المحلي؟' : 'Do you want to clear local progress?');
  if (!confirmed) return;
  storage.clearAll();
  progress = storage.getProgress();
  refreshHome();
  await loadLeaderboard();
  window.alert(getCopy('progressCleared'));
};

const bootStep = async (progressValue, textKey, delay = 220) => {
  ui.updateBoot(progressValue, getCopy(textKey));
  await wait(delay);
};

const init = async () => {
  language = ['ar', 'en'].includes(language) ? language : 'en';
  ui.applyLanguage(language);
  refreshHome();
  await bootStep(12, 'loadingRuins', 650);

  audio.setEnabled(storage.isSoundEnabled());
  await bootStep(30, 'loadingCanvas', 180);

  const sync = await firebase.init();
  ui.setSyncMode(sync.enabled, language);
  await saveCloudProfile();
  await bootStep(52, 'loadingSound', 160);

  engine = new GameEngine(document.getElementById('gameCanvas'), {
    getCopy,
    onHudUpdate: ({ score, coins, speedMultiplier, environmentIndex }) => {
      ui.updateHud({
        score,
        coins,
        speedMultiplier,
        environmentName: ui.environmentLabel(environmentIndex, language)
      });
    },
    onPowerChange: (powerKey, secondsLeft) => ui.setPowerStatus(powerKey, language, secondsLeft),
    onElephantStatus: (text) => ui.setElephantStatus(text),
    onJump: () => audio.jump(),
    onSlide: () => audio.slide(),
    onCoin: () => audio.coin(),
    onHit: () => audio.hit(),
    onPower: () => audio.power(),
    onGameOver: async (result) => {
      audio.stopMusic();
      await persistRun(result);
      await loadLeaderboard();
      ui.showGameOver({ ...result, language });
    }
  });
  engine.setLanguage(language);
  await bootStep(72, 'loadingLegions', 180);

  input = new InputController(document.getElementById('gameCanvas'), (action) => engine.handleAction(action), {
    onMotionStateChange: (state) => ui.setTiltState(state, language)
  });
  input.attach();

  ui.bind({
    onStart: startGame,
    onOpenLeaderboard: async () => {
      audio.uiTap();
      ui.showScreen('leaderboard');
      await loadLeaderboard();
    },
    onOpenSettings: () => {
      audio.uiTap();
      ui.showScreen('settings');
    },
    onPiLogin: simulatePiLogin,
    onQuitToHome: quitToHome,
    onRestart: startGame,
    onToggleLanguage: toggleLanguage,
    onToggleSound: toggleSound,
    onResetProgress: resetProgress,
    onBackHome: () => {
      audio.uiTap();
      ui.showScreen('home');
    }
  });

  refreshHome();
  await loadLeaderboard();
  ui.setElephantStatus(getCopy('elephantReady'));
  ui.setTiltState(input.getMotionState(), language);
  ui.updateHud({ score: 0, coins: 0, speedMultiplier: 1, environmentName: ui.environmentLabel(0, language) });
  ui.setPowerStatus(null, language);
  await bootStep(100, 'loadingReady', 220);
  await ui.finishBoot();
};

init();
