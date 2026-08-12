# Nettoyage de sécurité obligatoire avant publication

Le dépôt a déjà été assaini dans son état courant : les valeurs sensibles de la configuration principale ont été remplacées par des variables d’environnement, les comptes et mots de passe de démonstration ne sont plus documentés en clair et les workflows n8n utilisent une adresse d’expédition configurable.

## Actions indispensables

Les secrets qui ont été présents dans une version publique doivent être considérés comme compromis. Il faut révoquer et renouveler les accès concernés : mot de passe ou clé SMTP, secret JWT, clé n8n, mot de passe PostgreSQL et toute clé de service IA.

La suppression d’une valeur dans le dernier commit ne suffit pas si elle existe dans l’historique Git. Avant de publier les corrections, créer une sauvegarde du dépôt, nettoyer l’historique avec un outil adapté comme `git filter-repo` ou BFG Repo-Cleaner, puis effectuer un push forcé coordonné avec les collaborateurs.

Exemple de procédure à exécuter uniquement après sauvegarde et validation :

```bash
git clone --mirror <URL_DU_DEPOT> FindYourJob-clean.git
cd FindYourJob-clean.git

# Installer et utiliser git-filter-repo selon la procédure officielle.
# Remplacer les fichiers ou motifs concernés par des placeholders.
git filter-repo --path JOB4YOU-backend/src/main/resources/application.properties --invert-paths

git push --force --all origin
git push --force --tags origin
```

Cette commande retire le fichier entier de l’historique. Si le fichier doit rester dans le projet, il faut ensuite republier une version sans secret et réorganiser les commits selon la stratégie de l’équipe. Ne jamais lancer un push forcé sans confirmation des autres contributeurs.

## Règles permanentes

Les secrets doivent être injectés par variables d’environnement, gestionnaire de secrets ou fichier local ignoré. Les valeurs de test doivent être générées localement et ne doivent pas être réutilisées en production. Les logs ne doivent jamais afficher un mot de passe, un token, un CV ou une clé SMTP.
