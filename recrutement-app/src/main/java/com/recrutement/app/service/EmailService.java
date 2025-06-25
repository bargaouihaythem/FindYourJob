package com.recrutement.app.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

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

    /**
     * Envoie un e-mail avec un template Thymeleaf
     */
    @Async
    public void sendTemplateEmail(String to, String subject, String templateName, Map<String, Object> variables) {
        if (!emailEnabled) {
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
            mailSender.send(message);
            logger.info("Email sent successfully to: {}, subject: {}", to, subject);
        } catch (MessagingException e) {
            logger.error("Failed to send email to: {}, subject: {}", to, subject, e);
            throw new RuntimeException("Failed to send email", e);
        }
    }

    /**
     * Envoie un e-mail simple
     */
    @Async
    public void sendSimpleEmail(String to, String subject, String content) {
        if (!emailEnabled) {
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

            mailSender.send(message);
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
        if (!emailEnabled) {
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

            mailSender.send(message);
            logger.info("HTML email sent successfully to: {}, subject: {}", to, subject);
        } catch (MessagingException e) {
            logger.error("Failed to send HTML email to: {}, subject: {}", to, subject, e);
            throw new RuntimeException("Failed to send email", e);
        }
    }
}

