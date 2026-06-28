# KAL NET V1 - Firebase

Fichiers à déposer à la racine du dépôt GitHub Pages :

- index.html
- style.css
- app.js
- firebase.js
- initialData.js

Firebase Firestore doit être en mode test pour commencer :

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

Collections utilisées : `agents` et `chantiers`.
