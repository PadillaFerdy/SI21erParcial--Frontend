import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth } from '../../../services/auth';

const API_URL = 'http://localhost:8000/api/v1';

@Component({
  selector: 'app-devoluciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './devoluciones.html',
  styleUrls: ['./devoluciones.css']
})
export class Devoluciones implements OnInit {
  devoluciones: any[] = [];
  repartidores: any[] = [];
  ventas: any[] = [];
  isLoading = true;

  nuevaDev = { venta_id: '', motivo: '', tipo_solicitud: 'Devolución', requiere_delivery: false };
  showModal = false;

  constructor(private auth: Auth, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.cargarDatos();
  }

  async cargarDatos() {
    this.isLoading = true;
    try {
      const token = this.auth.getToken();
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const devRes = await fetch(`${API_URL}/devoluciones/`, { headers });
      this.devoluciones = await devRes.json();

      const usuRes = await fetch(`${API_URL}/seguridad/usuarios`, { headers });
      const usuarios = await usuRes.json();
      this.repartidores = usuarios.filter((u: any) => u.rol.nombre === 'Repartidor');

      const ventRes = await fetch(`${API_URL}/ventas/`, { headers });
      this.ventas = await ventRes.json();
      
    } catch (e) {
      console.error(e);
    }
    this.isLoading = false;
    this.cdr.detectChanges();
  }

  async crearDevolucion() {
    if (!this.nuevaDev.venta_id || !this.nuevaDev.motivo) return;
    try {
      const token = this.auth.getToken();
      await fetch(`${API_URL}/devoluciones/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          venta_id: parseInt(this.nuevaDev.venta_id), 
          motivo: this.nuevaDev.motivo,
          tipo_solicitud: this.nuevaDev.tipo_solicitud,
          requiere_delivery: this.nuevaDev.requiere_delivery ? 1 : 0
        })
      });
      this.showModal = false;
      this.nuevaDev = { venta_id: '', motivo: '', tipo_solicitud: 'Devolución', requiere_delivery: false };
      this.cargarDatos();
      this.cdr.detectChanges();
    } catch (e) {
      console.error(e);
    }
  }

  async asignarRepartidor(devId: number, event: any) {
    const repId = event.target.value;
    if (!repId) return;
    
    try {
      const token = this.auth.getToken();
      const res = await fetch(`${API_URL}/delivery/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ devolucion_id: devId })
      });
      const delivery = await res.json();
      
      await fetch(`${API_URL}/delivery/${delivery.id}/asignar`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ repartidor_id: parseInt(repId) })
      });

      // Actualizar el estado de la devolución para que ya no salga "Pendiente"
      await fetch(`${API_URL}/devoluciones/${devId}/estado`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'En Proceso' })
      });
      
      alert('Repartidor asignado exitosamente');
      this.cargarDatos();
      this.cdr.detectChanges();
    } catch (e) {
      console.error(e);
    }
  }
}

