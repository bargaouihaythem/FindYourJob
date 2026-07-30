package com.recrutement.app.dto;

import com.recrutement.app.entity.Department;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentResponse {

    private Long id;
    private String name;
    private String code;

    public DepartmentResponse(Department department) {
        this.id = department.getId();
        this.name = department.getName();
        this.code = department.getCode();
    }
}
