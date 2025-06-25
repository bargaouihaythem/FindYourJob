package com.recrutement.app.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EmailRequest {
    private String to;
    private String subject;
    private String content;
    private boolean html = false;
}
