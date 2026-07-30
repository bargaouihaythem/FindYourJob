package com.recrutement.app.service;

import com.recrutement.app.dto.ScoringWeightProfileRequest;
import com.recrutement.app.dto.ScoringWeightProfileResponse;
import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.ScoringWeightProfile;
import com.recrutement.app.repository.ScoringWeightProfileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Gère les profils de pondération du score IA (technique/communication/séniorité)
 * paramétrables par le RH pour chaque combinaison famille de métier × niveau.
 */
@Service
public class ScoringWeightProfileService {

    private static final double WEIGHT_SUM_TOLERANCE = 0.01;

    @Autowired
    private ScoringWeightProfileRepository scoringWeightProfileRepository;

    // Filet de sécurité si aucune offre / famille / niveau n'est renseigné,
    // ou si aucun profil n'existe encore pour la combinaison demandée.
    @Value("${ai.score.weight.technical:0.5}")
    private double defaultWeightTechnical;

    @Value("${ai.score.weight.communication:0.2}")
    private double defaultWeightCommunication;

    @Value("${ai.score.weight.seniority:0.3}")
    private double defaultWeightSeniority;

    public List<ScoringWeightProfileResponse> listAll() {
        return scoringWeightProfileRepository.findAll().stream()
                .map(ScoringWeightProfileResponse::new)
                .collect(Collectors.toList());
    }

    /**
     * Résout les poids à utiliser pour une offre : profil dédié
     * (jobFamily, seniorityLevel) si défini, sinon les poids par défaut.
     */
    public ScoringWeights resolveWeights(JobOffer.JobFamily jobFamily, JobOffer.SeniorityLevel seniorityLevel) {
        if (jobFamily != null && seniorityLevel != null) {
            return scoringWeightProfileRepository.findByJobFamilyAndSeniorityLevel(jobFamily, seniorityLevel)
                    .map(p -> new ScoringWeights(p.getWeightTechnical(), p.getWeightCommunication(), p.getWeightSeniority()))
                    .orElseGet(this::defaultWeights);
        }
        return defaultWeights();
    }

    private ScoringWeights defaultWeights() {
        return new ScoringWeights(defaultWeightTechnical, defaultWeightCommunication, defaultWeightSeniority);
    }

    @Transactional
    public ScoringWeightProfileResponse upsert(JobOffer.JobFamily jobFamily, JobOffer.SeniorityLevel seniorityLevel,
                                                ScoringWeightProfileRequest request, String updatedBy) {
        double sum = request.getWeightTechnical() + request.getWeightCommunication() + request.getWeightSeniority();
        if (Math.abs(sum - 1.0) > WEIGHT_SUM_TOLERANCE) {
            throw new IllegalArgumentException(
                    "La somme des 3 poids doit être égale à 1.0 (100%), valeur reçue : " + sum);
        }

        ScoringWeightProfile profile = scoringWeightProfileRepository
                .findByJobFamilyAndSeniorityLevel(jobFamily, seniorityLevel)
                .orElseGet(() -> {
                    ScoringWeightProfile p = new ScoringWeightProfile();
                    p.setJobFamily(jobFamily);
                    p.setSeniorityLevel(seniorityLevel);
                    return p;
                });

        profile.setWeightTechnical(request.getWeightTechnical());
        profile.setWeightCommunication(request.getWeightCommunication());
        profile.setWeightSeniority(request.getWeightSeniority());
        profile.setUpdatedBy(updatedBy);

        ScoringWeightProfile saved = scoringWeightProfileRepository.save(profile);
        return new ScoringWeightProfileResponse(saved);
    }

    public static class ScoringWeights {
        public final double technical;
        public final double communication;
        public final double seniority;

        public ScoringWeights(double technical, double communication, double seniority) {
            this.technical = technical;
            this.communication = communication;
            this.seniority = seniority;
        }
    }
}
