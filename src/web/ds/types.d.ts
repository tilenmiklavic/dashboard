import type { ReactNode, ButtonHTMLAttributes } from 'react';

export type Tone = 'positive' | 'negative' | 'warning' | 'neutral';

export interface IconProps { name: string; size?: number; strokeWidth?: number; label?: string; className?: string }
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' | 'ghost' | 'outline'; size?: 'md' | 'sm'; icon?: string; iconOnly?: boolean }
export interface SelectOption { value: string; label: string }
export interface SelectProps { options: (string | SelectOption)[]; value?: string; onChange?: (value: string) => void; icon?: string; defaultOpen?: boolean; className?: string }
export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> { selected?: boolean; icon?: string; leading?: ReactNode }
export interface DeltaBadgeProps { value: string; tone?: Tone }
export interface StatusProps { status: 'healthy' | 'degraded' | 'down' | 'idle'; children?: ReactNode }
export interface StatCardProps { label: string; value: string; delta?: string; direction?: 'up' | 'down'; tone?: Tone; note?: string }
export interface CardProps { title?: string; description?: string; aside?: ReactNode; children?: ReactNode; className?: string }
export interface LegendProps { items: { label: string; color?: string }[] }
export interface LineChartProps { series: { data: number[]; tone?: 'accent' | 'muted' }[]; labels?: string[]; activeLabel?: number; yTicks?: string[]; min?: number; max?: number; marker?: { index: number; title?: string; value?: string }; height?: number }
export interface BarChartProps { data: number[]; highlight?: number[]; markers?: { index: number; pct?: string; label?: string; value?: string }[]; labels?: string[]; activeLabel?: number; max?: number; height?: number }
export interface GaugeProps { value: number; max?: number; display?: string; caption?: string; footerLabel?: string; footerValue?: string }
export interface SegmentBarProps { segments: { value: number; label?: string; color?: string }[] }
export type TableCell = string | ReactNode | { text: string; trend?: 'up' | 'down'; tone?: Tone; dot?: string };
export interface DataTableProps { columns: { key: string; label: string; mono?: boolean; align?: 'left' | 'right' }[]; rows: Record<string, TableCell>[] }
export interface DatePickerProps { year?: number; month?: number; start?: number; end?: number; presets?: string[]; onApply?: (range: { s: number | null; e: number | null }) => void; onCancel?: () => void }
export interface NavEntry { label?: string; icon?: string; href?: string; active?: boolean; section?: string }
export interface SidebarProps { brand?: string; items: NavEntry[]; footer?: NavEntry[] }
export interface ChatMessageProps { role: 'user' | 'assistant'; children: ReactNode; actions?: boolean }
export interface ComposerProps { placeholder?: string; mode?: string; busy?: boolean; onSubmit?: (text: string) => void }
