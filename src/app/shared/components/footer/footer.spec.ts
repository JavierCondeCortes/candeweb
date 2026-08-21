import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
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
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              url: [],
              children: [],
            },
          },
        },
        {
          provide: PublicContentService,
          useValue: {
            getSiteSettings: () =>
              of({
                twitchChannelUrl: 'https://www.twitch.tv/candemorracingteam',
                discordUrl: 'https://discord.gg/j22XuDEfMk',
                contactEmail: null,
                featuredChampionship: null,
              }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Footer);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links the shared footer to the private setups library', () => {
    const link = fixture.nativeElement.querySelector('a[href="/setups"]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.textContent?.trim()).toBeTruthy();
  });

  it('makes the Chiquito Spotter public landing visible', () => {
    const link = fixture.nativeElement.querySelector(
      'a[href="/chiquito-spotter"]',
    ) as HTMLAnchorElement;

    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Chiquito Spotter');
  });
});
