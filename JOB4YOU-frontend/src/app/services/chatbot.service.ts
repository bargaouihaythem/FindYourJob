import { environment } from "../../environments/environment";
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChatbotAskResponse, ChatbotGreetingResponse } from '../models/interfaces';

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private apiUrl = environment.apiUrl + '/chatbot';

  constructor(private http: HttpClient) {}

  greeting(): Observable<ChatbotGreetingResponse> {
    return this.http.get<ChatbotGreetingResponse>(`${this.apiUrl}/greeting`);
  }

  ask(message: string): Observable<ChatbotAskResponse> {
    return this.http.post<ChatbotAskResponse>(`${this.apiUrl}/ask`, { message });
  }
}
