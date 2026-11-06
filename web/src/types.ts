/** Shape of public/data/hybrid-system.json, written by notebooks/hybrid_system.ipynb. */
export type Metrics = Record<string, string | number>;

export interface Plate {
  width: number;
  depth: number;
  thickness: number;
  radius: number;
}

export interface Group {
  id: string;
  label: string;
  x: number;
  z: number;
  size: number;
  /** How far the tile floats above the plate. */
  height: number;
  metrics: Metrics;
}

export interface SystemNode {
  id: string;
  layer: "resource" | "hzero";
  group: string | null;
  x: number;
  z: number;
  active: boolean;
  metrics: Metrics;
}

export interface Link {
  from: string;
  to: string;
  /** Reveal order when the diagram scrolls into view. */
  step: number;
  active: boolean;
  /** 0..1, relative traffic. Drives the number of moving pulses. */
  flow: number;
  jobs: number;
}

export interface HybridSystem {
  generated_at: string;
  source: string;
  summary: Metrics;
  plate: Plate;
  groups: Group[];
  nodes: SystemNode[];
  links: Link[];
}
