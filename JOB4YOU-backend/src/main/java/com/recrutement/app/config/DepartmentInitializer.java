package com.recrutement.app.config;

import com.recrutement.app.entity.Department;
import com.recrutement.app.repository.DepartmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DepartmentInitializer implements CommandLineRunner {

    @Autowired
    private DepartmentRepository departmentRepository;

    @Override
    public void run(String... args) throws Exception {
        createIfMissing("Recherche & Développement", "R&D");
        createIfMissing("4YOU", "4YOU");
        createIfMissing("Quality Assurance", "QA");
        createIfMissing("HRAccess", "HRACCESS");

        System.out.println("Départements par défaut initialisés avec succès!");
    }

    private void createIfMissing(String name, String code) {
        if (departmentRepository.findByCode(code).isEmpty()) {
            departmentRepository.save(new Department(name, code));
        }
    }
}
