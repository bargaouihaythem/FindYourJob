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
    @PreAuthorize("hasRole('HR') or hasRole('ADMIN') or hasRole('MANAGER') or hasRole('TEAM_LEAD') or hasRole('SENIOR_DEV') or hasRole('TEAM') or hasRole('ÉQUIPE') or hasRole('USER')")
    public ResponseEntity<Resource> serveFile(@PathVariable String fileName) {
        try {
            Resource resource = findFileResource(fileName);
            
            if (resource != null && resource.exists() && resource.isReadable()) {
                // Déterminer le type de contenu
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
     * Méthode utilitaire pour trouver un fichier en essayant différents chemins
     */
    private Resource findFileResource(String fileName) throws MalformedURLException {
        // 1. Essayer avec un chemin relatif
        Path filePath = Paths.get(uploadDir).resolve(fileName).normalize();
        Resource resource = new UrlResource(filePath.toUri());
        
        if (resource.exists() && resource.isReadable()) {
            return resource;
        }
        
        // 2. Essayer avec un chemin absolu basé sur le répertoire de travail
        Path absolutePath = Paths.get(System.getProperty("user.dir"), uploadDir, fileName).normalize();
        resource = new UrlResource(absolutePath.toUri());
        
        if (resource.exists() && resource.isReadable()) {
            return resource;
        }
        
        // 3. Lister les fichiers du répertoire pour debug et recherche intelligente
        try {
            Path uploadPath = Paths.get(System.getProperty("user.dir"), uploadDir);
            if (uploadPath.toFile().exists()) {
                System.out.println("[DEBUG] Recherche du fichier: " + fileName);
                System.out.println("[DEBUG] Fichiers disponibles dans " + uploadPath + ":");
                
                java.io.File[] files = uploadPath.toFile().listFiles();
                if (files != null) {
                    for (java.io.File file : files) {
                        System.out.println("  - " + file.getName());
                        
                        // Correspondance exacte
                        if (file.getName().equals(fileName)) {
                            System.out.println("[DEBUG] Correspondance exacte trouvée: " + file.getName());
                            return new UrlResource(file.toURI());
                        }
                        
                        // Correspondance par originalFilename (sans extension)
                        String baseFileName = fileName.replaceAll("\\.[^.]+$", "");
                        if (file.getName().contains(baseFileName) && baseFileName.length() > 3) {
                            System.out.println("[DEBUG] Correspondance partielle trouvée: " + file.getName());
                            return new UrlResource(file.toURI());
                        }
                        
                        // Si le fichier demandé commence par "cv_" mais pas le fichier réel
                        if (fileName.startsWith("cv_") && file.getName().startsWith("cv_")) {
                            String cleanRequested = fileName.substring(3);
                            String cleanActual = file.getName().substring(3);
                            if (cleanActual.contains(cleanRequested.replaceAll("\\.[^.]+$", ""))) {
                                System.out.println("[DEBUG] Correspondance CV trouvée: " + file.getName());
                                return new UrlResource(file.toURI());
                            }
                        }
                    }
                }
                
                // Dernier recours : prendre le premier fichier PDF/DOC si pas de correspondance
                if (files != null && files.length > 0) {
                    for (java.io.File file : files) {
                        String extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.') + 1);
                        if (file.getName().toLowerCase().endsWith(extension)) {
                            System.out.println("[DEBUG] Utilisation du fichier par défaut: " + file.getName());
                            return new UrlResource(file.toURI());
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.out.println("[DEBUG] Erreur lors de la recherche de fichiers: " + e.getMessage());
        }
        
        return null;
    }    @GetMapping("/{fileName:.+}/download")
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
