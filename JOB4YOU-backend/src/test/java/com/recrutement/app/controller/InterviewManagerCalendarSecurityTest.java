package com.recrutement.app.controller;

import com.recrutement.app.config.WebSecurityConfig;
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

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(InterviewController.class)
@Import({WebSecurityConfig.class, AuthEntryPointJwt.class, N8nApiKeyAuthenticationFilter.class})
@DisplayName("InterviewController — calendrier manager sécurisé")
class InterviewManagerCalendarSecurityTest {

    @Autowired MockMvc mockMvc;

    @MockBean InterviewService interviewService;
    @MockBean UserService userService;
    @MockBean UserDetailsServiceImpl userDetailsService;
    @MockBean JwtUtils jwtUtils;
    @MockBean N8nRequestAuthenticator n8nRequestAuthenticator;

    @Test
    @DisplayName("un appel anonyme au calendrier manager est refusé")
    void anonymousCannotReadManagerCalendar() throws Exception {
        mockMvc.perform(get("/api/interviews/my-calendar"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(roles = "MANAGER")
    @DisplayName("un manager authentifié peut consulter son calendrier")
    void managerCanReadScopedCalendar() throws Exception {
        when(interviewService.getManagerCalendar(any(LocalDateTime.class), any(LocalDateTime.class)))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/interviews/my-calendar")
                        .param("startDate", "2026-08-01T00:00:00")
                        .param("endDate", "2026-08-31T23:59:59"))
                .andExpect(status().isOk());
    }

    @Test
    @WithMockUser(roles = "HR")
    @DisplayName("un RH ne peut pas utiliser l’endpoint spécifique manager")
    void hrCannotUseManagerSpecificCalendarEndpoint() throws Exception {
        mockMvc.perform(get("/api/interviews/my-calendar")
                        .param("startDate", "2026-08-01T00:00:00")
                        .param("endDate", "2026-08-31T23:59:59"))
                .andExpect(status().isForbidden());
    }
}
