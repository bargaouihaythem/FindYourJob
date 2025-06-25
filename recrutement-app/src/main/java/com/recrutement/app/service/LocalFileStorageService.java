package com.recrutement.app.service;

import com.recrutement.app.exception.FileStorageException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.UUID;

@Service
public class LocalFileStorageService {

    @Value("${app.file.upload-dir:uploads/cvs}")
    private String uploadDir;

    @Value("${app.file.base-url:http://localhost:8080/api/files}")
    private String baseUrl;

    /**
     * Initialise le dossier de stockage
     */
    public void init() {
        try {
            Path uploadPath = Paths.get(uploadDir);
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
                System.out.println("[DEBUG] Dossier créé: " + uploadPath.toAbsolutePath());
            }
        } catch (IOException e) {
            throw new FileStorageException("Impossible de créer le dossier de stockage", e);
        }
    }

    /**
     * Stocke un fichier localement
     */
    public Map<String, String> storeFile(MultipartFile file) {
        init(); // S'assurer que le dossier existe

        try {
            // Générer un nom unique pour le fichier
            String originalFilename = file.getOriginalFilename();
            String extension = originalFilename != null && originalFilename.contains(".") 
                ? originalFilename.substring(originalFilename.lastIndexOf("."))
                : ".pdf";
            
            String fileName = "cv_" + UUID.randomUUID().toString().replace("-", "") + extension;
            
            // Copier le fichier vers le dossier de destination
            Path targetLocation = Paths.get(uploadDir).resolve(fileName);
            Files.copy(file.getInputStream(), targetLocation, StandardCopyOption.REPLACE_EXISTING);
            
            System.out.println("[DEBUG] Fichier stocké: " + targetLocation.toAbsolutePath());
            
            // Construire l'URL d'accès
            String fileUrl = baseUrl + "/" + fileName;
            
            return Map.of(
                "fileName", fileName,
                "url", fileUrl,
                "path", targetLocation.toString(),
                "fileSize", String.valueOf(file.getSize())
            );
            
        } catch (IOException e) {
            throw new FileStorageException("Échec du stockage du fichier " + file.getOriginalFilename(), e);
        }
    }

    /**
     * Supprime un fichier
     */
    public void deleteFile(String fileName) {
        try {
            Path filePath = Paths.get(uploadDir).resolve(fileName);
            Files.deleteIfExists(filePath);
            System.out.println("[DEBUG] Fichier supprimé: " + filePath.toAbsolutePath());
        } catch (IOException e) {
            System.err.println("[DEBUG] Erreur lors de la suppression du fichier: " + e.getMessage());
        }
    }

    /**
     * Génère l'URL d'accès à un fichier
     */
    public String generateFileUrl(String fileName) {
        return baseUrl + "/" + fileName;
    }

    /**
     * Vérifie si un fichier existe
     */
    public boolean fileExists(String fileName) {
        Path filePath = Paths.get(uploadDir).resolve(fileName);
        return Files.exists(filePath);
    }

    /**
     * Crée un fichier PDF de test pour un CV
     */
    public Map<String, String> createTestPDF(String fileName) {
        init(); // S'assurer que le dossier existe

        try {
            // Contenu PDF minimal valide
            String pdfContent = "%PDF-1.4\n" +
                "1 0 obj\n" +
                "<< /Type /Catalog /Pages 2 0 R >>\n" +
                "endobj\n" +
                "2 0 obj\n" +
                "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n" +
                "endobj\n" +
                "3 0 obj\n" +
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\n" +
                "endobj\n" +
                "4 0 obj\n" +
                "<< /Length 44 >>\n" +
                "stream\n" +
                "BT\n" +
                "/F1 12 Tf\n" +
                "100 700 Td\n" +
                "(CV Document) Tj\n" +
                "ET\n" +
                "endstream\n" +
                "endobj\n" +
                "xref\n" +
                "0 5\n" +
                "0000000000 65535 f \n" +
                "0000000009 00000 n \n" +
                "0000000058 00000 n \n" +
                "0000000115 00000 n \n" +
                "0000000245 00000 n \n" +
                "trailer\n" +
                "<< /Size 5 /Root 1 0 R >>\n" +
                "startxref\n" +
                "338\n" +
                "%%EOF";

            // Créer le fichier
            Path targetLocation = Paths.get(uploadDir).resolve(fileName);
            Files.write(targetLocation, pdfContent.getBytes());
            
            System.out.println("[DEBUG] Fichier PDF de test créé: " + targetLocation.toAbsolutePath());
            
            // Construire l'URL d'accès
            String fileUrl = baseUrl + "/" + fileName;
            
            return Map.of(
                "fileName", fileName,
                "url", fileUrl,
                "path", targetLocation.toString(),
                "fileSize", String.valueOf(pdfContent.getBytes().length)
            );
            
        } catch (IOException e) {
            throw new FileStorageException("Échec de la création du fichier PDF de test", e);
        }
    }
}
