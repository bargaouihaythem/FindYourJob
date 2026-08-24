package com.recrutement.app.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatbotAskRequest {

    @NotBlank(message = "La question ne peut pas être vide")
    @Size(max = 1000, message = "La question est trop longue (1000 caractères maximum)")
    private String message;
}
