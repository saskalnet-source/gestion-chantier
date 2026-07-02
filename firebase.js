import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCl7wK44p4vlG2hvLXr6PLrksnB6bxnQbk",
  authDomain: "gestion-chantier-b5e11.firebaseapp.com",
  projectId: "gestion-chantier-b5e11",
  storageBucket: "gestion-chantier-b5e11.firebasestorage.app",
  messagingSenderId: "390756939710",
  appId: "1:390756939710:web:aaa7b1ec6f58d0335aabef",
  measurementId: "G-ZFGK7WP9M7"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

enableIndexedDbPersistence(db).catch(() => {
  // Si plusieurs onglets sont ouverts, Firebase désactive juste le mode hors connexion.
});

export {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  onSnapshot,
  serverTimestamp
};
