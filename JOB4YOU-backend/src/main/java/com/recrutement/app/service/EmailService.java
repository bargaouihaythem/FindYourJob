package com.recrutement.app.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.HashMap;
import java.util.Map;

@Service
public class EmailService {

    private static final Logger logger = LoggerFactory.getLogger(EmailService.class);

    @Autowired
    private JavaMailSender mailSender;

    @Autowired
    private TemplateEngine templateEngine;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${app.email.enabled:true}")
    private boolean emailEnabled;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    /** "smtp" (default) ou "n8n" : l'envoi est delégue au workflow mailer, qui passe par l'API Gmail en HTTPS. */
    @Value("${app.email.transport:smtp}")
    private String emailTransport;

    @Value("${n8n.webhook.mailer:}")
    private String mailerWebhook;

    @Value("${n8n.api.key:}")
    private String n8nApiKey;

    @Autowired(required = false)
    @Qualifier("n8nRestTemplate")
    private RestTemplate n8nRestTemplate;

    /**
     * Un e-mail n'est tente que si l'envoi est active ET que le compte SMTP est renseign :
     * sans mot de passe d'application, JavaMailSender echouerait au milieu d'une requete metier.
     */
    private boolean canSend() {
        if (!emailEnabled) return false;
        if (useMailer()) return fromEmail != null && !fromEmail.isBlank();
        if (fromEmail == null || fromEmail.isBlank() || mailPassword == null || mailPassword.isBlank()) {
            logger.warn("app.email.enabled=true mais SPRING_MAIL_USERNAME / SPRING_MAIL_PASSWORD sont vides : envoi ignore.");
            return false;
        }
        return true;
    }

    private boolean useMailer() {
        return "n8n".equalsIgnoreCase(emailTransport)
                && mailerWebhook != null && !mailerWebhook.isBlank()
                && n8nRestTemplate != null;
    }

    /**
     * Remplace l'envoi SMTP quand le reseau bloque les ports 25/465/587 : le meme message,
     * serialise en JSON, est remis au workflow n8n qui l'expedie via l'API Gmail (443).
     */
    private void envoyer(MimeMessage message, String to, String subject, String body, boolean html) {
        if (useMailer()) {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (n8nApiKey != null && !n8nApiKey.isBlank()) {
                headers.set("X-N8N-API-Key", n8nApiKey);
            }
            Map<String, Object> payload = new HashMap<>();
            payload.put("from", fromEmail);
            payload.put("to", to);
            payload.put("subject", subject);
            payload.put(html ? "html" : "text", body);
            ResponseEntity<String> reponse =
                    n8nRestTemplate.postForEntity(mailerWebhook, new HttpEntity<>(payload, headers), String.class);
            logger.info("Email delegue au mailer n8n (HTTP {}) to: {}, subject: {}", reponse.getStatusCode(), to, subject);
            return;
        }
        try {
            mailSender.send(message);
        } catch (org.springframework.mail.MailException e) {
            throw new RuntimeException("Failed to send email: " + e.getMessage(), e);
        }
    }

    /**
     * Envoie un e-mail avec un template Thymeleaf (asynchrone)
     */
    @Async
    public void sendTemplateEmail(String to, String subject, String templateName, Map<String, Object> variables) {
        if (!canSend()) {
            logger.info("Email sending is disabled. Would have sent email to: {}, subject: {}", to, subject);
            return;
        }

        try {
            // Préparer le contexte Thymeleaf
            Context context = new Context();
            variables.forEach(context::setVariable);

            // Traiter le template
            String htmlContent = templateEngine.process(templateName, context);

            // Créer le message
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            // Envoyer l'e-mail
            envoyer(message, to, subject, htmlContent, true);
            logger.info("Template email sent successfully to: {}, subject: {}", to, subject);
        } catch (Exception e) {
            logger.error("Failed to send template email to: {}, subject: {}", to, subject, e);
            throw new RuntimeException("Failed to send email", e);
        }
    }

    /**
     * Envoie un e-mail simple
     */
    @Async
    public void sendSimpleEmail(String to, String subject, String content) {
        if (!canSend()) {
            logger.info("Email sending is disabled. Would have sent email to: {}, subject: {}", to, subject);
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(content, false);

            envoyer(message, to, subject, content, false);
            logger.info("Simple email sent successfully to: {}, subject: {}", to, subject);
        } catch (MessagingException e) {
            logger.error("Failed to send simple email to: {}, subject: {}", to, subject, e);
            throw new RuntimeException("Failed to send email", e);
        }
    }

    /**
     * Envoie un e-mail HTML
     */
    @Async
    public void sendHtmlEmail(String to, String subject, String htmlContent) {
        if (!canSend()) {
            logger.info("Email sending is disabled. Would have sent email to: {}, subject: {}", to, subject);
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            envoyer(message, to, subject, htmlContent, true);
            logger.info("HTML email sent successfully to: {}, subject: {}", to, subject);
        } catch (MessagingException e) {
            logger.error("Failed to send HTML email to: {}, subject: {}", to, subject, e);
            throw new RuntimeException("Failed to send email", e);
        }
    }

    /**
     * Envoie un e-mail simple de manière synchrone
     */
    public void sendSimpleEmailSync(String to, String subject, String content) {
        if (!canSend()) {
            logger.info("Email sending is disabled. Would have sent email to: {}, subject: {}", to, subject);
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(content, false);

            envoyer(message, to, subject, content, false);
            logger.info("Simple email sent successfully to: {}", to);
        } catch (Exception e) {
            logger.error("Failed to send simple email to: {}", to, e);
            throw new RuntimeException("Failed to send email: " + e.getMessage(), e);
        }
    }

    /**
     * Envoie un e-mail avec un template Thymeleaf de manière synchrone (recommandé pour les emails critiques)
     */
    public void sendTemplateEmailSync(String to, String subject, String templateName, Map<String, Object> variables) {
        if (!canSend()) {
            logger.info("Email sending is disabled. Would have sent email to: {}, subject: {}", to, subject);
            return;
        }

        try {
            // Préparer le contexte Thymeleaf
            Context context = new Context();
            variables.forEach(context::setVariable);

            // Traiter le template
            String htmlContent = templateEngine.process(templateName, context);

            // Créer le message
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            // Envoyer l'e-mail
            envoyer(message, to, subject, htmlContent, true);
            logger.info("Template email sent successfully to: {}, subject: {}", to, subject);
        } catch (Exception e) {
            logger.error("Failed to send template email to: {}, subject: {}", to, subject, e);
            throw new RuntimeException("Failed to send template email: " + e.getMessage(), e);
        }
    }
}

