import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Catalogo } from '../../../services/catalogo';

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './productos.html',
  styleUrls: ['./productos.css']
})
export class Productos implements OnInit {
  productos: any[] = [];
  categorias: any[] = []; // Para llenar el select desplegable
  proveedores: any[] = [];
  colecciones: any[] = [];
  isLoading = false;
  
  // Modal state
  showModal = false;
  // Formulario
  nuevoProducto = {
    nombre: '',
    descripcion: '',
    precio: null as number | null,
    categoria_id: null as number | null,
    proveedor_id: null as number | null,
    coleccion_id: null as number | null,
    modelo_3d_url: '',
    imagen_url: ''
  };
  
  archivoImagen: File | null = null;
  archivoModelo: File | null = null;
  isUploading = false;
  
  editingId: number | null = null;
  isSaving = false;

  constructor(
    private catalogoService: Catalogo, 
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadProductos();
    this.loadCategorias();
    this.loadProveedores();
    this.loadColecciones();
  }

  loadProductos() {
    this.isLoading = true;
    this.cdr.detectChanges();
    this.catalogoService.getProductos().subscribe({
      next: (data) => {
        this.productos = data;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadCategorias() {
    this.catalogoService.getCategorias().subscribe({
      next: (data) => {
        this.categorias = data;
        this.cdr.detectChanges();
      }
    });
  }

  loadProveedores() {
    this.http.get<any[]>('http://localhost:8000/api/v1/catalogo/proveedores').subscribe(data => {
      this.proveedores = data;
      this.cdr.detectChanges();
    });
  }

  loadColecciones() {
    this.catalogoService.getColecciones().subscribe(data => {
      this.colecciones = data;
      this.cdr.detectChanges();
    });
  }

  getCategoriaNombre(id: number): string {
    const cat = this.categorias.find(c => c.id === id);
    return cat ? cat.nombre : 'Desconocida';
  }

  openModal() {
    this.nuevoProducto = {
      nombre: '',
      descripcion: '',
      precio: null,
      categoria_id: null,
      proveedor_id: null,
      coleccion_id: null,
      modelo_3d_url: '',
      imagen_url: ''
    };
    this.archivoImagen = null;
    this.archivoModelo = null;
    this.editingId = null;
    this.showModal = true;
    this.cdr.detectChanges();
  }

  editProducto(p: any) {
    this.editingId = p.id;
    this.nuevoProducto = {
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: p.precio,
      categoria_id: p.categoria_id,
      proveedor_id: p.proveedor_id,
      coleccion_id: p.coleccion_id,
      modelo_3d_url: p.modelo_3d_url || '',
      imagen_url: p.imagen_url || ''
    };
    this.archivoImagen = null;
    this.archivoModelo = null;
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal() {
    this.showModal = false;
    this.cdr.detectChanges();
  }

  onFileSelected(event: any, tipo: 'imagen' | 'modelo') {
    const file: File = event.target.files[0];
    if (file) {
      if (tipo === 'imagen') this.archivoImagen = file;
      if (tipo === 'modelo') this.archivoModelo = file;
    }
  }

  removeFile(tipo: 'imagen' | 'modelo') {
    if (tipo === 'imagen') {
      this.nuevoProducto.imagen_url = '';
      this.archivoImagen = null;
    } else {
      this.nuevoProducto.modelo_3d_url = '';
      this.archivoModelo = null;
    }
    this.cdr.detectChanges();
  }

  async uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    return new Promise((resolve, reject) => {
      this.http.post<any>('http://localhost:8000/api/v1/archivos/upload', formData).subscribe({
        next: (res) => resolve(res.url),
        error: (err) => reject(err)
      });
    });
  }

  async guardarProducto() {
    if (!this.nuevoProducto.nombre || !this.nuevoProducto.precio || !this.nuevoProducto.categoria_id) return;
    
    this.isSaving = true;
    this.isUploading = true;
    this.cdr.detectChanges();

    try {
      if (this.archivoImagen) {
        this.nuevoProducto.imagen_url = await this.uploadFile(this.archivoImagen);
      }
      if (this.archivoModelo) {
        this.nuevoProducto.modelo_3d_url = await this.uploadFile(this.archivoModelo);
      }
    } catch (error) {
      console.error("Error subiendo archivo:", error);
      alert("Hubo un error al subir los archivos");
      this.isSaving = false;
      this.isUploading = false;
      this.cdr.detectChanges();
      return;
    }

    this.isUploading = false;
    
    const payload = {
      ...this.nuevoProducto,
      modelo_3d_url: this.nuevoProducto.modelo_3d_url || null,
      imagen_url: this.nuevoProducto.imagen_url || null
    };

    if (this.editingId) {
      this.catalogoService.updateProducto(this.editingId, payload).subscribe({
        next: (res) => {
          this.isSaving = false;
          this.closeModal();
          this.loadProductos();
        },
        error: (err) => {
          console.error(err);
          this.isSaving = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.catalogoService.createProducto(payload).subscribe({
        next: (res) => {
          this.isSaving = false;
          this.closeModal();
          this.loadProductos();
        },
        error: (err) => {
          console.error(err);
          this.isSaving = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  deleteProducto(id: number) {
    if (confirm('¿Estás seguro de que deseas eliminar este producto?')) {
      this.catalogoService.deleteProducto(id).subscribe({
        next: () => {
          this.loadProductos();
        },
        error: (err) => {
          console.error('Error eliminando producto:', err);
        }
      });
    }
  }
}

