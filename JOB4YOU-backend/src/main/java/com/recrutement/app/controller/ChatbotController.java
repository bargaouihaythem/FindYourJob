package com.recrutement.app.controller;

import com.recrutement.app.dto.ChatbotAskRequest;
import com.recrutement.app.dto.ChatbotAskResponse;
import com.recrutement.app.dto.ChatbotGreetingResponse;
import com.recrutement.app.service.ChatbotService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chatbot")
public class ChatbotController {

    @Autowired
    private ChatbotService chatbotService;

    @GetMapping("/greeting")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ChatbotGreetingResponse> greeting(Authentication authentication) {
        String greeting = chatbotService.greeting(authentication.getName());
        return ResponseEntity.ok(new ChatbotGreetingResponse(greeting));
    }

    @PostMapping("/ask")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<ChatbotAskResponse> ask(@Valid @RequestBody ChatbotAskRequest request,
                                                    Authentication authentication) {
        String answer = chatbotService.ask(authentication.getName(), request.getMessage());
        return ResponseEntity.ok(new ChatbotAskResponse(answer));
    }
}
