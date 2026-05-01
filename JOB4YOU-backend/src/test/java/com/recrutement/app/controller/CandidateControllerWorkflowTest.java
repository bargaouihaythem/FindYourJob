package com.recrutement.app.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.recrutement.app.dto.CandidateResponse;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Candidate.CandidateStatus;
import com.recrutement.app.security.jwt.AuthEntryPointJwt;
import com.recrutement.app.security.jwt.JwtUtils;
import com.recrutement.app.security.services.UserDetailsServiceImpl;
import com.recrutement.app.service.CandidateService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Tests de workflow HTTP complet : Security → Controller → Service (mock).
 *
 * Simule les actions réelles de chaque rôle :
 *   Candidat  → POST   /api/candidates/apply         (public)
 *   RH        → PATCH  /api/candidates/{id}/status   (HR/ADMIN)
 *   Manager   → GET    /api/candidates/validated     (MANAGER/HR/ADMIN)
 *   Admin     → GET    /api/candidates               (HR/ADMIN/MANAGER)
 *   Anonyme   → 401 Unauthorized
 */
@WebMvcTest(CandidateController.class)
@Import(CandidateControllerWorkflowTest.MethodSecurityConfig.class)
@DisplayName("CandidateController — Workflow HTTP complet")
class CandidateControllerWorkflowTest {

    /** Active @PreAuthorize dans le contexte @WebMvcTest (non chargé par défaut). */
    @TestConfiguration
    @EnableMethodSecurity(prePostEnabled = true)
    static class MethodSecurityConfig {}

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    // Mocks nécessaires pour le contexte Spring Security (@WebMvcTest)
    @MockBean CandidateService      candidateService;
    @MockBean UserDetailsServiceImpl userDetailsService;
    @MockBean AuthEntryPointJwt     authEntryPoint;
    @MockBean JwtUtils              jwtUtils;

    // ─── Helpers ────────────────────────────────────────────────────────────

    private CandidateResponse fakeResponse(Long id, CandidateStatus status) {
        CandidateResponse r = new CandidateResponse();
        r.setId(id);
        r.setFirstName("Alice");
        r.setLastName("Dupont");
        r.setEmail("alice@example.com");
        r.setStatus(status);
        r.setApplicationDate(LocalDateTime.now());
        return r;
    }

    // ════════════════════════════════════════════════════════════════════════
    // ÉTAPE 1 : Candidat voit les offres (GET /api/candidates non autorisé pour lui)
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("Accès non authentifié → 401")
    class AnonymousAccessTests {

        @Test
        @DisplayName("GET /api/candidates sans token → 401 Unauthorized")
        void anonymous_getCandidates_returns401() throws Exception {
            mockMvc.perform(get("/api/candidates"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("GET /api/candidates/validated sans token → 401 Unauthorized")
        void anonymous_getValidated_returns401() throws Exception {
            mockMvc.perform(get("/api/candidates/validated"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("PATCH /api/candidates/1/status sans token → 401 Unauthorized")
        void anonymous_updateStatus_returns401() throws Exception {
            mockMvc.perform(patch("/api/candidates/1/status")
                    .with(csrf())
                    .param("status", "CV_REVIEWED"))
                    .andExpect(status().isUnauthorized());
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // ÉTAPE 2 : CANDIDAT (ROLE_USER) — accès refusé à la gestion
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("ROLE_USER (Candidat) — accès restreint")
    class CandidateRoleTests {

        @Test
        @WithMockUser(roles = "USER")
        @DisplayName("Candidat ne peut PAS lister tous les candidats → 403")
        void candidate_cannotListAllCandidates() throws Exception {
            // @PreAuthorize requiert HR/ADMIN/MANAGER — USER doit être rejeté
            when(candidateService.getAllCandidates(any()))
                    .thenReturn(new PageImpl<>(List.of(), PageRequest.of(0, 10), 0));

            mockMvc.perform(get("/api/candidates"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @WithMockUser(roles = "USER")
        @DisplayName("Candidat ne peut PAS changer le statut → 403")
        void candidate_cannotUpdateStatus() throws Exception {
            mockMvc.perform(patch("/api/candidates/1/status")
                    .param("status", "CV_REVIEWED"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @WithMockUser(username = "alice@example.com", roles = "USER")
        @DisplayName("Candidat peut voir ses propres candidatures par email")
        void candidate_canGetOwnApplicationsByEmail() throws Exception {
            when(candidateService.getCandidatesByEmail("alice@example.com"))
                    .thenReturn(List.of(fakeResponse(1L, CandidateStatus.APPLIED)));

            mockMvc.perform(get("/api/candidates/by-email/alice@example.com"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].status").value("APPLIED"))
                    .andExpect(jsonPath("$[0].email").value("alice@example.com"));
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // ÉTAPE 3 : RH — valide administrativement le dossier
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("ROLE_HR — Validation administrative des dossiers")
    class HrRoleTests {

        @Test
        @WithMockUser(roles = "HR")
        @DisplayName("RH voit tous les candidats (GET /api/candidates)")
        void hr_canListAllCandidates() throws Exception {
            when(candidateService.getAllCandidates(any()))
                    .thenReturn(new PageImpl<>(List.of(
                            fakeResponse(1L, CandidateStatus.APPLIED),
                            fakeResponse(2L, CandidateStatus.APPLIED)
                    ), PageRequest.of(0, 10), 2));

            mockMvc.perform(get("/api/candidates"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].status").value("APPLIED"));
        }

        @Test
        @WithMockUser(roles = "HR")
        @DisplayName("RH valide un dossier → PATCH /api/candidates/1/status?status=CV_REVIEWED → Agent 2 déclenché")
        void hr_validatesCandidate_triggersAgent2() throws Exception {
            CandidateResponse updated = fakeResponse(1L, CandidateStatus.CV_REVIEWED);
            when(candidateService.updateCandidateStatus(1L, CandidateStatus.CV_REVIEWED))
                    .thenReturn(updated);

            mockMvc.perform(patch("/api/candidates/1/status")
                    .with(csrf())
                    .param("status", "CV_REVIEWED"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("CV_REVIEWED"));

            // Vérifie que le service a bien été appelé (qui lui déclenche Agent 2)
            verify(candidateService).updateCandidateStatus(1L, CandidateStatus.CV_REVIEWED);
        }

        @Test
        @WithMockUser(roles = "HR")
        @DisplayName("RH peut rejeter un candidat → REJECTED")
        void hr_canRejectCandidate() throws Exception {
            when(candidateService.updateCandidateStatus(3L, CandidateStatus.REJECTED))
                    .thenReturn(fakeResponse(3L, CandidateStatus.REJECTED));

            mockMvc.perform(patch("/api/candidates/3/status")
                    .with(csrf())
                    .param("status", "REJECTED"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("REJECTED"));
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // ÉTAPE 4 : MANAGER — voit uniquement les dossiers validés par RH
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("ROLE_MANAGER — Vue technique (dossiers validés par RH)")
    class ManagerRoleTests {

        @Test
        @WithMockUser(roles = "MANAGER")
        @DisplayName("Manager voit les dossiers validés par RH (GET /api/candidates/validated)")
        void manager_seesOnlyValidatedCandidates() throws Exception {
            when(candidateService.getValidatedCandidatesForManager())
                    .thenReturn(List.of(
                            fakeResponse(1L, CandidateStatus.CV_REVIEWED),
                            fakeResponse(2L, CandidateStatus.INTERVIEW)
                    ));

            mockMvc.perform(get("/api/candidates/validated"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(2))
                    .andExpect(jsonPath("$[0].status").value("CV_REVIEWED"))
                    .andExpect(jsonPath("$[1].status").value("INTERVIEW"));
        }

        @Test
        @WithMockUser(roles = "MANAGER")
        @DisplayName("Manager NE PEUT PAS changer le statut d'un candidat → 403")
        void manager_cannotUpdateStatus() throws Exception {
            mockMvc.perform(patch("/api/candidates/1/status")
                    .with(csrf())
                    .param("status", "INTERVIEW"))
                    .andExpect(status().isForbidden());
        }

        @Test
        @WithMockUser(roles = "MANAGER")
        @DisplayName("Manager peut voir un candidat par ID")
        void manager_canGetCandidateById() throws Exception {
            when(candidateService.getCandidateById(5L))
                    .thenReturn(fakeResponse(5L, CandidateStatus.TECHNICAL_TEST));

            mockMvc.perform(get("/api/candidates/5"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(5))
                    .andExpect(jsonPath("$.status").value("TECHNICAL_TEST"));
        }
    }

    // ════════════════════════════════════════════════════════════════════════
    // ÉTAPE 5 : ADMIN — accès complet
    // ════════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("ROLE_ADMIN — Supervision complète")
    class AdminRoleTests {

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("Admin voit tous les candidats")
        void admin_canListAllCandidates() throws Exception {
            when(candidateService.getAllCandidates(any()))
                    .thenReturn(new PageImpl<>(List.of(
                            fakeResponse(1L, CandidateStatus.APPLIED),
                            fakeResponse(2L, CandidateStatus.CV_REVIEWED),
                            fakeResponse(3L, CandidateStatus.ACCEPTED)
                    ), PageRequest.of(0, 10), 3));

            mockMvc.perform(get("/api/candidates"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[2].status").value("ACCEPTED"));
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("Admin peut voir les dossiers validés aussi")
        void admin_canGetValidatedCandidates() throws Exception {
            when(candidateService.getValidatedCandidatesForManager())
                    .thenReturn(List.of(fakeResponse(1L, CandidateStatus.FINAL_INTERVIEW)));

            mockMvc.perform(get("/api/candidates/validated"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].status").value("FINAL_INTERVIEW"));
        }

        @Test
        @WithMockUser(roles = "ADMIN")
        @DisplayName("Admin peut supprimer un candidat")
        void admin_canDeleteCandidate() throws Exception {
            mockMvc.perform(delete("/api/candidates/99")
                    .with(csrf()))
                    .andExpect(status().isOk());

            verify(candidateService).deleteCandidate(99L);
        }
    }
}
