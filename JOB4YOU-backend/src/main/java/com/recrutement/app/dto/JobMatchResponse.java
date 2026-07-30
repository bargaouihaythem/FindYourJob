package com.recrutement.app.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class JobMatchResponse {
    private Long jobOfferId;
    private String title;
    private String location;
    private String contractType;
    private String requiredSkills;
    private int matchScore; // 0-100
    private String source; // COHERE ou SIMULATED (mots-clés)
}
