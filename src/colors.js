// Surface colors for SAM masks and trade colors for jobs.
import { Hammer, Zap, Droplets, DoorOpen, Layers, Grid3x3, Paintbrush, Lamp, Rows3 } from 'lucide-react';

export const SURFACE = {
  wall: '#2ec4b6', floor: '#ffb547', ceiling: '#a78bfa', door: '#ff6b4a', window: '#5ab0ff', radiator: '#f472b6',
};

export const TRADE = {
  demolition: { color: '#8c6a5d', Icon: Hammer },
  electrician: { color: '#e0a800', Icon: Zap },
  plumber: { color: '#2f80ed', Icon: Droplets },
  windows_doors: { color: '#13a3a3', Icon: DoorOpen },
  plasterer: { color: '#b08968', Icon: Layers },
  tiler: { color: '#4c6ef5', Icon: Grid3x3 },
  painter: { color: '#e8552b', Icon: Paintbrush },
  ceiling: { color: '#8b7cf6', Icon: Lamp },
  floor: { color: '#d9822b', Icon: Rows3 },
};
