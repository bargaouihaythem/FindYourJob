package com.recrutement.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class RecrutementAppApplication {

    public static void main(String[] args) {
        SpringApplication.run(RecrutementAppApplication.class, args);
    }
}

