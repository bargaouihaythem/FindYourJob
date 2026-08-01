package com.recrutement.app.config;

import com.recrutement.app.service.JobOfferService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Vérifie toutes les heures les offres ACTIVE dont la deadline est dépassée et les bascule en EXPIRED. */
@Component
public class JobOfferExpirationScheduler {

    private static final Logger log = LoggerFactory.getLogger(JobOfferExpirationScheduler.class);

    @Autowired
    private JobOfferService jobOfferService;

    @Scheduled(cron = "0 0 * * * *")
    public void expireOverdueJobOffers() {
        int count = jobOfferService.expireOverdueJobOffers();
        if (count > 0) {
            log.info("[JobOfferExpirationScheduler] {} offre(s) basculée(s) en EXPIRED (deadline dépassée)", count);
        }
    }
}
