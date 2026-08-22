export interface TerminalActionState {
  message: string;
  status: 'ERROR' | 'IDLE' | 'SUCCESS';
}

export const initialTerminalActionState: TerminalActionState = {
  message: '',
  status: 'IDLE',
};
