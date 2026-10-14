# Validation des modèles — 13 octobre 2026

Machine : Intel Core i5-1240P, 16 Go de RAM. faster-whisper 1.2.1, CTranslate2 4.8.2, CPU int8, six threads, beam_size=3. Aucun GPU CUDA.

Les deux nouveaux fichiers de poids ont été téléchargés et contrôlés en SHA-256 :

- Large-v3 : 3 087 284 237 octets, `69f74147e3334731bc3a76048724833325d2ec74642fb52620eda87352e3d4f1`.
- Large-v3 Turbo : 1 617 884 929 octets, `e76620f83d5f5b69efd3d87e3dc180c1bd21df9fbebacfd4335e5e1efcc018da`.

Test du protocole du moteur : Base → Turbo → Base puis Base → Large-v3 → Base, avec transcription à chaque étape. Le moteur refuse les connexions réseau et charge uniquement les fichiers locaux.

Audio synthétique français : 4,543875 secondes, phrase attendue « Bonjour, ceci est un test de transcription locale. ». Tous les résultats correspondent exactement à cette phrase.

| Modèle | Transcription mesurée | Chargement lors du changement |
|---|---:|---:|
| Base | 0,84 à 1,30 s | 0,60 à 0,77 s lors du retour |
| Large-v3 Turbo | 10,31 s | 4,49 s |
| Large-v3 | 12,25 s | 12,80 s |

Ces mesures proviennent de tests ponctuels sur un très court audio, pendant les travaux sur cette machine. Elles ne constituent pas un benchmark général ni une comparaison de précision sur une voix humaine. Tester plusieurs enregistrements représentatifs pour choisir le modèle.

Le menu de l'exécutable installé a également permis de charger Turbo puis de revenir à Base, avec état de chargement visible, dictée désactivée et choix enregistré dans la configuration.

Le menu de l'exécutable installé a également chargé Large-v3, puis permis le retour à Base. Les trois choix sont disponibles ; Base est laissé actif à la fin de la validation.

Validation complémentaire du ciblage : Turbo avec microphone de test Chromium, texte Unicode effectivement observé dans la zone de texte d'une page locale Comet. Deux départs testés : champ web déjà actif ; départ depuis Blabby puis choix du champ avant l'arrêt. Empreinte du presse-papiers identique dans les deux cas. L'application a ensuite été relancée avec le microphone réel, en conservant Turbo sélectionné.

Correction d'encodage : le module d'insertion lit explicitement le pipe Electron en UTF-8, au lieu de l'encodage Windows implicite. Validation avec Turbo et audio synthétique accentué : santé, nécessite, réunion, à, hôpital et coût apparaissent correctement dans la zone de texte Comet. Le micro réel est réactivé après le test.

Visualiseur pendant le traitement : test avec Turbo, audio synthétique et champ Comet. Après l'arrêt, la capsule reste visible avec une animation bleue ; après insertion du texte dans le navigateur, elle disparaît. L'état de traitement dépend de la fin effective de la transcription et de l'insertion, sans délai fixe par modèle.

14 octobre 2026 : test avec dossier Turbo volontairement absent, démarrage sur Base et transcription réussie. Puis test intégré dans l'exécutable installé avec les vrais fichiers Turbo : démarrage et transcription de la phrase synthétique réussis. L'indisponibilité temporaire du dossier signalée par l'utilisateur n'a pas été reproduite ; les fichiers étaient présents pendant le diagnostic.

14 octobre : Small installé et SHA256 des poids vérifié (`3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671`). Son fichier vocabulary.txt est requis. Test Base → Small → Base réussi ; transcription de la phrase synthétique de 4,54 secondes en 8,40 secondes avec Small pendant ces travaux (pas une garantie de latence ni de précision).

Sur l'exécutable installé, deux démarrages par Ctrl + Espace avec microphone simulé ont été mesurés à 258 ms et 132 ms entre la prise en compte du raccourci et la confirmation de l'enregistrement. Le même processus d'intégration Windows a été réutilisé. La latence du vrai micro peut différer. Les caractères accentués ont été observés dans le champ Comet ; la précision linguistique sur les phrases tronquées n'est pas évaluée par ce test.

La seconde dictée a aussi conservé le presse-papiers (empreinte identique après les interactions de préparation du navigateur). L'application est ensuite relancée avec le vrai micro, Small sélectionné. Les fichiers Large-v3 et Turbo copiés dans le dossier stable ont également conservé leurs empreintes SHA256.
