package com.recrutement.app.controller;

import com.recrutement.app.dto.DepartmentResponse;
import com.recrutement.app.repository.DepartmentRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@CrossOrigin(origins = "*", maxAge = 3600)
@RestController
@RequestMapping("/api/departments")
@Tag(name = "Departments", description = "API pour la gestion des départements")
public class DepartmentController {

    @Autowired
    private DepartmentRepository departmentRepository;

    @GetMapping
    @Operation(summary = "Lister les départements (R&D, 4YOU, QA, HRACCESS)")
    public ResponseEntity<List<DepartmentResponse>> getAllDepartments() {
        List<DepartmentResponse> response = departmentRepository.findAll().stream()
                .map(DepartmentResponse::new)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }
}
