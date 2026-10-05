import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

// Subida de imágenes a Supabase Storage (buckets públicos)
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly supabase = inject(SupabaseService);

  // Sube el archivo con un nombre único y devuelve su URL pública
  async subirImagen(bucket: string, archivo: File): Promise<string> {
    const extension = archivo.name.split('.').pop()?.toLowerCase() || 'jpg';
    const ruta = `${crypto.randomUUID()}.${extension}`;

    const storage = this.supabase.client.storage.from(bucket);
    const { error } = await storage.upload(ruta, archivo, {
      contentType: archivo.type,
      cacheControl: '31536000', // el nombre es único: se puede cachear un año
      upsert: false,
    });

    if (error) {
      throw error;
    }

    return storage.getPublicUrl(ruta).data.publicUrl;
  }
}