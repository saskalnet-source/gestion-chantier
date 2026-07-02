# KAL NET - Version refaite complète

## Fichiers à mettre à la racine GitHub

- index.html
- style.css
- app.js
- firebase.js
- initialData.js

## Firebase

Dans Firestore > Règles, pour les tests :

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## Utilisation

1. Remplacer les anciens fichiers GitHub par ces fichiers.
2. Ouvrir GitHub Pages.
3. Cliquer sur **Réparer / réimporter les adresses** pour charger les adresses dans Firebase.
4. Ajouter les numéros des agents dans **Agents**.
5. Chercher une adresse, un client ou un agent.

Les résultats apparaissent uniquement après une recherche. Les numéros des agents sont cliquables pour appeler directement.
