# HANNIBAL — Next Level Polish

Hannibal is now a branded, mobile-first endless runner with a stronger Tunisian historical identity, richer UI, smoother controls, and lightweight immersive audio.

## What changed
- Tunisian-inspired visual direction with Carthage / Roman-ruins / desert palette
- Stone-road rendering, ruins, columns, haze, sunlight, and depth fog
- Polished runner animation, smoother jumping/sliding, and upgraded elephant motion
- Swipe controls plus device tilt steering for mobile browsers
- Lightweight cinematic music + sound effects built with Web Audio API
- Splash screen, loading screen, refined HUD, and improved game-over flow
- Optimized plain HTML/CSS/JS structure for Netlify and Pi Browser compatibility

## Run locally
Open `index.html` directly in a browser, or serve the folder with any static server.

## Firebase activation
If you want cloud sync, define this object before `src/main.js` loads:

```html
<script>
  window.__HANNIBAL_FIREBASE__ = {
    apiKey: 'YOUR_KEY',
    authDomain: 'YOUR_PROJECT.firebaseapp.com',
    projectId: 'YOUR_PROJECT',
    storageBucket: 'YOUR_PROJECT.appspot.com',
    messagingSenderId: '...',
    appId: '...'
  };
</script>
```

Without that object the game stays fully playable and saves locally.
