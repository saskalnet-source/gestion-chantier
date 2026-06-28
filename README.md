# KAL NET - Version 1 Firebase

Application simple de gestion des listings et chantiers.

## Contenu
- `index.html`
- `style.css`
- `app.js`
- `firebase.js`

## Installation GitHub Pages
1. Envoyez ces 4 fichiers dans votre dépôt GitHub.
2. Activez GitHub Pages : Settings > Pages > Deploy from branch > main / root.
3. Ouvrez le lien GitHub Pages.
4. À la première ouverture, cliquez sur **Charger la liste initiale** si votre base Firebase est vide.

## Important Firebase
Firestore doit être activé. Pour les tests, règles temporaires :

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

À sécuriser ensuite avec des comptes utilisateurs.
