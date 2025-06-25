# 🚨 CORRECTION URGENTE - Contrainte job_offer_id

## Problème Identifié

La contrainte `NOT NULL` sur `job_offer_id` existe toujours dans la base de données malgré notre modification de l'entité Java. **Hibernate avec `ddl-auto=update` ne modifie pas les contraintes existantes**.

## Solutions Possibles

### Option A : Modification Manuelle SQL (RECOMMANDÉE)

1. **Se connecter à PostgreSQL** :
   ```bash
   psql -U postgres -d rh_db
   ```

2. **Exécuter la commande SQL** :
   ```sql
   ALTER TABLE candidates ALTER COLUMN job_offer_id DROP NOT NULL;
   ```

3. **Vérifier la modification** :
   ```sql
   SELECT column_name, is_nullable FROM information_schema.columns 
   WHERE table_name = 'candidates' AND column_name = 'job_offer_id';
   ```

4. **Redémarrer l'application** avec `ddl-auto=update`

### Option B : Recréation du Schéma (DESTRUCTIVE)

1. **Modifier application.properties** (déjà fait) :
   ```properties
   spring.jpa.hibernate.ddl-auto=create-drop
   ```

2. **Redémarrer l'application** :
   ```bash
   mvn spring-boot:run
   ```

3. **Remettre `update`** après le premier démarrage

## Script SQL Prêt à l'Emploi

Exécuter ce script dans PostgreSQL :

```sql
-- Connexion à la base
\c rh_db;

-- Vérifier l'état actuel
SELECT column_name, is_nullable, data_type
FROM information_schema.columns 
WHERE table_name = 'candidates' AND column_name = 'job_offer_id';

-- Corriger la contrainte
ALTER TABLE candidates ALTER COLUMN job_offer_id DROP NOT NULL;

-- Vérifier la correction
SELECT column_name, is_nullable, data_type
FROM information_schema.columns 
WHERE table_name = 'candidates' AND column_name = 'job_offer_id';

-- Confirmation
SELECT 'CONTRAINTE CORRIGEE AVEC SUCCES!' as status;
```

## Test de Validation

Après la correction, tester avec :

```bash
# Test via PowerShell
powershell -ExecutionPolicy Bypass -File test-candidate.ps1

# Ou via navigateur
# Ouvrir test-candidate.html
```

## Résultat Attendu

Si la correction fonctionne :
```
✅ SUCCESS: Candidat créé avec succès sans offre d'emploi !
   JobOffer: null (OK)
```

## Action Immédiate Requise

1. ✅ Choisir l'Option A (SQL manuel) ou Option B (recréation)
2. ✅ Appliquer la correction
3. ✅ Tester avec notre endpoint de diagnostic
4. ✅ Valider le workflow CV Improvement complet

---

**Status** : 🔴 BLOQUANT - La contrainte doit être corrigée pour que CV Improvement fonctionne
