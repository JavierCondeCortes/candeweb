import { Component } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-rules',
  imports: [TranslatePipe],
  templateUrl: './rules.html',
  styleUrl: './rules.css',
})
export class Rules {}
