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
