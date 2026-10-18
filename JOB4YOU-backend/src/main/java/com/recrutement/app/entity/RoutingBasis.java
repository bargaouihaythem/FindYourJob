package com.recrutement.app.entity;

/**
 * Comment le manager destinataire d'un dossier a été déterminé.
 * Ordre de priorité utilisé par ManagerRoutingService.resolve.
 */
public enum RoutingBasis {

    /** Manager désigné explicitement sur l'offre par le RH. */
    OFFER_MANAGER,

    /** Managers portant le département de l'offre. */
    DEPARTMENT,

    /** À défaut de département : managers portant la famille de métier de l'offre. */
    JOB_FAMILY,

    /** Dernier filet : e-mail libre saisi sur l'offre (comportement historique). */
    LEGACY_EMAIL,

    /**
     * Le RH a désigné le destinataire lui-même au moment de la transmission, au lieu de
     * laisser la chaîne structurelle décider : sert quand le département de l'offre est
     * mal rattaché ou quand plusieurs managers sont éligibles.
     */
    MANUAL,

    /** Rien n'a pu être résolu : la transmission doit être bloquée, pas silencieuse. */
    UNRESOLVED
}
