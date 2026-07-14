import { Component, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-hero',
  imports: [],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero implements OnInit {
variableTextoVisible = signal('');
textos = [
  'CANDEONATO NEW ERA',
  '[ 02 - SEPTIEMBRE - 2026 ]',
  'OTRO MENSAJE'
];

indiceTexto = 0;

ngOnInit(): void {
  this.escribirTexto(this.textos[this.indiceTexto]);
}

escribirTexto(textoFinal: string): void {
  let i = 0;
  this.variableTextoVisible.set('');

  const interval = setInterval(() => {
    this.variableTextoVisible.set(textoFinal.slice(0, i + 1));
    i++;

    if (i >= textoFinal.length) {
      clearInterval(interval);

      setTimeout(() => {
        this.borrarTexto(textoFinal);
      }, 1500);
    }
  }, 120);
}

borrarTexto(textoFinal: string): void {
  let i = textoFinal.length;

  const interval = setInterval(() => {
    this.variableTextoVisible.set(textoFinal.slice(0, i - 1));
    i--;

    if (i <= 0) {
      clearInterval(interval);
      this.indiceTexto = (this.indiceTexto + 1) % this.textos.length;
      this.escribirTexto(this.textos[this.indiceTexto]);
    }
  }, 80);
}
}
