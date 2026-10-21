import Dexie, { type Table } from 'dexie';
import type { WallDoc } from '../model/types';

export interface AssetRecord {
  id: string;
  hash: string;
  name: string;
  mime: string;
  w: number;
  h: number;
  avgColor: string;
  original: Blob;
  previews: Record<string, Blob>;
  createdAt: number;
}

class GalleryDB extends Dexie {
  walls!: Table<WallDoc, string>;
  assets!: Table<AssetRecord, string>;
  constructor() {
    super('gallery-wall');
    this.version(1).stores({ walls: 'id, updatedAt', assets: 'id, hash' });
  }
}

export const db = new GalleryDB();
