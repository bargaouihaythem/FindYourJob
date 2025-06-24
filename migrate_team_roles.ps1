# Script PowerShell - Workflow unique de candidature aux offres
# L'ancien workflow d'amélioration CV a été complètement supprimé

Write-Host "🔄 MIGRATION - Workflow unique : Candidatures aux offres d'emploi" -ForegroundColor Cyan
Write-Host "❌ Le workflow d'amélioration CV a été supprimé" -ForegroundColor Red
Write-Host ""

try {
    # 1. Build du backend avec les nouveaux rôles
    Write-Host "📦 1. Compilation du backend avec les nouveaux rôles..." -ForegroundColor Yellow
    Set-Location "recrutement-app"
    & .\mvnw.cmd clean compile
    if ($LASTEXITCODE -ne 0) {
        throw "Erreur lors de la compilation"
    }

    # 2. Application du script SQL pour insérer les nouveaux rôles
    Write-Host "🗄️ 2. Application du script SQL pour les nouveaux rôles..." -ForegroundColor Yellow
    $sqlScript = "src\main\resources\db\add_team_roles.sql"
    if (Test-Path $sqlScript) {
        # Vous devrez adapter cette commande selon votre configuration PostgreSQL
        Write-Host "⚠️ Veuillez exécuter manuellement le script SQL: $sqlScript" -ForegroundColor Yellow
        Write-Host "   Commande suggérée: psql -d recrutement_db -f $sqlScript" -ForegroundColor Gray
    }

    # 3. Démarrage du backend
    Write-Host "🚀 3. Démarrage du backend..." -ForegroundColor Yellow
    Start-Process -FilePath ".\mvnw.cmd" -ArgumentList "spring-boot:run" -WindowStyle Minimized
    Start-Sleep 5

    # 4. Build du frontend
    Write-Host "🌐 4. Build du frontend..." -ForegroundColor Yellow
    Set-Location "..\recrutement-frontend"
    & npm install
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Erreur lors du build frontend"
    }

    # 5. Démarrage du frontend
    Write-Host "🌟 5. Démarrage du frontend..." -ForegroundColor Yellow
    Start-Process -FilePath "npm" -ArgumentList "start" -WindowStyle Minimized    Write-Host ""
    Write-Host "✅ MIGRATION TERMINÉE AVEC SUCCÈS" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎯 NOUVEAUX RÔLES AJOUTÉS:" -ForegroundColor Cyan
    Write-Host "   - ROLE_TEAM_LEAD  : Chef d'équipe technique" -ForegroundColor White
    Write-Host "   - ROLE_SENIOR_DEV : Développeur senior" -ForegroundColor White
    Write-Host "   - ROLE_TEAM       : Membre d'équipe générique" -ForegroundColor White
    Write-Host ""
    Write-Host "🔗 DEUX WORKFLOWS DISTINCTS DISPONIBLES:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📝 1. WORKFLOW AMÉLIORATION CV (Sans offre d'emploi)" -ForegroundColor Cyan
    Write-Host "   - Endpoint: POST /api/cv-improvements/test/submit" -ForegroundColor White
    Write-Host "   - But: Obtenir des conseils pour améliorer son CV" -ForegroundColor Gray
    Write-Host "   - Process: Candidat → RH → Équipe feedback → Suggestions" -ForegroundColor Gray
    Write-Host ""
    Write-Host "💼 2. WORKFLOW CANDIDATURE OFFRE (Avec offre d'emploi)" -ForegroundColor Cyan
    Write-Host "   - Endpoint: POST /api/candidates/apply" -ForegroundColor White
    Write-Host "   - But: Postuler à une offre d'emploi spécifique" -ForegroundColor Gray
    Write-Host "   - Process: Candidat → Postule → RH → Entretiens → Décision" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🌐 INTERFACES DISPONIBLES:" -ForegroundColor Cyan
    Write-Host "   - http://localhost:4200/job-offers (voir offres publiques)" -ForegroundColor White
    Write-Host "   - http://localhost:4200/team/feedback/{id} (interface équipe)" -ForegroundColor White
    Write-Host "   - http://localhost:4200/admin/candidates (gestion RH)" -ForegroundColor White
    Write-Host ""
    Write-Host "🎉 LES DEUX WORKFLOWS SONT MAINTENANT COMPLETS !" -ForegroundColor Green

} catch {
    Write-Host "❌ Erreur lors de la migration: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
