package com.recrutement.app.security.jwt;

import com.recrutement.app.service.N8nRequestAuthenticator;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/** Authentifie les appels internes n8n via X-N8N-API-Key. */
@Component
public class N8nApiKeyAuthenticationFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-N8N-API-Key";

    @Autowired(required = false)
    private N8nRequestAuthenticator authenticator;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String apiKey = request.getHeader(HEADER);
        if (authenticator != null && authenticator.isValid(apiKey)
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(
                            "n8n-agent", null,
                            List.of(new SimpleGrantedAuthority("ROLE_N8N")));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }
        filterChain.doFilter(request, response);
    }
}
