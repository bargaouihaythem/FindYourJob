package com.recrutement.app.dto;

import com.recrutement.app.entity.InternalNote;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InternalNoteResponse {

    private Long id;
    private String content;
    private Long candidateId;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private boolean pinned;

    public InternalNoteResponse(InternalNote note) {
        this.id = note.getId();
        this.content = note.getContent();
        this.candidateId = note.getCandidateId();
        this.createdBy = note.getCreatedBy();
        this.createdAt = note.getCreatedAt();
        this.updatedAt = note.getUpdatedAt();
        this.pinned = note.isPinned();
    }
}
