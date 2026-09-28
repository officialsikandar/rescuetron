import { Injectable, OnModuleInit } from '@nestjs/common';
import { initializeApp, cert } from 'firebase-admin/app';
import { getDatabase, Database } from 'firebase-admin/database';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private inMemoryStore = new Map<string, any[]>();
  public isDatabaseActive = false;
  public db: Database | null = null;

  onModuleInit() {
    const projectId = process.env.FIREBASE_PROJECT_ID?.replace(/"/g, '');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.replace(/"/g, '');
    let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/"/g, '');

    if (privateKey) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }

    const databaseURL = process.env.FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`;

    if (projectId && clientEmail && privateKey) {
      try {
        const app = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          databaseURL,
        });

        this.db = getDatabase(app);
        this.isDatabaseActive = true;
        console.log('⚡ [NestJS] Connected to Firebase Realtime Database Project:', projectId, 'URL:', databaseURL);
      } catch (err) {
        console.warn('⚠️ Firebase initialization warning:', err);
      }
    } else {
      console.log('💡 Firebase credentials not provided in .env — using local memory database store.');
      this.inMemoryStore.set('users', []);
      this.inMemoryStore.set('otps', []);
      this.inMemoryStore.set('contacts', []);
      this.inMemoryStore.set('alerts', []);
    }
  }

  getCollection(name: string): any[] {
    if (!this.inMemoryStore.has(name)) {
      this.inMemoryStore.set(name, []);
    }
    return this.inMemoryStore.get(name)!;
  }

  async saveDocument(pathName: string, data: any) {
    if (this.isDatabaseActive && this.db) {
      const id = data.id || data.email?.replace(/[.#$\[\]]/g, '_') || Math.random().toString(36).substring(2, 9);
      await this.db.ref(`${pathName}/${id}`).set(data);
      return data;
    }

    const list = this.getCollection(pathName);
    const existingIndex = list.findIndex(item => item.id === data.id || (item.email && item.email === data.email));
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...data };
    } else {
      list.push(data);
    }
    return data;
  }

  findDocument(pathName: string, queryFn: (item: any) => boolean) {
    const list = this.getCollection(pathName);
    return list.find(queryFn);
  }

  filterDocuments(pathName: string, queryFn: (item: any) => boolean) {
    const list = this.getCollection(pathName);
    return list.filter(queryFn);
  }
}
