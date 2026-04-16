import { CONFIG } from '../core/config.js';
import { formatNumber } from '../core/utils.js';
import { translations } from '../data/translations.js';

export class UIController {
  constructor() {
    this.els = {
      bootOverlay: document.getElementById('bootOverlay'),
      splashScreen: document.getElementById('splashScreen'),
      loadingScreen: document.getElementById('loadingScreen'),
      loadingFill: document.getElementById('loadingFill'),
      loadingText: document.getElementById('loadingText'),
      screens: {
        home: document.getElementById('homeScreen'),
        game: document.getElementById('gameScreen'),
        leaderboard: document.getElementById('leaderboardScreen'),
        settings: document.getElementById('settingsScreen')
      },
      langToggle: document.getElementById('langToggle'),
      soundToggle: document.getElementById('soundToggle'),
      settingsLangBtn: document.getElementById('settingsLangBtn'),
      settingsSoundBtn: document.getElementById('settingsSoundBtn'),
      startBtn: document.getElementById('startBtn'),
      leaderboardBtn: document.getElementById('leaderboardBtn'),
      settingsBtn: document.getElementById('settingsBtn'),
      piLoginBtn: document.getElementById('piLoginBtn'),
      pauseToHomeBtn: document.getElementById('pauseToHomeBtn'),
      restartBtn: document.getElementById('restartBtn'),
      homeBtnFromGame: document.getElementById('homeBtnFromGame'),
      resetProgressBtn: document.getElementById('resetProgressBtn'),
      backButtons: Array.from(document.querySelectorAll('.back-btn')),
      walletStatus: document.getElementById('walletStatus'),
      walletBalance: document.getElementById('walletBalance'),
      bestScoreValue: document.getElementById('bestScoreValue'),
      bestDistanceValue: document.getElementById('bestDistanceValue'),
      coinsBankValue: document.getElementById('coinsBankValue'),
      hudScore: document.getElementById('hudScore'),
      hudCoins: document.getElementById('hudCoins'),
      hudSpeed: document.getElementById('hudSpeed'),
      hudEnvironment: document.getElementById('hudEnvironment'),
      powerStatus: document.getElementById('powerStatus'),
      elephantStatus: document.getElementById('elephantStatus'),
      tiltStatus: document.getElementById('tiltStatus'),
      gameOverOverlay: document.getElementById('gameOverOverlay'),
      finalScoreTitle: document.getElementById('finalScoreTitle'),
      finalRunMeta: document.getElementById('finalRunMeta'),
      leaderboardList: document.getElementById('leaderboardList'),
      syncStatus: document.getElementById('syncStatus')
    };
  }

  bind(actions) {
    this.els.startBtn.addEventListener('click', actions.onStart);
    this.els.leaderboardBtn.addEventListener('click', actions.onOpenLeaderboard);
    this.els.settingsBtn.addEventListener('click', actions.onOpenSettings);
    this.els.piLoginBtn.addEventListener('click', actions.onPiLogin);
    this.els.pauseToHomeBtn.addEventListener('click', actions.onQuitToHome);
    this.els.restartBtn.addEventListener('click', actions.onRestart);
    this.els.homeBtnFromGame.addEventListener('click', actions.onQuitToHome);
    this.els.langToggle.addEventListener('click', actions.onToggleLanguage);
    this.els.settingsLangBtn.addEventListener('click', actions.onToggleLanguage);
    this.els.soundToggle.addEventListener('click', actions.onToggleSound);
    this.els.settingsSoundBtn.addEventListener('click', actions.onToggleSound);
    this.els.resetProgressBtn.addEventListener('click', actions.onResetProgress);
    this.els.backButtons.forEach((btn) => btn.addEventListener('click', actions.onBackHome));
  }

  showScreen(name) {
    Object.entries(this.els.screens).forEach(([key, el]) => el.classList.toggle('active', key === name));
    if (name !== 'game') this.hideGameOver();
  }

  applyLanguage(language) {
    const copy = translations[language] || translations.en;
    document.documentElement.lang = language;
    document.body.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.dataset.i18n;
      if (copy[key]) node.textContent = copy[key];
    });
    this.els.langToggle.textContent = language === 'ar' ? 'EN' : 'AR';
    this.els.loadingText.textContent = copy.loading;
    return copy;
  }

  setSoundButton(enabled) {
    this.els.soundToggle.textContent = enabled ? '🔊' : '🔇';
    this.els.settingsSoundBtn.textContent = enabled ? 'ON' : 'OFF';
  }

  updateHome(progress, profile, language) {
    const copy = translations[language] || translations.en;
    this.els.bestScoreValue.textContent = formatNumber(progress.bestScore || 0);
    this.els.bestDistanceValue.textContent = `${formatNumber(progress.bestDistance || 0)}${copy.meters}`;
    this.els.coinsBankValue.textContent = formatNumber(progress.totalCoins || 0);
    this.els.walletStatus.textContent = profile.piLoggedIn
      ? `${copy.walletConnected} ${profile.displayName}`
      : copy.walletGuest;
    this.els.walletBalance.textContent = `${(profile.piBalance || 0).toFixed(2)} π`;
  }

  updateHud({ score = 0, coins = 0, speedMultiplier = 1, environmentName = '' }) {
    this.els.hudScore.textContent = formatNumber(score);
    this.els.hudCoins.textContent = formatNumber(coins);
    this.els.hudSpeed.textContent = `${speedMultiplier.toFixed(1)}x`;
    this.els.hudEnvironment.textContent = environmentName;
  }

  setPowerStatus(powerKey, language, secondsLeft = 0) {
    if (!powerKey) {
      this.els.powerStatus.classList.add('hidden');
      return;
    }
    const copy = translations[language] || translations.en;
    const label = powerKey === 'shield' ? copy.shield : copy.magnet;
    this.els.powerStatus.textContent = `${label} • ${Math.max(1, Math.ceil(secondsLeft))}s`;
    this.els.powerStatus.classList.remove('hidden');
  }

  setElephantStatus(text) {
    this.els.elephantStatus.textContent = text;
  }

  setTiltState(state, language) {
    const copy = translations[language] || translations.en;
    const labels = {
      ready: copy.tiltReady,
      request: copy.tiltRequest,
      denied: copy.tiltDenied,
      unsupported: copy.tiltUnsupported,
      idle: copy.tiltGuide
    };
    this.els.tiltStatus.textContent = labels[state] || copy.tiltGuide;
    this.els.tiltStatus.dataset.state = state;
  }

  showGameOver({ score, distance, coins, language }) {
    const copy = translations[language] || translations.en;
    this.els.finalScoreTitle.textContent = formatNumber(score);
    this.els.finalRunMeta.textContent = `${formatNumber(distance)}${copy.meters} • ${formatNumber(coins)} ${copy.coinsCollected}`;
    this.els.gameOverOverlay.classList.remove('hidden');
  }

  hideGameOver() {
    this.els.gameOverOverlay.classList.add('hidden');
  }

  renderLeaderboard(entries, language) {
    const copy = translations[language] || translations.en;
    if (!entries.length) {
      this.els.leaderboardList.innerHTML = `<div class="leaderboard-row"><div class="rank-badge">—</div><div><div class="lb-name">${copy.emptyLeaderboard}</div><div class="lb-meta">Hannibal</div></div><div class="lb-score">0</div></div>`;
      return;
    }

    this.els.leaderboardList.innerHTML = entries.map((entry, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
      return `
        <div class="leaderboard-row">
          <div class="rank-badge">${medal}</div>
          <div>
            <div class="lb-name">${entry.displayName || 'Runner'}</div>
            <div class="lb-meta">${formatNumber(entry.distance || 0)}${copy.meters} • ${formatNumber(entry.coins || 0)} ${copy.coinsCollected}</div>
          </div>
          <div class="lb-score">${formatNumber(entry.score || 0)}</div>
        </div>
      `;
    }).join('');
  }

  setSyncMode(enabled, language) {
    const copy = translations[language] || translations.en;
    this.els.syncStatus.textContent = enabled ? copy.cloudMode : copy.localMode;
    this.els.syncStatus.dataset.mode = enabled ? 'cloud' : 'local';
  }

  environmentLabel(index, language) {
    const env = CONFIG.environments[index] || CONFIG.environments[0];
    return env.name[language] || env.name.en;
  }

  updateBoot(progress, text) {
    this.els.loadingFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    this.els.loadingText.textContent = text;
    if (progress >= 12) this.els.loadingScreen.classList.add('active');
  }

  async finishBoot() {
    this.els.bootOverlay.classList.add('done');
    await new Promise((resolve) => setTimeout(resolve, 520));
    this.els.bootOverlay.remove();
  }
}
