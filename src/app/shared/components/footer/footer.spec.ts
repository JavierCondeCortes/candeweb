import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PublicContentService } from '../../../core/services/public-content.service';

import { Footer } from './footer';

describe('Footer', () => {
  let component: Footer;
  let fixture: ComponentFixture<Footer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [
        provideRouter([]),
        {
          provide: PublicContentService,
          useValue: {
            getSiteSettings: () =>
              of({
                featuredChampionship: null,
                twitchChannelUrl: 'https://www.twitch.tv/candemorracingteam',
                discordUrl: 'https://discord.gg/j22XuDEfMk',
                contactEmail: null,
              }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Footer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
