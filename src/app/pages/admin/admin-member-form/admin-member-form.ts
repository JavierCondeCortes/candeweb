import { DatePipe } from '@angular/common';
import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { HasPendingChanges } from '../../../core/guards/pending-changes.guard';
import { MemberStatus, TeamMemberContent } from '../../../core/models/content-admin.model';
import { AdminApiService } from '../../../core/services/admin-api.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import {
  apiErrorMessage,
  apiFieldErrors,
  clientFieldErrors,
  focusErrorSummary,
} from '../admin-form-errors';

@Component({
  selector: 'app-admin-member-form',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './admin-member-form.html',
})
export class AdminMemberForm implements OnInit, HasPendingChanges {
  private readonly api = inject(AdminApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly memberId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly errorMessage = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly saved = signal(false);
  readonly loadedUpdatedAt = signal('');
  readonly updatedByName = signal<string | null>(null);

  readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    slug: ['', [Validators.maxLength(100)]],
    alias: ['', [Validators.maxLength(50)]],
    roleLabel: ['', [Validators.maxLength(80)]],
    bio: ['', [Validators.maxLength(280)]],
    photoUrl: [''],
    photoAlt: ['', [Validators.maxLength(160)]],
    photoConsentConfirmed: [false],
    twitchUrl: [''],
    instagramUrl: [''],
    youtubeUrl: [''],
    xUrl: [''],
    discordUrl: [''],
    websiteUrl: [''],
    displayOrder: [0, [Validators.required, Validators.min(0)]],
    isFeatured: [false],
    isDemo: [false],
    status: this.formBuilder.nonNullable.control<MemberStatus>('draft'),
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.memberId.set(id);
    this.loading.set(true);
    this.api
      .getMember(id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: ({ member }) => {
          this.loadedUpdatedAt.set(member.updatedAt);
          this.updatedByName.set(member.updatedByName ?? null);
          this.form.reset(toMemberForm(member));
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
    this.fieldErrors.set({});
    if (this.form.invalid) {
      this.errorMessage.set(this.i18n.translate('admin.common.reviewFields'));
      this.fieldErrors.set(
        clientFieldErrors(
          this.form,
          {
            name: this.i18n.translate('admin.memberForm.name').replace(' *', ''),
            slug: this.i18n.translate('admin.memberForm.slug'),
            alias: this.i18n.translate('admin.memberForm.alias'),
            roleLabel: this.i18n.translate('admin.memberForm.role'),
            bio: this.i18n.translate('admin.memberForm.description'),
            photoAlt: this.i18n.translate('admin.common.alternativeText'),
            displayOrder: this.i18n.translate('admin.common.order'),
          },
          (key, params) => this.i18n.translate(key, params),
        ),
      );
      focusErrorSummary('member-form-error');
      return;
    }
    if (this.saving()) return;

    this.saving.set(true);
    const input = this.form.getRawValue();
    const id = this.memberId();
    const request = id
      ? this.api.updateMember(id, { ...input, updatedAt: this.loadedUpdatedAt() })
      : this.api.createMember(input);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: ({ member }) => {
        this.loadedUpdatedAt.set(member.updatedAt);
        this.updatedByName.set(member.updatedByName ?? null);
        this.saved.set(true);
        this.form.markAsPristine();
        void this.router.navigate(['/admin/miembros', member.id]);
      },
      error: (error) => {
        this.errorMessage.set(
          apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
            this.i18n.translate(key),
          ),
        );
        this.fieldErrors.set(apiFieldErrors(error));
        focusErrorSummary('member-form-error');
      },
    });
  }

  async chooseImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      this.errorMessage.set(this.i18n.translate('admin.memberForm.invalidImage'));
      focusErrorSummary('member-form-error');
      return;
    }
    this.uploading.set(true);
    this.errorMessage.set('');
    try {
      const request = await this.api.uploadImage(file, 'member', this.form.controls.photoAlt.value);
      request.pipe(finalize(() => this.uploading.set(false))).subscribe({
        next: ({ asset }) => this.form.controls.photoUrl.setValue(asset.publicUrl),
        error: (error) => {
          this.errorMessage.set(
            apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
              this.i18n.translate(key),
            ),
          );
          focusErrorSummary('member-form-error');
        },
      });
    } catch (error) {
      this.uploading.set(false);
      this.errorMessage.set(
        apiErrorMessage(error, this.i18n.translate('admin.common.operationFailed'), (key) =>
          this.i18n.translate(key),
        ),
      );
      focusErrorSummary('member-form-error');
    }
  }

  hasPendingChanges(): boolean {
    return this.form.dirty && !this.saved();
  }

  @HostListener('window:beforeunload', ['$event'])
  warnBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasPendingChanges()) event.preventDefault();
  }
}

function toMemberForm(member: TeamMemberContent) {
  return {
    name: member.name,
    slug: member.slug,
    alias: member.alias ?? '',
    roleLabel: member.roleLabel ?? '',
    bio: member.bio ?? '',
    photoUrl: member.photoUrl ?? '',
    photoAlt: member.photoAlt ?? '',
    photoConsentConfirmed: member.photoConsentConfirmed ?? false,
    twitchUrl: member.twitchUrl ?? '',
    instagramUrl: member.instagramUrl ?? '',
    youtubeUrl: member.youtubeUrl ?? '',
    xUrl: member.xUrl ?? '',
    discordUrl: member.discordUrl ?? '',
    websiteUrl: member.websiteUrl ?? '',
    displayOrder: member.displayOrder,
    isFeatured: member.isFeatured,
    isDemo: member.isDemo,
    status: member.status,
  };
}
