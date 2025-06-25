package com.recrutement.app.config;

import com.recrutement.app.entity.Role;
import com.recrutement.app.repository.RoleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    @Autowired
    private RoleRepository roleRepository;

    @Override
    public void run(String... args) throws Exception {
        // Créer les rôles par défaut s'ils n'existent pas
        if (roleRepository.findByName(Role.ERole.ROLE_USER).isEmpty()) {
            roleRepository.save(new Role(Role.ERole.ROLE_USER));
        }

        if (roleRepository.findByName(Role.ERole.ROLE_HR).isEmpty()) {
            roleRepository.save(new Role(Role.ERole.ROLE_HR));
        }

        if (roleRepository.findByName(Role.ERole.ROLE_MANAGER).isEmpty()) {
            roleRepository.save(new Role(Role.ERole.ROLE_MANAGER));
        }

        if (roleRepository.findByName(Role.ERole.ROLE_ADMIN).isEmpty()) {
            roleRepository.save(new Role(Role.ERole.ROLE_ADMIN));
        }

        System.out.println("Rôles par défaut initialisés avec succès!");
    }
}

