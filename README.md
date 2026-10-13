# Blabby desktop local

Prototype Windows de dictée locale : Electron, JavaScript et Python / faster-whisper. Aucun compte ni quota. Le modèle fonctionne sur CPU en int8.

## Utilisation

Laisser Blabby ouvert ou réduit, cliquer dans un champ acceptant le collage, puis **Ctrl + Espace** pour enregistrer et à nouveau pour transcrire. Aucun appui sur Entrée n'est envoyé. Un bandeau indique l'enregistrement avec un voyant rouge et des barres suivant le niveau du microphone. La transcription reste dans Blabby ; seul le bouton Copier le texte modifie le presse-papiers.

La fenêtre principale se réduit si le raccourci est déclenché depuis Blabby. Aucun collage automatique dans une autre application. Le micro peut capter les sons ambiants. L'historique dure uniquement pendant la session.

## Lancement depuis les sources

Prérequis : Windows 64 bits, Node.js 22.12 ou plus récent avec npm, Python 3.12 et un modèle **faster-whisper** déjà téléchargé. Le dossier du modèle doit contenir `model.bin` et ses fichiers associés ; un modèle Whisper `.pt` ne convient pas.

Dans PowerShell à la racine du dépôt :

```powershell
npm ci
py -3.12 -m pip install --target python-libs -r requirements.txt
py -3.12 scripts/configure.py --model "C:\chemin\vers\faster-whisper-base"
npm start
```

L'installation initiale des dépendances nécessite Internet. Ensuite la dictée utilise les fichiers locaux : le moteur refuse les connexions réseau et la session Electron bloque HTTP, HTTPS et WebSocket. Le modèle n'est pas téléchargé automatiquement.

## Compilation du paquet Electron

```powershell
npm run check
npm run build
```

Le résultat est `dist/app.asar`, une archive d'application Electron. Ce n'est pas un installateur Windows autonome. Pour une distribution complète, il faut également un runtime Electron, Python, les dépendances et le modèle. En mode empaqueté, `worker.py`, `native_input.py`, `config.json` et `python-libs` sont attendus dans `resources/blabby-local` ; adapter les chemins du fichier de configuration à la machine cible.

## Organisation

- `app/main.js` : fenêtres Electron, raccourci global, moteur et collage.
- `app/renderer.js` : capture microphone, transcription et mesure du niveau audio.
- `app/preload.js` : pont IPC.
- `app/overlay.*` : bandeau et visualiseur.
- `worker.py` : transcription locale avec faster-whisper.
- `native_input.py` : détection de la fenêtre active et collage Windows.
- `scripts/` : configuration locale et construction de l'archive.

## État et limites

Le parcours Ctrl + Espace, transcription microphone et collage a été testé sur la version installée dans Bloc-notes et dans un champ de navigateur. Le bandeau, la réduction de la fenêtre et l'état de transcription ont été observés. La compatibilité avec tous les sites et les applications exécutées comme administrateur n'est pas garantie. Cette version reprend le prototype local ; les modes IA, comptes, paiements, synchronisation et fonctions de l'ancien serveur ne sont pas implémentés.

Ce dépôt contient les sources du prototype local. Les binaires de l'application d'origine, modèles, bibliothèques installées, configurations personnelles, journaux et enregistrements sont exclus.

Le bandeau se place en bas de l'écran où se trouve le pointeur, au-dessus de la barre des tâches. Fermer la fenêtre principale garde Blabby actif dans la zone de notification : double-cliquer son icône pour rouvrir, ou choisir Quitter Blabby dans son menu pour arrêter complètement. Une seule instance peut utiliser le raccourci à la fois.

Le visualiseur actuel est une capsule minimaliste de 112 × 40 pixels contenant uniquement la vague. Elle apparaît pendant l'enregistrement et disparaît dès l'arrêt ; la transcription continue en arrière-plan. Affichage et disparition vérifiés sur l'exécutable installé.


Le collage automatique est désactivé à la demande de l'utilisateur. Ctrl + Espace ne copie ni ne colle la transcription. Le bouton Copier le texte permet une copie volontaire.

Après transcription, la fenêtre principale réapparaît pour rendre le résultat ou l'erreur visible. Aucun collage automatique ni écriture du presse-papiers n'est effectué.

## Comportement actuel : insertion sans presse-papiers

Ctrl + Espace insère la transcription dans le champ actif avec les événements Unicode Windows (SendInput), sans lire ni écrire le presse-papiers. Garder la même fenêtre et le même champ actifs jusqu'à la fin. En cas d'échec, Blabby affiche le résultat pour récupération manuelle. Les notes précédentes décrivent les étapes du prototype ; cette section définit le comportement actuel.

Test : audio synthétique fourni au microphone de test Chromium, enregistrement et arrêt via le raccourci réel, texte avec accents inséré dans Bloc-notes. Empreinte du presse-papiers identique avant et après. Application relancée ensuite avec le vrai microphone. La compatibilité avec chaque champ de chaque site reste à vérifier.
