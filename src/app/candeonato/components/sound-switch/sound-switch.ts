import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-sound-switch',
  imports: [],
  templateUrl: './sound-switch.html',
  styleUrl: './sound-switch.css',
})
export class SoundSwitch {
  @Input() muted = true;
  @Input() paused = false;
  @Input() viewingVideo = false;

  @Output() readonly soundToggle = new EventEmitter<void>();
  @Output() readonly playToggle = new EventEmitter<void>();
  @Output() readonly viewToggle = new EventEmitter<void>();
}
