package com.recrutement.app.dto;

import com.recrutement.app.entity.CV;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CVResponse {

    private Long id;
    private String originalFilename;
    private String storedFilename;
    private String filePath;
    private String fileUrl;
    private Long fileSize;
    private String contentType;
    private LocalDateTime uploadDate;
    private LocalDateTime lastAccessed;
    private Long candidateId;
    private String candidateName;

    // Constructeur pour mapper depuis l'entité CV
    public CVResponse(CV cv) {
        this.id = cv.getId();
        this.originalFilename = cv.getOriginalFilename();
        this.storedFilename = cv.getStoredFilename();
        this.filePath = cv.getFilePath();
        this.fileUrl = cv.getFileUrl();
        this.fileSize = cv.getFileSize();
        this.contentType = cv.getContentType();
        this.uploadDate = cv.getUploadDate();
        this.lastAccessed = cv.getLastAccessed();
        this.candidateId = cv.getCandidate() != null ? cv.getCandidate().getId() : null;
        this.candidateName = cv.getCandidate() != null ? 
            cv.getCandidate().getFirstName() + " " + cv.getCandidate().getLastName() : null;
    }
}

