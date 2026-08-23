import { Injectable, signal } from '@angular/core';

export type ConfirmationTone = 'warning' | 'danger';

export interface ConfirmationOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  tone?: ConfirmationTone;
}

export interface ConfirmationState extends ConfirmationOptions {
  tone: ConfirmationTone;
}

@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private readonly stateSignal = signal<ConfirmationState | null>(null);
  private resolver: ((confirmed: boolean) => void) | null = null;

  readonly state = this.stateSignal.asReadonly();

  confirm(options: ConfirmationOptions): Promise<boolean> {
    this.finish(false);
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
      this.stateSignal.set({ ...options, tone: options.tone ?? 'warning' });
    });
  }

  accept(): void {
    this.finish(true);
  }

  cancel(): void {
    this.finish(false);
  }

  private finish(confirmed: boolean): void {
    const resolver = this.resolver;
    this.resolver = null;
    this.stateSignal.set(null);
    resolver?.(confirmed);
  }
}
