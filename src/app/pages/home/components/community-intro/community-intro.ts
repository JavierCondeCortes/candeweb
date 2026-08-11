import { Component, input } from '@angular/core';

type CommunityValue = {
  index: string;
  title: string;
  description: string;
};

@Component({
  selector: 'app-community-intro',
  templateUrl: './community-intro.html',
})
export class CommunityIntro {
  readonly discordUrl = input<string | null>(null);
  readonly values: readonly CommunityValue[] = [
    {
      index: '01',
      title: 'Competición limpia',
      description: 'La carrera importa, pero también cómo compartimos la pista.',
    },
    {
      index: '02',
      title: 'Compartir la experiencia',
      description: 'La actividad continúa en los directos, el contenido y la conversación.',
    },
    {
      index: '03',
      title: 'Comunidad primero',
      description: 'Creamos un paddock para aprender, competir y vivir cada carrera en compañía.',
    },
  ];
}
