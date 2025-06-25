package com.recrutement.app.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "cvs")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CV {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "original_filename", nullable = false)
    private String originalFilename;

    @Column(name = "stored_filename")
    private String storedFilename; // Nom du fichier sur le disque

    @Column(name = "file_path")
    private String filePath; // Chemin complet du fichier

    @Column(name = "file_url")
    private String fileUrl; // URL d'accès au fichier

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "content_type")
    private String contentType;

    @Column(name = "upload_date")
    private LocalDateTime uploadDate;

    @Column(name = "last_accessed")
    private LocalDateTime lastAccessed;

    // Relation avec le candidat (One-to-One)
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "candidate_id", nullable = false)
    private Candidate candidate;

    @PrePersist
    protected void onCreate() {
        uploadDate = LocalDateTime.now();
        lastAccessed = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        lastAccessed = LocalDateTime.now();
    }

    // Constructeur utilitaire pour stockage local
    public CV(String originalFilename, String storedFilename, String filePath, String fileUrl,
              Long fileSize, String contentType, Candidate candidate) {
        this.originalFilename = originalFilename;
        this.storedFilename = storedFilename;
        this.filePath = filePath;
        this.fileUrl = fileUrl;
        this.fileSize = fileSize;
        this.contentType = contentType;
        this.candidate = candidate;
    }
}

