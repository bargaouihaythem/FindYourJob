package com.recrutement.app.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Ce que le RH peut relire après avoir transmis un dossier : à qui il est parti, sur
 * quel critère, et si la notification a réellement été remise à n8n. « SENT » veut
 * dire que le webhook n8n a accepté l'événement, pas que l'e-mail est arrivé dans la
 * boîte du manager : c'est la limite de ce que la plateforme peut tracer ici.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoutingStatusResponse {

    private Long candidateId;
    private String candidateStatus;
    private LocalDateTime routedAt;
    private String routingBasis;
    private String routingBasisLabel;
    private Boolean transmitted;
    private List<RecipientNotification> recipients;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecipientNotification {

        private String email;
        private String fullName;
        /**
         * NOT_ENQUEUED : aucune notification enregistrée (webhook n8n non configuré ou
         * outbox désactivée). PENDING : en file ou en cours de reprise. SENT : accepté
         * par n8n. FAILED : après épuisement des tentatives.
         */
        private String notificationStatus;
        private Integer attempts;
        private LocalDateTime sentAt;
        private LocalDateTime nextAttemptAt;
        private String lastError;
        /** Relances déjà déclenchées par le RH sur ce destinataire. */
        private Integer retries;
    }
}
