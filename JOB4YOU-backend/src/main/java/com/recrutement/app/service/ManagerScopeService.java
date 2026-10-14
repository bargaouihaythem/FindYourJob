package com.recrutement.app.service;

import com.recrutement.app.entity.Candidate;
import com.recrutement.app.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Source unique de vérité du périmètre manager.
 *
 * Règle : un manager voit et peut instruire un dossier si et seulement si il en est
 * destinataire. La visibilité ne peut donc jamais être plus large que l'aiguillage —
 * les deux lisent la même fonction.
 *
 * Une fois le dossier routé, la liste des destinataires est figée sur la candidature :
 * modifier ensuite le département de l'offre ou la famille de métier d'un compte ne
 * retire pas l'accès au manager qui a reçu le dossier, et ne le donne pas à un autre.
 */
@Service
public class ManagerScopeService {

    @Autowired
    private ManagerRoutingService managerRoutingService;

    /**
     * Destinataires du dossier : la liste gelée à la transmission si elle existe,
     * sinon la résolution actuelle de l'offre (dossier pas encore transmis).
     */
    public List<String> recipientsOf(Candidate candidate) {
        if (candidate == null) {
            return List.of();
        }
        String frozen = candidate.getRoutedManagerEmails();
        if (frozen != null && !frozen.isBlank()) {
            return Arrays.stream(frozen.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isEmpty())
                    .collect(Collectors.toList());
        }
        return managerRoutingService.resolve(candidate.getJobOffer()).emails();
    }

    /** Un manager « pur » (sans rôle RH/Admin) est-il destinataire de ce dossier ? */
    public boolean isRecipient(Candidate candidate, User manager) {
        if (manager == null || manager.getEmail() == null) {
            return false;
        }
        return recipientsOf(candidate).stream()
                .anyMatch(manager.getEmail()::equalsIgnoreCase);
    }
}
