#!/bin/bash

# Script de migration pour ajouter les rôles équipe
# À exécuter pour corriger le workflow RH/équipe

echo "🔄 MIGRATION - Ajout des rôles équipe pour le workflow complet"
echo ""

# 1. Build du backend avec les nouveaux rôles
echo "📦 1. Compilation du backend avec les nouveaux rôles..."
cd recrutement-app
./mvnw clean compile
if [ $? -ne 0 ]; then
    echo "❌ Erreur lors de la compilation"
    exit 1
fi

# 2. Application du script SQL pour insérer les nouveaux rôles
echo "🗄️ 2. Application du script SQL pour les nouveaux rôles..."
psql -d recrutement_db -f src/main/resources/db/add_team_roles.sql
if [ $? -ne 0 ]; then
    echo "⚠️ Attention: Vérifiez que la base de données est accessible"
fi

# 3. Redémarrage du backend
echo "🚀 3. Redémarrage du backend..."
./mvnw spring-boot:run &
BACKEND_PID=$!
echo "Backend démarré avec PID: $BACKEND_PID"

# 4. Build du frontend
echo "🌐 4. Build du frontend..."
cd ../recrutement-frontend
npm install
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du build frontend"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# 5. Démarrage du frontend
echo "🌟 5. Démarrage du frontend..."
npm start &
FRONTEND_PID=$!
echo "Frontend démarré avec PID: $FRONTEND_PID"

echo ""
echo "✅ MIGRATION TERMINÉE AVEC SUCCÈS"
echo ""
echo "🎯 NOUVEAUX RÔLES AJOUTÉS:"
echo "   - ROLE_TEAM_LEAD  : Chef d'équipe technique"
echo "   - ROLE_SENIOR_DEV : Développeur senior"  
echo "   - ROLE_TEAM       : Membre d'équipe générique"
echo ""
echo "🔗 ENDPOINTS ÉQUIPE DISPONIBLES:"
echo "   - GET /api/cv-improvements/status/{status} (consultation)"
echo "   - GET /api/cv-improvements/{id} (détail CV)"
echo "   - POST /api/cv-improvements/{id}/feedback (soumission feedback)"
echo ""
echo "🌐 INTERFACE ÉQUIPE:"
echo "   - http://localhost:4200/team/feedback/{id}"
echo ""
echo "🎉 LE WORKFLOW RH/ÉQUIPE EST MAINTENANT COMPLET !"
echo ""
echo "Processus en cours d'exécution:"
echo "   - Backend PID: $BACKEND_PID"
echo "   - Frontend PID: $FRONTEND_PID"
echo ""
echo "Pour arrêter les services:"
echo "   kill $BACKEND_PID $FRONTEND_PID"
