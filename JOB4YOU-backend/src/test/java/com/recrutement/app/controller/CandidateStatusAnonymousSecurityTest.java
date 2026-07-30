package com.recrutement.app.controller;

import com.recrutement.app.config.WebSecurityConfig;
import com.recrutement.app.dto.CandidateResponse;
import com.recrutement.app.entity.Candidate.CandidateStatus;
import com.recrutement.app.security.jwt.AuthEntryPointJwt;
import com.recrutement.app.security.jwt.JwtUtils;
import com.recrutement.app.security.services.UserDetailsServiceImpl;
import com.recrutement.app.service.CandidateService;
import com.recrutement.app.service.PdfReportService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Vérifie, avec la VRAIE configuration de sécurité ({@link WebSecurityConfig},
 * qui autorise anonymement l'URL de mise à jour de statut pour n8n), qu'un appel
 * anonyme ne peut positionner que CV_REVIEWED ou AUTO_REJECTED — jamais
 * ACCEPTED/HIRED/REJECTED en direct.
 *
 * Contrairement à CandidateControllerWorkflowTest (qui n'importe que
 * EnableMethodSecurity et hérite donc de la sécurité Spring Boot par défaut,
 * entièrement authentifiée), cette classe importe WebSecurityConfig pour que
 * les requêtes anonymes atteignent réellement l'évaluation PreAuthorize,
 * comme en production.
 *
 * {@link AuthEntryPointJwt} n'est PAS mocké ici (contrairement à
 * CandidateControllerWorkflowTest) : pour un utilisateur anonyme, Spring
 * Security délègue un AccessDeniedException à l'AuthenticationEntryPoint
 * plutôt que de renvoyer 403 directement — il faut donc la vraie implémentation
 * (qui répond 401) pour que le test reflète le comportement réel de prod.
 */
@WebMvcTest(CandidateController.class)
@Import({WebSecurityConfig.class, AuthEntryPointJwt.class})
@DisplayName("CandidateController — /status : autorisations réelles pour appels anonymes (n8n)")
class CandidateStatusAnonymousSecurityTest {

    @Autowired MockMvc mockMvc;

    @MockBean CandidateService candidateService;
    @MockBean PdfReportService pdfReportService;
    @MockBean UserDetailsServiceImpl userDetailsService;
    @MockBean JwtUtils jwtUtils;

    private CandidateResponse fakeResponse(Long id, CandidateStatus status) {
        CandidateResponse r = new CandidateResponse();
        r.setId(id);
        r.setStatus(status);
        r.setApplicationDate(LocalDateTime.now());
        return r;
    }

    @Test
    @DisplayName("anonyme + CV_REVIEWED → 200 (Agent 1 valide le score IA)")
    void anonymous_canSetCvReviewed() throws Exception {
        when(candidateService.updateCandidateStatus(1L, CandidateStatus.CV_REVIEWED))
                .thenReturn(fakeResponse(1L, CandidateStatus.CV_REVIEWED));

        mockMvc.perform(patch("/api/candidates/1/status")
                        .with(csrf())
                        .param("status", "CV_REVIEWED"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("anonyme + AUTO_REJECTED → 200 (Agent 1 rejette automatiquement)")
    void anonymous_canSetAutoRejected() throws Exception {
        when(candidateService.updateCandidateStatus(1L, CandidateStatus.AUTO_REJECTED))
                .thenReturn(fakeResponse(1L, CandidateStatus.AUTO_REJECTED));

        mockMvc.perform(patch("/api/candidates/1/status")
                        .with(csrf())
                        .param("status", "AUTO_REJECTED"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("anonyme + ACCEPTED → 401 (ne peut pas contourner RH/Manager)")
    void anonymous_cannotSetAccepted() throws Exception {
        mockMvc.perform(patch("/api/candidates/1/status")
                        .with(csrf())
                        .param("status", "ACCEPTED"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("anonyme + HIRED → 401")
    void anonymous_cannotSetHired() throws Exception {
        mockMvc.perform(patch("/api/candidates/1/status")
                        .with(csrf())
                        .param("status", "HIRED"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("anonyme + REJECTED → 401")
    void anonymous_cannotSetRejectedDirectly() throws Exception {
        mockMvc.perform(patch("/api/candidates/1/status")
                        .with(csrf())
                        .param("status", "REJECTED"))
                .andExpect(status().isUnauthorized());
    }
}
