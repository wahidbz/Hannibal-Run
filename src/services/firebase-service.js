export class FirebaseService {
  constructor() {
    this.enabled = false;
    this.db = null;
    this.api = null;
  }

  async init() {
    const config = window.__HANNIBAL_FIREBASE__;
    if (!config || !config.apiKey || !config.projectId) {
      this.enabled = false;
      return { enabled: false };
    }

    try {
      const [{ initializeApp }, firestore] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js')
      ]);

      const app = initializeApp(config);
      this.db = firestore.getFirestore(app);
      this.api = firestore;
      this.enabled = true;
      return { enabled: true };
    } catch (error) {
      console.warn('Firebase init failed, falling back to local mode.', error);
      this.enabled = false;
      return { enabled: false, error };
    }
  }

  async saveUser(profile) {
    if (!this.enabled) return false;
    const { doc, setDoc, serverTimestamp } = this.api;
    await setDoc(doc(this.db, 'users', profile.id), {
      id: profile.id,
      displayName: profile.displayName,
      piName: profile.piName || null,
      piLoggedIn: !!profile.piLoggedIn,
      piBalance: profile.piBalance || 0,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return true;
  }

  async saveProgress(userId, progress) {
    if (!this.enabled) return false;
    const { doc, setDoc, serverTimestamp } = this.api;
    await setDoc(doc(this.db, 'progress', userId), {
      ...progress,
      userId,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return true;
  }

  async saveScore(entry) {
    if (!this.enabled) return false;
    const { addDoc, collection, serverTimestamp } = this.api;
    await addDoc(collection(this.db, 'scores'), {
      ...entry,
      createdAt: serverTimestamp()
    });
    return true;
  }

  async getLeaderboard(limitCount = 10) {
    if (!this.enabled) return null;
    const { collection, getDocs, limit, orderBy, query } = this.api;
    const q = query(collection(this.db, 'scores'), orderBy('score', 'desc'), limit(limitCount));
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
}
