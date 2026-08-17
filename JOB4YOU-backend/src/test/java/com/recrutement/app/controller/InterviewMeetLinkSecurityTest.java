package com.recrutement.app.controller;

import com.recrutement.app.config.WebSecurityConfig;
import com.recrutement.app.dto.InterviewResponse;
import com.recrutement.app.security.jwt.AuthEntryPointJwt;
import com.recrutement.app.security.jwt.JwtUtils;
import com.recrutement.app.security.jwt.N8nApiKeyAuthenticationFilter;
import com.recrutement.app.security.services.UserDetailsServiceImpl;
import com.recrutement.app.service.InterviewService;
import com.recrutement.app.service.N8nRequestAuthenticator;
import com.recrutement.app.service.UserService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Vérifie que le callback n8n (lien Google Meet réel) exige un JWT privilégié ou la clé n8n. */
@WebMvcTest(InterviewController.class)
@Import({WebSecurityConfig.class, AuthEntryPointJwt.class, N8nApiKeyAuthenticationFilter.class})
@DisplayName("InterviewController — meet-link : JWT privilégié ou clé n8n obligatoire")
class InterviewMeetLinkSecurityTest {

    @Autowired MockMvc mockMvc;

    @MockBean InterviewService interviewService;
    @MockBean UserService userService;
    @MockBean UserDetailsServiceImpl userDetailsService;
    @MockBean JwtUtils jwtUtils;
    @MockBean N8nRequestAuthenticator n8nRequestAuthenticator;

    private InterviewResponse fakeResponse(Long id, String meetLink) {
        InterviewResponse r = new InterviewResponse();
        r.setId(id);
        r.setMeetLink(meetLink);
        return r;
    }

    @Test
    @DisplayName("anonyme → 401")
    void anonymousCannotSaveMeetLink() throws Exception {
        mockMvc.perform(patch("/api/interviews/1/meet-link")
                        .with(csrf())
                        .param("meetLink", "https://meet.google.com/abc-defg-hij"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("clé n8n valide → 200")
    void validN8nKeyCanSaveMeetLink() throws Exception {
        when(n8nRequestAuthenticator.isValid("test-key")).thenReturn(true);
        when(interviewService.saveMeetLink(1L, "https://meet.google.com/abc-defg-hij"))
                .thenReturn(fakeResponse(1L, "https://meet.google.com/abc-defg-hij"));

        mockMvc.perform(patch("/api/interviews/1/meet-link")
                        .with(csrf())
                        .header("X-N8N-API-Key", "test-key")
                        .param("meetLink", "https://meet.google.com/abc-defg-hij"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("clé n8n invalide → 401")
    void invalidN8nKeyCannotSaveMeetLink() throws Exception {
        when(n8nRequestAuthenticator.isValid("wrong-key")).thenReturn(false);

        mockMvc.perform(patch("/api/interviews/1/meet-link")
                        .with(csrf())
                        .header("X-N8N-API-Key", "wrong-key")
                        .param("meetLink", "https://meet.google.com/abc-defg-hij"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "HR")
    @DisplayName("RH authentifié → 200")
    void hrCanSaveMeetLink() throws Exception {
        when(interviewService.saveMeetLink(1L, "https://meet.google.com/abc-defg-hij"))
                .thenReturn(fakeResponse(1L, "https://meet.google.com/abc-defg-hij"));

        mockMvc.perform(patch("/api/interviews/1/meet-link")
                        .with(csrf())
                        .param("meetLink", "https://meet.google.com/abc-defg-hij"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "USER")
    @DisplayName("candidat (ROLE_USER) → 403")
    void candidateCannotSaveMeetLink() throws Exception {
        mockMvc.perform(patch("/api/interviews/1/meet-link")
                        .with(csrf())
                        .param("meetLink", "https://meet.google.com/abc-defg-hij"))
                .andExpect(status().isForbidden());
    }
}
