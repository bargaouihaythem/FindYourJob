import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InternalNoteService } from '../../services/internal-note.service';
import { InternalNote } from '../../models/interfaces';

@Component({
  selector: 'app-internal-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './internal-notes.component.html',
  styleUrl: './internal-notes.component.scss'
})
export class InternalNotesComponent implements OnChanges {
  @Input({ required: true }) candidateId!: number;

  notes: InternalNote[] = [];
  loading = false;
  newNoteContent = '';
  editingId: number | null = null;
  editingContent = '';

  constructor(private internalNoteService: InternalNoteService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['candidateId'] && this.candidateId) {
      this.loadNotes();
    }
  }

  loadNotes(): void {
    this.loading = true;
    this.internalNoteService.getNotesForCandidate(this.candidateId).subscribe({
      next: (notes: InternalNote[]) => {
        this.notes = notes;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Erreur lors du chargement des notes internes:', error);
        this.loading = false;
      }
    });
  }

  addNote(): void {
    if (!this.newNoteContent.trim()) return;

    this.internalNoteService.createNote(this.candidateId, this.newNoteContent.trim()).subscribe({
      next: (note: InternalNote) => {
        this.notes.unshift(note);
        this.newNoteContent = '';
      },
      error: (error: any) => console.error('Erreur lors de la création de la note:', error)
    });
  }

  startEdit(note: InternalNote): void {
    this.editingId = note.id;
    this.editingContent = note.content;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editingContent = '';
  }

  saveEdit(note: InternalNote): void {
    if (!this.editingContent.trim()) return;

    this.internalNoteService.updateNote(note.id, this.candidateId, this.editingContent.trim()).subscribe({
      next: (updated: InternalNote) => {
        note.content = updated.content;
        note.updatedAt = updated.updatedAt;
        this.cancelEdit();
      },
      error: (error: any) => console.error('Erreur lors de la modification de la note:', error)
    });
  }

  deleteNote(note: InternalNote): void {
    this.internalNoteService.deleteNote(note.id).subscribe({
      next: () => {
        this.notes = this.notes.filter(n => n.id !== note.id);
      },
      error: (error: any) => console.error('Erreur lors de la suppression de la note:', error)
    });
  }

  togglePin(note: InternalNote): void {
    this.internalNoteService.togglePin(note.id).subscribe({
      next: (updated: InternalNote) => {
        note.pinned = updated.pinned;
        this.notes = [...this.notes].sort((a, b) => Number(b.pinned) - Number(a.pinned));
      },
      error: (error: any) => console.error('Erreur lors de l\'épinglage de la note:', error)
    });
  }
}
