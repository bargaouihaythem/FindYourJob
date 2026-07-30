package com.recrutement.app.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;

/**
 * Extrait le texte brut d'un CV (PDF ou DOCX/DOC) pour alimenter le scoring IA.
 * Ne lève jamais d'exception vers l'appelant : en cas d'échec, retourne null
 * pour que l'appelant puisse retomber sur la lettre de motivation.
 */
@Service
public class CvTextExtractionService {

    private static final Logger log = LoggerFactory.getLogger(CvTextExtractionService.class);

    public String extractText(Path filePath, String contentType) {
        if (filePath == null) return null;

        try (InputStream in = new FileInputStream(filePath.toFile())) {
            return extractText(in, contentType, filePath.toString());
        } catch (Exception e) {
            log.warn("[CvTextExtractionService] Échec de l'extraction du texte ({}) : {}", filePath, e.getMessage());
            return null;
        }
    }

    /**
     * Variante sans fichier stocké sur disque : utile pour un traitement à la
     * volée (ex. matching CV → offres sans persister le document).
     */
    public String extractText(InputStream in, String contentType, String filename) {
        try {
            if (isPdf(contentType, filename)) {
                return extractFromPdf(in);
            }
            if (isDocx(contentType, filename)) {
                return extractFromDocx(in);
            }
            if (isDoc(contentType, filename)) {
                return extractFromDoc(in);
            }
            log.warn("[CvTextExtractionService] Type de fichier non supporté pour extraction : {}", contentType);
            return null;
        } catch (Exception e) {
            log.warn("[CvTextExtractionService] Échec de l'extraction du texte ({}) : {}", filename, e.getMessage());
            return null;
        }
    }

    private String extractFromPdf(InputStream in) throws IOException {
        try (PDDocument document = Loader.loadPDF(in.readAllBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();
            return clean(stripper.getText(document));
        }
    }

    private String extractFromDocx(InputStream in) throws IOException {
        try (XWPFDocument document = new XWPFDocument(in);
             XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
            return clean(extractor.getText());
        }
    }

    private String extractFromDoc(InputStream in) throws IOException {
        try (WordExtractor extractor = new WordExtractor(in)) {
            return clean(extractor.getText());
        }
    }

    private String clean(String text) {
        if (text == null) return null;
        String trimmed = text.trim().replaceAll("[ \\t]+", " ");
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean isPdf(String contentType, String filename) {
        return "application/pdf".equals(contentType) || filename.toLowerCase().endsWith(".pdf");
    }

    private boolean isDocx(String contentType, String filename) {
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document".equals(contentType)
                || filename.toLowerCase().endsWith(".docx");
    }

    private boolean isDoc(String contentType, String filename) {
        return "application/msword".equals(contentType) || filename.toLowerCase().endsWith(".doc");
    }
}
