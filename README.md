# Blabby desktop local

Prototype Windows de dictée locale avec Electron, JavaScript et Python / faster-whisper. Aucun compte ni quota. Le modèle fonctionne sur CPU en int8.

## Utilisation

1. Lancer Blabby et attendre « Modèle prêt ».
2. Choisir le modèle et la langue dans la fenêtre principale.
3. Cliquer dans le champ où écrire, puis **Ctrl + Espace** pour enregistrer.
4. Appuyer à nouveau pour arrêter, transcrire et insérer le texte au curseur.

L'insertion utilise les événements Unicode Windows : elle ne lit ni ne modifie le presse-papiers et n'envoie pas Entrée. Garder le même champ et la même fenêtre actifs jusqu'à la fin. En cas d'échec, Blabby affiche la transcription pour récupération manuelle. Certains champs ou applications exécutées comme administrateur peuvent refuser l'insertion.

Pendant l'enregistrement, une petite vague réagissant au microphone apparaît en bas de l'écran du pointeur, au-dessus de la barre des tâches. Après l'arrêt du micro, elle passe en animation bleue de chargement pendant la transcription et l'insertion. Elle disparaît à la fin de l'opération, ou en cas d'erreur. Le micro peut capter les sons ambiants.

Fermer la fenêtre laisse Blabby actif dans la zone de notification. Double-cliquer l'icône pour rouvrir ; choisir **Quitter Blabby** dans son menu pour arrêter complètement. Une seule instance utilise le raccourci.

Le bouton **Copier le texte** permet une copie volontaire. Import audio : maximum 50 Mo par fichier. L'historique est conservé uniquement pendant la session.

## Lancement depuis les sources

Prérequis : Windows 64 bits, Node.js 22.12 ou plus récent avec npm, Python 3.12 et un modèle **faster-whisper** téléchargé. Son dossier doit contenir `model.bin` et ses fichiers associés ; un modèle Whisper `.pt` ne convient pas.

Dans PowerShell à la racine du dépôt :

```powershell
npm ci
py -3.12 -m pip install --target python-libs -r requirements.txt
py -3.12 scripts/configure.py --model "C:\chemin\vers\faster-whisper-base"
npm start
```

L'installation initiale nécessite Internet. Ensuite la dictée utilise les fichiers locaux : le moteur refuse les connexions réseau et la session Electron bloque HTTP, HTTPS et WebSocket. Aucun modèle n'est téléchargé automatiquement par l'application.

## Choix du modèle

Le menu **Moteur / modèle** propose les modèles installés parmi Base, Small, Large-v3 et Large-v3 Turbo. Les fichiers incomplets sont indisponibles. La dictée est désactivée pendant le changement. Un seul modèle est chargé à la fois et le choix est conservé dans `config.json`. Si le chargement échoue, le moteur tente de recharger le précédent.

Pour télécharger les versions CTranslate2 avec le CLI Hugging Face :

```powershell
hf download Systran/faster-whisper-large-v3 --local-dir models/large-v3 --include model.bin config.json tokenizer.json vocabulary.json preprocessor_config.json
hf download dropbox-dash/faster-whisper-large-v3-turbo --local-dir models/large-v3-turbo --include model.bin config.json tokenizer.json vocabulary.json preprocessor_config.json
py -3.12 scripts/configure.py --model "C:\chemin\vers\base" --large models/large-v3 --turbo models/large-v3-turbo
```

Installer auparavant le CLI Hugging Face si nécessaire. Les poids FP16 représentent environ 3,09 Go pour Large-v3 et 1,62 Go pour Turbo. À l'exécution, le moteur utilise int8 sur CPU. La vitesse et la précision dépendent du matériel, de la langue et de l'audio ; le nom Turbo ne garantit pas une latence donnée sur chaque processeur.

Sources : [faster-whisper](https://github.com/SYSTRAN/faster-whisper), [Large-v3 CTranslate2](https://huggingface.co/Systran/faster-whisper-large-v3), [Large-v3 Turbo CTranslate2](https://huggingface.co/dropbox-dash/faster-whisper-large-v3-turbo).

## Construction du paquet Electron

```powershell
npm run check
npm run build
```

Le résultat est `dist/app.asar`, une archive Electron, pas un installateur autonome. Une distribution complète nécessite également Electron, Python, les dépendances et le modèle. En mode empaqueté, `worker.py`, `native_input.py`, `windows_speech.ps1`, `config.json` et `python-libs` sont attendus dans `resources/blabby-local`. Adapter les chemins de configuration à la machine cible.

## Organisation et état

- `app/main.js` : fenêtres, raccourci global, modèles et insertion.
- `app/renderer.js` : capture microphone et interface.
- `app/preload.js` : pont IPC.
- `app/overlay.*` : visualiseur du microphone.
- `worker.py` : transcription et chargement des modèles locaux.
- `native_input.py` : fenêtre active et insertion Unicode Windows.
- `scripts/` : configuration et construction du paquet.

Le prototype ne reprend pas les modes IA, comptes, paiements ou synchronisation de l'ancien serveur. Les sources originales compilées et les binaires de l'application d'origine ne sont pas inclus. Modèles, dépendances installées, configurations personnelles, journaux et enregistrements sont exclus de Git.

Le parcours de dictée et l'insertion Unicode ont été testés dans Bloc-notes avec un audio synthétique fourni au microphone de test Chromium : texte avec accents inséré, presse-papiers inchangé. Le bandeau, son retrait immédiat et le fonctionnement après fermeture de la fenêtre principale ont aussi été observés. Cela ne garantit pas la précision sur une voix humaine ni la compatibilité avec tous les champs.

La validation des modèles et les temps observés sur un court audio synthétique sont détaillés dans [MODEL-VALIDATION.md](MODEL-VALIDATION.md).

Si Ctrl + Espace est lancé depuis Blabby, sélectionner ensuite le champ de destination et arrêter la dictée depuis ce champ. La destination est alors capturée à l'arrêt. Depuis une autre application, la destination reste celle capturée au démarrage. Une erreur d'insertion externe ne rouvre plus automatiquement Blabby au premier plan.


Au démarrage, si le modèle sélectionné manque ou ne se charge pas, Blabby tente automatiquement Base, affiche un avertissement et mémorise ce retour à Base. Les chemins locaux sont vérifiés avant chargement pour éviter de les interpréter comme des noms de modèles en ligne.


## Small et démarrage du raccourci

Le processus Windows d'insertion est préparé au lancement de Blabby puis réutilisé pour les dictées. L'actualisation de la liste des microphones se fait après le démarrage de l'enregistrement. Le micro est toujours libéré à l'arrêt : aucun enregistrement permanent. La capsule s'affiche pendant la préparation, puis devient rouge quand le micro enregistre.

Pour ajouter Small (inclure son fichier vocabulary.txt) :

```powershell
hf download Systran/faster-whisper-small --local-dir models/small --include model.bin config.json tokenizer.json vocabulary.txt
py -3.12 scripts/configure.py --model "C:\chemin\vers\base" --small models/small
```

Sur l'installation de développement, les modèles Small, Large-v3 et Turbo sont conservés sous Documents/Codex/BlabbyModels pour éviter la redirection du dossier AppData/Local par le conteneur Windows de Codex. Chaque machine doit renseigner ses propres chemins.

## Moteur Windows local

Le sélecteur propose **Windows local — SAPI** en plus de Whisper. Il utilise System.Speech dans Windows PowerShell 5 et un pack de reconnaissance Windows installé (fr-FR testé). Ce moteur local est distinct de Win + H et de Voice Access. Le microphone est celui par défaut de Windows ; le sélecteur de micro et l’import de fichiers sont désactivés dans ce mode. Une langue non installée affiche une erreur.

Les hypothèses apparaissent pendant la dictée dans Blabby et peuvent changer. Le texte final est inséré à l’arrêt de Ctrl + Espace, sans modifier le presse-papiers. Le choix du moteur est enregistré dans config.json (engine), séparément du dernier modèle Whisper (selectedModel). Whisper reste chargé pour faciliter le retour. Le processus SAPI est préparé au lancement, mais ne capture le micro que pendant une dictée.

`windows_speech.ps1` : service JSON-lines de reconnaissance locale, hypothèses et niveau audio. `main.js` le pilote via IPC ; `renderer.js` affiche les résultats provisoires. Windows PowerShell et un recognizer SAPI installé sont nécessaires.

Validation : audio synthétique français reconnu, résultats provisoires affichés dans l’interface, résultat final avec accents inséré dans un champ de navigateur via Ctrl + Espace, presse-papiers inchangé. Le test ne mesure pas la précision sur une voix humaine. Whisper continue de transcrire après l’arrêt ; son affichage progressif n’est pas implémenté.

Le raccourci lance désormais le microphone sans attendre la réponse du helper de capture de fenêtre. La destination est récupérée en parallèle et attendue avant insertion. Cela supprime une attente logicielle ; l’ouverture du périphérique conserve sa propre latence. Aucun tampon audio permanent ni écoute hors dictée n’est ajouté.
