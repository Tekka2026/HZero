/** Shape of data/models.json, written by notebooks/example_models.ipynb. */
export interface Part {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  /** Rotation around the vertical axis, radians. */
  ry?: number;
  /** 0..1, mapped to colour. */
  value?: number;
  [key: string]: unknown;
}

export interface Model {
  id: string;
  params: Record<string, unknown>;
  parts: Part[];
}

export interface ModelData {
  generated_at: string;
  source: string;
  models: Model[];
}
