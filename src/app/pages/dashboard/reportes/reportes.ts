import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reportes.html',
  styleUrls: ['./reportes.css']
})
export class Reportes implements OnInit {
  reporte: any = null;
  isLoading = false;
  isSpeaking = false;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.cargarReporte();
  }

  cargarReporte() {
    this.isLoading = true;
    this.cdr.detectChanges();
    this.http.get<any>('http://34.230.18.9/api/v1/ventas/reportes').subscribe({
      next: (data) => {
        this.reporte = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error cargando reportes:', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  respuestaVoz: string | null = null;

  iniciarConsultaPorVoz() {
    if (!this.reporte) {
      alert("Primero espera a que se carguen los datos.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta comandos de voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this.isSpeaking = true; // Usaremos esta variable para cambiar la UI a "Escuchando..."
      this.respuestaVoz = null;
      this.cdr.detectChanges();
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f¿?.,!]/g, "");
      this.procesarConsulta(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Error en reconocimiento de voz:", event.error);
      this.isSpeaking = false;
      this.cdr.detectChanges();
    };

    recognition.onend = () => {
      this.isSpeaking = false;
      this.cdr.detectChanges();
    };

    recognition.start();
  }

  procesarConsulta(pregunta: string) {
    let respuesta = "No entendí la pregunta. Intenta preguntar por 'ingresos', 'ventas', 'ticket promedio' o métodos de pago como 'efectivo', 'qr' o 'stripe'.";

    if (pregunta.includes('ingreso') || pregunta.includes('dinero') || pregunta.includes('ganancia')) {
      respuesta = `Los ingresos totales son de Bs. ${this.reporte.total_ingresos}.`;
    } else if (pregunta.includes('ticket') || pregunta.includes('promedio')) {
      respuesta = `El ticket promedio es de Bs. ${this.reporte.ticket_promedio.toFixed(2)}.`;
    } else if (pregunta.includes('cuantas ventas') || pregunta.includes('total de ventas')) {
      respuesta = `Se han realizado un total de ${this.reporte.total_ventas} ventas.`;
    } else if (pregunta.includes('efectivo')) {
      respuesta = `Tienes ${this.reporte.ventas_por_metodo.Efectivo || 0} ventas pagadas en Efectivo.`;
    } else if (pregunta.includes('qr') || pregunta.includes('transferencia')) {
      respuesta = `Tienes ${this.reporte.ventas_por_metodo.QR || 0} ventas pagadas por QR.`;
    } else if (pregunta.includes('tarjeta') || pregunta.includes('stripe')) {
      respuesta = `Tienes ${this.reporte.ventas_por_metodo.Stripe || 0} ventas pagadas con Tarjeta (Stripe).`;
    }

    this.respuestaVoz = respuesta;
    this.cdr.detectChanges();
  }
}
