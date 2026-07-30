package com.recrutement.app.service;

import com.recrutement.app.dto.InternalNoteRequest;
import com.recrutement.app.dto.InternalNoteResponse;
import com.recrutement.app.entity.InternalNote;
import com.recrutement.app.exception.ResourceNotFoundException;
import com.recrutement.app.repository.InternalNoteRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class InternalNoteService {

    @Autowired
    private InternalNoteRepository internalNoteRepository;

    @Transactional
    public InternalNoteResponse createNote(InternalNoteRequest request, String createdBy) {
        InternalNote note = new InternalNote();
        note.setCandidateId(request.getCandidateId());
        note.setContent(request.getContent());
        note.setCreatedBy(createdBy);

        InternalNote saved = internalNoteRepository.save(note);
        return new InternalNoteResponse(saved);
    }

    public List<InternalNoteResponse> getNotesForCandidate(Long candidateId) {
        return internalNoteRepository.findByCandidateIdOrderByPinnedDescCreatedAtDesc(candidateId).stream()
                .map(InternalNoteResponse::new)
                .collect(Collectors.toList());
    }

    @Transactional
    public InternalNoteResponse updateNote(Long id, String content) {
        InternalNote note = internalNoteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Note interne non trouvée avec l'ID: " + id));
        note.setContent(content);
        InternalNote saved = internalNoteRepository.save(note);
        return new InternalNoteResponse(saved);
    }

    @Transactional
    public void deleteNote(Long id) {
        InternalNote note = internalNoteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Note interne non trouvée avec l'ID: " + id));
        internalNoteRepository.delete(note);
    }

    @Transactional
    public InternalNoteResponse togglePin(Long id) {
        InternalNote note = internalNoteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Note interne non trouvée avec l'ID: " + id));
        note.setPinned(!note.isPinned());
        InternalNote saved = internalNoteRepository.save(note);
        return new InternalNoteResponse(saved);
    }
}
