// Tipos del intake conversacional de PREFORMA — compartidos entre page.tsx y
// components/AgentPanel.tsx (Bloque 1).
export type IntakeKind = 'texto' | 'numero' | 'mapa' | 'chips-single' | 'chips-multi'
export interface IntakeQuestion { key: string; kind: IntakeKind; pregunta: string; opciones?: { id: string; label: string }[] }
export interface ChatMsg { who: 'a' | 'u'; text: string }
