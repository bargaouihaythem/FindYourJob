package com.recrutement.app.controller;

import com.recrutement.app.config.WebSecurityConfig;
import com.recrutement.app.dto.CandidateResponse;
import com.recrutement.app.entity.Candidate.CandidateStatus;
import com.recrutement.app.security.jwt.AuthEntryPointJwt;
import com.recrutement.app.security.jwt.JwtUtils;
import com.recrutement.app.security.jwt.N8nApiKeyAuthenticationFilter;
import com.recrutement.app.security.services.UserDetailsServiceImpl;
import com.recrutement.app.service.CandidateService;
import com.recrutement.app.service.N8nRequestAuthenticator;
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

/** Vérifie le refus des appels anonymes et l'authentification machine n8n. */
@WebMvcTest(CandidateController.class)
@Import({WebSecurityConfig.class, AuthEntryPointJwt.class, N8nApiKeyAuthenticationFilter.class})
@DisplayName("CandidateController — statut : JWT ou clé n8n obligatoire")
class CandidateStatusAnonymousSecurityTest {

    @Autowired MockMvc mockMvc;

    @MockBean CandidateService candidateService;
    @MockBean PdfReportService pdfReportService;
    @MockBean UserDetailsServiceImpl userDetailsService;
    @MockBean JwtUtils jwtUtils;
    @MockBean N8nRequestAuthenticator n8nRequestAuthenticator;

    private CandidateResponse fakeResponse(Long id, CandidateStatus status) {
        CandidateResponse r = new CandidateResponse();
        r.setId(id);
        r.setStatus(status);
        r.setApplicationDate(LocalDateTime.now());
        return r;
    }

    @Test
    @DisplayName("anonyme + CV_REVIEWED → 401")
    void anonymousCannotSetCvReviewed() throws Exception {
        mockMvc.perform(patch("/api/candidates/1/status")
                        .with(csrf())
                        .param("status", "CV_REVIEWED"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("clé n8n valide + CV_REVIEWED → 200")
    void validN8nKeyCanSetCvReviewed() throws Exception {
        when(n8nRequestAuthenticator.isValid("test-key")).thenReturn(true);
        when(candidateService.updateCandidateStatus(1L, CandidateStatus.CV_REVIEWED))
                .thenReturn(fakeResponse(1L, CandidateStatus.CV_REVIEWED));

        mockMvc.perform(patch("/api/candidates/1/status")
                        .with(csrf())
                        .header("X-N8N-API-Key", "test-key")
                        .param("status", "CV_REVIEWED"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("clé n8n invalide + AUTO_REJECTED → 401")
    void invalidN8nKeyCannotSetAutoRejected() throws Exception {
        when(n8nRequestAuthenticator.isValid("wrong-key")).thenReturn(false);

        mockMvc.perform(patch("/api/candidates/1/status")
                        .with(csrf())
                        .header("X-N8N-API-Key", "wrong-key")
                        .param("status", "AUTO_REJECTED"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("anonyme + ACCEPTED → 401")
    void anonymousCannotSetAccepted() throws Exception {
        mockMvc.perform(patch("/api/candidates/1/status")
                        .with(csrf())
                        .param("status", "ACCEPTED"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("anonyme + HIRED → 401")
    void anonymousCannotSetHired() throws Exception {
        mockMvc.perform(patch("/api/candidates/1/status")
                        .with(csrf())
                        .param("status", "HIRED"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("anonyme + REJECTED → 401")
    void anonymousCannotSetRejectedDirectly() throws Exception {
        mockMvc.perform(patch("/api/candidates/1/status")
                        .with(csrf())
                        .param("status", "REJECTED"))
                .andExpect(status().isUnauthorized());
    }
}
