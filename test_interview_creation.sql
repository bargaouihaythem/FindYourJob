-- Script pour créer un entretien de test pour imen@gmail.com

-- 1. Vérifier s'il y a un candidat avec cet email
SELECT * FROM candidates WHERE email = 'imen@gmail.com';

-- 2. Vérifier s'il y a des utilisateurs pour être interviewers
SELECT * FROM users WHERE id IN (
    SELECT user_id FROM user_roles ur 
    JOIN roles r ON ur.role_id = r.id 
    WHERE r.name IN ('ROLE_HR', 'ROLE_MANAGER', 'ROLE_ADMIN')
);

-- 3. Créer un entretien de test (ajustez les IDs selon vos données)
-- Remplacez candidate_id et interviewer_id par les vrais IDs de votre base
INSERT INTO interviews (
    candidate_id, 
    interviewer_id, 
    interview_date, 
    type, 
    status, 
    duration_minutes, 
    location, 
    notes,
    created_at,
    updated_at
) VALUES (
    (SELECT id FROM candidates WHERE email = 'imen@gmail.com' LIMIT 1), -- candidate_id
    (SELECT u.id FROM users u 
     JOIN user_roles ur ON u.id = ur.user_id 
     JOIN roles r ON ur.role_id = r.id 
     WHERE r.name = 'ROLE_HR' LIMIT 1), -- interviewer_id (premier utilisateur HR trouvé)
    '2025-06-27 19:45:00', -- interview_date
    'TECHNICAL', -- type
    'SCHEDULED', -- status
    60, -- duration_minutes
    'Bureau - Salle de réunion A', -- location
    'Entretien technique pour le poste de développeur', -- notes
    NOW(), -- created_at
    NOW()  -- updated_at
);

-- 4. Vérifier que l'entretien a été créé
SELECT 
    i.id,
    i.interview_date,
    i.type,
    i.status,
    c.first_name,
    c.last_name,
    c.email,
    u.username as interviewer
FROM interviews i
JOIN candidates c ON i.candidate_id = c.id
JOIN users u ON i.interviewer_id = u.id
WHERE c.email = 'imen@gmail.com';
