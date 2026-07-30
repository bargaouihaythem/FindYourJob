package com.recrutement.app.controller;

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

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/files")
public class FileController {

    @Value("${app.file.upload-dir:uploads/cvs}")
    private String uploadDir;

    @GetMapping("/{fileName:.+}")
    public ResponseEntity<Resource> serveFile(@PathVariable String fileName) {
        try {
            Resource resource = findFileResource(fileName);

            if (resource != null && resource.exists() && resource.isReadable()) {
                String contentType = "application/pdf";
                if (fileName.toLowerCase().endsWith(".doc")) {
                    contentType = "application/msword";
                } else if (fileName.toLowerCase().endsWith(".docx")) {
                    contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                }

                return ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(contentType))
                        .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + fileName + "\"")
                        .body(resource);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (MalformedURLException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /**
     * Résout un fichier dans le répertoire d'upload. Correspondance EXACTE
     * uniquement (pas de recherche approximative) : servir un fichier
     * "similaire" au nom demandé reviendrait à exposer potentiellement le
     * CV d'un autre candidat. Le chemin résolu est vérifié pour rester
     * strictement à l'intérieur du répertoire d'upload (protection contre
     * la traversée de répertoire via "../").
     */
    private Resource findFileResource(String fileName) throws MalformedURLException {
        if (fileName == null || fileName.isBlank()
                || fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            return null;
        }

        Path uploadRoot = Paths.get(System.getProperty("user.dir"), uploadDir).normalize().toAbsolutePath();
        Path filePath = uploadRoot.resolve(fileName).normalize();

        if (!filePath.startsWith(uploadRoot)) {
            return null;
        }

        Resource resource = new UrlResource(filePath.toUri());
        return (resource.exists() && resource.isReadable()) ? resource : null;
    }

    @GetMapping("/{fileName:.+}/download")
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM') or hasRole('ÉQUIPE')")
    public ResponseEntity<Resource> downloadFile(@PathVariable String fileName) {
        try {
            Resource resource = findFileResource(fileName);

            if (resource != null && resource.exists() && resource.isReadable()) {
                return ResponseEntity.ok()
                        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                        .body(resource);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (MalformedURLException e) {
            return ResponseEntity.badRequest().build();
        }
    }
}
