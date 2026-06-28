# KAL NET V1 - Firebase

Application simple de gestion des chantiers avec :
- Firebase Firestore
- Gestion des agents + téléphone
- Chantiers avec Poubelle / Ménage / Gardiennage
- Import Excel / CSV
- Export CSV
- Synchronisation entre téléphones

## Installation GitHub
Déposez tout le contenu du dossier dans votre dépôt GitHub, puis activez GitHub Pages.

## Firebase
Dans Firebase > Firestore Database > Règles, pour les tests seulement :

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
