import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, finalize } from 'rxjs';
import {
  ChampionshipContent,
  SiteSettings,
  TwitchChannelSetting,
} from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import {
  apiErrorMessage,
  apiFieldErrors,
  clientFieldErrors,
  focusErrorSummary,
} from '../admin-form-errors';

const DEFAULT_CHIQUITO_SPOTTER_URL =
  'https://www.patreon.com/candemor/posts/chiquitito-151646382';

@Component({
  selector: 'app-admin-settings',
  imports: [DatePipe, ReactiveFormsModule, TranslatePipe],
  templateUrl: './admin-settings.html',
})
export class AdminSettings implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18n = inject(I18nService);

  readonly championships = signal<ChampionshipContent[]>([]);
  readonly current = signal<SiteSettings | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly message = signal('');
  readonly errorMessage = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});

  readonly form = this.formBuilder.nonNullable.group({
    twitchChannelLogin: ['', [Validators.required]],
    twitchChannelUrl: ['', [Validators.required]],
    twitchChannelsText: [''],
    featuredChampionshipId: [''],
    chiquitoSpotterUrl: ['', [Validators.required]],
    contactEmail: ['', [Validators.email]],
    discordUrl: [''],
    instagramUrl: [''],
    youtubeUrl: [''],
  });

  ngOnInit(): void {
    forkJoin({ settings: this.api.getSettings(), championships: this.api.getChampionships() })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ settings, championships }) => {
          this.current.set(settings.settings);
          this.championships.set(
            championships.championships.filter((championship) => championship.status !== 'draft'),
          );
          this.form.reset({
            twitchChannelLogin: settings.settings.twitchChannelLogin,
            twitchChannelUrl: settings.settings.twitchChannelUrl,
            twitchChannelsText: (settings.settings.twitchChannels ?? [])
              .filter((channel) => channel.login !== settings.settings.twitchChannelLogin)
              .sort((left, right) => left.priority - right.priority)
              .map((channel) => channel.login)
              .join('\n'),
            featuredChampionshipId: settings.settings.featuredChampionshipId ?? '',
            chiquitoSpotterUrl:
              settings.settings.chiquitoSpotterUrl ?? DEFAULT_CHIQUITO_SPOTTER_URL,
            contactEmail: settings.settings.contactEmail ?? '',
            discordUrl: settings.settings.discordUrl ?? '',
            instagramUrl: settings.settings.instagramUrl ?? '',
            youtubeUrl: settings.settings.youtubeUrl ?? '',
          });
          this.form.markAsPristine();
        },
        error: (error) =>
          this.errorMessage.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          ),
      });
  }

  save(): void {
    this.form.markAllAsTouched();
    this.errorMessage.set('');
    this.message.set('');
    this.fieldErrors.set({});
    if (this.form.invalid) {
      this.errorMessage.set(this.i18n.translate('admin.common.reviewFields'));
      this.fieldErrors.set(
        clientFieldErrors(
          this.form,
          {
            twitchChannelLogin: this.i18n.translate('admin.settings.channelLogin'),
            twitchChannelUrl: this.i18n.translate('admin.settings.channelUrl'),
            chiquitoSpotterUrl: this.i18n.translate('admin.settings.spotterUrl'),
            contactEmail: this.i18n.translate('admin.settings.email'),
          },
          (key, params) => this.i18n.translate(key, params),
        ),
      );
      focusErrorSummary('settings-form-error');
      return;
    }
    if (this.saving()) return;
    const value = this.form.getRawValue();
    const additionalChannels = parseAdditionalTwitchChannels(
      value.twitchChannelsText,
      value.twitchChannelLogin,
      (key, params) => this.i18n.translate(key, params),
    );
    if (additionalChannels.error) {
      this.errorMessage.set(this.i18n.translate('admin.common.reviewFields'));
      this.fieldErrors.set({ twitchChannels: additionalChannels.error });
      focusErrorSummary('settings-form-error');
      return;
    }
    const settings: SiteSettings = {
      twitchChannelLogin: value.twitchChannelLogin,
      twitchChannelUrl: value.twitchChannelUrl,
      twitchChannels: [
        {
          login: value.twitchChannelLogin.trim().toLowerCase(),
          url: value.twitchChannelUrl,
          isOfficial: true,
          priority: 0,
        },
        ...additionalChannels.channels,
      ],
      featuredChampionshipId: value.featuredChampionshipId || null,
      chiquitoSpotterUrl: value.chiquitoSpotterUrl,
      contactEmail: value.contactEmail || null,
      discordUrl: value.discordUrl || null,
      instagramUrl: value.instagramUrl || null,
      youtubeUrl: value.youtubeUrl || null,
      updatedAt: this.current()?.updatedAt ?? '',
      updatedByName: this.current()?.updatedByName ?? null,
    };
    this.saving.set(true);
    this.api
      .updateSettings(settings)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: ({ settings: updated }) => {
          this.current.set(updated);
          this.form.markAsPristine();
          this.message.set(this.i18n.translate('admin.settings.saved'));
        },
        error: (error) => {
          this.errorMessage.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          );
          this.fieldErrors.set(apiFieldErrors(error));
          focusErrorSummary('settings-form-error');
        },
      });
  }
}

function parseAdditionalTwitchChannels(
  value: string,
  primaryLogin: string,
  translate: (key: string, params?: Record<string, string>) => string,
): { channels: TwitchChannelSetting[]; error: string } {
  const entries = value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length > 5) {
    return { channels: [], error: translate('admin.settings.maxChannels') };
  }

  const channels: TwitchChannelSetting[] = [];
  const seen = new Set([primaryLogin.trim().toLowerCase()]);
  for (const entry of entries) {
    let login = entry.replace(/^@/, '').toLowerCase();
    if (/^https?:\/\//i.test(entry)) {
      try {
        const url = new URL(entry);
        const hostname = url.hostname.replace(/^www\./, '');
        if (url.protocol !== 'https:' || hostname !== 'twitch.tv') throw new Error();
        login = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase() ?? '';
      } catch {
        return {
          channels: [],
          error: translate('admin.settings.invalidTwitchUrl', { entry }),
        };
      }
    }
    if (!/^[a-z0-9_]{3,25}$/.test(login)) {
      return {
        channels: [],
        error: translate('admin.settings.invalidTwitchLogin', { entry }),
      };
    }
    if (seen.has(login)) {
      return {
        channels: [],
        error: translate('admin.settings.duplicateChannel', { login }),
      };
    }
    seen.add(login);
    channels.push({
      login,
      url: `https://www.twitch.tv/${login}`,
      isOfficial: false,
      priority: channels.length + 1,
    });
  }
  return { channels, error: '' };
}
