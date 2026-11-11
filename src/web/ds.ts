// Typed handles on the design system components (window.Dash, defined by /ds/bundle.js; props in ds/types.d.ts).
import type { FC } from 'react';
import type * as T from './ds/types';

const D = (window as any).Dash;

export const Sidebar = D.Sidebar as FC<T.SidebarProps>;
export const Select = D.Select as FC<T.SelectProps>;
export const StatCard = D.StatCard as FC<T.StatCardProps>;
export const Card = D.Card as FC<T.CardProps>;
export const Legend = D.Legend as FC<T.LegendProps>;
export const LineChart = D.LineChart as FC<T.LineChartProps>;
export const Gauge = D.Gauge as FC<T.GaugeProps>;
export const Status = D.Status as FC<T.StatusProps>;
export const DataTable = D.DataTable as FC<T.DataTableProps>;
export const Chip = D.Chip as FC<T.ChipProps>;
