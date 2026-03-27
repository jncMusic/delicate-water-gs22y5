'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDc6bGpzvxNALaxvrhZxSMxuHAvqQJozSE",
  authDomain: "jnc-music-dashboard.firebaseapp.com",
  projectId: "jnc-music-dashboard",
  storageBucket: "jnc-music-dashboard.firebasestorage.app",
  messagingSenderId: "228282757928",
  appId: "1:228282757928:web:6fae515d207d8a61e0961d",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const storage = getStorage(app);

export const APP_ID = 'jnc-music-v2';
export const GALLERY_COLLECTION = `artifacts/${APP_ID}/public/data/gallery`;

export const GALLERY_CATEGORIES = [
  { id: 'concert',  label: '연주회' },
  { id: 'facility', label: '학원 시설' },
  { id: 'exterior', label: '외관' },
  { id: 'class',    label: '수업사진' },
];
