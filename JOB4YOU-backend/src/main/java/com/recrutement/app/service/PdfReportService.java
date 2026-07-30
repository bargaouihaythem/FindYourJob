package com.recrutement.app.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import com.recrutement.app.entity.AuditLog;
import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.Feedback;
import com.recrutement.app.entity.Interview;
import com.recrutement.app.repository.FeedbackRepository;
import com.recrutement.app.repository.InterviewRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Génère un dossier candidat exportable en PDF (OpenPDF, open source, pas de
 * dépendance à un moteur de templating externe : mise en page construite en
 * code, suffisant pour un document de synthèse RH).
 */
@Service
public class PdfReportService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final Font TITLE_FONT = new Font(Font.HELVETICA, 18, Font.BOLD, new Color(30, 58, 138));
    private static final Font SECTION_FONT = new Font(Font.HELVETICA, 13, Font.BOLD, new Color(30, 58, 138));
    private static final Font LABEL_FONT = new Font(Font.HELVETICA, 10, Font.BOLD);
    private static final Font VALUE_FONT = new Font(Font.HELVETICA, 10, Font.NORMAL);
    private static final Font FOOTER_FONT = new Font(Font.HELVETICA, 8, Font.ITALIC, Color.GRAY);

    @Autowired
    private InterviewRepository interviewRepository;

    @Autowired
    private FeedbackRepository feedbackRepository;

    @Autowired
    private AuditLogService auditLogService;

    public byte[] generateCandidateReport(Candidate candidate) {
        Document document = new Document(PageSize.A4, 40, 40, 50, 50);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        try {
            PdfWriter writer = PdfWriter.getInstance(document, out);
            writer.setPageEvent(new FooterPageEvent());
            document.open();

            addHeader(document);
            addPersonalInfo(document, candidate);
            addJobOffer(document, candidate);
            addAiScoring(document, candidate);
            addStatusHistory(document, candidate);
            addInterviews(document, candidate);
            addFeedbacks(document, candidate);

            document.close();
        } catch (DocumentException e) {
            throw new RuntimeException("Erreur lors de la génération du PDF: " + e.getMessage(), e);
        }

        return out.toByteArray();
    }

    private void addHeader(Document document) throws DocumentException {
        Paragraph title = new Paragraph("JOB4YOU — Dossier Candidat", TITLE_FONT);
        title.setAlignment(Element.ALIGN_CENTER);
        document.add(title);

        Paragraph date = new Paragraph("Généré le " + java.time.LocalDateTime.now().format(DATE_FORMAT),
                new Font(Font.HELVETICA, 9, Font.ITALIC, Color.GRAY));
        date.setAlignment(Element.ALIGN_CENTER);
        date.setSpacingAfter(20);
        document.add(date);
    }

    private void addPersonalInfo(Document document, Candidate candidate) throws DocumentException {
        addSectionTitle(document, "Informations personnelles");
        PdfPTable table = newTable(2);
        addRow(table, "Nom complet", candidate.getFirstName() + " " + candidate.getLastName());
        addRow(table, "Email", candidate.getEmail());
        addRow(table, "Téléphone", candidate.getPhone() != null ? candidate.getPhone() : "—");
        addRow(table, "LinkedIn", candidate.getLinkedinProfile() != null ? candidate.getLinkedinProfile() : "—");
        addRow(table, "Date de candidature",
                candidate.getApplicationDate() != null ? candidate.getApplicationDate().format(DATE_FORMAT) : "—");
        document.add(table);
    }

    private void addJobOffer(Document document, Candidate candidate) throws DocumentException {
        addSectionTitle(document, "Offre postulée");
        PdfPTable table = newTable(2);
        if (candidate.getJobOffer() != null) {
            addRow(table, "Titre", candidate.getJobOffer().getTitle());
            addRow(table, "Compétences requises",
                    candidate.getJobOffer().getRequiredSkills() != null ? candidate.getJobOffer().getRequiredSkills() : "—");
            addRow(table, "Type de contrat", candidate.getJobOffer().getContractType());
            addRow(table, "Localisation", candidate.getJobOffer().getLocation());
        } else {
            addRow(table, "Offre", "Candidature générale (sans offre spécifique)");
        }
        document.add(table);
    }

    private void addAiScoring(Document document, Candidate candidate) throws DocumentException {
        addSectionTitle(document, "Scoring IA");
        PdfPTable table = newTable(2);
        addRow(table, "Score technique", format(candidate.getAiScoreTechnical()));
        addRow(table, "Score communication", format(candidate.getAiScoreCommunication()));
        addRow(table, "Adéquation séniorité", format(candidate.getAiScoreSeniorityMatch()));
        addRow(table, "Score final IA", format(candidate.getAiScore()));
        if (candidate.getManualScore() != null) {
            addRow(table, "Score corrigé (RH)", candidate.getManualScore() + " — " +
                    (candidate.getManualScoreReason() != null ? candidate.getManualScoreReason() : ""));
        }
        addRow(table, "Recommandation IA", candidate.getAiRecommendation() != null ? candidate.getAiRecommendation() : "—");
        document.add(table);
    }

    private void addStatusHistory(Document document, Candidate candidate) throws DocumentException {
        addSectionTitle(document, "Historique des statuts");
        List<AuditLog> history = auditLogService.getHistory("CANDIDATE", candidate.getId());
        if (history.isEmpty()) {
            document.add(new Paragraph("Aucun historique disponible.", VALUE_FONT));
            return;
        }
        PdfPTable table = new PdfPTable(3);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{25, 35, 40});
        addHeaderCell(table, "Date");
        addHeaderCell(table, "Action");
        addHeaderCell(table, "Détail");
        for (AuditLog entry : history) {
            table.addCell(new PdfPCell(new Phrase(entry.getPerformedAt().format(DATE_FORMAT), VALUE_FONT)));
            table.addCell(new PdfPCell(new Phrase(entry.getAction(), VALUE_FONT)));
            String detail = (entry.getOldValue() != null ? entry.getOldValue() : "—") + " → " +
                    (entry.getNewValue() != null ? entry.getNewValue() : "—");
            table.addCell(new PdfPCell(new Phrase(detail, VALUE_FONT)));
        }
        document.add(table);
        document.add(Chunk.NEWLINE);
    }

    private void addInterviews(Document document, Candidate candidate) throws DocumentException {
        addSectionTitle(document, "Entretiens planifiés");
        List<Interview> interviews = interviewRepository.findByCandidateId(candidate.getId());
        if (interviews.isEmpty()) {
            document.add(new Paragraph("Aucun entretien planifié.", VALUE_FONT));
            return;
        }
        for (Interview interview : interviews) {
            String line = "• " + interview.getType() + " — "
                    + (interview.getInterviewDate() != null ? interview.getInterviewDate().format(DATE_FORMAT) : "date non définie")
                    + " (" + interview.getStatus() + ")";
            document.add(new Paragraph(line, VALUE_FONT));
        }
        document.add(Chunk.NEWLINE);
    }

    private void addFeedbacks(Document document, Candidate candidate) throws DocumentException {
        addSectionTitle(document, "Feedbacks");
        List<Feedback> feedbacks = feedbackRepository.findByCandidateId(candidate.getId());
        if (feedbacks.isEmpty()) {
            document.add(new Paragraph("Aucun feedback enregistré.", VALUE_FONT));
            return;
        }
        for (Feedback feedback : feedbacks) {
            String header = feedback.getType() + " — note " +
                    (feedback.getRating() != null ? feedback.getRating() + "/5" : "N/A");
            document.add(new Paragraph(header, LABEL_FONT));
            document.add(new Paragraph(feedback.getContent() != null ? feedback.getContent() : "—", VALUE_FONT));
            document.add(Chunk.NEWLINE);
        }
    }

    private void addSectionTitle(Document document, String title) throws DocumentException {
        Paragraph p = new Paragraph(title, SECTION_FONT);
        p.setSpacingBefore(10);
        p.setSpacingAfter(6);
        document.add(p);
    }

    private PdfPTable newTable(int columns) throws DocumentException {
        PdfPTable table = new PdfPTable(columns);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{35, 65});
        table.setSpacingAfter(10);
        return table;
    }

    private void addRow(PdfPTable table, String label, String value) {
        PdfPCell labelCell = new PdfPCell(new Phrase(label, LABEL_FONT));
        labelCell.setBorder(Rectangle.NO_BORDER);
        labelCell.setPaddingBottom(4);
        table.addCell(labelCell);

        PdfPCell valueCell = new PdfPCell(new Phrase(value != null ? value : "—", VALUE_FONT));
        valueCell.setBorder(Rectangle.NO_BORDER);
        valueCell.setPaddingBottom(4);
        table.addCell(valueCell);
    }

    private void addHeaderCell(PdfPTable table, String text) {
        PdfPCell cell = new PdfPCell(new Phrase(text, LABEL_FONT));
        cell.setBackgroundColor(new Color(226, 232, 240));
        table.addCell(cell);
    }

    private String format(Integer value) {
        return value != null ? value + "/100" : "—";
    }

    /** Ajoute le pied de page "Document confidentiel" sur chaque page. */
    private static class FooterPageEvent extends com.lowagie.text.pdf.PdfPageEventHelper {
        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            Phrase footer = new Phrase("Document confidentiel - JOB4YOU", FOOTER_FONT);
            com.lowagie.text.pdf.ColumnText.showTextAligned(
                    writer.getDirectContent(), Element.ALIGN_CENTER, footer,
                    (document.right() + document.left()) / 2, document.bottom() - 20, 0);
        }
    }
}
