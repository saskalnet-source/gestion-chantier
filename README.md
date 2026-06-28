# KAL NET - Version 1 Firebase

Fichiers à déposer dans GitHub Pages :
- index.html
- style.css
- app.js
- firebase.js

Fonctions :
- Chantiers synchronisés Firebase
- Agents synchronisés Firebase
- Ajouter / modifier / supprimer agent
- Ajouter / modifier / supprimer chantier
- Import Excel / CSV
- Export CSV

Règles Firestore de test :
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
