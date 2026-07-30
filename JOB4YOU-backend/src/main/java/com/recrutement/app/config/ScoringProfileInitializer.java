package com.recrutement.app.config;

import com.recrutement.app.entity.JobOffer;
import com.recrutement.app.entity.ScoringWeightProfile;
import com.recrutement.app.repository.ScoringWeightProfileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class ScoringProfileInitializer implements CommandLineRunner {

    @Autowired
    private ScoringWeightProfileRepository scoringWeightProfileRepository;

    @Value("${ai.score.weight.technical:0.5}")
    private double defaultWeightTechnical;

    @Value("${ai.score.weight.communication:0.2}")
    private double defaultWeightCommunication;

    @Value("${ai.score.weight.seniority:0.3}")
    private double defaultWeightSeniority;

    @Override
    public void run(String... args) throws Exception {
        for (JobOffer.JobFamily family : JobOffer.JobFamily.values()) {
            for (JobOffer.SeniorityLevel level : JobOffer.SeniorityLevel.values()) {
                createIfMissing(family, level);
            }
        }
        System.out.println("Profils de pondération de scoring par défaut initialisés avec succès!");
    }

    private void createIfMissing(JobOffer.JobFamily family, JobOffer.SeniorityLevel level) {
        if (scoringWeightProfileRepository.findByJobFamilyAndSeniorityLevel(family, level).isEmpty()) {
            ScoringWeightProfile profile = new ScoringWeightProfile();
            profile.setJobFamily(family);
            profile.setSeniorityLevel(level);
            profile.setWeightTechnical(defaultWeightTechnical);
            profile.setWeightCommunication(defaultWeightCommunication);
            profile.setWeightSeniority(defaultWeightSeniority);
            profile.setUpdatedBy("system");
            scoringWeightProfileRepository.save(profile);
        }
    }
}
