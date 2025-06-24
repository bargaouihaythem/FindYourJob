#!/bin/bash

# Script de test des rôles et permissions
# Assurez-vous que votre backend est démarré sur http://localhost:8080

BASE_URL="http://localhost:8080/api"

echo "=== Test des Rôles et Permissions - Application de Recrutement ==="
echo

# Fonction pour tester l'authentification
test_auth() {
    local username=$1
    local password=$2
    local role=$3
    
    echo "Test d'authentification pour $role ($username)..."
    
    response=$(curl -s -X POST "$BASE_URL/auth/signin" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$username\",\"password\":\"$password\"}")
    
    token=$(echo $response | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$token" ]; then
        echo "✅ Authentification réussie pour $role"
        echo "Token: ${token:0:20}..."
        return 0
    else
        echo "❌ Échec de l'authentification pour $role"
        echo "Réponse: $response"
        return 1
    fi
}

# Fonction pour tester la création d'entretien
test_create_interview() {
    local token=$1
    local role=$2
    
    echo "Test de création d'entretien pour $role..."
    
    response=$(curl -s -X POST "$BASE_URL/interviews" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d '{
            "candidateId": 1,
            "jobOfferId": 1,
            "interviewerId": 2,
            "interviewDate": "2024-02-15T10:00:00",
            "durationMinutes": 60,
            "location": "Salle de réunion A",
            "type": "VIDEO",
            "notes": "Entretien technique"
        }')
    
    if echo "$response" | grep -q '"id"'; then
        echo "✅ $role peut créer des entretiens"
        return 0
    elif echo "$response" | grep -q "403\|Forbidden\|Access Denied"; then
        echo "❌ $role ne peut PAS créer des entretiens (403 Forbidden)"
        return 1
    else
        echo "⚠️  Réponse inattendue pour $role: $response"
        return 1
    fi
}

# Fonction pour tester la consultation d'entretiens
test_view_interviews() {
    local token=$1
    local role=$2
    
    echo "Test de consultation d'entretiens pour $role..."
    
    response=$(curl -s -X GET "$BASE_URL/interviews" \
        -H "Authorization: Bearer $token")
    
    if echo "$response" | grep -q '\['; then
        echo "✅ $role peut consulter les entretiens"
        return 0
    elif echo "$response" | grep -q "403\|Forbidden\|Access Denied"; then
        echo "❌ $role ne peut PAS consulter les entretiens (403 Forbidden)"
        return 1
    else
        echo "⚠️  Réponse inattendue pour $role: $response"
        return 1
    fi
}

# Données de test pour chaque rôle
declare -A test_users=(
    ["HR"]="hr@company.com:hr123456"
    ["ADMIN"]="admin@company.com:admin123456"
    ["MANAGER"]="manager@company.com:manager123456"
    ["USER"]="candidate@company.com:candidate123456"
)

echo "Création des utilisateurs de test..."
echo

# Créer les utilisateurs de test
for role in "${!test_users[@]}"; do
    IFS=':' read -r username password <<< "${test_users[$role]}"
    
    echo "Création de l'utilisateur $role ($username)..."
    
    role_lower=$(echo "$role" | tr '[:upper:]' '[:lower:]')
    
    response=$(curl -s -X POST "$BASE_URL/auth/signup" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$username\",\"email\":\"$username\",\"password\":\"$password\",\"role\":[\"$role_lower\"]}")
    
    if echo "$response" | grep -q "success\|registered\|created"; then
        echo "✅ Utilisateur $role créé avec succès"
    elif echo "$response" | grep -q "already\|exists"; then
        echo "ℹ️  Utilisateur $role existe déjà"
    else
        echo "⚠️  Réponse pour création $role: $response"
    fi
    echo
done

echo "=========================================="
echo "Test des permissions par rôle"
echo "=========================================="
echo

# Tester chaque rôle
for role in "${!test_users[@]}"; do
    IFS=':' read -r username password <<< "${test_users[$role]}"
    
    echo "--- Test pour $role ($username) ---"
    
    # Test d'authentification
    response=$(curl -s -X POST "$BASE_URL/auth/signin" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$username\",\"password\":\"$password\"}")
    
    token=$(echo $response | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
    
    if [ -n "$token" ]; then
        echo "✅ Authentification réussie"
        
        # Test de consultation d'entretiens
        test_view_interviews "$token" "$role"
        
        # Test de création d'entretien
        test_create_interview "$token" "$role"
        
    else
        echo "❌ Échec de l'authentification"
        echo "Réponse: $response"
    fi
    
    echo
done

echo "=========================================="
echo "Résumé des permissions attendues:"
echo "=========================================="
echo "HR:       ✅ Créer, ✅ Consulter, ✅ Modifier, ✅ Supprimer"
echo "ADMIN:    ✅ Créer, ✅ Consulter, ✅ Modifier, ✅ Supprimer"
echo "MANAGER:  ❌ Créer, ✅ Consulter (limité), ✅ Modifier statut"
echo "USER:     ❌ Créer, ✅ Consulter (ses propres entretiens)"
echo
echo "=========================================="
echo "Recommendations:"
echo "=========================================="
echo "1. Seuls HR et ADMIN peuvent créer des entretiens"
echo "2. MANAGER peut consulter et modifier le statut"
echo "3. USER (candidats) ne voient que leurs propres entretiens"
echo "4. Considérez d'ajouter TEAM_LEAD et SENIOR_DEV aux permissions"
