import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { VentasService } from '../../../services/ventas';

@Component({
  selector: 'app-ventas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ventas.html',
  styleUrls: ['./ventas.css']
})
export class Ventas implements OnInit {
  productos: any[] = [];
  sucursales: any[] = [];
  inventarios: any[] = [];
  tallas: any[] = [];
  colores: any[] = [];
  
  cart: any[] = [];
  sucursalSeleccionada: number | null = null;
  productoSeleccionado: number | null = null;
  tallaSeleccionada: number | null = null;
  colorSeleccionado: number | null = null;
  cantidadSeleccionada: number = 1;
  
  isProcessing = false;
  ventaExitosa = false;
  
  metodoPago: string = 'Efectivo';
  tipoEntrega: string = 'Recojo en Tienda';
  direccionEnvio: string = '';
  
  showModalQR: boolean = false;
  showModalStripe: boolean = false;
  
  mockCardNumber: string = '';
  mockCardExp: string = '';
  mockCardCvc: string = '';

  constructor(
    private ventasService: VentasService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadData();
  }

  formatCardNumber(val: string) {
    let cleaned = val.replace(/\D/g, '');
    this.mockCardNumber = cleaned.match(/.{1,4}/g)?.join(' ') || '';
  }

  formatCardExp(val: string) {
    let cleaned = val.replace(/\D/g, '');
    if (cleaned.length >= 3) {
      this.mockCardExp = cleaned.substring(0, 2) + ' / ' + cleaned.substring(2, 4);
    } else if (cleaned.length === 2 && val.length > this.mockCardExp.length) {
      this.mockCardExp = cleaned + ' / ';
    } else {
      this.mockCardExp = cleaned;
    }
  }

  loadData() {
    // Cargar catálogos básicos
    forkJoin({
      productos: this.http.get<any[]>('http://34.230.18.9/api/v1/catalogo/productos'),
      tallas: this.http.get<any[]>('http://34.230.18.9/api/v1/catalogo/tallas'),
      colores: this.http.get<any[]>('http://34.230.18.9/api/v1/catalogo/colores'),
      sucursales: this.http.get<any[]>('http://34.230.18.9/api/v1/sucursales/sucursales'),
      inventarios: this.http.get<any[]>('http://34.230.18.9/api/v1/sucursales/inventarios')
    }).subscribe({
      next: (res: any) => {
      this.productos = res.productos;
      this.tallas = res.tallas;
      this.colores = res.colores;
      this.sucursales = res.sucursales;
      this.inventarios = res.inventarios;
      this.cdr.detectChanges();
    }, error: (err) => {
      console.error("Error loading data:", err);
    }});
  }

  getProductoNombre(id: number): string { return this.productos.find(p => p.id === id)?.nombre || ''; }
  getProductoPrecio(id: number): number { return this.productos.find(p => p.id === id)?.precio || 0; }
  getTalla(id: number): string { return this.tallas.find(t => t.id === id)?.nombre || ''; }
  getColor(id: number): string { return this.colores.find(c => c.id === id)?.nombre || ''; }

  getStockDisponible(): number {
    if (!this.sucursalSeleccionada || !this.productoSeleccionado || !this.tallaSeleccionada || !this.colorSeleccionado) return 0;
    
    const inv = this.inventarios.find(i => 
      i.sucursal_id === this.sucursalSeleccionada &&
      i.producto_id === this.productoSeleccionado &&
      i.talla_id === this.tallaSeleccionada &&
      i.color_id === this.colorSeleccionado
    );
    return inv ? inv.cantidad : 0;
  }

  addToCart() {
    if (!this.productoSeleccionado || !this.tallaSeleccionada || !this.colorSeleccionado) return;
    
    const stock = this.getStockDisponible();
    if (this.cantidadSeleccionada > stock) {
      alert("No hay suficiente stock en esta sucursal");
      return;
    }

    const precio = this.getProductoPrecio(this.productoSeleccionado);
    
    // Verificar si ya está en el carrito
    const idx = this.cart.findIndex(i => i.producto_id === this.productoSeleccionado && i.talla_id === this.tallaSeleccionada && i.color_id === this.colorSeleccionado);
    
    if (idx >= 0) {
      if (this.cart[idx].cantidad + this.cantidadSeleccionada > stock) {
         alert("Stock insuficiente para añadir más.");
         return;
      }
      this.cart[idx].cantidad += this.cantidadSeleccionada;
      this.cart[idx].subtotal = this.cart[idx].cantidad * precio;
    } else {
      this.cart.push({
        producto_id: this.productoSeleccionado,
        talla_id: this.tallaSeleccionada,
        color_id: this.colorSeleccionado,
        cantidad: this.cantidadSeleccionada,
        precio_unitario: precio,
        subtotal: precio * this.cantidadSeleccionada
      });
    }
    
    // Reset selections (except branch)
    this.productoSeleccionado = null;
    this.tallaSeleccionada = null;
    this.colorSeleccionado = null;
    this.cantidadSeleccionada = 1;
    this.cdr.detectChanges();
  }

  removeFromCart(index: number) {
    this.cart.splice(index, 1);
    this.cdr.detectChanges();
  }

  getTotal(): number {
    return this.cart.reduce((acc, item) => acc + item.subtotal, 0);
  }

  procesarVenta() {
    if (this.cart.length === 0 || !this.sucursalSeleccionada) return;
    
    if (this.tipoEntrega === 'Delivery' && (!this.direccionEnvio || this.direccionEnvio.trim() === '')) {
      alert("Por favor ingrese la dirección de envío para el Delivery.");
      return;
    }

    if (this.metodoPago === 'QR') {
      this.confirmarPagoQR();
      return;
    } else if (this.metodoPago === 'Stripe') {
      this.showModalStripe = true;
      this.cdr.detectChanges();
      return;
    }
    
    // Pago en Efectivo directo
    this.enviarVentaBackend('Efectivo', null);
  }

  qrUrl: string = '';
  qrTxId: string = '';
  pollingInterval: any;
  paymentSuccessQR: boolean = false;
  paymentSuccessStripe: boolean = false;

  confirmarPagoQR() {
    this.isProcessing = true;
    this.cdr.detectChanges();
    
    // Iniciar simulación real de QR:
    const payload = { amount: this.getTotal() };
    this.http.post<any>('http://34.230.18.9/api/v1/ventas/generar-qr', payload).subscribe({
      next: (res) => {
        this.qrUrl = res.qr_url;
        this.qrTxId = res.tx_id;
        this.showModalQR = true;
        this.paymentSuccessQR = false;
        this.isProcessing = false;
        this.cdr.detectChanges();
        
        // Empezar a "escuchar" si el banco nos dice que ya pagaron (Polling)
        this.pollingInterval = setInterval(() => {
          this.checkQRPaymentStatus();
        }, 2000);
      },
      error: (err) => {
        alert("Error al generar QR: " + (err.error?.detail || err.message));
        this.isProcessing = false;
        this.cdr.detectChanges();
      }
    });
  }

  checkQRPaymentStatus() {
    if (!this.qrTxId) return;
    
    this.http.get<any>(`http://34.230.18.9/api/v1/ventas/estado-pago-qr/${this.qrTxId}`).subscribe({
      next: (res) => {
        if (res.status === 'COMPLETED') {
          // El banco confirmó el pago! Detener polling y mostrar animación de éxito.
          clearInterval(this.pollingInterval);
          this.paymentSuccessQR = true;
          this.cdr.detectChanges();
          
          // Esperamos 2 segundos para que el usuario vea la animación y luego procesamos
          setTimeout(() => {
            this.enviarVentaBackend('QR', this.qrTxId);
            this.showModalQR = false;
            this.qrTxId = '';
            this.qrUrl = '';
            this.paymentSuccessQR = false;
            this.isVerifying = false;
          }, 2000);
        }
      }
    });
  }

  isVerifying: boolean = false;

  // --- BOTÓN SECRETO PARA LA DEFENSA DEL PROYECTO ---
  simularEscaneoCliente() {
    if (!this.qrTxId) return;
    this.isVerifying = true;
    this.cdr.detectChanges();
    this.http.post<any>(`http://34.230.18.9/api/v1/ventas/simular-pago-cliente/${this.qrTxId}`, {}).subscribe();
    // Esto hará que el próximo 'tick' del polling devuelva COMPLETED
  }

  cerrarModalQR() {
    this.showModalQR = false;
    this.isVerifying = false;
    this.paymentSuccessQR = false;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  confirmarPagoStripe() {
    if (!this.mockCardNumber || !this.mockCardExp || !this.mockCardCvc) {
      alert("Por favor ingrese los datos de la tarjeta.");
      return;
    }
    
    this.isProcessing = true;
    this.cdr.detectChanges();
    
    const payload = { amount: this.getTotal(), currency: 'bob' };
    
    this.http.post<any>('http://34.230.18.9/api/v1/ventas/create-payment-intent', payload).subscribe({
      next: (res) => {
        // Obtenemos el client_secret de la simulación
        const txId = res.client_secret;
        
        this.paymentSuccessStripe = true;
        this.cdr.detectChanges();
        
        setTimeout(() => {
          this.enviarVentaBackend('Stripe', txId);
          this.showModalStripe = false;
          this.paymentSuccessStripe = false;
        }, 2000);
      },
      error: (err) => {
        alert("Error en la pasarela de pago: " + (err.error?.detail || err.message));
        this.isProcessing = false;
        this.cdr.detectChanges();
      }
    });
  }

  private enviarVentaBackend(metodo: string, transaccion_id: string | null) {
    this.isProcessing = true;
    this.cdr.detectChanges();
    
    const payload = {
      sucursal_id: this.sucursalSeleccionada,
      usuario_id: 1, // Por ahora quemado hasta tener el AuthService
      metodo_pago: metodo,
      transaccion_id: transaccion_id,
      tipo_entrega: this.tipoEntrega,
      direccion_envio: this.direccionEnvio,
      detalles: this.cart
    };
    
    this.ventasService.crearVenta(payload).subscribe({
      next: (res: any) => {
        this.isProcessing = false;
        this.ventaExitosa = true;
        this.cart = [];
        this.mockCardNumber = '';
        this.mockCardExp = '';
        this.mockCardCvc = '';
        this.loadData(); // Refrescar inventario
        this.cdr.detectChanges();
        
        setTimeout(() => {
          this.ventaExitosa = false;
          this.cdr.detectChanges();
        }, 3000);
      },
      error: (err: any) => {
        alert("Error al procesar la venta: " + (err.error?.detail || err.message));
        this.isProcessing = false;
        this.cdr.detectChanges();
      }
    });
  }
}

