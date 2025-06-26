# 🔐 CORRECTION TÉLÉCHARGEMENT CV - AUTHENTIFICATION JWT

## ✅ Problème Résolu

Le problème d'authentification lors du téléchargement des CV a été corrigé.

### 🐛 **Problème identifié :**
```
{"path":"/api/files/cv_d0f17de055834afab50f486eb84ae34c.pdf","error":"Unauthorized","message":"Full authentication is required to access this resource","status":401}
```

**Cause :** La méthode `downloadCV()` utilisait `window.open()` qui fait une requête GET directe sans inclure les headers d'authentification JWT.

### ✅ **Solution appliquée :**

#### **Avant (problématique) :**
```typescript
downloadCV(candidate: Candidate): void {
  if (candidate.cv && candidate.cv.fileUrl) {
    window.open(candidate.cv.fileUrl, '_blank'); // ❌ Pas d'authentification
  }
}
```

#### **Après (corrigé) :**
```typescript
downloadCV(candidate: Candidate): void {
  if (candidate.cv && candidate.cv.fileUrl) {
    // ✅ Utilisation du service CV avec authentification JWT
    this.cvService.downloadFile(candidate.cv.fileUrl).subscribe({
      next: (blob: Blob) => {
        // Créer un téléchargement automatique avec le bon nom de fichier
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = candidate.cv?.originalFilename || 
                       `CV_${candidate.firstName}_${candidate.lastName}.pdf`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        this.toastrNotification.showSuccess('CV téléchargé avec succès');
      },
      error: (error: any) => {
        // Gestion des erreurs avec messages appropriés
        if (error.status === 401) {
          this.toastrNotification.showError('Erreur d\'authentification. Veuillez vous reconnecter.', 'Accès refusé');
        } else if (error.status === 404) {
          this.toastrNotification.showError('Le fichier CV n\'a pas été trouvé', 'Fichier introuvable');
        } else {
          this.toastrNotification.showError('Erreur lors du téléchargement du CV', 'Erreur de téléchargement');
        }
      }
    });
  }
}
```

### 🔧 **Fonctionnalités ajoutées :**

1. **Authentification JWT** : Les requêtes passent maintenant par l'intercepteur JWT qui ajoute automatiquement le token d'authentification

2. **Téléchargement automatique** : Le fichier se télécharge directement avec le bon nom (nom original ou nom formaté)

3. **Gestion d'erreurs avancée** :
   - **401 Unauthorized** : Message spécifique demandant de se reconnecter
   - **404 Not Found** : Message indiquant que le fichier n'existe pas
   - **Autres erreurs** : Message générique d'erreur de téléchargement

4. **Messages de succès** : Toast de confirmation quand le téléchargement réussit

5. **Nettoyage mémoire** : Révocation automatique des URLs temporaires

### 🛡️ **Service CVService utilisé :**
```typescript
downloadFile(fileUrl: string): Observable<Blob> {
  return this.http.get(fileUrl, { 
    responseType: 'blob',
    headers: new HttpHeaders({
      'Accept': 'application/octet-stream'
    })
  });
}
```

Ce service utilise automatiquement l'intercepteur JWT configuré dans l'application.

### 📱 **Test :**
1. Aller sur `/admin/candidates`
2. Cliquer sur le bouton "Télécharger CV" (icône download) d'un candidat
3. Le CV se télécharge maintenant correctement avec authentification
4. Messages d'erreur appropriés si problème d'accès

**🎉 Le téléchargement de CV fonctionne maintenant avec l'authentification JWT !**
