package com.recrutement.app.controller;

import com.recrutement.app.entity.CV;
import com.recrutement.app.repository.CVRepository;
import com.recrutement.app.service.AccessControlService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.MalformedURLException;
import java.nio.file.Path;
import java.nio.file.Paths;

@CrossOrigin(origins = "${app.cors.allowed-origins:http://localhost:4200}", maxAge = 3600)
@RestController
@RequestMapping("/api/files")
public class FileController {

    @Value("${app.file.upload-dir:uploads/cvs}")
    private String uploadDir;

    private final CVRepository cvRepository;
    private final AccessControlService accessControlService;

    public FileController(CVRepository cvRepository, AccessControlService accessControlService) {
        this.cvRepository = cvRepository;
        this.accessControlService = accessControlService;
    }

    @GetMapping("/{fileName:.+}")
    @PreAuthorize("hasRole('USER') or hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER')")
    public ResponseEntity<Resource> serveFile(@PathVariable String fileName) {
        CV cv = findCVAndAuthorize(fileName);
        return serve(cv, fileName, false);
    }

    @GetMapping("/{fileName:.+}/download")
    @PreAuthorize("hasRole('USER') or hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM')")
    public ResponseEntity<Resource> downloadFile(@PathVariable String fileName) {
        CV cv = findCVAndAuthorize(fileName);
        return serve(cv, fileName, true);
    }

    private CV findCVAndAuthorize(String fileName) {
        if (fileName == null || fileName.isBlank()
                || fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            throw new IllegalArgumentException("Nom de fichier invalide");
        }
        CV cv = cvRepository.findByStoredFilename(fileName)
                .orElseThrow(() -> new IllegalArgumentException("Fichier introuvable"));
        accessControlService.assertCanAccessCandidate(cv.getCandidate());
        return cv;
    }

    private ResponseEntity<Resource> serve(CV cv, String fileName, boolean attachment) {
        try {
            Resource resource = findFileResource(fileName);
            if (resource == null || !resource.exists() || !resource.isReadable()) {
                return ResponseEntity.notFound().build();
            }

            cv.setLastAccessed(java.time.LocalDateTime.now());
            cvRepository.save(cv);

            String contentType = cv.getContentType() != null ? cv.getContentType() : "application/octet-stream";
            String disposition = attachment ? "attachment" : "inline";
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"" + sanitizeFilename(fileName) + "\"")
                    .body(resource);
        } catch (MalformedURLException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    private Resource findFileResource(String fileName) throws MalformedURLException {
        Path uploadRoot = Paths.get(System.getProperty("user.dir"), uploadDir).normalize().toAbsolutePath();
        Path filePath = uploadRoot.resolve(fileName).normalize();
        if (!filePath.startsWith(uploadRoot)) {
            return null;
        }
        Resource resource = new UrlResource(filePath.toUri());
        return (resource.exists() && resource.isReadable()) ? resource : null;
    }

    private String sanitizeFilename(String fileName) {
        return fileName.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
