import { Component, effect, ElementRef, inject, viewChild } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ConfirmationService } from '../../../core/services/confirmation.service';

@Component({
  selector: 'app-confirmation-dialog',
  imports: [TranslatePipe],
  templateUrl: './confirmation-dialog.html',
  styleUrl: './confirmation-dialog.css',
})
export class ConfirmationDialog {
  readonly confirmation = inject(ConfirmationService);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private returnFocusTo: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const request = this.confirmation.state();
      if (!request) {
        const returnFocusTo = this.returnFocusTo;
        this.returnFocusTo = null;
        if (returnFocusTo) {
          queueMicrotask(() => {
            if (returnFocusTo.isConnected) returnFocusTo.focus();
          });
        }
        return;
      }
      const dialog = this.dialog()?.nativeElement;
      if (!dialog || dialog.open) return;
      queueMicrotask(() => {
        if (this.confirmation.state() === request && dialog.isConnected && !dialog.open) {
          const activeElement = dialog.ownerDocument.activeElement;
          this.returnFocusTo = activeElement instanceof HTMLElement ? activeElement : null;
          dialog.showModal();
        }
      });
    });
  }

  cancel(event?: Event): void {
    event?.preventDefault();
    this.confirmation.cancel();
  }

  confirm(): void {
    this.confirmation.accept();
  }

  closeIfStillPending(): void {
    if (this.confirmation.state()) this.confirmation.cancel();
  }

  backdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.confirmation.cancel();
  }
}
